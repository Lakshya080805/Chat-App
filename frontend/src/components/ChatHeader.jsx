
import { useEffect, useRef, useState } from "react";
import { Phone, Video, X, MoreHorizontal, Users } from "lucide-react";
import { toast } from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import CallModal from "./CallModal";
import GroupSettingsModal from "./GroupSettingsModal";
import GroupCallModal from "./GroupCallModal";

const WEBRTC_DEBUG = String(import.meta.env.VITE_DEBUG_WEBRTC || "false").toLowerCase() === "true";

const logWebrtcDebug = (...args) => {
  if (!WEBRTC_DEBUG) return;
  console.log("[webrtc-debug]", ...args);
};

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
  const { selectedChat, setSelectedChat, users } = useChatStore();
  const {
    authUser,
    onlineUsers,
    socket,
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
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [callStatus, setCallStatus] = useState("Idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [iceConnectionState, setIceConnectionState] = useState("new");
  const [connectionState, setConnectionState] = useState("new");
  const [signalingState, setSignalingState] = useState("stable");
  const [localCandidateCount, setLocalCandidateCount] = useState(0);
  const [remoteCandidateCount, setRemoteCandidateCount] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [pendingIncomingCall, setPendingIncomingCall] = useState(null);
  const [activeGroupRoom, setActiveGroupRoom] = useState(null);
  const [groupCallType, setGroupCallType] = useState("video");
  const [isGroupCallOpen, setIsGroupCallOpen] = useState(false);
  const autoJoinGuardRef = useRef(false);
  const peerConnectionRef = useRef(null);
  const activePeerUserIdRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const cachedIceServersRef = useRef(buildIceServers());
  const ringtoneIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const otherParticipant = selectedChat?.members?.find(
    (member) => String(member._id) !== String(authUser?._id)
  );
  const callTargetId = selectedChat?.isGroup ? null : otherParticipant?._id;
  const chatTitle = selectedChat?.isGroup ? selectedChat.name || "Group chat" : otherParticipant?.fullName || "Friend";
  const onlineGroupMembers = (selectedChat?.members || [])
    .filter((member) => {
      const memberId = String(member._id);
      if (memberId === String(authUser?._id)) return false;
      return onlineUsers.includes(memberId);
    })
    .map((member) => member.fullName)
    .filter(Boolean);
  const onlineGroupCount = onlineGroupMembers.length;
  const onlineGroupSummary =
    onlineGroupCount > 0
      ? `Online: ${onlineGroupMembers.slice(0, 3).join(", ")}${
          onlineGroupCount > 3 ? ` +${onlineGroupCount - 3}` : ""
        }`
      : `${selectedChat?.members?.length || 0} members`;
  const chatSubtitle = selectedChat?.isGroup
    ? onlineGroupSummary
    : callTargetId && onlineUsers.includes(callTargetId)
    ? "Online"
    : "Offline";

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

    logWebrtcDebug("flushPendingIceCandidates start", {
      pendingCount: pendingIceCandidatesRef.current.length,
      remoteDescriptionType: peerConnectionRef.current.remoteDescription?.type,
    });

    while (pendingIceCandidatesRef.current.length > 0) {
      const candidate = pendingIceCandidatesRef.current.shift();
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }

    logWebrtcDebug("flushPendingIceCandidates done", {
      pendingCount: pendingIceCandidatesRef.current.length,
    });
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
        logWebrtcDebug("fetched ice servers", {
          count: fetchedIceServers.length,
          urls: fetchedIceServers.map((s) => s.urls),
        });
        cachedIceServersRef.current = fetchedIceServers;
      }
    } catch (error) {
      console.warn("Using fallback ICE servers:", error?.message || error);
    }

    return cachedIceServersRef.current;
  };

  const clearStatsPolling = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  };

  const waitForIceGatheringComplete = (peerConnection, timeoutMs = 3000) => {
    if (!peerConnection) return Promise.resolve();
    if (peerConnection.iceGatheringState === "complete") return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        peerConnection.removeEventListener("icegatheringstatechange", onStateChange);
        clearTimeout(timer);
        resolve();
      };

      const onStateChange = () => {
        if (peerConnection.iceGatheringState === "complete") {
          logWebrtcDebug("ice gathering complete");
          finish();
        }
      };

      const timer = setTimeout(() => {
        logWebrtcDebug("ice gathering timeout", {
          state: peerConnection.iceGatheringState,
          timeoutMs,
        });
        finish();
      }, timeoutMs);

      peerConnection.addEventListener("icegatheringstatechange", onStateChange);
    });
  };

  const logConnectionStatsSnapshot = async (label = "stats") => {
    if (!WEBRTC_DEBUG || !peerConnectionRef.current) return;

    try {
      const stats = await peerConnectionRef.current.getStats();
      let selectedPair = null;
      let localCandidate = null;
      let remoteCandidate = null;

      stats.forEach((report) => {
        if (report.type === "transport" && report.selectedCandidatePairId) {
          selectedPair = stats.get(report.selectedCandidatePairId) || selectedPair;
        }
      });

      if (!selectedPair) {
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.nominated && report.state === "succeeded") {
            selectedPair = report;
          }
        });
      }

      if (selectedPair?.localCandidateId) {
        localCandidate = stats.get(selectedPair.localCandidateId) || null;
      }

      if (selectedPair?.remoteCandidateId) {
        remoteCandidate = stats.get(selectedPair.remoteCandidateId) || null;
      }

      logWebrtcDebug(`${label} snapshot`, {
        connectionState: peerConnectionRef.current.connectionState,
        iceConnectionState: peerConnectionRef.current.iceConnectionState,
        signalingState: peerConnectionRef.current.signalingState,
        selectedPair: selectedPair
          ? {
              state: selectedPair.state,
              nominated: selectedPair.nominated,
              bytesSent: selectedPair.bytesSent,
              bytesReceived: selectedPair.bytesReceived,
              currentRoundTripTime: selectedPair.currentRoundTripTime,
            }
          : null,
        localCandidate: localCandidate
          ? {
              candidateType: localCandidate.candidateType,
              protocol: localCandidate.protocol,
              relayProtocol: localCandidate.relayProtocol,
            }
          : null,
        remoteCandidate: remoteCandidate
          ? {
              candidateType: remoteCandidate.candidateType,
              protocol: remoteCandidate.protocol,
              relayProtocol: remoteCandidate.relayProtocol,
            }
          : null,
      });
    } catch (error) {
      logWebrtcDebug(`${label} snapshot error`, { message: error?.message });
    }
  };

  const startStatsPolling = () => {
    if (!WEBRTC_DEBUG) return;
    clearStatsPolling();
    statsIntervalRef.current = setInterval(() => {
      logConnectionStatsSnapshot("periodic");
    }, 2000);
  };

  const createPeerConnection = async (targetUserId, remoteMediaStream) => {
    const iceServers = await getIceServers();
    logWebrtcDebug("createPeerConnection", {
      targetUserId,
      iceServerCount: Array.isArray(iceServers) ? iceServers.length : 0,
    });
    const peerConnection = new RTCPeerConnection({ iceServers });

    setIceConnectionState(peerConnection.iceConnectionState);
    setConnectionState(peerConnection.connectionState);
    setSignalingState(peerConnection.signalingState);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        setLocalCandidateCount((prev) => prev + 1);
        logWebrtcDebug("local ice-candidate", {
          to: targetUserId,
          candidateType: event.candidate.type || event.candidate.candidate,
        });
        sendIceCandidate({
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.onicecandidateerror = (event) => {
      logWebrtcDebug("icecandidateerror", {
        address: event?.address,
        port: event?.port,
        url: event?.url,
        errorCode: event?.errorCode,
        errorText: event?.errorText,
      });
    };

    peerConnection.ontrack = (event) => {
      logWebrtcDebug("remote track", {
        streamCount: event.streams?.length || 0,
        trackKinds: event.streams?.[0]?.getTracks()?.map((t) => t.kind) || [],
      });
      event.streams[0].getTracks().forEach((track) => {
        const alreadyAdded = remoteMediaStream.getTracks().some((t) => t.id === track.id);
        if (!alreadyAdded) {
          remoteMediaStream.addTrack(track);
        }
      });
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      logWebrtcDebug("connectionstatechange", { state });
      setConnectionState(state);
      if (state === "connected") {
        setCallStatus("Connected");
        logConnectionStatsSnapshot("connected");
      } else if (state === "connecting") {
        setCallStatus("Connecting");
      } else if (state === "disconnected" || state === "failed") {
        setCallStatus("Ended");
        logConnectionStatsSnapshot(state);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      logWebrtcDebug("iceconnectionstatechange", {
        state: peerConnection.iceConnectionState,
      });
      setIceConnectionState(peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === "failed") {
        logConnectionStatsSnapshot("ice-failed");
      }
    };

    peerConnection.onsignalingstatechange = () => {
      logWebrtcDebug("signalingstatechange", {
        state: peerConnection.signalingState,
      });
      setSignalingState(peerConnection.signalingState);
    };

    return peerConnection;
  };

  const cleanupCallState = () => {
    clearStatsPolling();

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidateerror = null;
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
    setIceConnectionState("new");
    setConnectionState("new");
    setSignalingState("stable");
    setLocalCandidateCount(0);
    setRemoteCandidateCount(0);
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

  const switchCamera = async () => {
    if (!localStream) return;
    if (!navigator.mediaDevices?.enumerateDevices) {
      toast.error("Camera switching is not supported in this browser.");
      return;
    }

    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");

      if (videoDevices.length < 2) {
        toast("No alternate camera found.");
        return;
      }

      const currentTrack = videoTracks[0];
      const currentDeviceId = currentTrack.getSettings()?.deviceId;
      const currentIndex = videoDevices.findIndex((device) => device.deviceId === currentDeviceId);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % videoDevices.length : 0;
      const nextDevice = videoDevices[nextIndex];

      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: nextDevice.deviceId } },
        audio: false,
      });
      const nextVideoTrack = nextStream.getVideoTracks()[0];

      const peerConnection = peerConnectionRef.current;
      if (peerConnection) {
        const sender = peerConnection.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(nextVideoTrack);
        } else {
          peerConnection.addTrack(nextVideoTrack, localStream);
        }
      }

      nextVideoTrack.enabled = !isCameraOff;

      const updatedStream = new MediaStream([
        ...localStream.getAudioTracks(),
        nextVideoTrack,
      ]);
      currentTrack.stop();
      setLocalStream(updatedStream);
    } catch (error) {
      console.error("Failed to switch camera:", error);
      toast.error("Could not switch camera.");
    }
  };

  const acceptIncomingCall = async () => {
    if (!pendingIncomingCall) return;
    if (peerConnectionRef.current) return;
    logWebrtcDebug("acceptIncomingCall", {
      from: pendingIncomingCall.from,
      callType: pendingIncomingCall.callType,
      hasOffer: Boolean(pendingIncomingCall.offer),
    });
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
      logWebrtcDebug("setRemoteDescription(offer) success", {
        from: pendingIncomingCall.from,
      });

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await waitForIceGatheringComplete(peerConnection);
      const finalAnswer = peerConnection.localDescription || answer;
      logWebrtcDebug("create/setLocalDescription(answer) success", {
        to: pendingIncomingCall.from,
      });

      answerCall({
        to: pendingIncomingCall.from,
        answer: finalAnswer,
      });

      setIsVideoCall(effectiveType === "video");
      setLocalStream(stream);
      setRemoteStream(remoteMediaStream);
      setIsCallModalOpen(true);
      setCallStatus("Connecting");
      startStatsPolling();
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
    if (!callTargetId) return;
    try {
      logWebrtcDebug("startCall", {
        to: callTargetId,
        requestedType: callType,
      });
      setCallStatus("Connecting");
      const { stream, effectiveType } = await getMediaWithFallback(callType);
      const remoteMediaStream = new MediaStream();

      const peerConnection = await createPeerConnection(callTargetId, remoteMediaStream);
      peerConnectionRef.current = peerConnection;
      activePeerUserIdRef.current = callTargetId;

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(peerConnection);
      const finalOffer = peerConnection.localDescription || offer;
      logWebrtcDebug("create/setLocalDescription(offer) success", {
        to: callTargetId,
        effectiveType,
      });

      callUser({
        to: callTargetId,
        offer: finalOffer,
        callType: effectiveType,
      });
      setCallStatus("Ringing");

      setIsVideoCall(effectiveType === "video");
      setLocalStream(stream);
      setRemoteStream(remoteMediaStream);
      setIsCallModalOpen(true);
      startStatsPolling();
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
    logWebrtcDebug("incomingCall", {
      from: incomingCall.from,
      callType: incomingCall.callType,
      hasOffer: Boolean(incomingCall.offer),
    });
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

      logWebrtcDebug("remoteAnswer received", {
        from: remoteAnswer.from,
        hasAnswer: Boolean(remoteAnswer.answer),
        signalingState: peerConnectionRef.current.signalingState,
      });

      if (peerConnectionRef.current.signalingState === "have-local-offer") {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(remoteAnswer.answer));
        logWebrtcDebug("setRemoteDescription(answer) success", {
          from: remoteAnswer.from,
        });
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
      setRemoteCandidateCount((prev) => prev + 1);
      logWebrtcDebug("remote ice-candidate", {
        from: remoteIceCandidate.from,
        candidateType: candidate.type || candidate.candidate,
        hasRemoteDescription: Boolean(peerConnectionRef.current.remoteDescription),
      });

      if (peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        logWebrtcDebug("queue remote ice-candidate", {
          from: remoteIceCandidate.from,
        });
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
      clearStatsPolling();
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

  useEffect(() => {
    if (!socket || !selectedChat?._id) return;

    const handleRoomCreate = ({ roomId, chatId, hostId }) => {
      if (String(chatId) !== String(selectedChat._id)) return;
      setActiveGroupRoom({ roomId, chatId, hostId });
    };

    const handleRoomEnded = ({ roomId, chatId }) => {
      if (String(chatId) !== String(selectedChat._id)) return;
      setActiveGroupRoom(null);
      if (selectedChat?._id) {
        localStorage.removeItem(`active-call-${selectedChat._id}`);
      }
      if (isGroupCallOpen && String(roomId) === String(activeGroupRoom?.roomId)) {
        setIsGroupCallOpen(false);
      }
    };

    const handleHostChanged = ({ roomId, chatId, hostId }) => {
      if (String(chatId) !== String(selectedChat._id)) return;
      setActiveGroupRoom((prev) =>
        prev && String(prev.roomId) === String(roomId) ? { ...prev, hostId } : prev
      );
    };

    socket.on("call:room:create", handleRoomCreate);
    socket.on("call:room:ended", handleRoomEnded);
    socket.on("call:room:hostChanged", handleHostChanged);

    return () => {
      socket.off("call:room:create", handleRoomCreate);
      socket.off("call:room:ended", handleRoomEnded);
      socket.off("call:room:hostChanged", handleHostChanged);
    };
  }, [socket, selectedChat?._id, isGroupCallOpen, activeGroupRoom?.roomId]);

  useEffect(() => {
    if (!selectedChat?.isGroup) return;
    let isMounted = true;
    const fetchActiveRoom = async () => {
      try {
        const res = await axiosInstance.get("/calls/rooms/active", {
          params: { chatId: selectedChat._id },
        });
        if (!isMounted) return;
        if (res.data?.roomId) {
          setActiveGroupRoom(res.data);
          setGroupCallType(res.data.callType || "video");
          const shouldAutoJoin =
            localStorage.getItem(`active-call-${selectedChat._id}`) === "true";
          if (shouldAutoJoin && !autoJoinGuardRef.current && !isGroupCallOpen) {
            autoJoinGuardRef.current = true;
            await joinGroupCall(true);
          }
        } else {
          setActiveGroupRoom(null);
        }
      } catch (error) {
        console.error("fetchActiveRoom error", error?.message || error);
      }
    };
    fetchActiveRoom();
    return () => {
      isMounted = false;
    };
  }, [selectedChat?._id, selectedChat?.isGroup]);

  const startGroupCall = async (callType) => {
    if (!selectedChat?._id) return;
    try {
      setGroupCallType(callType);
      const res = await axiosInstance.post("/calls/rooms", {
        chatId: selectedChat._id,
        callType,
      });
      const room = res.data;
      setActiveGroupRoom(room);
      const socket = useAuthStore.getState().socket;
      if (res.status === 201) {
        socket?.emit("call:room:create", {
          roomId: room.roomId,
          chatId: selectedChat._id,
        });
      } else {
        socket?.emit("call:room:join", {
          roomId: room.roomId,
          chatId: selectedChat._id,
        });
      }
      setGroupCallType(room.callType || callType);
      setIsGroupCallOpen(true);
      localStorage.setItem(`active-call-${selectedChat._id}`, "true");
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to start group call";
      toast.error(msg);
    }
  };

  const joinGroupCall = async (isAutoJoin = false) => {
    if (!activeGroupRoom?.roomId) return;
    try {
      const res = await axiosInstance.post(`/calls/rooms/${activeGroupRoom.roomId}/join`);
      const room = res.data;
      setActiveGroupRoom(room);
      setGroupCallType(room.callType || "video");
      const socket = useAuthStore.getState().socket;
      socket?.emit("call:room:join", {
        roomId: room.roomId,
        chatId: selectedChat._id,
      });
      setIsGroupCallOpen(true);
      localStorage.setItem(`active-call-${selectedChat._id}`, "true");
    } catch (error) {
      if (!isAutoJoin) {
        const msg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to join group call";
        toast.error(msg);
      }
    }
  };

  const leaveGroupCall = async () => {
    if (!activeGroupRoom?.roomId) return;
    try {
      await axiosInstance.post(`/calls/rooms/${activeGroupRoom.roomId}/leave`);
      const socket = useAuthStore.getState().socket;
      socket?.emit("call:room:leave", {
        roomId: activeGroupRoom.roomId,
        chatId: selectedChat._id,
      });
    } catch (error) {
      console.error("leaveGroupCall error", error?.message || error);
    } finally {
      setIsGroupCallOpen(false);
      if (selectedChat?._id) {
        localStorage.removeItem(`active-call-${selectedChat._id}`);
      }
    }
  };

  const endGroupCall = async () => {
    if (!activeGroupRoom?.roomId) return;
    try {
      await axiosInstance.post(`/calls/rooms/${activeGroupRoom.roomId}/end`);
      const socket = useAuthStore.getState().socket;
      socket?.emit("call:room:ended", {
        roomId: activeGroupRoom.roomId,
        chatId: selectedChat._id,
      });
      setActiveGroupRoom(null);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to end group call";
      toast.error(msg);
    } finally {
      setIsGroupCallOpen(false);
      if (selectedChat?._id) {
        localStorage.removeItem(`active-call-${selectedChat._id}`);
      }
    }
  };

  return (
    <>
      <div className="p-2.5 border-b border-base-300">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img
                src={
                  selectedChat?.isGroup
                    ? selectedChat.groupPhoto || "/avatar.png"
                    : otherParticipant?.profilePic || "/avatar.png"
                }
                alt={chatTitle}
              />
            </div>
          </div>

          {/* Chat info */}
          <div>
            <h3 className="font-medium">{chatTitle}</h3>
            <p className="text-sm text-base-content/70">{chatSubtitle}</p>
            {callStatus !== "Idle" && (
              <p className="text-xs text-primary mt-0.5">Call: {callStatus}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedChat?.isGroup && (
            <button
              className="btn btn-sm btn-circle"
              title="Group settings"
              onClick={() => setIsGroupSettingsOpen(true)}
            >
              <MoreHorizontal className="size-4" />
            </button>
          )}
          {callTargetId && (
            <>
              <button
                className="btn btn-sm btn-circle"
                title="Start Audio Call"
                onClick={() => startCall("audio")}
              >
                <Phone className="size-4" />
              </button>
              <button
                className="btn btn-sm btn-circle"
                title="Start Video Call"
                onClick={() => startCall("video")}
              >
                <Video className="size-4" />
              </button>
            </>
          )}
          {!callTargetId && selectedChat?.isGroup && (
            <>
              <button
                className="btn btn-sm btn-circle"
                title="Start group audio call"
                onClick={() => startGroupCall("audio")}
              >
                <Phone className="size-4" />
              </button>
              <button
                className="btn btn-sm btn-circle"
                title="Start group video call"
                onClick={() => startGroupCall("video")}
              >
                <Video className="size-4" />
              </button>
            </>
          )}
          {/* Close button */}
          <button onClick={() => setSelectedChat(null)}>
            <X />
          </button>
        </div>
      </div>

      {selectedChat?.isGroup && activeGroupRoom?.roomId && !isGroupCallOpen && (
        <div className="mt-3 p-3 rounded-lg border border-base-300 bg-base-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Users className="size-4" />
            <span>Group call in progress</span>
          </div>
          <button className="btn btn-sm btn-primary" onClick={joinGroupCall}>
            Join call
          </button>
        </div>
      )}

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
        onSwitchCamera={switchCamera}
        diagnostics={{
          iceConnectionState,
          connectionState,
          signalingState,
          localCandidateCount,
          remoteCandidateCount,
        }}
      />
      </div>
      <GroupSettingsModal
        isOpen={isGroupSettingsOpen}
        onClose={() => setIsGroupSettingsOpen(false)}
      />
      <GroupCallModal
        isOpen={isGroupCallOpen}
        roomId={activeGroupRoom?.roomId}
        chatId={selectedChat?._id}
        callType={groupCallType}
        isHost={String(activeGroupRoom?.hostId) === String(authUser?._id)}
        onClose={leaveGroupCall}
        onLeave={leaveGroupCall}
        onEnd={endGroupCall}
      />
    </>
  );
};
export default ChatHeader;
