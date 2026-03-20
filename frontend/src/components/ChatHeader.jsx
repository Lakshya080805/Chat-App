
import { useEffect, useRef, useState } from "react";
import { Phone, Video, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import CallModal from "./CallModal";

const buildIceServers = () => {
  const stunEnv = import.meta.env.VITE_STUN_URLS;
  const turnEnv = import.meta.env.VITE_TURN_URLS;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  const servers = [];

  const stunUrls = (stunEnv || "stun:stun.l.google.com:19302")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  stunUrls.forEach((url) => {
    servers.push({ urls: url });
  });

  const turnUrls = (turnEnv || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
};

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, users } = useChatStore();
  const {
    onlineUsers,
    callUser,
    answerCall,
    sendIceCandidate,
    incomingCall,
    remoteAnswer,
    remoteIceCandidate,
    callEndedBy,
    endCall,
    clearCallSignals,
  } = useAuthStore();
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [callStatus, setCallStatus] = useState("Idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [pendingIncomingCall, setPendingIncomingCall] = useState(null);
  const peerConnectionRef = useRef(null);
  const activePeerUserIdRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const cachedIceServersRef = useRef(buildIceServers());
  const ringtoneIntervalRef = useRef(null);
  const audioContextRef = useRef(null);

  const playRingtonePulse = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.04, ctx.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
    } catch {
      // Ignore ringtone errors (autoplay policies can block sound until user interaction).
    }
  };

  const startIncomingRingtone = () => {
    if (ringtoneIntervalRef.current) return;

    playRingtonePulse();
    ringtoneIntervalRef.current = setInterval(() => {
      playRingtonePulse();
    }, 1200);
  };

  const stopIncomingRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  };

  const flushPendingIceCandidates = async () => {
    if (!peerConnectionRef.current) return;
    if (!peerConnectionRef.current.remoteDescription) return;

    while (pendingIceCandidatesRef.current.length > 0) {
      const candidate = pendingIceCandidatesRef.current.shift();
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const getMediaWithFallback = async (requestedType) => {
    const wantsVideo = requestedType === "video";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantsVideo,
      });

      return {
        stream,
        effectiveType: wantsVideo ? "video" : "audio",
      };
    } catch (error) {
      // Usually happens when testing two users on one device/camera.
      if (wantsVideo && error?.name === "NotReadableError") {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        toast("Camera busy, joined with audio only.");
        return {
          stream: fallbackStream,
          effectiveType: "audio",
        };
      }

      throw error;
    }
  };

  const getIceServers = async () => {
    try {
      const res = await axiosInstance.get("/calls/ice-servers");
      const fetchedIceServers = res?.data?.iceServers;
      if (Array.isArray(fetchedIceServers) && fetchedIceServers.length > 0) {
        cachedIceServersRef.current = fetchedIceServers;
      }
    } catch (error) {
      console.warn("Using fallback ICE servers:", error?.message || error);
    }

    return cachedIceServersRef.current;
  };

  const createPeerConnection = async (targetUserId, remoteMediaStream) => {
    const iceServers = await getIceServers();
    const peerConnection = new RTCPeerConnection({ iceServers });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendIceCandidate({
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        const alreadyAdded = remoteMediaStream.getTracks().some((t) => t.id === track.id);
        if (!alreadyAdded) {
          remoteMediaStream.addTrack(track);
        }
      });
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === "connected") {
        setCallStatus("Connected");
      } else if (state === "connecting") {
        setCallStatus("Connecting");
      } else if (state === "disconnected" || state === "failed") {
        setCallStatus("Ended");
      }
    };

    return peerConnection;
  };

  const cleanupCallState = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIsCallModalOpen(false);
    setIsMuted(false);
    setIsCameraOff(false);
    activePeerUserIdRef.current = null;
    pendingIceCandidatesRef.current = [];
  };

  const handleEndCall = () => {
    stopIncomingRingtone();
    if (activePeerUserIdRef.current) {
      endCall({ to: activePeerUserIdRef.current });
    }
    setCallStatus("Ended");
    cleanupCallState();
  };

  const toggleMute = () => {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const nextMuted = !isMuted;
    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    const nextCameraOff = !isCameraOff;
    videoTracks.forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setIsCameraOff(nextCameraOff);
  };

  const acceptIncomingCall = async () => {
    if (!pendingIncomingCall) return;
    if (peerConnectionRef.current) return;
    stopIncomingRingtone();

    try {
      const requestedType = pendingIncomingCall.callType === "audio" ? "audio" : "video";
      const { stream, effectiveType } = await getMediaWithFallback(requestedType);
      const remoteMediaStream = new MediaStream();

      const peerConnection = await createPeerConnection(pendingIncomingCall.from, remoteMediaStream);
      peerConnectionRef.current = peerConnection;
      activePeerUserIdRef.current = pendingIncomingCall.from;

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      await peerConnection.setRemoteDescription(new RTCSessionDescription(pendingIncomingCall.offer));

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      answerCall({
        to: pendingIncomingCall.from,
        answer,
      });

      setIsVideoCall(effectiveType === "video");
      setLocalStream(stream);
      setRemoteStream(remoteMediaStream);
      setIsCallModalOpen(true);
      setCallStatus("Connecting");
      setPendingIncomingCall(null);
      clearCallSignals();

      await flushPendingIceCandidates();
    } catch (error) {
      console.error("Failed to accept incoming call:", error);
      toast.error("Could not join call. Microphone/camera is unavailable.");
      setCallStatus("Ended");
      cleanupCallState();
      setPendingIncomingCall(null);
      clearCallSignals();
    }
  };

  const rejectIncomingCall = () => {
    stopIncomingRingtone();
    if (pendingIncomingCall?.from) {
      endCall({ to: pendingIncomingCall.from });
    }
    setCallStatus("Ended");
    setPendingIncomingCall(null);
    clearCallSignals();
  };

  const startCall = async (callType) => {
    try {
      setCallStatus("Connecting");
      const { stream, effectiveType } = await getMediaWithFallback(callType);
      const remoteMediaStream = new MediaStream();

      const peerConnection = await createPeerConnection(selectedUser._id, remoteMediaStream);
      peerConnectionRef.current = peerConnection;
      activePeerUserIdRef.current = selectedUser._id;

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      callUser({
        to: selectedUser._id,
        offer,
        callType: effectiveType,
      });
      setCallStatus("Ringing");

      setIsVideoCall(effectiveType === "video");
      setLocalStream(stream);
      setRemoteStream(remoteMediaStream);
      setIsCallModalOpen(true);
    } catch (error) {
      console.error("Failed to start call:", error);
      toast.error("Unable to start call. Microphone/camera is unavailable.");
      setCallStatus("Ended");
      cleanupCallState();
    }
  };

  useEffect(() => {
    if (!incomingCall) return;
    if (peerConnectionRef.current) return;
    setCallStatus("Ringing");
    setPendingIncomingCall(incomingCall);
  }, [incomingCall]);

  useEffect(() => {
    if (pendingIncomingCall && !isCallModalOpen) {
      startIncomingRingtone();
    } else {
      stopIncomingRingtone();
    }
  }, [pendingIncomingCall, isCallModalOpen]);

  useEffect(() => {
    const applyRemoteAnswer = async () => {
      if (!remoteAnswer || !peerConnectionRef.current) return;
      if (activePeerUserIdRef.current && remoteAnswer.from !== activePeerUserIdRef.current) return;

      if (peerConnectionRef.current.signalingState === "have-local-offer") {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(remoteAnswer.answer));
        await flushPendingIceCandidates();
      }
    };

    applyRemoteAnswer().catch((error) => {
      console.error("Failed to apply remote answer:", error);
    });
  }, [remoteAnswer]);

  useEffect(() => {
    const addRemoteIce = async () => {
      if (!remoteIceCandidate || !peerConnectionRef.current) return;
      if (activePeerUserIdRef.current && remoteIceCandidate.from !== activePeerUserIdRef.current) return;

      const candidate = remoteIceCandidate.candidate;
      if (!candidate) return;

      if (peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        pendingIceCandidatesRef.current.push(candidate);
      }
    };

    addRemoteIce().catch((error) => {
      console.error("Failed to add remote ICE candidate:", error);
    });
  }, [remoteIceCandidate]);

  useEffect(() => {
    if (!callEndedBy) return;
    stopIncomingRingtone();
    setCallStatus("Ended");
    if (activePeerUserIdRef.current && callEndedBy === activePeerUserIdRef.current) {
      cleanupCallState();
    }
    if (pendingIncomingCall?.from && callEndedBy === pendingIncomingCall.from) {
      setPendingIncomingCall(null);
      clearCallSignals();
    }
  }, [callEndedBy]);

  useEffect(() => {
    if (callStatus !== "Ended") return;

    const timeoutId = setTimeout(() => {
      setCallStatus("Idle");
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [callStatus]);

  useEffect(() => {
    return () => {
      stopIncomingRingtone();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const incomingCaller = pendingIncomingCall
    ? users.find((user) => user._id === pendingIncomingCall.from)
    : null;

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
            </p>
            {callStatus !== "Idle" && (
              <p className="text-xs text-primary mt-0.5">Call: {callStatus}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Call Button */}
          <button
            className="btn btn-sm btn-circle"
            title="Start Audio Call"
            onClick={() => startCall("audio")}
          >
            <Phone className="size-4" />
          </button>
          {/* Video Call Button */}
          <button
            className="btn btn-sm btn-circle"
            title="Start Video Call"
            onClick={() => startCall("video")}
          >
            <Video className="size-4" />
          </button>
          {/* Close button */}
          <button onClick={() => setSelectedUser(null)}>
            <X />
          </button>
        </div>
      </div>

      {pendingIncomingCall && !isCallModalOpen && (
        <div className="mt-3 p-3 rounded-lg border border-base-300 bg-base-200 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              Incoming {pendingIncomingCall.callType === "audio" ? "audio" : "video"} call
            </p>
            <p className="text-xs text-base-content/70">
              From {incomingCaller?.fullName || "a user"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-sm btn-success" onClick={acceptIncomingCall}>
              Accept
            </button>
            <button className="btn btn-sm btn-error" onClick={rejectIncomingCall}>
              Reject
            </button>
          </div>
        </div>
      )}

      <CallModal
        isOpen={isCallModalOpen}
        onClose={handleEndCall}
        localStream={localStream}
        remoteStream={remoteStream}
        isVideo={isVideoCall}
        callStatus={callStatus}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
      />
    </div>
  );
};
export default ChatHeader;
