//     import { useChatStore } from "../store/useChatStore";
// import { useEffect, useRef } from "react";

// import ChatHeader from "./ChatHeader";
// import MessageInput from "./MessageInput";
// import MessageSkeleton from "./skeletons/MessageSkeleton";
// import { useAuthStore } from "../store/useAuthStore";
// import { formatMessageTime } from "../lib/utils";

// const REACTION_PICKER = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉", "🤝"];

// const ChatContainer = () => {
//   const {
//     messages,
//     getMessages,
//     isMessagesLoading,
//     selectedUser,
//     subscribeToMessages,
//     unsubscribeFromMessages,
//     toggleReaction,
//   } = useChatStore();
//   const { authUser } = useAuthStore();
//   const messageEndRef = useRef(null);

//   useEffect(() => {
//     if (!selectedUser) return;
//     getMessages(selectedUser._id);
//     subscribeToMessages();

//     return () => unsubscribeFromMessages();
//   }, [selectedUser?._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

//   useEffect(() => {
//     if (messageEndRef.current && messages) {
//       messageEndRef.current.scrollIntoView({ behavior: "smooth" });
//     }
//   }, [messages]);

//   if (isMessagesLoading) {
//     return (
//       <div className="flex-1 flex flex-col overflow-auto">
//         <ChatHeader />
//         <MessageSkeleton />
//         <MessageInput />
//       </div>
//     );
//   }

//   const getDisplayName = (userId) => {
//     const normalizedAuthUserId = authUser?._id ? String(authUser._id) : "";
//     if (normalizedAuthUserId && String(userId) === normalizedAuthUserId) {
//       return "You";
//     }
//     if (selectedUser && String(userId) === String(selectedUser._id)) {
//       return selectedUser.fullName || "Friend";
//     }
//     return "Friend";
//   };

//   return (
//     <div className="flex-1 flex flex-col overflow-auto">
//       <ChatHeader />
//       <div className="flex-1 overflow-y-auto p-4 space-y-4">
//         {messages.map((message) => {
//           const reactionGroups = (message.reactions || []).reduce((acc, reaction) => {
//             const bucket = acc[reaction.emoji] || [];
//             bucket.push(reaction);
//             acc[reaction.emoji] = bucket;
//             return acc;
//           }, {});
//           const reactionEntries = Object.entries(reactionGroups);

//           return (
//             <div
//               key={message._id}
//               className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
//               ref={messageEndRef}
//             >
//               <div className="chat-image avatar">
//                 <div className="size-10 rounded-full border">
//                   <img
//                     src={
//                       message.senderId === authUser._id
//                         ? authUser.profilePic || "/avatar.png"
//                         : selectedUser.profilePic || "/avatar.png"
//                     }
//                     alt="profile-pic"
//                   />
//                 </div>
//               </div>
//               <div className="chat-header mb-1">
//                 <time className="text-xs opacity-50 ml-1">{formatMessageTime(message.createdAt)}</time>
//               </div>
//               <div className="chat-bubble flex flex-col">
//                 {message.image && (
//                   <img
//                     src={message.image}
//                     alt="attachment"
//                     className="sm:max-w-[200px] rounded-md mb-2"
//                   />
//                 )}
//                 {message.text && <p>{message.text}</p>}

//                 {reactionEntries.length > 0 && (
//                   <div className="mt-2 flex flex-wrap items-center gap-2">
//                     {reactionEntries.map(([emoji, reactions]) => {
//                       const reactedByMe = reactions.some(
//                         (reaction) => String(reaction.userId) === String(authUser._id)
//                       );
//                       const tooltipNames = Array.from(
//                         new Set(reactions.map((reaction) => getDisplayName(reaction.userId)))
//                       ).join(", ");

//                       return (
//                         <div key={`${message._id}-${emoji}`} className="relative group">
//                           <button
//                             type="button"
//                             onClick={() => toggleReaction({ messageId: message._id, emoji })}
//                             className={`flex items-center gap-1 rounded-full border px-2 py-1 text-sm transition ${
//                               reactedByMe
//                                 ? "border-blue-400 bg-blue-50 text-blue-700"
//                                 : "border-transparent bg-base-200 text-base-content"
//                             }`}
//                           >
//                             <span className="text-lg">{emoji}</span>
//                             <span className="text-[10px] font-semibold">{reactions.length}</span>
//                           </button>
//                           <div className="pointer-events-none absolute -top-9 left-1/2 z-10 w-max -translate-x-1/2 rounded-md border border-zinc-300 bg-base-100 px-2 py-1 text-[11px] opacity-0 transition group-hover:opacity-100">
//                             {tooltipNames}
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 )}

//                 <div className="relative mt-2 group">
//                   <button
//                     type="button"
//                     className="btn btn-ghost btn-xs normal-case text-xs"
//                     aria-label="Add reaction"
//                   >
//                     + Add reaction
//                   </button>
//                   <div className="absolute -top-16 left-0 z-10 flex gap-1 rounded-full border border-base-300 bg-base-100 p-2 text-lg shadow-lg opacity-0 transition duration-150 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
//                     {REACTION_PICKER.map((emoji) => (
//                       <button
//                         key={emoji}
//                         type="button"
//                         onClick={() => toggleReaction({ messageId: message._id, emoji })}
//                         className="rounded-full px-2 py-1 hover:bg-base-200 transition"
//                       >
//                         {emoji}
//                       </button>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           );
//         })}
//       </div>
//       <MessageInput />
//     </div>
//   );
// };

// export default ChatContainer;



import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import EmojiPicker from "emoji-picker-react";

const URL_SPLIT_REGEX = /(https?:\/\/[^\s]+)/g;
const URL_TEST_REGEX = /https?:\/\/[^\s]+/;

const renderTextWithLinks = (text) => {
  if (!text) return null;
  const parts = text.split(URL_SPLIT_REGEX);
  return parts.map((part, index) => {
    if (URL_TEST_REGEX.test(part)) {
      return (
        <a
          key={`link-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="underline text-blue-600 break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
};

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedChat,
    subscribeToMessages,
    unsubscribeFromMessages,
    toggleReaction,
    typingUsers,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const pickerRef = useRef(null);
  const [openPickerMessageId, setOpenPickerMessageId] = useState(null);
  const [highlightedReactionKey, setHighlightedReactionKey] = useState(null);
  const highlightTimeoutRef = useRef(null);

  useEffect(() => {
    if (!selectedChat) return;
    getMessages(selectedChat._id);
    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedChat?._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setOpenPickerMessageId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  const getMemberName = (userId) => {
    const normalizedAuthUserId = authUser?._id ? String(authUser._id) : "";
    if (normalizedAuthUserId && String(userId) === normalizedAuthUserId) {
      return "You";
    }
    const member = selectedChat?.members?.find((item) => String(item._id) === String(userId));
    return member?.fullName || "Friend";
  };

  const getMemberAvatar = (userId) => {
    const member = selectedChat?.members?.find((item) => String(item._id) === String(userId));
    return member?.profilePic || "/avatar.png";
  };

  const handleReactionClick = (messageId, emoji) => {
    if (!selectedChat) return;
    const reactionKey = `${messageId}:${emoji}`;
    setHighlightedReactionKey(reactionKey);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedReactionKey(null);
    }, 400);
    toggleReaction({ messageId, emoji, chatId: selectedChat._id });
  };

  const typingMemberNames =
    selectedChat && selectedChat._id
      ? (typingUsers[selectedChat._id] || []).map((userId) => getMemberName(userId)).filter(Boolean)
      : [];

  const typingLabel =
    typingMemberNames.length > 0
      ? `${typingMemberNames.join(", ")} ${typingMemberNames.length > 1 ? "are" : "is"} typing…`
      : "";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ChatHeader />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const reactionGroups = (message.reactions || []).reduce((acc, reaction) => {
            const bucket = acc[reaction.emoji] || [];
            bucket.push(reaction);
            acc[reaction.emoji] = bucket;
            return acc;
          }, {});
          const reactionEntries = Object.entries(reactionGroups);

          return (
            <div
              key={message._id}
              className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
              ref={messageEndRef}
            >
              <div className="chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img
                    src={
                      message.senderId === authUser._id
                        ? authUser.profilePic || "/avatar.png"
                        : getMemberAvatar(message.senderId)
                    }
                    alt="profile-pic"
                  />
                </div>
              </div>
              <div className="chat-header mb-1">
                <time className="text-xs opacity-50 ml-1">{formatMessageTime(message.createdAt)}</time>
              </div>
              <div className="chat-bubble flex flex-col max-w-[70%] sm:max-w-[60%] break-words">
                {message.image && (
                  <img
                    src={message.image}
                    alt="attachment"
                    className="sm:max-w-[200px] rounded-md mb-2"
                  />
                )}
                {message.text && (
                  <p className="break-words whitespace-pre-wrap">
                    {renderTextWithLinks(message.text)}
                  </p>
                )}

                {reactionEntries.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {reactionEntries.map(([emoji, reactions]) => {
                      const reactedByMe = reactions.some(
                        (reaction) => String(reaction.userId) === String(authUser._id)
                      );
                      const tooltipNames = Array.from(
                        new Set(reactions.map((reaction) => getMemberName(reaction.userId)))
                      ).join(", ");

                      return (
                        <div key={`${message._id}-${emoji}`} className="relative group">
                          <button
                            type="button"
                            onClick={() => handleReactionClick(message._id, emoji)}
                            className={`flex items-center gap-1 rounded-full border px-2 py-1 text-sm transition duration-200 transform ${
                              reactedByMe
                                ? "border-blue-400 bg-blue-50 text-blue-700"
                                : "border-transparent bg-base-200 text-base-content"
                            } ${highlightedReactionKey === `${message._id}:${emoji}` ? "scale-105 shadow-lg" : ""}`}
                          >
                            <span className="text-lg">{emoji}</span>
                            <span className="text-[10px] font-semibold">{reactions.length}</span>
                          </button>
                          <div className="pointer-events-none absolute -top-9 left-1/2 z-10 w-max -translate-x-1/2 rounded-md border border-zinc-300 bg-base-100 px-2 py-1 text-[11px] opacity-0 transition group-hover:opacity-100">
                            {tooltipNames}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="relative mt-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs normal-case text-xs"
                    aria-label="Add reaction"
                    onClick={() =>
                      setOpenPickerMessageId((id) => (id === message._id ? null : message._id))
                    }
                  >
                    + Add reaction
                  </button>
                  {openPickerMessageId === message._id && (
                    <div
                      ref={pickerRef}
                      className={`absolute -bottom-[320px] z-20 w-[260px] rounded-lg border border-base-300 bg-base-100 p-2 shadow-lg ${
                        message.senderId === authUser._id ? "right-0" : "left-0"
                      }`}
                    >
                      <EmojiPicker
                        onEmojiClick={(emojiObject) => {
                          handleReactionClick(message._id, emojiObject.emoji);
                          setOpenPickerMessageId(null);
                        }}
                        autoFocusSearch={false}
                        theme="light"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {typingLabel && (
        <div className="px-4 pb-2 text-xs italic text-base-content/70">{typingLabel}</div>
      )}
      <MessageInput />
    </div>
  );
};

export default ChatContainer;
