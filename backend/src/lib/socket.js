// // import {Server} from "socket.io";
// // import http from "http";
// // import express from 'express';

// // const app=express();
// // const server=http.createServer(app);

// // const io=new Server(server,{
// //     cors:{
// //         origin:["http://localhost:5173"]
// //     },
// // });

// // export function getRecieverSocketId(userId){
// //     return userSocketMap[userId];
// // }

// // const userSocketMap={}; //{userId:socketId}


// // io.on("connection",(socket)=>{
// //     console.log("A user connected", socket.id);

// //     const userId=socket.handshake.query.userId
// //     if(userId)userSocketMap[userId]=socket.id

// //     // io.emit used to send events to all the connected clients
// //     io.emit("getOnlineUsers",Object.keys(userSocketMap));

// //     socket.on("disconnect",()=>{
// //         console.log("A user disconnected",socket.id)
// //         delete userSocketMap[userId];
// //         io.emit("getOnlineUsers",Object.keys(userSocketMap));
// //     })
// // })
// // export {io,app,server};

// import { Server } from "socket.io";
// import http from "http";
// import express from "express";

// const SOCKET_DEBUG = String(process.env.DEBUG_WEBRTC || "false").toLowerCase() === "true";

// const logSocketDebug = (...args) => {
//   if (!SOCKET_DEBUG) return;
//   console.log("[socket-debug]", ...args);
// };

// export const app = express();
// export const server = http.createServer(app);

// // Allow localhost in development and FRONTEND_URL in production
// const allowedOrigins = [
//   "http://localhost:5173", // dev Vite origin
// ];

// if (process.env.NODE_ENV === "production" && process.env.FRONTEND_URL) {
//   allowedOrigins.push(process.env.FRONTEND_URL);
// }

// const io = new Server(server, {
//   cors: {
//     origin: (origin, callback) => {
//       // allow requests with no origin (like server-to-server or tools)
//       if (!origin) return callback(null, true);
//       if (allowedOrigins.includes(origin)) {
//         return callback(null, true);
//       }
//       return callback(new Error("Origin not allowed by CORS"));
//     },
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
// });

// // Map of userId -> Set<socketId> so the same user can be connected on multiple devices/tabs.
// const userSocketMap = {}; // { userId: Set<socketId> }

// const getUserSocketIds = (userId) => {
//   if (!userId) return [];
//   const sockets = userSocketMap[userId];
//   if (!sockets) return [];
//   return Array.from(sockets);
// };

// // Backward-compatible helper used by message controller (first socket only).
// export function getRecieverSocketId(userId) {
//   return getUserSocketIds(userId)[0];
// }

// const emitToUser = (targetUserId, eventName, payload) => {
//   const receiverSocketIds = getUserSocketIds(targetUserId);
//   logSocketDebug("emitToUser", {
//     eventName,
//     targetUserId,
//     receiverSocketCount: receiverSocketIds.length,
//   });
//   if (receiverSocketIds.length === 0) return false;

//   receiverSocketIds.forEach((socketId) => {
//     io.to(socketId).emit(eventName, payload);
//   });

//   return true;
// };

// export const broadcastConversation = (message, eventName = "reactionUpdated") => {
//   const participantIds = new Set();
//   if (message.senderId) participantIds.add(String(message.senderId));
//   if (message.recieverId) participantIds.add(String(message.recieverId));

//   participantIds.forEach((userId) => emitToUser(userId, eventName, message));
// };

// io.on("connection", (socket) => {
//   console.log("A user connected", socket.id);

//   // Socket.IO v4 clients commonly send auth payload; fallback to handshake.query for older code
//   const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

//   if (userId) {
//     if (!userSocketMap[userId]) {
//       userSocketMap[userId] = new Set();
//     }
//     userSocketMap[userId].add(socket.id);
//     logSocketDebug("user socket added", {
//       userId,
//       socketId: socket.id,
//       socketCount: userSocketMap[userId].size,
//     });
//   }

//   // Relay WebRTC offer from caller -> callee
//   socket.on("call-user", ({ to, offer, callType }) => {
//     if (!to || !userId) return;
//     logSocketDebug("recv call-user", {
//       from: userId,
//       to,
//       callType,
//       hasOffer: Boolean(offer),
//     });

//     emitToUser(to, "call-user", {
//       from: userId,
//       offer,
//       callType,
//     });
//   });

//   // Relay WebRTC answer from callee -> caller
//   socket.on("answer-call", ({ to, answer }) => {
//     if (!to || !userId) return;
//     logSocketDebug("recv answer-call", {
//       from: userId,
//       to,
//       hasAnswer: Boolean(answer),
//     });

//     emitToUser(to, "answer-call", {
//       from: userId,
//       answer,
//     });
//   });

//   // Relay ICE candidates both directions
//   socket.on("ice-candidate", ({ to, candidate }) => {
//     if (!to || !userId) return;
//     logSocketDebug("recv ice-candidate", {
//       from: userId,
//       to,
//       candidateType: candidate?.type || candidate?.candidate,
//     });

//     emitToUser(to, "ice-candidate", {
//       from: userId,
//       candidate,
//     });
//   });

//   // Notify remote peer that call ended/rejected
//   socket.on("end-call", ({ to }) => {
//     if (!to || !userId) return;
//     logSocketDebug("recv end-call", { from: userId, to });

//     emitToUser(to, "end-call", {
//       from: userId,
//     });
//   });

//   // broadcast current online users to all connected clients
//   io.emit("getOnlineUsers", Object.keys(userSocketMap));

//   socket.on("disconnect", () => {
//     console.log("A user disconnected", socket.id);

//     if (userId && userSocketMap[userId]) {
//       userSocketMap[userId].delete(socket.id);
//       logSocketDebug("user socket removed", {
//         userId,
//         socketId: socket.id,
//         socketCount: userSocketMap[userId].size,
//       });
//       if (userSocketMap[userId].size === 0) {
//         delete userSocketMap[userId];
//         logSocketDebug("user offline", { userId });
//       }
//     }

//     io.emit("getOnlineUsers", Object.keys(userSocketMap));
//   });
// });

// export { io };


import { Server } from "socket.io";
import http from "http";
import express from "express";

import Chat from "../models/chat.model.js";
import { toggleReactionOnMessage } from "../services/message.service.js";

const SOCKET_DEBUG = String(process.env.DEBUG_WEBRTC || "false").toLowerCase() === "true";

const logSocketDebug = (...args) => {
  if (!SOCKET_DEBUG) return;
  console.log("[socket-debug]", ...args);
};

export const app = express();
export const server = http.createServer(app);

const allowedOrigins = ["http://localhost:5173"];
if (process.env.NODE_ENV === "production" && process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
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

const userSocketMap = {};

const getUserSocketIds = (userId) => {
  if (!userId) return [];
  const sockets = userSocketMap[userId];
  if (!sockets) return [];
  return Array.from(sockets);
};

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

const joinSocketToRoom = (socketId, roomId) => {
  const socketInstance = io.sockets.sockets.get(socketId);
  if (!socketInstance) return;
  socketInstance.join(roomId);
};

const joinUserSocketsToRoom = (userId, roomId) => {
  const socketIds = getUserSocketIds(userId);
  socketIds.forEach((socketId) => joinSocketToRoom(socketId, roomId));
};

const leaveUserSocketsFromRoom = (userId, roomId) => {
  const socketIds = getUserSocketIds(userId);
  socketIds.forEach((socketId) => {
    const socketInstance = io.sockets.sockets.get(socketId);
    if (!socketInstance) return;
    socketInstance.leave(roomId);
  });
};

const joinRoomsForExistingChats = async (socket, userId) => {
  if (!userId) return;
  try {
    const chats = await Chat.find({ members: userId }).select("_id");
    chats.forEach((chat) => {
      socket.join(String(chat._id));
    });
  } catch (error) {
    console.error("joinRoomsForExistingChats error", error?.message || error);
  }
};

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);
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
    joinRoomsForExistingChats(socket, userId);
  }

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

  socket.on("end-call", ({ to }) => {
    if (!to || !userId) return;
    logSocketDebug("recv end-call", { from: userId, to });

    emitToUser(to, "end-call", {
      from: userId,
    });
  });

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

  socket.on("message:react", async ({ messageId, emoji }, callback) => {
    if (!userId || !messageId || !emoji) {
      callback?.({ success: false, error: "Missing payload" });
      return;
    }

    try {
      const updatedMessage = await toggleReactionOnMessage({ messageId, userId, emoji });
      if (!updatedMessage) {
        callback?.({ success: false, error: "Message not found" });
        return;
      }
      const chatRoom = updatedMessage?.chatId ? String(updatedMessage.chatId) : null;
      if (chatRoom) {
        io.to(chatRoom).emit("reactionUpdated", updatedMessage);
      }
      callback?.({ success: true });
    } catch (error) {
      console.error("message:react error", error?.message || error);
      callback?.({ success: false, error: error?.message || "Failed to toggle reaction" });
    }
  });

  socket.on("chat:typing", ({ chatId, isTyping }) => {
    if (!userId || !chatId) return;
    const normalizedChatId = String(chatId);
    logSocketDebug("chat:typing", { chatId: normalizedChatId, userId, isTyping });
    socket.to(normalizedChatId).emit("chat:typing", {
      chatId: normalizedChatId,
      userId,
      isTyping: Boolean(isTyping),
    });
  });

  socket.on("call:room:create", ({ roomId, chatId }) => {
    if (!userId || !roomId || !chatId) return;
    const normalizedChatId = String(chatId);
    const normalizedRoomId = String(roomId);
    socket.join(normalizedRoomId);
    socket.to(normalizedChatId).emit("call:room:create", {
      roomId: normalizedRoomId,
      chatId: normalizedChatId,
      hostId: userId,
    });
  });

  socket.on("call:room:join", ({ roomId, chatId }) => {
    if (!userId || !roomId || !chatId) return;
    const normalizedRoomId = String(roomId);
    socket.join(normalizedRoomId);
    socket.to(normalizedRoomId).emit("call:room:join", {
      roomId: normalizedRoomId,
      chatId: String(chatId),
      userId,
    });
  });

  socket.on("call:room:leave", ({ roomId, chatId }) => {
    if (!userId || !roomId || !chatId) return;
    const normalizedRoomId = String(roomId);
    socket.leave(normalizedRoomId);
    socket.to(normalizedRoomId).emit("call:room:leave", {
      roomId: normalizedRoomId,
      chatId: String(chatId),
      userId,
    });
  });

  socket.on("call:room:ended", ({ roomId, chatId }) => {
    if (!userId || !roomId || !chatId) return;
    const normalizedRoomId = String(roomId);
    io.to(normalizedRoomId).emit("call:room:ended", {
      roomId: normalizedRoomId,
      chatId: String(chatId),
      endedBy: userId,
    });
  });
});

const normalizeUserIds = (userIds = []) =>
  Array.from(new Set(userIds.map((id) => (id ? String(id) : "")))).filter(Boolean);

export const ensureUsersInRoom = (userIds, chatId) => {
  if (!chatId) return;
  const normalizedRoomId = String(chatId);
  normalizeUserIds(userIds).forEach((userId) => joinUserSocketsToRoom(userId, normalizedRoomId));
};

export const removeUsersFromRoom = (userIds, chatId) => {
  if (!chatId) return;
  const normalizedRoomId = String(chatId);
  normalizeUserIds(userIds).forEach((userId) => leaveUserSocketsFromRoom(userId, normalizedRoomId));
};

export { io, emitToUser };
