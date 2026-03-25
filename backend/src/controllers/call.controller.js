import crypto from "crypto";
import mongoose from "mongoose";

import Chat from "../models/chat.model.js";
import CallRoom from "../models/callRoom.model.js";
import CallHistory from "../models/callHistory.model.js";
import { io } from "../lib/socket.js";

const { Types } = mongoose;

const buildRoomId = (chatId) => `call_${chatId}_${crypto.randomBytes(6).toString("hex")}`;

const isMemberOfChat = (chat, userId) =>
  chat?.members?.some((member) => String(member) === String(userId));

const pickNextHost = (chat, participantIds = []) => {
  const participantSet = new Set(participantIds.map((id) => String(id)));
  const adminCandidate = (chat?.admins || []).find((adminId) =>
    participantSet.has(String(adminId))
  );
  if (adminCandidate) return adminCandidate;
  return participantIds[0] || null;
};

const updateChatCallState = async ({ chat, room, endedAt = null }) => {
  if (!chat) return;
  if (endedAt) {
    chat.activeCallRoomId = null;
    chat.activeCallType = null;
    chat.activeCallStartedAt = null;
    chat.activeCallEndedAt = endedAt;
  } else {
    chat.activeCallRoomId = room?.roomId || chat.activeCallRoomId;
    chat.activeCallType = room?.callType || chat.activeCallType;
    chat.activeCallStartedAt = chat.activeCallStartedAt || new Date();
    chat.activeCallEndedAt = null;
  }
  await chat.save();
};

const recordCallHistory = async ({ room, endedAt, endedBy }) => {
  if (!room || !endedAt) return;
  const startedAt = room.createdAt || new Date();
  const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  const participants = room.participantsEver?.length ? room.participantsEver : room.participants;

  await CallHistory.create({
    roomId: room.roomId,
    chatId: room.chatId,
    hostId: room.hostId,
    participants,
    callType: room.callType || "video",
    startedAt,
    endedAt,
    durationSeconds,
    endedBy: endedBy || null,
  });
};

export const getIceServers = async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return res.status(400).json({ message: "Twilio credentials not configured" });
    }

    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const tokenUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`;

    const twilioRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(),
    });

    if (!twilioRes.ok) {
      const errorText = await twilioRes.text();
      console.error("Twilio ICE token error:", errorText);
      return res.status(502).json({ message: "Failed to fetch ICE servers from Twilio" });
    }

    const data = await twilioRes.json();
    const rawIceServers = Array.isArray(data.ice_servers) ? data.ice_servers : [];

    // Twilio can return legacy `url` key; WebRTC expects `urls`.
    const iceServers = rawIceServers
      .map((server) => {
        const urls = server.urls || server.url;
        if (!urls) return null;

        const normalized = { urls };
        if (server.username) normalized.username = server.username;
        if (server.credential) normalized.credential = server.credential;
        return normalized;
      })
      .filter(Boolean);

    return res.status(200).json({ iceServers });
  } catch (error) {
    console.error("Error in getIceServers:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createLivekitToken = async (req, res) => {
  try {
    const { roomName } = req.body;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    console.log("LIVEKIT_URL", livekitUrl);

    if (!roomName) {
      return res.status(400).json({ message: "roomName is required" });
    }

    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.status(400).json({ message: "LiveKit environment variables not configured" });
    }

    const { AccessToken } = await import("livekit-server-sdk");

    const token = new AccessToken(apiKey, apiSecret, {
      identity: String(req.user._id),
      name: req.user.fullName || "User",
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    return res.status(200).json({
      token: await token.toJwt(),
      url: livekitUrl,
    });
  } catch (error) {
    console.error("Error in createLivekitToken:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createCallRoom = async (req, res) => {
  try {
    const { chatId, callType = "video" } = req.body;
    if (!chatId || !Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Valid chatId is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ message: "Group chat not found" });
    }

    if (!isMemberOfChat(chat, req.user._id)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const existingRoom = await CallRoom.findOne({ chatId, endedAt: null });
    if (existingRoom) {
      await updateChatCallState({ chat, room: existingRoom });
      return res.status(200).json(existingRoom);
    }

    const room = await CallRoom.create({
      roomId: buildRoomId(chatId),
      chatId,
      hostId: req.user._id,
      participants: [req.user._id],
      participantsEver: [req.user._id],
      callType: callType === "audio" ? "audio" : "video",
    });
    await updateChatCallState({ chat, room });
    io.to(String(chatId)).emit("call:room:create", {
      roomId: room.roomId,
      chatId: String(chatId),
      hostId: String(room.hostId),
    });

    return res.status(201).json(room);
  } catch (error) {
    console.error("Error in createCallRoom:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const joinCallRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({ message: "roomId is required" });
    }

    const room = await CallRoom.findOne({ roomId, endedAt: null });
    if (!room) {
      return res.status(404).json({ message: "Call room not found" });
    }

    const chat = await Chat.findById(room.chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ message: "Group chat not found" });
    }

    if (!isMemberOfChat(chat, req.user._id)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const alreadyParticipant = room.participants.some(
      (participant) => String(participant) === String(req.user._id)
    );

    if (!alreadyParticipant) {
      room.participants.push(req.user._id);
      if (!room.participantsEver?.some((p) => String(p) === String(req.user._id))) {
        room.participantsEver = [...(room.participantsEver || []), req.user._id];
      }
      await room.save();
      io.to(String(room.roomId)).emit("call:room:join", {
        roomId: room.roomId,
        chatId: String(room.chatId),
        userId: String(req.user._id),
      });
    }
    await updateChatCallState({ chat, room });

    return res.status(200).json(room);
  } catch (error) {
    console.error("Error in joinCallRoom:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const leaveCallRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({ message: "roomId is required" });
    }

    const room = await CallRoom.findOne({ roomId, endedAt: null });
    if (!room) {
      return res.status(404).json({ message: "Call room not found" });
    }

    const remainingParticipants = room.participants.filter(
      (participant) => String(participant) !== String(req.user._id)
    );

    room.participants = remainingParticipants;

    const chat = await Chat.findById(room.chatId);

    if (remainingParticipants.length === 0) {
      room.endedAt = new Date();
      if (chat) {
        await updateChatCallState({ chat, room, endedAt: room.endedAt });
        await recordCallHistory({ room, endedAt: room.endedAt, endedBy: req.user._id });
        io.to(String(chat._id)).emit("call:room:ended", {
          roomId: room.roomId,
          chatId: String(chat._id),
          endedBy: String(req.user._id),
        });
      }
    } else if (String(room.hostId) === String(req.user._id)) {
      const nextHost = pickNextHost(chat, remainingParticipants);
      if (nextHost) {
        room.hostId = nextHost;
        io.to(String(room.roomId)).emit("call:room:hostChanged", {
          roomId: room.roomId,
          chatId: String(room.chatId),
          hostId: String(room.hostId),
        });
      }
    }

    await room.save();
    if (chat && !room.endedAt) {
      await updateChatCallState({ chat, room });
    }
    io.to(String(room.roomId)).emit("call:room:leave", {
      roomId: room.roomId,
      chatId: String(room.chatId),
      userId: String(req.user._id),
    });
    return res.status(200).json(room);
  } catch (error) {
    console.error("Error in leaveCallRoom:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const endCallRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({ message: "roomId is required" });
    }

    const room = await CallRoom.findOne({ roomId, endedAt: null });
    if (!room) {
      return res.status(404).json({ message: "Call room not found" });
    }

    if (String(room.hostId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the host can end the call" });
    }

    room.endedAt = new Date();
    await room.save();
    const chat = await Chat.findById(room.chatId);
    if (chat) {
      await updateChatCallState({ chat, room, endedAt: room.endedAt });
      await recordCallHistory({ room, endedAt: room.endedAt, endedBy: req.user._id });
      io.to(String(chat._id)).emit("call:room:ended", {
        roomId: room.roomId,
        chatId: String(chat._id),
        endedBy: String(req.user._id),
      });
    }
    return res.status(200).json(room);
  } catch (error) {
    console.error("Error in endCallRoom:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getActiveCallRoom = async (req, res) => {
  try {
    const { chatId } = req.query;
    if (!chatId || !Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Valid chatId is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ message: "Group chat not found" });
    }

    if (!isMemberOfChat(chat, req.user._id)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const room = await CallRoom.findOne({ chatId, endedAt: null });
    if (!room) {
      return res.status(200).json(null);
    }

    await updateChatCallState({ chat, room });
    return res.status(200).json(room);
  } catch (error) {
    console.error("Error in getActiveCallRoom:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getCallHistory = async (req, res) => {
  try {
    const { chatId } = req.query;
    if (!chatId || !Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Valid chatId is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ message: "Group chat not found" });
    }

    if (!isMemberOfChat(chat, req.user._id)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const history = await CallHistory.find({ chatId })
      .sort({ endedAt: -1 })
      .limit(20);

    return res.status(200).json({ history });
  } catch (error) {
    console.error("Error in getCallHistory:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const livekitHealth = async (req, res) => {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    const missing = [];
    if (!apiKey) missing.push("LIVEKIT_API_KEY");
    if (!apiSecret) missing.push("LIVEKIT_API_SECRET");
    if (!livekitUrl) missing.push("LIVEKIT_URL");

    if (missing.length > 0) {
      return res.status(500).json({ ok: false, missing });
    }

    return res.status(200).json({
      ok: true,
      livekitUrl,
    });
  } catch (error) {
    console.error("Error in livekitHealth:", error.message);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
};
