import { ReportViewer } from '@/app/components/ReportViewer';
import { useLessonNotes } from '@/query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { useChat, ReceivedChatMessage } from '@livekit/components-react';

export const StudentWindow = (props: { roomId: string }) => {
  const { roomId } = props;
  const { chatMessages } = useChat();
  const { data: lesson } = useLessonNotes(roomId);

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
                    {chatMessages.map(
                      (message: ReceivedChatMessage, index: number) => (
                        <span key={index}>{message.message} </span>
                      )
                    )}
                  </p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value='report'>
              <div className='p-4 '>
                <ReportViewer report={lesson ?? ''} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
