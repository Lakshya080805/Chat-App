import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Chat from "../models/chat.model.js";
import cloudinary from "../lib/cloudinary.js";

import { io } from "../lib/socket.js";
import { toggleReactionOnMessage } from "../services/message.service.js";

export const getUsersForSidebar=async(req,res)=>{
    try{
        const loggedInUserId=req.user._id;
        const filteredUsers=await User.find({_id:{$ne:loggedInUserId}}).select("-password")

        res.status(200).json(filteredUsers)
    }
    catch(error){
     console.log("error in getUsersForSidebar",error.message);
     res.status(500).json({error:"Internal server erro"});
    }
}

const getOrCreateDirectChat = async (userId, targetUserId) => {
  const existingChat = await Chat.findOne({
    isGroup: false,
    members: { $size: 2, $all: [userId, targetUserId] },
  });

  if (existingChat) return existingChat;

  const newChat = await Chat.create({
    isGroup: false,
    members: [userId, targetUserId],
    admins: [userId],
  });

  return newChat;
};

const resolveChatId = async (paramId, currentUserId) => {
  if (!paramId) return null;

  let chat = await Chat.findById(paramId);
  if (chat) return chat;

  chat = await getOrCreateDirectChat(currentUserId, paramId);
  return chat;
};

export const getMessages =async(req,res)=>{
    try{
        const {id:chatIdentifier}=req.params;
        const myId=req.user._id;
        const chat = await resolveChatId(chatIdentifier, myId);

        if(!chat){
          return res.status(404).json({error:"Chat not found"});
        }

        const messages=await Message.find({ chatId: chat._id }).sort({ createdAt: 1 });
        res.status(200).json(messages)
    }
    catch(error){
    console.log("error in getmessages controller",error.message);
    res.status(500).json({error:"internal server error"});
        }
}

export const sendMessage=async(req,res)=>{
    try{
      const {text,image}=req.body;
      const {id:chatIdentifier}=req.params;
      const senderId=req.user._id;

      let imageUrl;

      if(image){
        const uploadResponse=await cloudinary.uploader.upload(image);
        imageUrl=uploadResponse.secure_url;
      }

      const chat = await resolveChatId(chatIdentifier, senderId);
      if(!chat){
        return res.status(400).json({error:"Chat not found"});
      }

      const newMessage = new Message({
        senderId,
        chatId: chat._id,
        text,
        image: imageUrl,
      });

      await newMessage.save();
      await Chat.findByIdAndUpdate(chat._id, { updatedAt: new Date() });

      if (chat._id) {
        io.to(String(chat._id)).emit("message:new", newMessage);
      }

      res.status(200).json(newMessage);
    }
    catch(error){
      console.log("error in sendMessage controller",error.message);
      res.status(500).json({error:"internal server error"});
    }
}

export const toggleReaction=async(req,res)=>{
  try{
    const {messageId}=req.params;
    const {emoji}=req.body;
    const userId=req.user._id;

    if(!emoji || typeof emoji!=="string"){
      return res.status(400).json({error:"Emoji is required"});
    }

    const updatedMessage = await toggleReactionOnMessage({ messageId, userId, emoji });
    if(!updatedMessage){
      return res.status(404).json({error:"Message not found"});
    }
    const reactionRoom = updatedMessage.chatId ? String(updatedMessage.chatId) : null;
    if (reactionRoom) {
      io.to(reactionRoom).emit("reactionUpdated", updatedMessage);
    }
    res.status(200).json(updatedMessage);
  }
  catch(error){
    console.log("error in toggleReaction",error.message);
    res.status(500).json({error:"internal server error"});
  }
}
