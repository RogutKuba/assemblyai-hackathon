'use client';

import { useSearchParams } from 'next/navigation';
import ChatRoom from '../../components/ChatRoom';

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'student';

  return (
    <div className='min-h-screen p-8 bg-neutral-900 text-white'>
      <div className='max-w-4xl mx-auto'>
        <div className='flex justify-between items-center mb-8'>
          <h1 className='text-2xl font-bold'>Room: {params.roomId}</h1>
          <span className='px-4 py-2 bg-blue-600 rounded-md'>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </span>
        </div>
        <ChatRoom roomId={params.roomId} role={role as 'teacher' | 'student'} />
      </div>
    </div>
  );
}
