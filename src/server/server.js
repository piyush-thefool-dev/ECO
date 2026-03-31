/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ECO SIGNALING SERVER
   Role: A lightweight matchmaker. It introduces two browsers,
   relays their connection credentials, and then disconnects from
   the process. User files never touch this backend.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const path = require("path");
const os = require("os");

// OS UTILITY: Scans the host machine's network interfaces to find the active Wi-Fi IPv4 address.
// This allows mobile devices to connect via the local network instead of failing on localhost.
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let fallbackIP = "localhost";
  let preferredIP = null;

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();

    // Ignore virtual network adapters
    if (
      lowerName.includes("veth") ||
      lowerName.includes("vmware") ||
      lowerName.includes("virtual") ||
      lowerName.includes("wsl")
    ) {
      continue;
    }

    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        // Ignore standard VirtualBox Host-Only subnets
        if (iface.address.startsWith("192.168.56.")) {
          continue;
        }

        // Prioritize actual Wi-Fi adapters
        if (
          lowerName.includes("wi-fi") ||
          lowerName.includes("wifi") ||
          lowerName.includes("wlan")
        ) {
          preferredIP = iface.address;
        }

        // Store the first valid physical IP as a fallback
        if (fallbackIP === "localhost") {
          fallbackIP = iface.address;
        }
      }
    }
  }

  return preferredIP || fallbackIP;
}

// STATIC ROUTING: Configures Express to serve the frontend UI and client-side logic.
const root = path.join(__dirname, "../../");
app.use(express.static(root));
app.use(express.static(path.join(root, "public")));
app.use(express.static(path.join(root, "src/compression")));
app.use(express.static(path.join(root, "src/transport")));
app.use(express.static(path.join(root, "src/ui")));

const PORT = process.env.PORT || 3000;
const localIP = getLocalIP();

// API ENDPOINT: Exposes the hardware network IP so the frontend can generate valid mobile QR codes
app.get("/get-local-ip", (req, res) => {
  res.json({ ip: localIP, port: PORT });
});

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // ROOM ISOLATION: Groups users by their 4-letter share code.
  socket.on("join-room", (code) => {
    const room = io.sockets.adapter.rooms.get(code);
    const size = room ? room.size : 0;

    // SECURITY LIMIT: Enforce a strict 1-to-1 connection to prevent third-party snooping.
    if (size >= 2) {
      socket.emit("room-full");
      console.log(`⛔ ${socket.id} tried to join full room: ${code}`);
      return;
    }

    socket.join(code);
    socket.currentRoom = code;
    console.log(`🏠 ${socket.id} joined room: ${code} (size now: ${size + 1})`);

    // When the room hits 2 peers, trigger the WebRTC handshaking process.
    if (size === 1) {
      socket.emit("ready");
      socket.to(code).emit("peer-joined");
    }
  });

  // WEBRTC RELAY: The server acts as a blind relay for Session Description Protocol (SDP) payloads.
  // Once the browsers successfully process these, a direct P2P tunnel is opened.
  socket.on("offer", ({ code, data }) => socket.to(code).emit("offer", data));
  socket.on("answer", ({ code, data }) => socket.to(code).emit("answer", data));
  socket.on("ice-candidate", ({ code, data }) =>
    socket.to(code).emit("ice-candidate", data),
  );

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("peer-left");
    }
  });
});

// STARTUP: Output the dynamic local IP for easy testing across devices.
http.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`🚀 ECO Server is Live!`);
  console.log(`=========================================`);
  console.log(`💻 Local (This PC): http://localhost:${PORT}`);
  console.log(`📱 Network (Phone): http://${localIP}:${PORT}`);
  console.log(`=========================================\n`);
});
