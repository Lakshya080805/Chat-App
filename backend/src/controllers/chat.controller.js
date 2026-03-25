import mongoose from "mongoose";
import crypto from "crypto";

import Chat from "../models/chat.model.js";
import cloudinary from "../lib/cloudinary.js";
import { ensureUsersInRoom, removeUsersFromRoom, io } from "../lib/socket.js";

const { Types } = mongoose;

const sanitizeMemberIds = (memberIds = []) =>
  Array.isArray(memberIds) ? memberIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => String(id)) : [];

const isAdmin = (chat, userId) =>
  chat?.admins?.some((member) => String(member) === String(userId));

const attachMembersPayload = async (chat) => chat.populate("members", "fullName profilePic");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const INVITE_EXPIRY_MS = 24 * 60 * 60 * 1000;

const buildInviteLink = (inviteCode) => `${FRONTEND_URL}/invite/${inviteCode}`;

const generateInviteCode = () => crypto.randomBytes(24).toString("base64url");

const generateUniqueInviteCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const exists = await Chat.exists({ inviteCode: code });
    if (!exists) return code;
  }
  return `${generateInviteCode()}-${Date.now().toString(36)}`;
};

export const getUserChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const chats = await Chat.find({ members: userId })
      .sort({ updatedAt: -1 })
      .populate("members", "fullName profilePic");

    res.status(200).json({ chats });
  } catch (error) {
    console.error("getUserChats error", error?.message || error);
    res.status(500).json({ error: "Failed to load chats" });
  }
};

export const createGroupChat = async (req, res) => {
  try {
    const { name, memberIds = [], groupPhoto = "" } = req.body;
    const trimmedName = (name || "").trim();

    if (!trimmedName) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const uniqueMemberIds = new Set(sanitizeMemberIds(memberIds));
    uniqueMemberIds.add(String(req.user._id));
    const members = Array.from(uniqueMemberIds);

    const chat = await Chat.create({
      isGroup: true,
      name: trimmedName,
      groupPhoto: groupPhoto || "",
      members,
      admins: [req.user._id],
    });

    const populatedChat = await attachMembersPayload(chat);
    ensureUsersInRoom(members, chat._id);

    res.status(201).json(populatedChat);
  } catch (error) {
    console.error("createGroupChat error", error?.message || error);
    res.status(500).json({ error: "Failed to create group" });
  }
};

export const addMemberToGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { memberId } = req.body;

    if (!memberId || !Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ error: "Valid memberId is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!isAdmin(chat, req.user._id)) {
      return res.status(403).json({ error: "Only admins can add members" });
    }

    if (chat.members.some((member) => String(member) === String(memberId))) {
      return res.status(400).json({ error: "User is already a member" });
    }

    chat.members.push(memberId);
    await chat.save();

    const populatedChat = await attachMembersPayload(chat);
    ensureUsersInRoom([memberId], chat._id);

    res.status(200).json(populatedChat);
  } catch (error) {
    console.error("addMemberToGroup error", error?.message || error);
    res.status(500).json({ error: "Failed to add member" });
  }
};

export const removeMemberFromGroup = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;

    if (!memberId || !Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ error: "Valid memberId is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!isAdmin(chat, req.user._id)) {
      return res.status(403).json({ error: "Only admins can remove members" });
    }

    if (!chat.members.some((member) => String(member) === String(memberId))) {
      return res.status(400).json({ error: "User is not part of the group" });
    }

    chat.members = chat.members.filter((member) => String(member) !== String(memberId));
    chat.admins = chat.admins.filter((admin) => String(admin) !== String(memberId));

    if (!chat.admins.length && chat.members.length) {
      chat.admins = [chat.members[0]];
    }

    await chat.save();

    const populatedChat = await attachMembersPayload(chat);
    removeUsersFromRoom([memberId], chat._id);

    res.status(200).json(populatedChat);
  } catch (error) {
    console.error("removeMemberFromGroup error", error?.message || error);
    res.status(500).json({ error: "Failed to remove member" });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = String(req.user._id);

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!chat.members.some((member) => String(member) === userId)) {
      return res.status(400).json({ error: "You are not part of this group" });
    }

    chat.members = chat.members.filter((member) => String(member) !== userId);
    chat.admins = chat.admins.filter((admin) => String(admin) !== userId);

    if (!chat.members.length) {
      await chat.deleteOne();
      removeUsersFromRoom([userId], chat._id);
      return res.status(204).send();
    }

    if (!chat.admins.length) {
      chat.admins = [chat.members[0]];
    }

    await chat.save();

    const populatedChat = await attachMembersPayload(chat);
    removeUsersFromRoom([userId], chat._id);

    res.status(200).json(populatedChat);
  } catch (error) {
    console.error("leaveGroup error", error?.message || error);
    res.status(500).json({ error: "Failed to leave group" });
  }
};

export const promoteMemberToAdmin = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { memberId } = req.body;

    if (!memberId || !Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ error: "Valid memberId is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!isAdmin(chat, req.user._id)) {
      return res.status(403).json({ error: "Only admins can manage roles" });
    }

    if (!chat.members.some((member) => String(member) === String(memberId))) {
      return res.status(400).json({ error: "User must be a member to become admin" });
    }

    if (chat.admins.some((admin) => String(admin) === String(memberId))) {
      return res.status(400).json({ error: "User is already an admin" });
    }

    chat.admins.push(memberId);
    await chat.save();

    const populatedChat = await attachMembersPayload(chat);
    ensureUsersInRoom([memberId], chat._id);

    res.status(200).json(populatedChat);
  } catch (error) {
    console.error("promoteMemberToAdmin error", error?.message || error);
    res.status(500).json({ error: "Failed to promote member" });
  }
};

export const demoteMemberFromAdmin = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;

    if (!memberId || !Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ error: "Valid memberId is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!isAdmin(chat, req.user._id)) {
      return res.status(403).json({ error: "Only admins can manage roles" });
    }

    if (!chat.admins.some((admin) => String(admin) === String(memberId))) {
      return res.status(400).json({ error: "User is not an admin" });
    }

    if (String(memberId) === String(req.user._id) && chat.admins.length === 1) {
      return res.status(400).json({ error: "At least one admin must remain" });
    }

    chat.admins = chat.admins.filter((admin) => String(admin) !== String(memberId));
    await chat.save();

    const populatedChat = await attachMembersPayload(chat);
    removeUsersFromRoom([memberId], chat._id);

    res.status(200).json(populatedChat);
  } catch (error) {
    console.error("demoteMemberFromAdmin error", error?.message || error);
    res.status(500).json({ error: "Failed to demote admin" });
  }
};

export const updateGroupPhoto = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { image } = req.body;

    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "Image data is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!isAdmin(chat, req.user._id)) {
      return res.status(403).json({ error: "Only admins can update the group photo" });
    }

    const uploadResponse = await cloudinary.uploader.upload(image);
    chat.groupPhoto = uploadResponse.secure_url || chat.groupPhoto;
    await chat.save();

    const populatedChat = await attachMembersPayload(chat);
    res.status(200).json(populatedChat);
  } catch (error) {
    console.error("updateGroupPhoto error", error?.message || error);
    res.status(500).json({ error: "Failed to update group photo" });
  }
};

export const generateInviteLink = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!isAdmin(chat, userId)) {
      return res.status(403).json({ error: "Only admins can generate invite links" });
    }

    const inviteCode = await generateUniqueInviteCode();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

    chat.inviteCode = inviteCode;
    chat.inviteCodeExpiresAt = expiresAt;
    await chat.save();

    res.status(200).json({
      inviteCode,
      inviteLink: buildInviteLink(inviteCode),
      expiresAt,
      chatId: chat._id,
    });
  } catch (error) {
    console.error("generateInviteLink error", error?.message || error);
    res.status(500).json({ error: "Failed to generate invite link" });
  }
};

export const joinViaInvite = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = String(req.user._id);
    const isPreview =
      String(req.query.preview || "").toLowerCase() === "true" ||
      String(req.query.preview || "") === "1";

    if (!code) {
      return res.status(400).json({ error: "Invite code is required" });
    }

    const chat = await Chat.findOne({ inviteCode: code });
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Invite link is invalid" });
    }

    if (!chat.inviteCodeExpiresAt || new Date(chat.inviteCodeExpiresAt) < new Date()) {
      return res.status(410).json({ error: "Invite link has expired" });
    }

    if (isPreview) {
      return res.status(200).json({
        chatId: chat._id,
        name: chat.name,
        memberCount: chat.members.length,
        expiresAt: chat.inviteCodeExpiresAt,
        isMember: chat.members.some((member) => String(member) === userId),
      });
    }

    const alreadyMember = chat.members.some((member) => String(member) === userId);
    if (!alreadyMember) {
      chat.members.push(userId);
      await chat.save();
      ensureUsersInRoom([userId], chat._id);
      io.to(String(chat._id)).emit("chat:memberJoined", {
        chatId: chat._id,
        member: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
        memberCount: chat.members.length,
      });
    } else {
      ensureUsersInRoom([userId], chat._id);
    }

    const populatedChat = await attachMembersPayload(chat);
    res.status(200).json(populatedChat);
  } catch (error) {
    console.error("joinViaInvite error", error?.message || error);
    res.status(500).json({ error: "Failed to join group" });
  }
};
