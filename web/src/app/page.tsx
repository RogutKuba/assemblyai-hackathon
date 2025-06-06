'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const handleJoin = (role: 'teacher' | 'student') => {
    if (!roomId.trim()) return;
    router.push(`/${roomId}/${role}`);
  };

  return (
    <div className='min-h-screen p-8 bg-neutral-900 text-white'>
      <div className='max-w-md mx-auto mt-16'>
        <h1 className='text-3xl font-bold text-center mb-8'>
          Welcome to EchoTutor
        </h1>

        <div className='space-y-2 bg-neutral-800 p-6 rounded-lg'>
          <div>
            <label htmlFor='roomId' className='block text-sm font-medium mb-2'>
              Enter Room Code
            </label>
            <input
              type='text'
              id='roomId'
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder='Enter room code'
              className='w-full px-4 py-2 rounded-md bg-neutral-700 border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4'
              required
            />
          </div>

          <div className='flex gap-4'>
            <a
              href='https://www.youtube.com/watch?v=dQw4w9WgXcQ'
              target='_blank'
              rel='noopener noreferrer'
              className='flex-1 py-2 px-4 bg-blue-600 text-white text-center rounded-md hover:bg-blue-700 transition-colors'
            >
              Join as Teacher
            </a>
            <button
              onClick={() => handleJoin('student')}
              className='flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            >
              Join as Student
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
