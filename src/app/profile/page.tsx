'use client';

import React, { useState, useEffect } from 'react';
import { WalletContext } from '@/context/WalletContext'; // Adjust if your context path is different

export default function ProfilePage() {
  const { wallet, connected, disconnect } = React.useContext(WalletContext);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    username: "Stellar Builder",
    bio: "Passionate about decentralized payments and real-time streaming on Stellar.",
    joinedAt: "June 2025",
    totalStreams: 24,
    totalVolume: "12,450 XLM",
  });

  const handleSave = () => {
    // TODO: Connect to backend later
    console.log("Profile saved:", profile);
    setIsEditing(false);
  };

  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400">Please connect your wallet to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 py-12">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold">My Profile</h1>
        <button
          onClick={disconnect}
          className="text-red-400 hover:text-red-500 transition"
        >
          Disconnect Wallet
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-40 h-40 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center text-7xl shadow-xl">
            👤
          </div>

          <div className="flex-1 space-y-4">
            {isEditing ? (
              <input
                type="text"
                value={profile.username}
                onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                className="text-4xl font-bold bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-3 w-full focus:outline-none"
              />
            ) : (
              <h2 className="text-4xl font-bold">{profile.username}</h2>
            )}

            <p className="text-gray-400 font-mono">
              {wallet?.publicKey?.slice(0, 8)}...{wallet?.publicKey?.slice(-6)}
            </p>

            {isEditing ? (
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                className="w-full h-28 bg-zinc-800 border border-zinc-700 rounded-xl p-4 resize-none"
                placeholder="Tell us about yourself..."
              />
            ) : (
              <p className="text-gray-300 leading-relaxed">{profile.bio}</p>
            )}
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition self-start"
          >
            {isEditing ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        {isEditing && (
          <button
            onClick={handleSave}
            className="mt-6 px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-2xl font-medium"
          >
            Save Changes
          </button>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
          <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800">
            <p className="text-sm text-gray-500">Total Streams</p>
            <p className="text-4xl font-bold mt-3">{profile.totalStreams}</p>
          </div>
          <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800">
            <p className="text-sm text-gray-500">Total Volume</p>
            <p className="text-4xl font-bold mt-3">{profile.totalVolume}</p>
          </div>
          <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800">
            <p className="text-sm text-gray-500">Member Since</p>
            <p className="text-4xl font-bold mt-3">{profile.joinedAt}</p>
          </div>
          <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800">
            <p className="text-sm text-gray-500">Reputation</p>
            <p className="text-4xl font-bold mt-3">Level 4</p>
          </div>
        </div>
      </div>
    </div>
  );
}