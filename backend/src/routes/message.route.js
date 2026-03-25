import express from "express"
import { protectRoute } from "../middlewear/auth.middlewear.js";
import { getMessages, getUsersForSidebar, sendMessage,toggleReaction } from "../controllers/message.controller.js";

const router=express.Router();

router.get("/users",protectRoute,getUsersForSidebar)
router.get("/:id",protectRoute,getMessages)

router.post("/send/:id",protectRoute,sendMessage)
router.post("/:messageId/reactions",protectRoute,toggleReaction)

export default router;
