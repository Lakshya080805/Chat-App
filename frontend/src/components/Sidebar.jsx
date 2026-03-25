import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users } from "lucide-react";
import GroupModal from "./GroupModal";

const Sidebar = () => {
  const {
    getChats,
    chats,
    selectedChat,
    setSelectedChat,
    createGroup,
    getUsers,
    users,
    isUsersLoading,
    isChatsLoading,
  } = useChatStore();

  const { authUser, onlineUsers = [] } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isGroupModalOpen, setGroupModalOpen] = useState(false);

  useEffect(() => {
    getChats();
    getUsers();
  }, [getChats, getUsers]);

  const filteredChats = useMemo(() => {
    if (!showOnlineOnly) return chats;
    return chats.filter((chat) => {
      if (chat?.isGroup) return false;
      const otherMember = chat.members?.find((member) => String(member._id) !== String(authUser?._id));
      return Boolean(otherMember && onlineUsers.includes(otherMember._id));
    });
  }, [chats, showOnlineOnly, onlineUsers, authUser?._id]);

  const handleGroupCreate = async (payload) => {
    await createGroup(payload);
    setGroupModalOpen(false);
  };

  if (isChatsLoading) {
    return <SidebarSkeleton />;
  }

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-6" />
            <span className="font-medium hidden lg:block">Chats</span>
          </div>
          <button
            type="button"
            className="btn btn-xs btn-primary hidden lg:inline-flex"
            onClick={() => setGroupModalOpen(true)}
          >
            Create group
          </button>
        </div>
        <div className="lg:hidden">
          <button
            type="button"
            className="btn btn-xs btn-primary w-full"
            onClick={() => setGroupModalOpen(true)}
          >
            Create group
          </button>
        </div>
        <div className="hidden lg:flex items-center justify-between text-sm text-zinc-500">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(event) => setShowOnlineOnly(event.target.checked)}
              className="checkbox checkbox-sm"
            />
            Show online only
          </label>
          <div>({Math.max(onlineUsers.length - 1, 0)} online)</div>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3 space-y-2">
        {filteredChats.length === 0 && (
          <div className="text-center text-zinc-500 py-4">No chats yet</div>
        )}
        {filteredChats.map((chat) => {
          const otherMember = chat.members?.find((member) => String(member._id) !== String(authUser?._id));
          const isSelected = selectedChat?._id === chat._id;
          const onlineIndicator = !chat.isGroup && otherMember && onlineUsers.includes(otherMember._id);

          return (
            <button
              key={chat._id}
              onClick={() => setSelectedChat(chat)}
              className={`w-full p-3 flex items-center gap-3 hover:bg-base-300 transition-colors rounded-lg ${
                isSelected ? "bg-base-300 ring-1 ring-base-300" : ""
              }`}
            >
              <div className="relative">
                <img
                  src={
                    chat.isGroup
                      ? chat.groupPhoto || "/avatar.png"
                      : otherMember?.profilePic || "/avatar.png"
                  }
                  alt={chat.isGroup ? chat.name : otherMember?.fullName}
                  className="size-12 object-cover rounded-full border border-base-200"
                />
                {onlineIndicator && (
                  <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-base-100" />
                )}
              </div>

              <div className="hidden lg:flex flex-col flex-1 text-left min-w-0">
                <div className="font-medium truncate">
                  {chat.isGroup ? chat.name || "Group chat" : otherMember?.fullName || "Friend"}
                </div>
                <div className="text-sm text-zinc-400">
                  {chat.isGroup
                    ? `${chat.members?.length || 0} members`
                    : onlineIndicator
                    ? "Online"
                    : "Offline"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <GroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        users={users}
        isLoading={isUsersLoading}
        onSubmit={handleGroupCreate}
      />
    </aside>
  );
};

export default Sidebar;
