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

const SOCKET_DEBUG = String(process.env.DEBUG_WEBRTC || "false").toLowerCase() === "true";

const logSocketDebug = (...args) => {
  if (!SOCKET_DEBUG) return;
  console.log("[socket-debug]", ...args);
};

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

// Map of userId -> Set<socketId> so the same user can be connected on multiple devices/tabs.
const userSocketMap = {}; // { userId: Set<socketId> }

const getUserSocketIds = (userId) => {
  if (!userId) return [];
  const sockets = userSocketMap[userId];
  if (!sockets) return [];
  return Array.from(sockets);
};

// Backward-compatible helper used by message controller (first socket only).
export function getRecieverSocketId(userId) {
  return getUserSocketIds(userId)[0];
}

const emitToUser = (targetUserId, eventName, payload) => {
  const receiverSocketIds = getUserSocketIds(targetUserId);
  logSocketDebug("emitToUser", {
    eventName,
    targetUserId,
    receiverSocketCount: receiverSocketIds.length,
  });
  if (receiverSocketIds.length === 0) return false;

  receiverSocketIds.forEach((socketId) => {
    io.to(socketId).emit(eventName, payload);
  });

  return true;
};

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  // Socket.IO v4 clients commonly send auth payload; fallback to handshake.query for older code
  const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

  if (userId) {
    if (!userSocketMap[userId]) {
      userSocketMap[userId] = new Set();
    }
    userSocketMap[userId].add(socket.id);
    logSocketDebug("user socket added", {
      userId,
      socketId: socket.id,
      socketCount: userSocketMap[userId].size,
    });
  }

  // Relay WebRTC offer from caller -> callee
  socket.on("call-user", ({ to, offer, callType }) => {
    if (!to || !userId) return;
    logSocketDebug("recv call-user", {
      from: userId,
      to,
      callType,
      hasOffer: Boolean(offer),
    });

    emitToUser(to, "call-user", {
      from: userId,
      offer,
      callType,
    });
  });

  // Relay WebRTC answer from callee -> caller
  socket.on("answer-call", ({ to, answer }) => {
    if (!to || !userId) return;
    logSocketDebug("recv answer-call", {
      from: userId,
      to,
      hasAnswer: Boolean(answer),
    });

    emitToUser(to, "answer-call", {
      from: userId,
      answer,
    });
  });

  // Relay ICE candidates both directions
  socket.on("ice-candidate", ({ to, candidate }) => {
    if (!to || !userId) return;
    logSocketDebug("recv ice-candidate", {
      from: userId,
      to,
      candidateType: candidate?.type || candidate?.candidate,
    });

    emitToUser(to, "ice-candidate", {
      from: userId,
      candidate,
    });
  });

  // Notify remote peer that call ended/rejected
  socket.on("end-call", ({ to }) => {
    if (!to || !userId) return;
    logSocketDebug("recv end-call", { from: userId, to });

    emitToUser(to, "end-call", {
      from: userId,
    });
  });

  // broadcast current online users to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);

    if (userId && userSocketMap[userId]) {
      userSocketMap[userId].delete(socket.id);
      logSocketDebug("user socket removed", {
        userId,
        socketId: socket.id,
        socketCount: userSocketMap[userId].size,
      });
      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
        logSocketDebug("user offline", { userId });
      }
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io };