'use client';

import { useEffect, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { TeacherWindow } from '@/app/components/TeacherWindow';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { StudentWindow } from '@/app/components/StudentWindow';

export default function ChatRoom({
  roomId,
  role,
}: {
  roomId: string;
  role: 'teacher' | 'student';
}) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/livekit?roomId=${roomId}&role=${role}`
        );
        const data = await response.json();
        setToken(data.participantToken);
        setServerUrl(data.serverUrl);
      } catch (error) {
        console.error('Failed to fetch token:', error);
      }
    };
    fetchToken();
  }, [roomId, role]);

  if (!token || !serverUrl) {
    return <div>Loading...</div>;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={true}
      audio={true}
      data-lk-theme='dark'
    >
      <div className='h-[80vh] border border-neutral-800 rounded-lg overflow-hidden'>
        <PanelGroup direction='horizontal'>
          {/* Video Conference Section */}
          <Panel defaultSize={80} minSize={30}>
            <div className='h-full bg-black rounded-lg overflow-hidden'>
              <VideoConference data-lk-theme='light' />
            </div>
          </Panel>

          <PanelResizeHandle className='w-1 bg-neutral-700 hover:bg-neutral-600 transition-colors' />

          {/* Teacher Window Section */}
          <Panel defaultSize={40} minSize={20}>
            <div className='h-full bg-neutral-800 py-4 px-2'>
              {role === 'teacher' ? (
                <TeacherWindow roomId={roomId} />
              ) : (
                <StudentWindow roomId={roomId} />
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </LiveKitRoom>
  );
}
