import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined');
}

export class LessonMaker {
  private totalTranscript: string = '';
  private lastestTranscript: string = '';
  private lastUpdateTime: number = Date.now();

  private readonly SUMMARY_INTERVAL = 5000; // 5 seconds between summaries
  private readonly MIN_CONTENT_LENGTH = 5; // Minimum characters needed for a meaningful summary

  private summaryTimer: NodeJS.Timeout | null = null;
  private lessonId: string;
  private openai: OpenAI;
  private isGeneratingSummary: boolean = false;
  private totalLessonContent: string = '';
  private lessonFilePath: string;

  constructor(lessonId: string) {
    this.lessonId = lessonId;
    this.openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
    this.lessonFilePath = path.join(
      process.cwd(),
      'data',
      'lessons',
      'default.md'
    );
    this.reset();
    this.startSummaryTimer();
    this.loadExistingContent();
  }

  private loadExistingContent() {
    try {
      if (fs.existsSync(this.lessonFilePath)) {
        this.totalLessonContent = fs.readFileSync(this.lessonFilePath, 'utf-8');
      }
    } catch (error) {
      console.error('Error loading existing lesson content:', error);
    }
  }

  private reset() {
    this.totalTranscript = '';
    this.lastestTranscript = '';
    this.lastUpdateTime = Date.now();
    this.isGeneratingSummary = false;
    if (this.summaryTimer) {
      clearInterval(this.summaryTimer);
      this.summaryTimer = null;
    }
  }

  private startSummaryTimer() {
    this.summaryTimer = setInterval(() => {
      this.generateSummary();
    }, this.SUMMARY_INTERVAL);
  }

  public processTranscription(
    roomId: string,
    text: string,
    isPartial: boolean = false
  ) {
    // update the lesson file path
    this.lessonFilePath = path.join(
      process.cwd(),
      'data',
      'lessons',
      `${roomId}.md`
    );
    const now = Date.now();
    this.lastUpdateTime = now;

    // Skip processing if it's a partial transcript
    if (isPartial) {
      return;
    }

    this.lastestTranscript += text;
  }

  private async generateSummary() {
    console.log('Generating summary...');

    // Skip if already generating a summary or no new content
    if (
      this.isGeneratingSummary ||
      this.lastestTranscript.length < this.MIN_CONTENT_LENGTH
    ) {
      console.log(
        'Skipping summary generation: already generating or not enough new content',
        this.isGeneratingSummary,
        this.lastestTranscript.length
      );
      return;
    }

    try {
      this.isGeneratingSummary = true;
      const summary = await this.generateSummaryWithAI(this.lastestTranscript);

      if (!summary) {
        console.log('Skipping summary generation: received no new content');
        return;
      }

      // Clear latest transcript after successful summary
      this.totalTranscript += this.lastestTranscript;
      this.lastestTranscript = '';

      // add the summary to the total lesson content
      this.totalLessonContent += summary;

      // update the lesson file
      fs.writeFileSync(this.lessonFilePath, this.totalLessonContent);
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      this.isGeneratingSummary = false;
    }
  }

  private async generateSummaryWithAI(content: string): Promise<string | null> {
    try {
      const systemPrompt = `You are an expert educational content creator specializing in converting live spoken transcripts into well-structured lesson notes in real-time. Your task is to:

1. Analyze the latest transcript segment in context of the total transcript and existing lesson notes
2. If the latest segment is too short or lacks sufficient context to form meaningful notes, return null to wait for more content
3. When there is enough content, extract key concepts, definitions, examples, and important points
4. Format the content in clear, organized markdown with:
   - Headers and subheaders for main topics
   - Bullet points for key concepts
   - Code blocks where technical content is discussed
   - Emphasis on important terms using bold or italic
5. Maintain consistency with existing lesson notes
6. Focus on clarity and educational value
7. Avoid redundancy with previously covered content
8. Include relevant examples or analogies when present in the transcript
9. Add appropriate spacing between sections:
   - Start with two newlines (\\n\\n) when beginning a new major section or topic
   - Use single newlines (\\n) for minor transitions within the same topic
   - No newlines when continuing the same thought or point

Special handling for lesson start:
- If there is no total transcript yet (empty string), you are at the start of a new lesson
- Wait to understand the main topic and structure of the lesson before generating notes
- Be more lenient with content length requirements for the first summary

Remember: You are processing live transcripts, so it's better to wait for more context than to generate incomplete or potentially incorrect notes. Return null if you need more information to create meaningful lesson notes.

Your output should be concise yet comprehensive, making the content easy to understand and reference later.`;

      const prompt = `<total-transcript>${this.totalTranscript}</total-transcript>
      <latest-transcript>${content}</latest-transcript>
      <current-lesson-notes>${this.totalLessonContent}</current-lesson-notes>`;

      console.log('Prompt:', prompt);

      const responseFormat = z.object({
        newLessonNotes: z
          .string()
          .nullable()
          .describe(
            'The new lesson notes from the latest transcript to append to the current lesson notes in markdown format'
          ),
      });

      const completion = await this.openai.chat.completions.parse({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'gpt-4o-mini',
        temperature: 0.7,
        response_format: zodResponseFormat(responseFormat, 'lesson_notes'),
      });

      const summary = completion.choices[0].message.parsed;

      console.log('Latest Summary from openai:', summary);

      return summary?.newLessonNotes && summary.newLessonNotes.length > 0
        ? summary.newLessonNotes
        : null;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }

  public getCurrentState() {
    return {
      totalTranscript: this.totalTranscript,
      latestTranscript: this.lastestTranscript,
      lastUpdateTime: this.lastUpdateTime,
    };
  }

  public clear() {
    this.reset();
    this.startSummaryTimer();
  }
}
