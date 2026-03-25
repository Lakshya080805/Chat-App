import mongoose from "mongoose";

const callRoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    callType: {
      type: String,
      enum: ["audio", "video"],
      default: "video",
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    participantsEver: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const CallRoom = mongoose.model("CallRoom", callRoomSchema);

export default CallRoom;
