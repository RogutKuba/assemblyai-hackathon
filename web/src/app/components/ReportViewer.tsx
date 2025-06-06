import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Vapi from '@vapi-ai/web';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@/ui/button';
import { cx } from '@/ui/lib/utils';
import { RiLoader2Fill, RiMic2AiLine } from '@remixicon/react';

const NEXT_PUBLIC_VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY;
if (!NEXT_PUBLIC_VAPI_API_KEY) {
  throw new Error('NEXT_PUBLIC_VAPI_API_KEY is not set');
}

export const ReportViewer = (props: { report: string }) => {
  return (
    <div className='flex flex-col gap-4'>
      <div className='prose prose-invert w-full overflow-y-auto'>
        <Markdown remarkPlugins={[remarkGfm]}>{props.report}</Markdown>
      </div>
      <ReportVoiceAgent report={props.report} />
    </div>
  );
};

export const ReportVoiceAgent = ({ report }: { report: string }) => {
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [started, setStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<
    Array<{ role: string; text: string }>
  >([]);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vapiInstance = new Vapi(NEXT_PUBLIC_VAPI_API_KEY);
    setVapi(vapiInstance);

    // Event listeners
    vapiInstance.on('call-start', () => {
      console.log('Call started');
      setIsConnected(true);
    });

    vapiInstance.on('call-end', () => {
      console.log('Call ended');
      setIsConnected(false);
      setIsSpeaking(false);
      setTranscript([]);
    });

    vapiInstance.on('speech-start', () => {
      console.log('Assistant started speaking');
      setIsSpeaking(true);
    });

    vapiInstance.on('speech-end', () => {
      console.log('Assistant stopped speaking');
      setIsSpeaking(false);
    });

    vapiInstance.on('message', (message) => {
      if (message.type === 'transcript') {
        setTranscript((prev) => [
          ...prev,
          {
            role: message.role,
            text: message.transcript,
          },
        ]);
      }
    });

    vapiInstance.on('error', (error) => {
      console.error('Vapi error:', error);
    });

    return () => {
      vapiInstance?.stop();
    };
  }, []);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop =
        transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript]);

  const startCall = async () => {
    if (vapi) {
      setStarted(true);
      const ASSISSTANT_ID = 'b197aa91-ebac-4f78-96d2-900c66aac787';

      await vapi.start(ASSISSTANT_ID, {
        variableValues: {
          LESSON_NOTES: report,
        },
      });
    }
  };

  const endCall = () => {
    if (vapi) {
      setStarted(false);
      vapi.stop();
    }
  };

  return (
    <>
      {isConnected && (
        <div className='fixed bottom-24 right-6 w-96 bg-neutral-900 rounded-lg border border-neutral-800 shadow-lg z-50'>
          <div className='flex items-center justify-between p-4 border-b border-neutral-800'>
            <div className='flex items-center gap-2'>
              <div
                className={`w-2 h-2 rounded-full ${
                  isSpeaking ? 'bg-red-500 animate-pulse' : 'bg-primary'
                }`}
              ></div>
              <span className='text-sm font-medium text-neutral-200'>
                {isSpeaking ? 'Assistant Speaking...' : 'Listening...'}
              </span>
            </div>
            <Button
              variant='destructive'
              onClick={endCall}
              className='text-xs px-2 py-1'
            >
              End Call
            </Button>
          </div>

          <div
            ref={transcriptContainerRef}
            className='max-h-[300px] overflow-y-auto p-4 bg-neutral-950/50'
          >
            {transcript.length === 0 ? (
              <p className='text-sm text-neutral-400'>
                Conversation will appear here...
              </p>
            ) : (
              transcript.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-2 ${
                    msg.role === 'user' ? 'text-right' : 'text-left'
                  }`}
                >
                  <span
                    className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[80%] ${
                      msg.role === 'user'
                        ? 'bg-primary text-white'
                        : 'bg-neutral-800 text-neutral-200'
                    }`}
                  >
                    {msg.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <div className='flex flex-col items-center gap-4'>
        <Button
          onClick={isConnected ? endCall : startCall}
          className={cx(
            isConnected ? 'bg-red-500' : 'bg-blue-500',
            'w-full mt-4'
          )}
        >
          {isConnected ? null : started ? (
            <RiLoader2Fill className='w-4 h-4 text-white animate-spin' />
          ) : (
            <RiMic2AiLine className='w-4 h-4 text-white' />
          )}
          {isConnected
            ? 'End Call'
            : started
            ? 'Loading...'
            : 'Talk to Assistant'}
        </Button>
      </div>
    </>
  );
};
