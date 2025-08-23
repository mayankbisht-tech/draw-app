"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function CreateRoom({ roomId }: { roomId: string }) {
  const router = useRouter();

  const handleJoinClick = () => {
    router.push(`/draw/${roomId}`);
  };

  return (
    <div className="flex flex-col items-center justify-center p-10 bg-zinc-900 rounded-2xl shadow-2xl w-[90%] max-w-md border border-zinc-800">
      <p className="text-2xl md:text-3xl font-semibold text-gray-200 mb-6 text-center">
        Your Room is Ready
      </p>
      <div className="w-full p-3 mb-6 bg-zinc-800 border border-zinc-700 rounded-lg text-center">
        <p className="text-lg font-mono text-gray-300 break-all">{roomId}</p>
      </div>
      <button
        onClick={handleJoinClick}
        className="w-full px-8 py-3 bg-gray-800 hover:bg-black text-white font-semibold rounded-lg shadow-lg transition-all duration-300"
      >
        Enter Room
      </button>
    </div>
  );
}

function JoinRoom() {
  const router = useRouter();
  const [roomId, setRoomId] = useState<string>("");

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRoomId(event.target.value);
  };

  const handleJoinClick = () => {
    if (roomId.trim()) {
      router.push(`/draw/${roomId}`);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJoinClick();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-10 bg-zinc-900 rounded-2xl shadow-2xl w-[90%] max-w-md border border-zinc-800">
       <p className="text-2xl md:text-3xl font-semibold text-gray-200 mb-4 text-center">
        Join an Existing Room
      </p>
      <input
        type="text"
        value={roomId}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Enter Room ID"
        className="px-5 py-3 border border-zinc-700 rounded-lg bg-zinc-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 w-full transition-colors duration-200"
      />
      <button
        onClick={handleJoinClick}
        className="w-full px-8 py-3 bg-gray-800 hover:bg-black text-white font-semibold rounded-lg shadow-lg transition-all duration-300"
      >
        Join
      </button>
    </div>
  );
}


export default function RoomPage() {
  const [mode, setMode] = useState<"default" | "create" | "join">("default");
  const [roomId, setRoomId] = useState<string | null>(null);

  const handleCreateRoom = () => {
    const newRoomId = crypto.randomUUID();
    setRoomId(newRoomId);
    setMode("create");
  };

  const renderContent = () => {
    if (mode === "create" && roomId) {
      return <CreateRoom roomId={roomId} />;
    }
    if (mode === "join") {
      return <JoinRoom />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-8 p-10 bg-zinc-900 rounded-2xl shadow-2xl w-[90%] max-w-md border border-zinc-800">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-200 text-center">
          Drawing Room
        </h1>
        <div className="flex flex-col gap-4 w-full">
          <button
            onClick={handleCreateRoom}
            className="w-full px-6 py-3 bg-gray-800 hover:bg-black text-white font-semibold rounded-xl shadow-lg transition-all duration-300"
          >
            Create a New Room
          </button>
          <button
            onClick={() => setMode("join")}
            className="w-full px-6 py-3 bg-gray-800 hover:bg-black text-white font-semibold rounded-xl shadow-lg transition-all duration-300"
          >
            Join an Existing Room
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-950 via-black to-zinc-950 font-inter">
      {renderContent()}
    </div>
  );
}
