import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const formatCountdown = (expiresAt) => {
  if (!expiresAt) return "";
  const msRemaining = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(msRemaining) || msRemaining <= 0) return "Expired";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
};

const InvitePage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { authUser, isCheckingAuth } = useAuthStore();
  const { previewInvite, joinViaInvite } = useChatStore();
  const [inviteInfo, setInviteInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [countdown, setCountdown] = useState("");
  const hasInviteError = !isLoading && !inviteInfo;

  const inviteTitle = useMemo(() => inviteInfo?.name || "Group chat", [inviteInfo?.name]);

  useEffect(() => {
    if (!code || !authUser) return;
    let isMounted = true;
    const loadPreview = async () => {
      setIsLoading(true);
      const info = await previewInvite({ code });
      if (isMounted) {
        setInviteInfo(info);
        setIsLoading(false);
      }
    };
    loadPreview();
    return () => {
      isMounted = false;
    };
  }, [code, authUser, previewInvite]);

  useEffect(() => {
    if (!inviteInfo?.expiresAt) return;
    const update = () => {
      setCountdown(formatCountdown(inviteInfo.expiresAt));
    };
    update();
    const timerId = setInterval(update, 1000);
    return () => clearInterval(timerId);
  }, [inviteInfo?.expiresAt]);

  const handleJoin = async () => {
    if (!code) return;
    setIsJoining(true);
    const chat = await joinViaInvite({ code });
    setIsJoining(false);
    if (chat?._id) {
      navigate("/");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="w-full max-w-md rounded-2xl border border-base-200 bg-base-100 p-6 text-center">
          <h2 className="text-xl font-semibold">Sign in to join the group</h2>
          <p className="text-sm text-zinc-500 mt-2">
            This invite link is for a private group. Please log in to continue.
          </p>
          <Link to="/login" className="btn btn-primary mt-4 w-full">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen px-4">
      <div className="w-full max-w-md rounded-2xl border border-base-200 bg-base-100 p-6">
        <h2 className="text-xl font-semibold">{inviteTitle}</h2>
        <p className="text-sm text-zinc-500 mt-2">
          {inviteInfo?.memberCount != null
            ? `${inviteInfo.memberCount} members`
            : hasInviteError
            ? "This invite link is invalid or expired."
            : "Loading group info..."}
        </p>
        {inviteInfo?.expiresAt && (
          <p className="text-xs text-zinc-400 mt-1">Expires in {countdown}</p>
        )}

        <div className="mt-5 space-y-3">
          {isLoading ? (
            <button type="button" className="btn btn-primary w-full" disabled>
              Loading invite...
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={handleJoin}
              disabled={isJoining || countdown === "Expired" || hasInviteError}
            >
              {hasInviteError
                ? "Invite unavailable"
                : countdown === "Expired"
                ? "Invite expired"
                : isJoining
                ? "Joining..."
                : "Join group"}
            </button>
          )}
          <Link to="/" className="btn btn-ghost w-full">
            Back to chats
          </Link>
        </div>
      </div>
    </div>
  );
};

export default InvitePage;
