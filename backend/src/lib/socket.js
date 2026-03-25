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
