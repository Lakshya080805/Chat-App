<p align="center">
  <strong>Real-time chat platform with 1:1 + group messaging, invites, and audio/video calling.</strong>
</p>
<p align="center">
  <a href="https://chat-app-peach-six-84.vercel.app/">
    <img src="https://img.shields.io/badge/Live%20Demo-Visit-brightgreen?style=for-the-badge" />
  </a>
</p>

# 🚀 Conversations & Calls

- **Production-grade calling** — peer-to-peer WebRTC for 1:1, 
   scalable LiveKit rooms for groups, with screen sharing, 
   host controls, and Twilio ICE for NAT traversal

---

## ✨ Highlights

- **Real-time everywhere** — messages, reactions, typing, and call events via Socket.IO
- **Dual calling system** — WebRTC for 1:1 calls, LiveKit for group calls
- **Media resilience** — audio-only fallback if camera is busy, ICE from Twilio
- **Group-first UX** — roles, invites, member management, call history
- **UX polish** — emoji picker, reaction tooltips, linkified messages, themes

---

## ✅ Core Features


 ### 🔐 Auth & Profiles
- JWT + HTTP-only cookies
- Signup / login / logout
- Profile photo upload (Cloudinary)
- Member since and status display

### 💬 Messaging
- 1:1 and group messages
- Image attachments with preview
- Link detection in messages
- Timestamps and read-friendly layout

### 👥 Groups
- Create groups
- Add/remove members
- Promote/demote admins
- Update group photo
- Leave group / auto-delete if empty

  
### 📞 1:1 Audio & Video Calls (WebRTC)
- Peer-to-peer audio and video calling directly from the chat
- Incoming call banner with accept / reject
- Call status flow: `ringing → connecting → connected → ended`
- Mute / unmute microphone
- Camera on/off toggle
- Front/back camera switch (mobile-friendly)
- Fallback to audio-only if camera is unavailable or busy
- ICE servers via Twilio for reliable NAT traversal
- Full WebRTC diagnostics (ICE state, connection state, signaling state, candidate counts)

### 📹 Group Audio & Video Calls (LiveKit)
- Multi-participant audio and video calls inside group chats
- **Screen sharing** — share your screen alongside your camera feed
- Separate tiles for screen share vs. camera (no overlap)
- Active speaker highlighting
- Paginated participant grid for large groups
- Host controls — end call for everyone, automatic host handover on leave
- Camera, mic, and screen share toggles mid-call
- Auto-rejoin if you accidentally close the tab
- Call history per group (duration, participants, call type)
- Live call history tab inside group settings

 ### 🔗 Invites
- Generate invite links with expiry
- Invite preview page
- Join group via invite
- Share invite inside chats

 

### 😀 Reactions
- Emoji picker
- Reaction counts with hover tooltips
- Optimistic UI + realtime sync

### ✍️ Typing
- Typing indicator per chat
- Throttled typing events





---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, DaisyUI |
| State | Zustand |
| Real-time | Socket.IO |
| 1:1 Calls | WebRTC |
| Group Calls | LiveKit |
| Backend | Node.js, Express 5 |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcrypt |
| Media | Cloudinary |
| ICE Servers | Twilio |

---

## 📂 Project Structure

```bash
frontend/
├── src/components/
├── src/pages/
├── src/store/
└── src/lib/

backend/
├── src/controllers/
├── src/models/
├── src/routes/
├── src/services/
└── src/lib/
```

---

## 🌐 API Endpoints

| Area | Routes |
|---|---|
| Auth | `POST /api/auth/signup` `POST /api/auth/login` `POST /api/auth/logout` `GET /api/auth/check` |
| Messages | `GET /api/messages/users` `GET /api/messages/:id` `POST /api/messages/send/:id` `POST /api/messages/:messageId/reactions` |
| Chats | `GET /api/chats` `POST /api/chats/groups` `POST /api/chats/:chatId/members` `DELETE /api/chats/:chatId/members/:memberId` `POST /api/chats/:chatId/leave` `POST /api/chats/:chatId/admins` `DELETE /api/chats/:chatId/admins/:memberId` `PUT /api/chats/:chatId/photo` `POST /api/chats/:chatId/invite` `GET /api/chats/invite/:code` |
| Calls | `GET /api/calls/ice-servers` `POST /api/calls/livekit/token` `POST /api/calls/rooms` `POST /api/calls/rooms/:roomId/join` `POST /api/calls/rooms/:roomId/leave` `POST /api/calls/rooms/:roomId/end` `GET /api/calls/rooms/active` `GET /api/calls/rooms/history` |

---

## 🚀 Running Locally

**Prerequisites:** Node.js 18+, MongoDB, npm

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

- Frontend → `http://localhost:5173`
- Backend → `http://localhost:5000`

---

## 🔑 Environment Variables

```env
# Backend
PORT=5000
MONGO_URI=...
JWT_SECRET=...
FRONTEND_URL=http://localhost:5173

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# LiveKit
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=...

# Twilio ICE
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
```

---

## 📌 Notes

- Group calls use LiveKit tokens generated on the backend
- 1:1 calls use WebRTC signaling via Socket.IO + Twilio ICE
- Invite links expire automatically after 24h
