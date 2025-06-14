import { useQuery } from '@tanstack/react-query';

export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const getLessonNotes = async (lessonId: string): Promise<string> => {
  const response = await fetch(`${BASE_URL}/lesson/${lessonId}`);
  return response.text();
};

export const useLessonNotes = (lessonId: string) => {
  const query = useQuery({
    queryKey: ['lessonNotes', lessonId],
    queryFn: () => getLessonNotes(lessonId),
    refetchInterval: 1500,
  });
  return {
    lessonNotes: query.data,
    ...query,
  };
};
