import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

const applyOptimisticReaction = (messages, messageId, emoji, userId) => {
  const normalizedUserId = String(userId);
  return messages.map((message) => {
    if (message._id !== messageId) return message;
    const reactions = message.reactions ? [...message.reactions] : [];
    const existingReactionIndex = reactions.findIndex(
      (reaction) => String(reaction.userId) === normalizedUserId && reaction.emoji === emoji
    );

    if (existingReactionIndex >= 0) {
      reactions.splice(existingReactionIndex, 1);
    } else {
      reactions.push({ userId: normalizedUserId, emoji });
    }

    return { ...message, reactions };
  });
};

const updateMessageInList = (messages, updatedMessage) =>
  messages.map((message) => (message._id === updatedMessage._id ? updatedMessage : message));

const upsertChatIntoList = (chats, chat) => {
  if (!chat) return chats;
  const filtered = chats.filter((item) => item._id !== chat._id);
  return [chat, ...filtered];
};

const updateTypingList = (list = [], userId, isTyping) => {
  const normalized = list.filter((id) => id !== userId);
  if (isTyping) {
    normalized.push(userId);
  }
  return normalized;
};

export const useChatStore = create((set, get) => ({
  chats: [],
  selectedChat: null,
  messages: [],
  users: [],
  typingUsers: {},
  isChatsLoading: false,
  isMessagesLoading: false,
  isUsersLoading: false,

  getChats: async () => {
    set({ isChatsLoading: true });
    try {
      const res = await axiosInstance.get("/chats");
      set({ chats: res.data?.chats || [] });
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to load chats";
      toast.error(message);
    } finally {
      set({ isChatsLoading: false });
    }
  },

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to load users";
      toast.error(message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (chatId) => {
    if (!chatId) return;
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${chatId}`);
      set({ messages: res.data });
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to load messages";
      toast.error(message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedChat, messages } = get();
    if (!selectedChat) return;

    try {
      const res = await axiosInstance.post(`/messages/send/${selectedChat._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to send message";
      toast.error(message);
    }
  },

  toggleReaction: async ({ messageId, emoji, chatId }) => {
    const authUser = useAuthStore.getState().authUser;
    if (!authUser || !messageId || !emoji) return;

    const previousMessages = get().messages;
    const optimisticMessages = applyOptimisticReaction(previousMessages, messageId, emoji, authUser._id);
    set({ messages: optimisticMessages });

    let hasReverted = false;
    const revert = (errorMessage) => {
      if (hasReverted) return;
      hasReverted = true;
      set({ messages: previousMessages });
      if (errorMessage) {
        toast.error(errorMessage);
      }
    };

    const emitPayload = {
      messageId,
      emoji,
      chatId,
      userId: authUser._id,
    };

    const socket = useAuthStore.getState().socket;
    if (socket?.connected) {
      socket.emit("message:react", emitPayload, (response) => {
        if (response?.success === false) {
          revert(response.error || "Failed to update reaction");
        }
      });
      return;
    }

    try {
      await axiosInstance.post(`/messages/${messageId}/reactions`, { emoji, chatId });
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update reaction";
      revert(message);
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("message:new", (newMessage) => {
      const currentChatId = get().selectedChat?._id;
      if (!currentChatId || String(newMessage.chatId) !== String(currentChatId)) return;

      set((state) => {
        if (state.messages.some((message) => message._id === newMessage._id)) return state;
        return { messages: [...state.messages, newMessage] };
      });
    });

    socket.on("reactionUpdated", (updatedMessage) => {
      const currentChatId = get().selectedChat?._id;
      if (!currentChatId || String(updatedMessage.chatId) !== String(currentChatId)) return;

      set({ messages: updateMessageInList(get().messages, updatedMessage) });
    });

    socket.on("chat:typing", ({ chatId, userId, isTyping }) => {
      if (!chatId || !userId) return;
      set((state) => {
        const normalizedChatId = String(chatId);
        const existing = state.typingUsers[normalizedChatId] || [];
        const updatedList = updateTypingList(existing, userId, Boolean(isTyping));
        const updatedTypingUsers = { ...state.typingUsers };
        if (updatedList.length === 0) {
          delete updatedTypingUsers[normalizedChatId];
        } else {
          updatedTypingUsers[normalizedChatId] = updatedList;
        }
        return {
          typingUsers: updatedTypingUsers,
        };
      });
    });

    socket.on("chat:memberJoined", ({ chatId, member }) => {
      if (!chatId || !member?._id) return;
      set((state) => {
        const normalizedChatId = String(chatId);
        const updateChat = (chat) => {
          if (!chat || String(chat._id) !== normalizedChatId) return chat;
          const existingMembers = chat.members || [];
          const alreadyMember = existingMembers.some((m) => String(m._id) === String(member._id));
          if (alreadyMember) return chat;
          return { ...chat, members: [...existingMembers, member] };
        };

        return {
          chats: state.chats.map(updateChat),
          selectedChat: updateChat(state.selectedChat),
        };
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("message:new");
    socket.off("reactionUpdated");
    socket.off("chat:typing");
    socket.off("chat:memberJoined");
  },

  setSelectedChat: (selectedChat) => set({ selectedChat, messages: [] }),

  sendTypingStatus: ({ chatId, isTyping }) => {
    const authUser = useAuthStore.getState().authUser;
    const socket = useAuthStore.getState().socket;
    if (!authUser || !socket?.connected || !chatId) return;
    socket.emit("chat:typing", { chatId, isTyping: Boolean(isTyping) });
  },

  createGroup: async ({ name, memberIds = [] }) => {
    set({ isChatsLoading: true });
    try {
      const res = await axiosInstance.post("/chats/groups", { name, memberIds });
      const newChat = res.data;
      set((state) => ({
        chats: [newChat, ...state.chats.filter((chat) => chat._id !== newChat._id)],
        selectedChat: newChat,
        messages: [],
      }));
      await get().getChats();
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to create group";
      toast.error(message);
    } finally {
      set({ isChatsLoading: false });
    }
  },

  addMembersToGroup: async ({ memberIds = [] }) => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup || memberIds.length === 0) return;
    set({ isChatsLoading: true });
    try {
      let updatedChat = null;
      for (const memberId of memberIds) {
        const res = await axiosInstance.post(`/chats/${selectedChat._id}/members`, { memberId });
        updatedChat = res.data;
      }
      if (updatedChat) {
        set((state) => ({
          chats: upsertChatIntoList(state.chats, updatedChat),
          selectedChat: updatedChat,
        }));
        toast.success("Members added");
      }
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to add members";
      toast.error(message);
    } finally {
      set({ isChatsLoading: false });
    }
  },

  removeMemberFromGroup: async ({ memberId }) => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup || !memberId) return;
    set({ isChatsLoading: true });
    try {
      const res = await axiosInstance.delete(`/chats/${selectedChat._id}/members/${memberId}`);
      const updatedChat = res.data;
      if (updatedChat) {
        set((state) => ({
          chats: upsertChatIntoList(state.chats, updatedChat),
          selectedChat: updatedChat,
        }));
        toast.success("Member removed");
      }
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to remove member";
      toast.error(message);
    } finally {
      set({ isChatsLoading: false });
    }
  },

  promoteMemberToAdmin: async ({ memberId }) => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup || !memberId) return;
    set({ isChatsLoading: true });
    try {
      const res = await axiosInstance.post(`/chats/${selectedChat._id}/admins`, { memberId });
      const updatedChat = res.data;
      if (updatedChat) {
        set((state) => ({
          chats: upsertChatIntoList(state.chats, updatedChat),
          selectedChat: updatedChat,
        }));
        toast.success("Member promoted to admin");
      }
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to promote admin";
      toast.error(message);
    } finally {
      set({ isChatsLoading: false });
    }
  },

  demoteMemberFromAdmin: async ({ memberId }) => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup || !memberId) return;
    set({ isChatsLoading: true });
    try {
      const res = await axiosInstance.delete(`/chats/${selectedChat._id}/admins/${memberId}`);
      const updatedChat = res.data;
      if (updatedChat) {
        set((state) => ({
          chats: upsertChatIntoList(state.chats, updatedChat),
          selectedChat: updatedChat,
        }));
        toast.success("Member demoted from admin");
      }
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to demote admin";
      toast.error(message);
    } finally {
      set({ isChatsLoading: false });
    }
  },

  updateGroupPhoto: async ({ image }) => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup || !image) return;
    set({ isChatsLoading: true });
    try {
      const res = await axiosInstance.put(`/chats/${selectedChat._id}/photo`, { image });
      const updatedChat = res.data;
      if (updatedChat) {
        set((state) => ({
          chats: upsertChatIntoList(state.chats, updatedChat),
          selectedChat: updatedChat,
        }));
        toast.success("Updated group photo");
      }
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to update photo";
      toast.error(message);
    } finally {
      set({ isChatsLoading: false });
    }
  },

  leaveGroup: async () => {
    const { selectedChat } = get();
    if (!selectedChat?.isGroup) return;
    set({ isChatsLoading: true });
    try {
      const res = await axiosInstance.post(`/chats/${selectedChat._id}/leave`);
      if (res.status === 204) {
        set((state) => ({
          chats: state.chats.filter((chat) => chat._id !== selectedChat._id),
          selectedChat: null,
          messages: [],
        }));
        toast.success("Left the group");
        return;
      }
      const updatedChat = res.data;
      if (updatedChat) {
        set((state) => ({
          chats: upsertChatIntoList(state.chats, updatedChat),
          selectedChat: null,
          messages: [],
        }));
        toast.success("Left the group");
      }
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to leave group";
      toast.error(message);
    } finally {
      set({ isChatsLoading: false });
      get().getChats();
    }
  },

  generateInviteLink: async ({ chatId }) => {
    if (!chatId) return null;
    try {
      const res = await axiosInstance.post(`/chats/${chatId}/invite`);
      const payload = res.data || {};
      const origin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : "";
      const inviteLink =
        payload.inviteCode && origin
          ? `${origin}/invite/${payload.inviteCode}`
          : payload.inviteLink;
      return { ...payload, inviteLink };
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to generate invite link";
      toast.error(message);
      return null;
    }
  },

  previewInvite: async ({ code }) => {
    if (!code) return null;
    try {
      const res = await axiosInstance.get(`/chats/invite/${code}?preview=1`);
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to load invite";
      toast.error(message);
      return null;
    }
  },

  joinViaInvite: async ({ code }) => {
    if (!code) return null;
    try {
      const res = await axiosInstance.get(`/chats/invite/${code}`);
      const joinedChat = res.data;
      if (joinedChat) {
        set((state) => ({
          chats: upsertChatIntoList(state.chats, joinedChat),
          selectedChat: joinedChat,
          messages: [],
        }));
      }
      return joinedChat;
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to join group";
      toast.error(message);
      return null;
    }
  },

  shareInviteWithUsers: async ({ userIds = [], inviteLink }) => {
    if (!inviteLink || !Array.isArray(userIds) || userIds.length === 0) return false;
    try {
      for (const userId of userIds) {
        await axiosInstance.post(`/messages/send/${userId}`, {
          text: `Join my group: ${inviteLink}`,
        });
      }
      toast.success("Invite sent");
      return true;
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to send invite";
      toast.error(message);
      return false;
    }
  },
}));
