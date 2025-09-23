import jwt from "jsonwebtoken";

export const  generateToken=(userId,res)=>{

    const token=jwt.sign({userId},process.env.JWT_SECRET,{
        expiresIn:"7d"
    })

    res.cookie("jwt",token,{
        maxAge: 7*24*60*60*1000,
        httpOnly:true, // prevent XSS attack cross site scripting attack
        // sameSite:"none",
        // secure: process.env.NODE_ENV!=="production"
        // secure:true,
         sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production", // enable in prod only
        path: "/", 
    })
    return token;
}