// import {Server} from "socket.io";
// import http from "http";
// import express from 'express';

// const app=express();
// const server=http.createServer(app);

// const io=new Server(server,{
//     cors:{
//         origin:["http://localhost:5173",
//             "https://chat-app-front end-rr10.onrender.com"
//         ],
//      methods: ["GET", "POST"],
//     credentials: true
//     },
// });

// const userSocketMap={}; //{userId:socketId}

// export function getRecieverSocketId(userId){
//     return userSocketMap[userId];
// }




// io.on("connection",(socket)=>{
//     console.log("A user connected", socket.id);

//     const userId=socket.handshake.query.userId
//     if(userId)userSocketMap[userId]=socket.id

//     // io.emit used to send events to all the connected clients
//     io.emit("getOnlineUsers",Object.keys(userSocketMap));

//     socket.on("disconnect",()=>{
//         console.log("A user disconnected",socket.id)
//         delete userSocketMap[userId];
//         io.emit("getOnlineUsers",Object.keys(userSocketMap));
//     })
// })
// export {io,app,server};

import { Server } from "socket.io";

let io;
let userSocketMap = {}; // { userId: socketId }

// Initialize socket.io server with http server passed in
export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        // Remove old frontend domain if not used anymore
        //"https://chat-app-frontend-rr10.onrender.com"
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Socket connection handler
  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("disconnect", () => {
      console.log("A user disconnected", socket.id);
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
  });

  return io;
}

// Helper to get a user's socket ID by userId
export function getRecieverSocketId(userId) {
  return userSocketMap[userId];
}
