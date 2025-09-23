// import axios from "axios";

// export const axiosInstance=axios.create({
//     baseURL : import.meta.env.MODE==="development"?"https://chat-app-2-2qpk.onrender.com":"/api",
//     withCredentials: true,

// })

//http://localhost:5000/api

import axios from "axios";

// const BASE_URL =
//   import.meta.env.MODE === "development"
//     ? "http://localhost:5000/api" // local backend
//     : "https://chat-app-2-2qpk.onrender.com/api"; // deployed backend

const BASE_URL = "";

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});


// axiosInstance.interceptors.request.use(
//   (config) => {
//     const token = localStorage.getItem('token'); // Get token from localStorage
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`; // Attach token
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );
