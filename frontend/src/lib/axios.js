// import axios from "axios";

// export const axiosInstance=axios.create({
//     baseURL : import.meta.env.MODE==="development"?"https://chat-app-2-2qpk.onrender.com":"/api",
//     withCredentials: true,

// })

//http://localhost:5000/api

import axios from "axios";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000/api" // local backend
    : "https://chat-app-2-2qpk.onrender.com/api"; // deployed backend

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});
