// import {Server} from "socket.io";
// import http from "http";
// import express from 'express';

// const app=express();
// const server=http.createServer(app);

// const io=new Server(server,{
//     cors:{
//         origin:["http://localhost:5173"]
//     },
// });

// export function getRecieverSocketId(userId){
//     return userSocketMap[userId];
// }

// const userSocketMap={}; //{userId:socketId}


// io.on("connection",(socket)=>{
//     console.log("A user connected", socket.id);

//     const userId=socket.handshake.query.userId
//     if(userId)userSocketMap[userId]=socket.id

//     // io.emit used to send events to all the connected clients
//     io.emit("getOnlineUsers",Object.keys(userSocketMap));

//     socket.on("disconnect",()=>{
//         console.log("A user disconnected",socket.id)
//         delete userSocketMap[userId];
//         io.emit("getOnlineUsers",Object.keys(userSocketMap));
//     })
// })
// export {io,app,server};

import { Server } from "socket.io";
import http from "http";
import express from "express";

export const app = express();
export const server = http.createServer(app);

// Allow localhost in development and FRONTEND_URL in production
const allowedOrigins = [
  "http://localhost:5173", // dev Vite origin
];

if (process.env.NODE_ENV === "production" && process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // allow requests with no origin (like server-to-server or tools)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Map of userId -> socketId (single socket per user). If you expect multiple sockets per user, switch to arrays.
const userSocketMap = {}; // { userId: socketId }

// Utility to get socket id by user id
export function getRecieverSocketId(userId) {
  return userSocketMap[userId];
}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  // Socket.IO v4 clients commonly send auth payload; fallback to handshake.query for older code
  const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

  if (userId) {
    // store mapping (if you need multiple sockets per user, make this an array push)
    userSocketMap[userId] = socket.id;
  }

  // broadcast current online users to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);

    // Safely remove the mapping only if it matches this socket id
    if (userId && userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io };