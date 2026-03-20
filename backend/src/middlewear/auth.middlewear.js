import jwt from "jsonwebtoken"
import User from "../models/user.model.js"

export const protectRoute=async(req,res,next)=>{
    try {
        const cookieToken = req.cookies?.jwt;
        const authHeader = req.headers?.authorization || "";
        const bearerToken = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;
        const token = cookieToken || bearerToken;

        if (!token) {
            return res.status(401).json({ message: "Unauthorized no token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded) {
            return res.status(401).json({ message: "Unauthorized invalid token" });
        }

        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        req.user = user;

        next();
    } catch (error) {
        console.log("Error in protect route middleware:", error.message);
        res.status(500).json({ message: "Internal error" });
    }
}