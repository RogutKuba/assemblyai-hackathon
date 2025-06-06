import { ReportViewer } from '@/app/components/ReportViewer';
import { useLessonNotes } from '@/query';
import { Button } from '@/ui/button';
import { cx } from '@/ui/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { useChat, useDataChannel } from '@livekit/components-react';
import { useRef, useState } from 'react';

export const TeacherWindow = (props: { roomId: string }) => {
  const { roomId } = props;

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');

  const socket = useRef<WebSocket | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const scriptProcessor = useRef<ScriptProcessorNode | null>(null);

  const { data: lesson } = useLessonNotes(roomId);
  const { send } = useChat();

  const addTranscriptToLesson = async (params: {
    transcript: string;
    isPartial: boolean;
  }) => {
    const response = await fetch('http://localhost:8000/add-to-lesson', {
      method: 'POST',
      body: JSON.stringify({
        roomId,
        transcript: params.transcript,
        isPartial: params.isPartial,
      }),
    });
    const data = await response.json();
    if (data.error) {
      console.error('Error adding transcript to lesson:', data.error);
      alert(data.error);
    }
  };

  const getToken = async () => {
    const response = await fetch('http://localhost:8000/token');
    const data = await response.json();

    if (data.error) {
      console.error('Error fetching token:', data.error);
      alert(data.error);
      return null;
    }

    return data.token;
  };

  const startTranscription = async () => {
    const token = await getToken();
    if (!token) return;

    socket.current = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
    );

    socket.current.onopen = async () => {
      console.log('WebSocket connection established');
      setIsTranscribing(true);

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
          output[i] = Math.min(1, inputData[i]) * 0x7fff;
        }

        socket.current.send(output.buffer);
      };
    };

    socket.current.onmessage = (event) => {
      const res = JSON.parse(event.data);

      if (res.message_type === 'PartialTranscript') {
        setPartialTranscript(res.text);
      }

      if (res.message_type === 'FinalTranscript') {
        setTranscript((prev) => prev + ' ' + res.text);
        setPartialTranscript('');

        send(res.text);
      }

      addTranscriptToLesson({
        transcript: res.text,
        isPartial: res.message_type === 'PartialTranscript',
      });
    };

    socket.current.onerror = (event) => {
      console.error('WebSocket error:', event);
      stopTranscription();
    };

    socket.current.onclose = (event) => {
      console.log('WebSocket closed:', event);
      socket.current = null;
    };
  };

  const stopTranscription = () => {
    setIsTranscribing(false);

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

  return (
    <div className='h-full w-full'>
      <div className='flex h-full w-full flex-col justify-between'>
        <div className='overflow-y-auto h-full'>
          <Tabs defaultValue='transcription' className='h-full w-full flex-1'>
            <TabsList className='w-full bg-background'>
              <TabsTrigger
                value='transcription'
                className='data-[state=active]:bg-primary data-[state=active]:text-primary-foreground'
              >
                Transcription
              </TabsTrigger>
              <TabsTrigger
                value='report'
                className='data-[state=active]:bg-primary data-[state=active]:text-primary-foreground'
              >
                Report
              </TabsTrigger>
            </TabsList>
            <TabsContent value='transcription' className='h-[calc(100%-56px)]'>
              <div className='flex flex-col h-full justify-between p-4'>
                <div className='flex-1 overflow-y-auto mb-4'>
                  <p className='text-foreground'>
                    {transcript}{' '}
                    <span className='text-muted-foreground'>
                      {partialTranscript}
                    </span>
                  </p>
                </div>

                <Button
                  onClick={
                    isTranscribing ? stopTranscription : startTranscription
                  }
                  className={cx(
                    isTranscribing ? 'bg-red-500' : 'bg-blue-500',
                    'w-full mt-4'
                  )}
                >
                  {isTranscribing
                    ? 'Stop Transcription'
                    : 'Start Transcription'}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value='report'>
              <div className='p-4'>
                <ReportViewer report={lesson ?? ''} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
