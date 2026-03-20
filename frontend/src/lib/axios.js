// import axios from "axios";

// export const axiosInstance=axios.create({
//     baseURL : import.meta.env.MODE==="development"?"http://localhost:5000/api":"/api",
//     withCredentials: true,

// })

import axios from "axios";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : import.meta.env.VITE_BACKEND_URL; // ✅ comes from Vercel env var

export const axiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("chat-auth-token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
