// src/pages/OffSeasonPage.tsx
import React from 'react';
import { FaInstagram, FaLink } from 'react-icons/fa';

export default function OffSeasonPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-teal-50 to-teal-100 px-6 py-10">
      <div className="w-full max-w-2xl bg-white/70 backdrop-blur-md rounded-3xl shadow-md p-8 sm:p-12 text-center border border-gray-100">
        {/* Hero Image */}
        <div className="flex justify-center mb-8">
          <img
            src="images/360_rest.png"
            alt="Jo i 健康隊 Off-season"
            className="w-56 h-56 object-contain drop-shadow-md"
          />
        </div>

        {/* Text */}
        <h1 className="text-2xl font-semibold text-gray-800 mb-6 leading-relaxed">
          下一期營隊將於{' '}
          <span className="text-teal-700 font-bold">2025/11/03</span>{' '}
          開始，這段期間先好好休息，消化一下上一期的內容吧。
        </h1>

        {/* Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Instagram Button */}
          <a
            href="https://www.instagram.com/movement_health360/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-medium
                       bg-black text-white hover:opacity-90 transition shadow-md"
          >
            <FaInstagram
              className="text-lg"
              style={{
                background:
                  'linear-gradient(45deg, #F58529, #DD2A7B, #8134AF, #515BD4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            />
            追蹤官方 IG
          </a>

          {/* Portaly Button */}
          <a
            href="https://portaly.cc/movementhealth360"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-medium
                       bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 transition shadow-sm"
          >
            <FaLink className="text-gray-700 text-lg" />
            前往官方 Portaly
          </a>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-sm text-gray-500">
          🌊 Jo i 健康隊感謝你的參與，持續探索、保持覺察，我們下期再見！
        </p>
      </div>
    </div>
  );
}
