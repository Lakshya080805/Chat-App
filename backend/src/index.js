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
// const PORT=process.env.PORT || 5000;
// const __dirname=path.resolve();


// app.use(express.json());
// app.use(cookieParser());
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://chat-app-frontend-rr10.onrender.com"
// ];
// app.use(cors({
//     origin:allowedOrigins,
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

//----------------------------------------------------------------------------------------------------------

import express from "express";
import http from "http";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
// import { app, server } from "./lib/socket.js";
import { initSocket } from "./lib/socket.js";
import { setIO } from "./lib/socketInstance.js";

// dotenv.config();
// const PORT = process.env.PORT || 5000;

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const frontendPath = path.join(__dirname, "../frontend/dist");

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = initSocket(server);
setIO(io);

const PORT = process.env.PORT || 5000;
const frontendPath = path.join(__dirname, "../frontend/dist");

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173",
  "https://chat-app-frontend-rr10.onrender.com",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendPath));
  app.get("/*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

server.listen(PORT, () => {
  console.log("server running on port:" + PORT);
  connectDB();
});
