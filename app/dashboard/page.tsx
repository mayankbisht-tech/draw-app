"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<{ name: string } | null>(null);
  
  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      setUserInfo(JSON.parse(storedUserInfo));
    }
  }, []);

  const handleSignOut = async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userInfo");
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-tr from-black via-gray-950 to-gray-950 text-gray-100 font-inter">
      <header className="bg-black shadow-lg py-4 px-6 md:px-10 lg:px-16 flex justify-between items-center rounded-b-xl">
        <div className="text-3xl font-extrabold text-white">
          Draw
        </div>
        <nav className="flex items-center space-x-4">
          <button 
            onClick={handleSignOut} 
            className="px-6 py-2 rounded-full bg-red-900 text-white font-medium hover:bg-red-800 transition-colors duration-200 shadow-lg"
          >
            Sign Out
          </button>
        </nav>
      </header>
      <main className="flex-grow flex items-center justify-center p-6 md:p-10 lg:p-16">
        <div className="text-center max-w-4xl">
          <h1 className="text-5xl font-extrabold text-gray-200">
            Welcome to your Dashboard, {userInfo?.name || 'User'}!
          </h1>
          <p className="text-lg text-gray-400 mt-4">
            This is your personal space. Manage your drawings and account settings here.
          </p>
          <button 
            onClick={() => router.push('/room')}  
            className="mt-8 px-10 py-4 rounded-full bg-gray-900 text-white text-xl font-semibold hover:bg-black transition-all duration-300 transform hover:scale-105 shadow-xl"
          >
            Go to Drawing Rooms
          </button>
        </div>
      </main>
    </div>
  );
}
