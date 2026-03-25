import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const GroupSettingsModal = ({ isOpen, onClose }) => {
  const {
    selectedChat,
    users,
    addMembersToGroup,
    removeMemberFromGroup,
    leaveGroup,
    promoteMemberToAdmin,
    demoteMemberFromAdmin,
    updateGroupPhoto,
    generateInviteLink,
    shareInviteWithUsers,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState(null);
  const [inviteCountdown, setInviteCountdown] = useState("");
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [shareUserIds, setShareUserIds] = useState([]);
  const [isSharingInvite, setIsSharingInvite] = useState(false);

  const isAdmin = selectedChat?.admins?.some(
    (adminId) => String(adminId) === String(authUser?._id)
  );

  const chatMembers = selectedChat?.members || [];
  const currentMemberIds = useMemo(
    () => new Set(chatMembers.map((member) => String(member._id))),
    [chatMembers]
  );

  const availableUsers = useMemo(
    () => users.filter((user) => !currentMemberIds.has(String(user._id))),
    [users, currentMemberIds]
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedMemberIds([]);
      setPhotoFile(null);
      setPhotoPreview("");
      setInviteLink("");
      setInviteExpiresAt(null);
      setInviteCountdown("");
      setShareUserIds([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!inviteExpiresAt) return;
    const updateCountdown = () => {
      const msRemaining = new Date(inviteExpiresAt).getTime() - Date.now();
      if (Number.isNaN(msRemaining) || msRemaining <= 0) {
        setInviteCountdown("Expired");
        return;
      }
      const totalSeconds = Math.floor(msRemaining / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);
      setInviteCountdown(parts.join(" "));
    };

    updateCountdown();
    const timerId = setInterval(updateCountdown, 1000);
    return () => clearInterval(timerId);
  }, [inviteExpiresAt]);

  const toggleSelection = (memberId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleAddMembers = async () => {
    if (!selectedMemberIds.length) return;
    setIsAdding(true);
    await addMembersToGroup({ memberIds: selectedMemberIds });
    setSelectedMemberIds([]);
    setIsAdding(false);
  };

  const handleRemoveMember = async (memberId) => {
    setRemovingId(memberId);
    await removeMemberFromGroup({ memberId });
    setRemovingId(null);
  };

  const handlePromote = async (memberId) => {
    await promoteMemberToAdmin({ memberId });
  };

  const handleDemote = async (memberId) => {
    await demoteMemberFromAdmin({ memberId });
  };

  const handleLeaveGroup = async () => {
    setIsLeaving(true);
    await leaveGroup();
    setIsLeaving(false);
    onClose();
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const preview = await toBase64(file);
    setPhotoPreview(preview);
  };

  const handleUpdatePhoto = async () => {
    if (!photoFile) return;
    setIsUploadingPhoto(true);
    const imageData = await toBase64(photoFile);
    await updateGroupPhoto({ image: imageData });
    setIsUploadingPhoto(false);
    setPhotoFile(null);
    setPhotoPreview("");
  };

  const handleGenerateInvite = async () => {
    if (!selectedChat?._id) return;
    setIsGeneratingInvite(true);
    const invite = await generateInviteLink({ chatId: selectedChat._id });
    setIsGeneratingInvite(false);
    if (!invite?.inviteLink) return;
    setInviteLink(invite.inviteLink);
    setInviteExpiresAt(invite.expiresAt);
    try {
      await navigator.clipboard.writeText(invite.inviteLink);
      toast.success("Invite link copied to clipboard");
    } catch (error) {
      toast.success("Invite link generated");
    }
  };

  const toggleShareUser = (userId) => {
    setShareUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleShareInvite = async () => {
    if (!inviteLink || shareUserIds.length === 0) return;
    setIsSharingInvite(true);
    const success = await shareInviteWithUsers({ userIds: shareUserIds, inviteLink });
    setIsSharingInvite(false);
    if (success) {
      setShareUserIds([]);
    }
  };

  if (!isOpen || !selectedChat?.isGroup) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-900/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-base-200 bg-base-100 shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-base-200 px-4 py-3 sticky top-0 bg-base-100 z-10">
          <h3 className="text-lg font-semibold">Group settings</h3>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Add members</h4>
              <button
                type="button"
                className="text-xs text-primary"
                disabled={!isAdmin}
                onClick={() => setSelectedMemberIds([])}
              >
                Clear selection
              </button>
            </div>
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-base-200 p-2">
              {availableUsers.length === 0 && (
                <p className="text-xs text-zinc-400">No additional users available.</p>
              )}
              {availableUsers.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => toggleSelection(user._id)}
                  className={`flex items-center gap-3 w-full rounded-lg border px-3 py-2 text-left transition ${
                    selectedMemberIds.includes(user._id)
                      ? "border-primary bg-primary/10"
                      : "border-base-200 bg-base-100"
                  } ${!isAdmin ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="size-8 rounded-full object-cover border"
                  />
                  <div>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-xs text-zinc-400">{user.email}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!isAdmin || selectedMemberIds.length === 0 || isAdding}
              onClick={handleAddMembers}
            >
              {isAdding ? "Adding..." : "Add selected members"}
            </button>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-medium">Group photo</h4>
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 overflow-hidden rounded-full border border-base-200 bg-base-100">
                <img
                  src={photoPreview || selectedChat.groupPhoto || "/avatar.png"}
                  alt="group"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-2">
                <label className="btn btn-sm">
                  {photoFile ? "Change image" : "Upload image"}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleUpdatePhoto}
                  disabled={!photoFile || isUploadingPhoto || !isAdmin}
                >
                  {isUploadingPhoto ? "Updating..." : "Update display picture"}
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Invite link</h4>
              <span className="text-xs text-zinc-500">
                {inviteCountdown
                  ? inviteCountdown === "Expired"
                    ? "Expired"
                    : `Expires in ${inviteCountdown}`
                  : "No active link"}
              </span>
            </div>
            <div className="rounded-lg border border-base-200 bg-base-100 p-3 space-y-2">
              {inviteLink ? (
                <>
                  <a
                    href={inviteLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 break-all underline"
                  >
                    {inviteLink}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteLink);
                          toast.success("Invite link copied");
                        } catch {
                          toast.error("Could not copy link");
                        }
                      }}
                    >
                      Copy link
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() =>
                        window.open(
                          `https://wa.me/?text=${encodeURIComponent(inviteLink)}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      Share on WhatsApp
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={!isAdmin || isGeneratingInvite}
                      onClick={handleGenerateInvite}
                    >
                      {isGeneratingInvite ? "Regenerating..." : "Regenerate link"}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!isAdmin || isGeneratingInvite}
                  onClick={handleGenerateInvite}
                >
                  {isGeneratingInvite ? "Generating..." : "Generate invite link"}
                </button>
              )}
            </div>
            {inviteLink && (
              <div className="rounded-lg border border-base-200 bg-base-100 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold">Share with users</h5>
                  <span className="text-xs text-zinc-400">
                    {shareUserIds.length} selected
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {availableUsers.length === 0 && (
                    <p className="text-xs text-zinc-400">No additional users available.</p>
                  )}
                  {availableUsers.map((user) => (
                    <label
                      key={`share-${user._id}`}
                      className="flex items-center gap-2 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={shareUserIds.includes(user._id)}
                        onChange={() => toggleShareUser(user._id)}
                      />
                      <span className="font-medium">{user.fullName}</span>
                      <span className="text-zinc-400">{user.email}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={shareUserIds.length === 0 || isSharingInvite}
                  onClick={handleShareInvite}
                >
                  {isSharingInvite ? "Sharing..." : "Send invite message"}
                </button>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Current members</h4>
              <span className="text-xs text-zinc-500">{chatMembers.length} total</span>
            </div>
            <div className="space-y-2">
              {chatMembers.map((member) => {
                const isSelf = String(member._id) === String(authUser?._id);
                const isMemberAdmin = selectedChat.admins?.some(
                  (adminId) => String(adminId) === String(member._id)
                );
                return (
                  <div
                    key={member._id}
                    className="flex items-center justify-between rounded-lg border border-base-200 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={member.profilePic || "/avatar.png"}
                        alt={member.fullName}
                        className="size-8 rounded-full object-cover border"
                      />
                      <div>
                        <p className="font-medium">
                          {member.fullName} {isSelf && "(you)"}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {isMemberAdmin ? "Admin" : "Member"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isAdmin && isMemberAdmin && !isSelf && (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => handleDemote(member._id)}
                        >
                          Demote
                        </button>
                      )}
                      {isAdmin && !isMemberAdmin && (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => handlePromote(member._id)}
                        >
                          Promote
                        </button>
                      )}
                      {isAdmin && !isSelf && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          disabled={removingId === member._id}
                          onClick={() => handleRemoveMember(member._id)}
                        >
                          {removingId === member._id ? "Removing..." : "Remove"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <h4 className="text-sm font-medium text-red-600">Danger zone</h4>
            <p className="text-xs text-red-600">
              Leaving removes you from the chat. If you're the last member, the group will be deleted.
            </p>
            <button
              type="button"
              className="btn btn-error btn-sm w-full"
              onClick={handleLeaveGroup}
              disabled={isLeaving}
            >
              {isLeaving ? "Leaving..." : "Leave group"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default GroupSettingsModal;

