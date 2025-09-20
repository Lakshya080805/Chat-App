import axios from "axios";

export const axiosInstance=axios.create({
    baseURL : import.meta.env.MODE==="development"?"https://chat-app-2-2qpk.onrender.com":"/api",
    withCredentials: true,

})

//http://localhost:5000/api