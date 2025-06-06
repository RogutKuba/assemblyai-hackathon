import ChatRoom from '@/app/components/ChatRoom';

export default async function TeacherRoomPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return (
    <div className='min-h-screen p-8 bg-neutral-900 text-white'>
      <ChatRoom roomId={id} role='teacher' />
    </div>
  );
}
