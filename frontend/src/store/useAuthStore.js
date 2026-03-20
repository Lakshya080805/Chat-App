// import {create} from "zustand"
// import { axiosInstance } from "../lib/axios"
// import { toast } from "react-hot-toast";
// import { io } from "socket.io-client";

// const BASE_URL=import.meta.env.MODE==="development"?"http://localhost:5000":"/"

// export const useAuthStore=create((set,get)=>({
//     authUser:null,
//      isSigningUp:false,
//      isLoggingIn:false,
//      isUpdatingProfile:false,
//     isCheckingAuth:true,
//     onlineUsers:[],
//     socket:null,

//     checkAuth:async()=>{
//         try{
//       const res=await axiosInstance.get("/auth/check");

//       set({authUser:res.data});
//       get().connectSocket()
//         }
//         catch(error){
//             console.log("error in checkAuth",error);
//         set({authUser:null})
//         }
//         finally{
//             set({isCheckingAuth:false})
//         }


//     },

//     signup:async(data)=>{
//         set({isSigningUp:true});
//        try{
//         const res =await axiosInstance.post("/auth/signup",data);
//         set({authUser:res.data});
//         toast.success("Account created successfully");

//         get().connectSocket()
//        }
//     //    catch(error){
//     //     toast.error(error.response.data.message);
//     //    }
//     catch (error) {
//     const errorMessage =
//       error?.response?.data?.message || error.message || "Login failed";
//     toast.error(errorMessage);
//   }
//        finally{
//         set({isSigningUp:false});
//        }
//     },

//     login: async(data)=>{
//         set({isLoggingIn:true});
//         try{
//             const res=await axiosInstance.post("/auth/login",data);
//             set({authUser:res.data});
//             toast.success("Logged in successfully");

//             get().connectSocket()
//         }
//         // catch(error){
//         //      toast.error(error.response.data.message);
//         // }
//         catch (error) {
//     const errorMessage =
//       error?.response?.data?.message || error.message || "Login failed";
//     toast.error(errorMessage);
//   }
//         finally{
//             set({isLoggingIn:false})
//     }
//     },

//     logout: async()=>{
//         try{
//            await axiosInstance.post("/auth/logout")
//            set({authUser:null})
//            toast.success("Logged out successfully")
//            get().disconnectSocket()
//         }
//         catch(error){
//             toast.error(error.response.data.message)

//         }
//     },

//     updateProfile:async(data)=>{
//         set({isUpdatingProfile:true});
//         try{
//             const res=await axiosInstance.put("/auth/update-profile",data);
//             set({authUser:res.data});
//             toast.success("Profile updated successfully");
//         }
//         catch(error){
//             console.log("error in updateProfile",error);
//             toast.error(error.response.data.message);
//         }
//         finally{
//             set({isUpdatingProfile:false});
//         }
//     },

//     connectSocket:()=>{
//         const {authUser}=get()
//         if(!authUser || get().socket?.connected)return ;

//         const socket=io(BASE_URL,{
//             query:{
//                 userId:authUser._id,
//             },
//         })
//         socket.connect();

//         set({socket:socket});

//         socket.on("getOnlineUsers", (userIds)=>{
//              set({onlineUsers:userIds});
//         })
//     },

//     disconnectSocket:()=>{
//          if (get().socket?.connected) get().socket.disconnect();
//     }
// }));



import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { toast } from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : import.meta.env.VITE_BACKEND_URL; // Vercel env var

const SOCKET_DEBUG = String(import.meta.env.VITE_DEBUG_WEBRTC || "false").toLowerCase() === "true";

const logSocketDebug = (...args) => {
  if (!SOCKET_DEBUG) return;
  console.log("[socket-debug]", ...args);
};

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,
  incomingCall: null,
  remoteAnswer: null,
  remoteIceCandidate: null,
  callEndedBy: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      if (error?.response?.status !== 401) {
        console.log("error in checkAuth", error);
      }
      localStorage.removeItem("chat-auth-token");
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      if (res?.data?.token) {
        localStorage.setItem("chat-auth-token", res.data.token);
      }
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || error.message || "Signup failed";
      toast.error(errorMessage);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      if (res?.data?.token) {
        localStorage.setItem("chat-auth-token", res.data.token);
      }
      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || error.message || "Login failed";
      toast.error(errorMessage);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      localStorage.removeItem("chat-auth-token");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || "Logout failed";
      toast.error(msg);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in updateProfile", error);
      const msg = error?.response?.data?.message || error?.message || "Update failed";
      toast.error(msg);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser, socket } = get();
    if (!authUser) return;
    if (socket?.connected) return;

    // create socket but don't auto connect until configured
    const s = io(BASE_URL, {
      autoConnect: false,
      auth: {
        userId: authUser._id, // server reads handshake.auth.userId
      },
      withCredentials: true,
    });

    // connect after creation
    s.connect();

    // set socket in store
    set({ socket: s });

    s.on("connect", () => {
      console.log("socket connected:", s.id);
      logSocketDebug("connected", { socketId: s.id, userId: authUser._id });
    });

    s.on("connect_error", (err) => {
      console.error("socket connect_error:", err);
      logSocketDebug("connect_error", { message: err?.message, name: err?.name });
    });

    s.on("getOnlineUsers", (userIds) => {
      logSocketDebug("getOnlineUsers", { count: userIds?.length || 0, userIds });
      set({ onlineUsers: userIds });
    });

    // WebRTC signaling events
    s.on("call-user", (payload) => {
      logSocketDebug("recv call-user", {
        from: payload?.from,
        callType: payload?.callType,
        hasOffer: Boolean(payload?.offer),
      });
      set({ incomingCall: payload });
    });

    s.on("answer-call", (payload) => {
      logSocketDebug("recv answer-call", {
        from: payload?.from,
        hasAnswer: Boolean(payload?.answer),
      });
      set({ remoteAnswer: payload });
    });

    s.on("ice-candidate", (payload) => {
      logSocketDebug("recv ice-candidate", {
        from: payload?.from,
        candidateType: payload?.candidate?.type || payload?.candidate?.candidate,
      });
      set({ remoteIceCandidate: payload });
    });

    s.on("end-call", (payload) => {
      logSocketDebug("recv end-call", { from: payload?.from });
      set({ callEndedBy: payload?.from || null, incomingCall: null, remoteAnswer: null, remoteIceCandidate: null });
    });

    // safe cleanup on disconnect
    s.on("disconnect", () => {
      logSocketDebug("disconnected", { socketId: s.id, userId: authUser._id });
      set({ onlineUsers: [] });
      // keep socket until disconnectSocket clears it so you can inspect state if needed
    });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      try {
        socket.disconnect();
      } catch (err) {
        console.warn("socket disconnect error", err);
      }
    }
    // clear socket and online users from store
    set({
      socket: null,
      onlineUsers: [],
      incomingCall: null,
      remoteAnswer: null,
      remoteIceCandidate: null,
      callEndedBy: null,
    });
  },

  callUser: ({ to, offer, callType = "video" }) => {
    const socket = get().socket;
    if (!socket?.connected) return;
    logSocketDebug("emit call-user", {
      socketId: socket.id,
      to,
      callType,
      hasOffer: Boolean(offer),
    });
    socket.emit("call-user", { to, offer, callType });
  },

  answerCall: ({ to, answer }) => {
    const socket = get().socket;
    if (!socket?.connected) return;
    logSocketDebug("emit answer-call", {
      socketId: socket.id,
      to,
      hasAnswer: Boolean(answer),
    });
    socket.emit("answer-call", { to, answer });
  },

  sendIceCandidate: ({ to, candidate }) => {
    const socket = get().socket;
    if (!socket?.connected) return;
    logSocketDebug("emit ice-candidate", {
      socketId: socket.id,
      to,
      candidateType: candidate?.type || candidate?.candidate,
    });
    socket.emit("ice-candidate", { to, candidate });
  },

  endCall: ({ to }) => {
    const socket = get().socket;
    if (!socket?.connected) return;
    logSocketDebug("emit end-call", { socketId: socket.id, to });
    socket.emit("end-call", { to });
    set({ incomingCall: null, remoteAnswer: null, remoteIceCandidate: null, callEndedBy: null });
  },

  clearCallSignals: () => {
    set({ incomingCall: null, remoteAnswer: null, remoteIceCandidate: null, callEndedBy: null });
  },
}));