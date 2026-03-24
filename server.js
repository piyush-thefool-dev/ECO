const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

// Serves index.html and other static files (style.css, script.js)
// without this, browser cannot load the app
app.use(express.static(__dirname));

// Checks for new peer and gives them unique id
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Room Manager - controls who can join which room
  // Each room has a unique code shared between 2 peers
  socket.on("join-room", (code) => {
    const room = io.sockets.adapter.rooms.get(code);
    const size = room ? room.size : 0;

    // Bouncer - blocks 3rd person from joining a full room
    if (size >= 2) {
      socket.emit("room-full");
      console.log(`${socket.id} tried to join full room: ${code}`);
      return;
    }

    // Adds peer to the room and remembers which room they are in
    socket.join(code);
    socket.currentRoom = code;
    console.log(`${socket.id} joined room: ${code} (size now: ${size + 1})`);

    // Starter/Trigger - fires when exactly 2 peers are in the room
    // tells both peers to start the WebRTC handshake
    if (size === 1) {
      socket.emit("ready");
      socket.to(code).emit("peer-joined");
    }
  });

  // Relay/Forwarder - passes WebRTC messages between peers in same room
  // server never reads the data, just passes it through
  socket.on("offer", ({ code, data }) => socket.to(code).emit("offer", data));
  socket.on("answer", ({ code, data }) => socket.to(code).emit("answer", data));
  socket.on("ice-candidate", ({ code, data }) =>
    socket.to(code).emit("ice-candidate", data),
  );

  // Cleanup - when a peer leaves, notify the other peer in the same room
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("peer-left");
    }
  });
});

// Starts the server on port 3000 (or environment port for deployment)
const PORT = process.env.PORT || 3000;
http.listen(PORT, () =>
  console.log(`Signaling server running on port ${PORT}`),
);
