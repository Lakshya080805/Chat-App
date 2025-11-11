// import React, { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";

// const socket = io("http://localhost:3000", {
//   query: { userId: "Call"}, // Replace with actual userId from auth
// });

// const VideoCall = ({ peerId }) => {
//   const localVideoRef = useRef(null);
//   const remoteVideoRef = useRef(null);
//   const pcRef = useRef(null);

//   const [inCall, setInCall] = useState(false);
// // 
//   useEffect(() => {
//     pcRef.current = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });

//     pcRef.current.onicecandidate = (event) => {
//       if (event.candidate) {
//         socket.emit("ice-candidate", {
//           to: peerId,
//           candidate: event.candidate,
//         });
//       }
//     };

//     pcRef.current.ontrack = (event) => {
//       remoteVideoRef.current.srcObject = event.streams[0];
//     };

//     socket.on("incoming-call", async ({ from, offer }) => {
//       const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//       localVideoRef.current.srcObject = stream;
//       stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));

//       await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
//       const answer = await pcRef.current.createAnswer();
//       await pcRef.current.setLocalDescription(answer);

//       socket.emit("answer-call", { to: from, answer });
//       setInCall(true);
//     });

//     socket.on("call-accepted", async ({ answer }) => {
//       await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
//       setInCall(true);
//     });

//     socket.on("ice-candidate", ({ candidate }) => {
//       pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
//     });

//     return () => {
//       socket.off("incoming-call");
//       socket.off("call-accepted");
//       socket.off("ice-candidate");
//     };
//   }, [peerId]);

//   const startCall = async () => {
//     const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//     localVideoRef.current.srcObject = stream;
//     stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));

//     const offer = await pcRef.current.createOffer();
//     await pcRef.current.setLocalDescription(offer);

//     socket.emit("call-user", { to: peerId, offer });
//   };

//   return (
//     <div className="video-container">
//       <div>
//         <video ref={localVideoRef} autoPlay playsInline muted />
//         <video ref={remoteVideoRef} autoPlay playsInline />
//       </div>

//       {!inCall && (
//         <button onClick={startCall} className="btn btn-primary">
//           Start Call
//         </button>
//       )}
//     </div>
//   );
// };

// export default VideoCall;
