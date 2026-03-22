const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

// Track the 2 connected users (new part)
let peers = [];

// Checks for new peer and gives them unique id
io.on("connection", (socket) => {
  peers.push(socket.id);
  console.log("User connected:", socket.id);

  // Starter/Trigger (Tell Peer A that Peer B has arrived) (new part)
  if (peers.length === 2) {
    io.emit("ready");
    // both peers now know to start WebRTC
  }

  // Relay/Forwarder (Pass messages between peers)
  socket.on("offer", (data) => socket.broadcast.emit("offer", data));
  socket.on("answer", (data) => socket.broadcast.emit("answer", data));
  socket.on("ice-candidate", (data) =>
    socket.broadcast.emit("ice-candidate", data),
  );

  // Cleanup (Remove peer when they leave) (new part)
  socket.on("disconnect", () => {
    peers = peers.filter((id) => id !== socket.id);
    console.log("User disconnected:", socket.id);
    socket.broadcast.emit("peer-left");
    // tell the other person
  });
});

http.listen(3000, () => console.log("Signaling server running on port 3000"));
