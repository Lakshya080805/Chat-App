import Message from "../models/message.model.js";

export const toggleReactionOnMessage = async ({ messageId, userId, emoji }) => {
  if (!messageId || !userId || !emoji) return null;

  const message = await Message.findById(messageId);
  if (!message) return null;

  const normalizedUserId = String(userId);
  const existingReactionIndex = message.reactions.findIndex(
    (reaction) => String(reaction.userId) === normalizedUserId && reaction.emoji === emoji
  );

  if (existingReactionIndex >= 0) {
    message.reactions.splice(existingReactionIndex, 1);
  } else {
    message.reactions.push({
      userId,
      emoji,
    });
  }

  await message.save();
  return message;
};
