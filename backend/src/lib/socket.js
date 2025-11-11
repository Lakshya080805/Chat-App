// import {Server} from "socket.io";
// import http from "http";
// import express from 'express';

// const app=express();
// const server=http.createServer(app);

// const io=new Server(server,{
//     cors:{
//         origin:["http://localhost:5173"]
//     },
// });

// export function getRecieverSocketId(userId){
//     return userSocketMap[userId];
// }

// const userSocketMap={}; //{userId:socketId}


// io.on("connection",(socket)=>{
//     console.log("A user connected", socket.id);

//     const 
//     userId=socket.handshake.query.userId
//     if(userId)userSocketMap[userId]=socket.id

//     // io.emit used to send events to all the connected clients
//     io.emit("getOnlineUsers",Object.keys(userSocketMap));

//   //   // ✅ --- VIDEO CALL EVENTS ---
//   // socket.on("call-user", ({ to, offer }) => {
//   //   console.log("➡️ call-user from:", userId, "to:", to);
//   //   const targetSocketId = userSocketMap[to];
//   //   if (targetSocketId) {
//   //     io.to(targetSocketId).emit("incoming-call", { from: userId, offer });
//   //     console.log("✅ incoming-call sent to:", to);
//   //   } else {
//   //     console.log("❌ Target not online:", to);
//   //   }
//   // });

//   // socket.on("answer-call", ({ to, answer }) => {
//   //   const targetSocketId = userSocketMap[to];
//   //   if (targetSocketId) {
//   //     io.to(targetSocketId).emit("call-accepted", { answer });
//   //     console.log("✅ call-accepted sent to:", to);
//   //   }
//   // });

//   // socket.on("ice-candidate", ({ to, candidate }) => {
//   //   const targetSocketId = userSocketMap[to];
//   //   if (targetSocketId) {
//   //     io.to(targetSocketId).emit("ice-candidate", { candidate });
//   //   }
//   // });
//   //-----------------------------------------------------
//     socket.on("disconnect",()=>{
//         console.log("A user disconnected",socket.id)
//         delete userSocketMap[userId];
//         io.emit("getOnlineUsers",Object.keys(userSocketMap));
//     })
// })
// export {io,app,server};


import {Server} from "socket.io";
import http from "http";
import express from 'express';

const app=express();
const server=http.createServer(app);

const io=new Server(server,{
    cors:{
        origin:["http://localhost:5173"]
    },
});

export function getRecieverSocketId(userId){
    return userSocketMap[userId];
}

const userSocketMap={}; //{userId:socketId}


io.on("connection",(socket)=>{
    console.log("A user connected", socket.id);

    const userId=socket.handshake.query.userId
    if(userId)userSocketMap[userId]=socket.id

    // io.emit used to send events to all the connected clients
    io.emit("getOnlineUsers",Object.keys(userSocketMap));

    socket.on("disconnect",()=>{
        console.log("A user disconnected",socket.id)
        delete userSocketMap[userId];
        io.emit("getOnlineUsers",Object.keys(userSocketMap));
    })
})
export {io,app,server};