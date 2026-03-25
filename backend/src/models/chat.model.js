import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    isGroup: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    groupPhoto: {
      type: String,
      default: "",
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    activeCallRoomId: {
      type: String,
      default: null,
    },
    activeCallType: {
      type: String,
      enum: ["audio", "video", null],
      default: null,
    },
    activeCallStartedAt: {
      type: Date,
      default: null,
    },
    activeCallEndedAt: {
      type: Date,
      default: null,
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    inviteCodeExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;
