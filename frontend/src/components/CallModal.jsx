import { useEffect, useRef } from "react";

const CallModal = ({
  isOpen,
  onClose,
  localStream,
  remoteStream,
  isVideo = true,
  callStatus = "Connecting",
  isMuted = false,
  isCameraOff = false,
  onToggleMute,
  onToggleCamera,
  diagnostics,
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (localAudioRef.current && localStream) {
      localAudioRef.current.srcObject = localStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }

    return () => {
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (localAudioRef.current) localAudioRef.current.srcObject = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    };
  }, [localStream, remoteStream]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg p-4 shadow-lg relative w-full max-w-md flex flex-col items-center">
        <button className="absolute top-2 right-2 btn btn-sm" onClick={onClose}>
          ✕
        </button>
        <div className="w-full flex flex-col items-center gap-4">
          {isVideo ? (
            <>
              <div className="w-full">
                <p className="text-xs text-base-content/60 mb-1">You</p>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-32 h-32 bg-black rounded-lg border"
                />
              </div>
              <div className="w-full">
                <p className="text-xs text-base-content/60 mb-1">Remote</p>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-64 h-64 bg-black rounded-lg border"
                />
              </div>
            </>
          ) : (
            <>
              <audio ref={localAudioRef} autoPlay muted />
              <audio ref={remoteAudioRef} autoPlay />
              <div className="text-center text-base-content/80">Audio call in progress...</div>
            </>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-sm" onClick={onToggleMute}>
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button className="btn btn-sm" onClick={onToggleCamera} disabled={!isVideo}>
            {isCameraOff ? "Camera On" : "Camera Off"}
          </button>
          <button className="btn btn-error btn-sm" onClick={onClose}>
            Hang Up
          </button>
        </div>
        <p className="mt-2 text-xs text-base-content/70">Status: {callStatus}</p>
        {diagnostics && (
          <div className="mt-2 w-full rounded border border-base-300 p-2 text-xs text-base-content/70">
            <p>ICE state: {diagnostics.iceConnectionState}</p>
            <p>Peer state: {diagnostics.connectionState}</p>
            <p>Signaling: {diagnostics.signalingState}</p>
            <p>Candidates: local {diagnostics.localCandidateCount} | remote {diagnostics.remoteCandidateCount}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallModal;
