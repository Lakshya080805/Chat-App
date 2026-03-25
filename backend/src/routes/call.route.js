import express from "express";
import { protectRoute } from "../middlewear/auth.middlewear.js";
import {
  getIceServers,
  createLivekitToken,
  createCallRoom,
  joinCallRoom,
  leaveCallRoom,
  endCallRoom,
  getActiveCallRoom,
  getCallHistory,
  livekitHealth,
} from "../controllers/call.controller.js";

const router = express.Router();

router.get("/ice-servers", protectRoute, getIceServers);
router.post("/livekit/token", protectRoute, createLivekitToken);
router.post("/rooms", protectRoute, createCallRoom);
router.post("/rooms/:roomId/join", protectRoute, joinCallRoom);
router.post("/rooms/:roomId/leave", protectRoute, leaveCallRoom);
router.post("/rooms/:roomId/end", protectRoute, endCallRoom);
router.get("/rooms/active", protectRoute, getActiveCallRoom);
router.get("/rooms/history", protectRoute, getCallHistory);
router.get("/health/livekit", protectRoute, livekitHealth);

export default router;
