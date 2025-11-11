import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server);
app.use(express.static("public"));

let rooms = {};

io.on("connection", (socket) => {
  socket.on("create-room", () => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[code] = { videoType: null, videoData: null, users: [] };
    socket.join(code);
    rooms[code].users.push(socket.id);
    socket.emit("room-created", code);
  });

  socket.on("join-room", (code) => {
    if (rooms[code]) {
      socket.join(code);
      rooms[code].users.push(socket.id);
      socket.emit("room-joined", code, rooms[code].videoType, rooms[code].videoData);
      socket.to(code).emit("new-user", socket.id);
    } else {
      socket.emit("error", "Room not found");
    }
  });

  socket.on("set-video", (code, type, data) => {
    if (rooms[code]) {
      rooms[code].videoType = type;
      rooms[code].videoData = data;
      io.to(code).emit("video-set", type, data);
    }
  });

  // WebRTC signaling
  socket.on("offer", (code, offer, toId) => io.to(toId).emit("offer", offer, socket.id));
  socket.on("answer", (code, answer, toId) => io.to(toId).emit("answer", answer, socket.id));
  socket.on("candidate", (code, candidate, toId) => io.to(toId).emit("candidate", candidate, socket.id));

  socket.on("disconnect", () => {
    for (const c in rooms) {
      rooms[c].users = rooms[c].users.filter(u => u !== socket.id);
      if (rooms[c].users.length === 0) delete rooms[c];
    }
  });
});

server.listen(3000, () => console.log("🚀 Running on http://localhost:3000"));
