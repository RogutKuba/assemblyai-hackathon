'use client';

import { useRef, useState } from 'react';
import { BASE_URL } from '@/query';
export default function Transcription() {
  const socket = useRef<WebSocket | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const scriptProcessor = useRef<ScriptProcessorNode | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [markdownPreview, setMarkdownPreview] = useState('');

  // const { send } = useDataChannel();

  const addTranscriptToLesson = async (params: {
    transcript: string;
    isPartial: boolean;
  }) => {
    const response = await fetch(`${BASE_URL}/add-to-lesson`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (data.error) {
      console.error('Error adding transcript to lesson:', data.error);
      alert(data.error);
    }
  };

  const getToken = async () => {
    const response = await fetch(`${BASE_URL}/token`);
    const data = await response.json();

    if (data.error) {
      console.error('Error fetching token:', data.error);
      alert(data.error);
      return null;
    }

    return data.token;
  };

  const startRecording = async () => {
    const token = await getToken();
    if (!token) return;

    socket.current = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
    );

    socket.current.onopen = async () => {
      console.log('WebSocket connection established');
      setIsRecording(true);

      mediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      audioContext.current = new AudioContext({ sampleRate: 16000 });

      const source = audioContext.current.createMediaStreamSource(
        mediaStream.current
      );
      scriptProcessor.current = audioContext.current.createScriptProcessor(
        4096,
        1,
        1
      );

      source.connect(scriptProcessor.current);
      scriptProcessor.current.connect(audioContext.current.destination);

      scriptProcessor.current.onaudioprocess = (event) => {
        if (!socket.current || socket.current.readyState !== WebSocket.OPEN)
          return;

        let inputData = event.inputBuffer.getChannelData(0);
        let output = new Int16Array(inputData.length);

        for (let i = 0; i < inputData.length; i++) {
          output[i] = Math.min(1, inputData[i]) * 0x7fff; // Convert float32 PCM -> PCM16
        }

        socket.current.send(output.buffer);
      };
    };

    socket.current.onmessage = (event) => {
      const res = JSON.parse(event.data);

      console.log('Received message:', res);

      if (res.message_type === 'PartialTranscript') {
        console.log('Partial:', res.text);
        setPartialTranscript(res.text);
      }

      if (res.message_type === 'FinalTranscript') {
        console.log('Final:', res.text);
        setTranscript((prev) => prev + ' ' + res.text);
        setPartialTranscript('');
      }

      addTranscriptToLesson({
        transcript: res.text,
        isPartial: res.message_type === 'PartialTranscript',
      });
    };

    socket.current.onerror = (event) => {
      console.error('WebSocket error:', event);
      stopRecording();
    };

    socket.current.onclose = (event) => {
      console.log('WebSocket closed:', event);
      socket.current = null;
    };
  };

  const stopRecording = () => {
    setIsRecording(false);

    if (scriptProcessor.current) {
      scriptProcessor.current.disconnect();
      scriptProcessor.current = null;
    }

    if (audioContext.current) {
      audioContext.current.close();
      audioContext.current = null;
    }

    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
    }

    if (socket.current) {
      console.log('Ending session...');
      socket.current.send(JSON.stringify({ terminate_session: true }));
      socket.current.close();
      socket.current = null;
    }
  };

  // const updateTranscript = (transcript: string) => {
  //   send(
  //     new TextEncoder().encode(
  //       JSON.stringify({
  //         content: transcript,
  //         timestamp: Date.now(),
  //       })
  //     ),
  //     {
  //       reliable: true,
  //     }
  //   );
  // };

  return (
    <div className='flex flex-col h-full bg-white rounded-lg shadow-lg p-4'>
      <h2 className='text-xl font-bold mb-4'>Real-Time Transcription</h2>
      <div className='flex-1 overflow-y-auto mb-4'>
        <p className='text-gray-700'>
          {transcript}{' '}
          <span className='text-gray-500'>{partialTranscript}</span>
        </p>
      </div>
      <div className='flex-1 overflow-y-auto mb-4 border-t pt-4'>
        <h3 className='text-lg font-semibold mb-2'>Lesson Preview</h3>
        <pre className='whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded'>
          {markdownPreview}
        </pre>
      </div>
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`w-full px-4 py-2 rounded-lg ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
    </div>
  );
}
