import { Room } from 'livekit-client';

export const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

export const connectToRoom = async () => {
  const response = await fetch('http://localhost:8000/livekit');
  const data = await response.json();

  if (!data.serverUrl || !data.participantToken) {
    throw new Error('Failed to get LiveKit connection details');
  }

  const room = new Room();
  await room.connect(data.serverUrl, data.participantToken, {
    autoSubscribe: true,
  });

  return {
    room,
    participantName: data.participantName,
  };
};
