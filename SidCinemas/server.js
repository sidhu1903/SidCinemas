import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fetch from "node-fetch"; // 👈 added for Redis REST API

const app = express();
const server = createServer(app);
const io = new Server(server);
app.use(express.static("public"));

// ---------------------------
// Redis helper functions 👇
// ---------------------------
async function saveRoom(code, data) {
  await fetch(`${process.env.UPSTASH_URL}/set/${code}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

async function getRoom(code) {
  const res = await fetch(`${process.env.UPSTASH_URL}/get/${code}`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_TOKEN}` },
  });
  const json = await res.json();
  return json.result ? JSON.parse(json.result) : null;
}

// ---------------------------
// Socket.IO main logic 👇
// ---------------------------
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", async () => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    const roomData = { videoType: null, videoData: null, users: [] };

    await saveRoom(code, roomData);
    socket.join(code);
    socket.emit("room-created", code);
    console.log("Room created:", code);
  });

  socket.on("join-room", async (code) => {
    const room = await getRoom(code);

    if (room) {
      socket.join(code);
      room.users.push(socket.id);
      await saveRoom(code, room);
      socket.emit("room-joined", code, room.videoType, room.videoData);
      socket.to(code).emit("new-user", socket.id);
      console.log("User joined:", code);
    } else {
      socket.emit("error", "Room not found");
      console.log("Join failed for code:", code);
    }
  });

  socket.on("set-video", async (code, type, data) => {
    const room = await getRoom(code);
    if (room) {
      room.videoType = type;
      room.videoData = data;
      await saveRoom(code, room);
      io.to(code).emit("video-set", type, data);
      console.log("Video set for room:", code);
    }
  });

  // WebRTC signaling
  socket.on("offer", (code, offer, toId) => io.to(toId).emit("offer", offer, socket.id));
  socket.on("answer", (code, answer, toId) => io.to(toId).emit("answer", answer, socket.id));
  socket.on("candidate", (code, candidate, toId) => io.to(toId).emit("candidate", candidate, socket.id));

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    // Optional: clean up user from rooms if needed
  });
});

server.listen(3000, () => console.log("🚀 SidCinemas server running on port 3000"));
