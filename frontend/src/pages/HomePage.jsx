// import { useChatStore } from "../store/useChatStore";

// import Sidebar from "../components/Sidebar";
// import NoChatSelected from "../components/NoChatSelected";
// import ChatContainer from "../components/ChatContainer";

// import VideoCall from "../components/VideoCall";

// // const HomePage = () => {
// //   const { selectedUser } = useChatStore();

// //   return (
// //     <div className="h-screen bg-base-200">
// //       <div className="flex items-center justify-center pt-20 px-4">
// //         <div className="bg-base-100 rounded-lg shadow-cl w-full max-w-6xl h-[calc(100vh-8rem)]">
// //           <div className="flex h-full rounded-lg overflow-hidden">
// //             <Sidebar />

// //             {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
// //           </div>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // };

// const HomePage = () => {
//   const { selectedUser } = useChatStore();

//   return (
//     <div className="h-screen bg-base-200">
//       <div className="flex items-center justify-center pt-20 px-4">
//         <div className="bg-base-100 rounded-lg shadow-cl w-full max-w-6xl h-[calc(100vh-8rem)] relative">
//           <div className="flex h-full rounded-lg overflow-hidden">
//             {/* Sidebar on the left */}
//             <Sidebar />

//             {/* Chat or empty state */}
//             {!selectedUser ? (
//               <NoChatSelected />
//             ) : (
//               <div className="flex flex-col w-full relative">
//                 <ChatContainer />
                
//                 {/* 🟢 Show VideoCall component when chatting with someone */}
//                 <div className="absolute bottom-4 right-4 z-50">
//                   <VideoCall peerId={selectedUser._id} />
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default HomePage;

import { useChatStore } from "../store/useChatStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <div className="h-screen bg-base-200">
      <div className="flex items-center justify-center pt-20 px-4">
        <div className="bg-base-100 rounded-lg shadow-cl w-full max-w-6xl h-[calc(100vh-8rem)]">
          <div className="flex h-full rounded-lg overflow-hidden">
            <Sidebar />

            {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
          </div>
        </div>
      </div>
    </div>
  );
};
export default HomePage;