import express from "express";
import { protectRoute } from "../middlewear/auth.middlewear.js";
import {
  getUserChats,
  createGroupChat,
  addMemberToGroup,
  removeMemberFromGroup,
  leaveGroup,
  promoteMemberToAdmin,
  demoteMemberFromAdmin,
  updateGroupPhoto,
  generateInviteLink,
  joinViaInvite,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", getUserChats);
router.post("/groups", createGroupChat);
router.post("/:chatId/members", addMemberToGroup);
router.delete("/:chatId/members/:memberId", removeMemberFromGroup);
router.post("/:chatId/leave", leaveGroup);
router.post("/:chatId/admins", promoteMemberToAdmin);
router.delete("/:chatId/admins/:memberId", demoteMemberFromAdmin);
router.put("/:chatId/photo", updateGroupPhoto);
router.post("/:chatId/invite", generateInviteLink);
router.get("/invite/:code", joinViaInvite);

export default router;
