// import express from "express";
// import dotenv from "dotenv";
// import cookieParser from "cookie-parser"
// import cors from "cors"

// import path from "path";

// import {connectDB} from "./lib/db.js"

// import authRoutes from "./routes/auth.route.js"
// import messageRoutes from "./routes/message.route.js"
// import { app,server } from "./lib/socket.js";

// dotenv.config();
// const PORT=process.env.PORT;
// const __dirname=path.resolve();


// app.use(express.json());
// app.use(cookieParser());
// app.use(cors({
//     origin:"http://localhost:5173",
//     credentials:true
// }))


// app.use("/api/auth",authRoutes)
// app.use("/api/messages",messageRoutes)

// if(process.env.NODE_ENV==="production"){
//     app.use(express.static(path.join(__dirname,"../frontend/dist")));

//     app.get(/.*/,(req,res)=>{
//         res.sendFile(path.join(__dirname,"../frontend","dist","index.html"));
        
//     })
// }

// server.listen(PORT,()=>{
//     console.log("server running on port:"+PORT);
//     connectDB()
// })


import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser"
import cors from "cors"

import path from "path";

import {connectDB} from "./lib/db.js"

import authRoutes from "./routes/auth.route.js"
import messageRoutes from "./routes/message.route.js"
import { app,server } from "./lib/socket.js";

dotenv.config();
const PORT=process.env.PORT || 5000;
const __dirname=path.resolve();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
 
app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    // origin:"http://localhost:5173",
    credentials:true,
    origin: process.env.NODE_ENV === "production" ? FRONTEND_URL : "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}))


app.get("/_health", (req, res) => res.sendStatus(200));

app.use("/api/auth",authRoutes)
app.use("/api/messages",messageRoutes)

// if(process.env.NODE_ENV==="production"){
//     app.use(express.static(path.join(__dirname,"../frontend/dist")));

//     app.get(/.*/,(req,res)=>{
//         res.sendFile(path.join(__dirname,"../frontend","dist","index.html"));
        
//     })
// }

// server.listen(PORT,()=>{
//     console.log("server running on port:"+PORT);
//     connectDB()
// })
server.listen(PORT, async () => {
  console.log("Server running on port:", PORT);
  try {
    await connectDB();
    console.log("Connected to DB");
  } catch (err) {
    console.error("DB connection error:", err);
  }
});