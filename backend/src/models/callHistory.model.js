import mongoose from "mongoose";

const callHistorySchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
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
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    callType: {
      type: String,
      enum: ["audio", "video"],
      default: "video",
    },
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
      required: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const CallHistory = mongoose.model("CallHistory", callHistorySchema);

export default CallHistory;
