import { useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track, createLocalTracks } from "livekit-client";
import { X, Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";

const ParticipantTile = ({ participant, isLocal, isActive, videoTrack, label }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const { audioTrack } = useMemo(() => {
    const tracks = Array.from(participant.trackPublications.values())
      .map((pub) => pub.track)
      .filter(Boolean);
    return {
      audioTrack: tracks.find((track) => track.kind === Track.Kind.Audio) || null,
    };
  }, [participant]);

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoTrack.attach(videoRef.current);
      return () => videoTrack.detach(videoRef.current);
    }
    return undefined;
  }, [videoTrack]);

  useEffect(() => {
    if (audioTrack && audioRef.current) {
      audioTrack.attach(audioRef.current);
      return () => audioTrack.detach(audioRef.current);
    }
    return undefined;
  }, [audioTrack]);

  return (
    <div
      className={`relative aspect-video rounded-lg overflow-hidden flex items-center justify-center ${
        isActive ? "ring-2 ring-primary shadow-lg bg-base-200" : "bg-base-200"
      }`}
    >
      {videoTrack ? (
        <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted={isLocal} />
      ) : (
        <div className="text-sm text-zinc-500">{participant.name || "Participant"}</div>
      )}
      <audio ref={audioRef} autoPlay />
      <div className="absolute left-2 bottom-2 rounded-full bg-base-100/80 px-2 py-1 text-[10px]">
        {label || (isLocal ? "You" : participant.name || "User")}
      </div>
    </div>
  );
};

const GroupCallModal = ({
  isOpen,
  roomId,
  chatId,
  callType = "video",
  isHost = false,
  onClose,
  onLeave,
  onEnd,
}) => {
  const { authUser } = useAuthStore();
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(callType !== "video");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeSpeakerIds, setActiveSpeakerIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  const syncParticipants = (roomInstance) => {
    const locals = roomInstance?.localParticipant ? [roomInstance.localParticipant] : [];
    const remotes = Array.from(roomInstance?.remoteParticipants?.values() || []);
    setParticipants([...locals, ...remotes]);
  };

  const buildTiles = () => {
    const tiles = [];
    participants.forEach((participant) => {
      const tracks = Array.from(participant.trackPublications.values())
        .map((pub) => pub.track)
        .filter(Boolean);
      const screenShareTrack = tracks.find(
        (track) => track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare
      );
      const cameraTrack = tracks.find(
        (track) => track.kind === Track.Kind.Video && track.source !== Track.Source.ScreenShare
      );

      if (screenShareTrack) {
        tiles.push({
          key: `${participant.identity}-screen`,
          participant,
          videoTrack: screenShareTrack,
          label: `${participant.name || "User"} • Screen`,
        });
      }
      if (cameraTrack) {
        tiles.push({
          key: `${participant.identity}-camera`,
          participant,
          videoTrack: cameraTrack,
          label: participant.identity === String(authUser?._id) ? "You" : participant.name || "User",
        });
      }
      if (!screenShareTrack && !cameraTrack) {
        tiles.push({
          key: `${participant.identity}-placeholder`,
          participant,
          videoTrack: null,
          label: participant.identity === String(authUser?._id) ? "You" : participant.name || "User",
        });
      }
    });
    return tiles;
  };

  const tiles = buildTiles();
  const sharingUsers = Array.from(
    new Set(
      tiles
        .filter((tile) => tile.key.endsWith("-screen"))
        .map((tile) => tile.participant?.name || "User")
    )
  );
  const totalPages = Math.max(1, Math.ceil(tiles.length / pageSize));
  const pagedTiles = tiles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getGridClass = (count) => {
    if (count <= 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2 lg:grid-cols-2";
    if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
    if (count <= 9) return "grid-cols-3 lg:grid-cols-3";
    return "grid-cols-3 lg:grid-cols-4";
  };

  useEffect(() => {
    if (!isOpen || !roomId) return;
    let isMounted = true;
    let activeRoom = null;
    let localTracks = [];

    const connectToRoom = async () => {
      try {
        setIsConnecting(true);
        setErrorMessage("");

        const iceRes = await axiosInstance.get("/calls/ice-servers");
        const iceServers = iceRes?.data?.iceServers || [];

        const tokenRes = await axiosInstance.post("/calls/livekit/token", {
          roomName: roomId,
        });
        const rawPayload = tokenRes.data || {};
        const payload =
          rawPayload?.token && rawPayload?.url
            ? rawPayload
            : rawPayload?.data && (rawPayload.data.token || rawPayload.data.url)
            ? rawPayload.data
            : rawPayload;
        let token = payload?.token || payload?.accessToken || payload?.jwt;
        let url = payload?.url || payload?.livekitUrl || payload?.wsUrl;
        if (token && typeof token !== "string") {
          token = token.token || token.jwt || String(token);
        }
        if (url && typeof url !== "string") {
          url = String(url);
        }
        if (!token || !url) {
          throw new Error("Missing LiveKit credentials");
        }

        activeRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          rtcConfiguration: iceServers.length ? { iceServers } : undefined,
        });

        await activeRoom.connect(url, token);

        try {
          localTracks = await createLocalTracks({
            audio: true,
            video: callType === "video",
          });
        } catch (mediaError) {
          if (mediaError?.name === "NotReadableError") {
            toast.error("Camera is busy. Joining with audio only.");
            setIsCameraOff(true);
            localTracks = await createLocalTracks({
              audio: true,
              video: false,
            });
          } else if (mediaError?.name === "NotAllowedError") {
            toast.error("Camera/microphone permission denied.");
            throw mediaError;
          } else {
            throw mediaError;
          }
        }

        await Promise.all(localTracks.map((track) => activeRoom.localParticipant.publishTrack(track)));

        if (!isMounted) return;
        setRoom(activeRoom);
        syncParticipants(activeRoom);

        activeRoom.on(RoomEvent.ParticipantConnected, () => syncParticipants(activeRoom));
        activeRoom.on(RoomEvent.ParticipantDisconnected, () => syncParticipants(activeRoom));
        activeRoom.on(RoomEvent.TrackSubscribed, () => syncParticipants(activeRoom));
        activeRoom.on(RoomEvent.TrackUnsubscribed, () => syncParticipants(activeRoom));
        activeRoom.on(RoomEvent.LocalTrackPublished, () => syncParticipants(activeRoom));
        activeRoom.on(RoomEvent.LocalTrackUnpublished, () => syncParticipants(activeRoom));
        activeRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          const ids = (speakers || []).map((speaker) => speaker.identity);
          if (isMounted) setActiveSpeakerIds(ids);
        });
      } catch (error) {
        console.error("LiveKit connect error:", error);
        if (isMounted) {
          setErrorMessage(error?.message || "Failed to connect to call");
        }
      } finally {
        if (isMounted) setIsConnecting(false);
      }
    };

    connectToRoom();

    return () => {
      isMounted = false;
      localTracks.forEach((track) => track.stop());
      if (activeRoom) {
        activeRoom.disconnect();
      }
      setRoom(null);
      setParticipants([]);
      setActiveSpeakerIds([]);
    };
  }, [isOpen, roomId, callType]);

  const toggleMute = async () => {
    if (!room) return;
    const nextMuted = !isMuted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      setIsMuted(nextMuted);
    } catch (error) {
      console.error("Mic toggle error:", error);
      toast.error("Could not toggle microphone");
    }
  };

  const toggleCamera = async () => {
    if (!room) return;
    const nextOff = !isCameraOff;
    try {
      await room.localParticipant.setCameraEnabled(!nextOff);
      setIsCameraOff(nextOff);
    } catch (error) {
      console.error("Camera toggle error:", error);
      toast.error("Could not toggle camera");
    }
  };

  const toggleScreenShare = async () => {
    if (!room) return;
    const nextSharing = !isScreenSharing;
    try {
      await room.localParticipant.setScreenShareEnabled(nextSharing);
      setIsScreenSharing(nextSharing);
    } catch (error) {
      console.error("Screen share error:", error);
      toast.error("Screen share failed or was blocked");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-base-100 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-base-200 px-4 py-3">
          <div>
            <h3 className="text-lg font-semibold">Group Call</h3>
            <p className="text-xs text-zinc-500">{chatId ? `Chat: ${chatId}` : ""}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4">
          {isConnecting ? (
            <div className="flex items-center justify-center h-64 text-sm text-zinc-500">
              Connecting to call...
            </div>
          ) : errorMessage ? (
            <div className="flex items-center justify-center h-64 text-sm text-red-500">
              {errorMessage}
            </div>
          ) : (
            <>
              {sharingUsers.length > 0 && (
                <div className="mb-3 rounded-lg border border-base-200 bg-base-100 px-3 py-2 text-xs">
                  {sharingUsers.join(", ")} {sharingUsers.length > 1 ? "are" : "is"} sharing screen
                </div>
              )}
              <div className={`grid gap-3 auto-rows-fr ${getGridClass(pagedTiles.length)}`}>
                {pagedTiles.map((tile) => (
                  <ParticipantTile
                    key={tile.key}
                    participant={tile.participant}
                    videoTrack={tile.videoTrack}
                    label={tile.label}
                    isLocal={String(tile.participant.identity) === String(authUser?._id)}
                    isActive={activeSpeakerIds.includes(tile.participant.identity)}
                  />
                ))}
              </div>
            </>
          )}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>
              <span className="text-xs text-zinc-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-base-200 p-4">
          <button className="btn btn-ghost btn-sm" onClick={toggleMute}>
            {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={toggleCamera} disabled={callType !== "video"}>
            {isCameraOff ? <VideoOff className="size-4" /> : <Video className="size-4" />}
            {isCameraOff ? "Camera off" : "Camera on"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={toggleScreenShare}>
            {isScreenSharing ? <MonitorOff className="size-4" /> : <MonitorUp className="size-4" />}
            {isScreenSharing ? "Stop share" : "Share screen"}
          </button>
          {isHost ? (
            <button className="btn btn-error btn-sm" onClick={onEnd}>
              End call
            </button>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={onLeave}>
              Leave call
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupCallModal;
