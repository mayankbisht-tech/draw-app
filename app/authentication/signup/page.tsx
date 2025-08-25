"use client";

import React, { useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";

export default function Signup() {
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const keyHandleDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef?: RefObject<HTMLInputElement | null>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstNameRef.current?.value,
          lastName: lastNameRef.current?.value,
          email: emailRef.current?.value,
          password: passwordRef.current?.value,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        setErrorMessage(data.error || "Sign-up failed. Please try again.");
      }
    } catch (error) {
      console.error("Network error:", error);
      setErrorMessage(
        "Could not connect to the server. Please check your connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-zinc-900 to-stone-950 font-inter">
      <button
        onClick={() => router.push("/")}
        className="absolute top-4 right-4 bg-zinc-800 hover:bg-zinc-900 text-white text-sm px-4 py-2 rounded-md transition-colors duration-200"
      >
        Home
      </button>

      <div className="w-full max-w-md p-8 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl">
        <div className="flex flex-col items-center space-y-6">
          <p className="font-bold text-3xl text-white mb-4">Create Account</p>

          {errorMessage && (
            <div className="w-full p-3 bg-red-900 text-red-100 rounded-md text-center text-sm">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-4 w-full">
            <input
              type="text"
              ref={firstNameRef}
              placeholder="First Name"
              className="w-full px-5 py-3 rounded-lg bg-zinc-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 border border-zinc-700 transition-colors duration-200"
              onKeyDown={(e) => keyHandleDown(e, lastNameRef)}
              disabled={isLoading}
            />
            <input
              type="text"
              ref={lastNameRef}
              placeholder="Last Name"
              className="w-full px-5 py-3 rounded-lg bg-zinc-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 border border-zinc-700 transition-colors duration-200"
              onKeyDown={(e) => keyHandleDown(e, emailRef)}
              disabled={isLoading}
            />
          </div>
          <input
            type="email"
            ref={emailRef}
            placeholder="Email"
            className="w-full px-5 py-3 rounded-lg bg-zinc-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 border border-zinc-700 transition-colors duration-200"
            onKeyDown={(e) => keyHandleDown(e, passwordRef)}
            disabled={isLoading}
          />
          <input
            type="password"
            ref={passwordRef}
            placeholder="Password"
            className="w-full px-5 py-3 rounded-lg bg-zinc-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 border border-zinc-700 transition-colors duration-200"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={isLoading}
          />
          <button
            className="w-full bg-gray-800 hover:bg-black transition-all duration-300 py-3 rounded-lg font-semibold text-white shadow-lg disabled:bg-gray-700 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Creating Account..." : "Sign Up"}
          </button>
          <div className="text-sm text-gray-400">
            Already have an account? 
            <button onClick={() => router.push('/authentication/signin')} className="text-white hover:underline ml-1">Sign In</button>
          </div>
        </div>
      </div>
    </div>
  );
}