// Install the required packages by executing the command "npm install assemblyai node-record-lpcm16 livekit-server-sdk"

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { AssemblyAI } from 'assemblyai';
import { serve } from '@hono/node-server';
import {
  AccessToken,
  AccessTokenOptions,
  VideoGrant,
} from 'livekit-server-sdk';
import dotenv from 'dotenv';
import { LessonMaker } from './lesson-maker';
import fs from 'fs';
import path from 'path';

// Create a single instance of LessonMaker that runs in the background
const lessonMaker = new LessonMaker('test-lesson');

dotenv.config();
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_WS_URL = process.env.LIVEKIT_URL;

const port = process.env.PORT ? Number(process.env.PORT) : 8000;

if (!ASSEMBLYAI_API_KEY) {
  throw new Error('ASSEMBLYAI_API_KEY is not set');
}

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_WS_URL) {
  throw new Error('LiveKit environment variables are not set');
}

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

interface AppContext {
  Variables: {
    lessonMaker: LessonMaker;
  };
}

const aaiClient = new AssemblyAI({
  apiKey: ASSEMBLYAI_API_KEY,
});

const app = new Hono<AppContext>();

// make the data folder
if (!fs.existsSync(path.join(process.cwd(), 'data', 'lessons'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data', 'lessons'), {
    recursive: true,
  });
}

// Enable CORS
app
  .use('*', cors())
  // .use(logger())
  .use('*', (c, next) => {
    // Use the single background instance
    c.set('lessonMaker', lessonMaker);
    return next();
  })
  .get('/token', async (c) => {
    try {
      console.log('Creating token...');
      const token = await aaiClient.realtime.createTemporaryToken({
        expires_in: 3600,
      });
      return c.json({ token });
    } catch (error) {
      console.error('Error creating token:', error);
      return c.json({ error: error.message }, 500);
    }
  })
  // .post('/transcribe', async (c) => {
  //   console.log('Transcribing audio...');
  //   try {
  //     const { audioData } = await c.req.json();

  //     const transcriber = aaiClient.streaming.transcriber({
  //       sampleRate: 16000,
  //       formatTurns: true,
  //     });

  //     // Set up event handlers
  //     transcriber.on('open', ({ id }) => {
  //       console.log(`Session opened with ID: ${id}`);
  //     });

  //     transcriber.on('error', (error) => {
  //       console.error('Error:', error);
  //     });

  //     transcriber.on('close', (code, reason) => {
  //       console.log('Session closed:', code, reason);
  //     });

  //     let transcriptText = '';
  //     transcriber.on('turn', (turn) => {
  //       if (!turn.transcript) {
  //         return;
  //       }
  //       transcriptText = turn.transcript;
  //       // Process the transcription in real-time with our background LessonMaker
  //       lessonMaker.processTranscription(turn.transcript, false);
  //     });

  //     // Connect to streaming service
  //     await transcriber.connect();

  //     // Convert audio data to stream and pipe to transcriber
  //     const audioStream = Readable.from(Buffer.from(audioData));
  //     await Readable.toWeb(audioStream).pipeTo(transcriber.stream());

  //     // Wait for transcription to complete
  //     await new Promise((resolve) => setTimeout(resolve, 1000));
  //     await transcriber.close();

  //     console.log('Transcription complete:', transcriptText);

  //     return c.json({ transcript: transcriptText });
  //   } catch (error) {
  //     console.error('Transcription error:', error);
  //     return c.json({ error: error.message }, 500);
  //   }
  // })
  .post('/add-to-lesson', async (c) => {
    const { roomId, transcript, isPartial } = await c.req.json();
    lessonMaker.processTranscription(roomId, transcript, isPartial);
    return c.json({ success: true });
  })
  .get('/lesson/:lessonId', async (c) => {
    const { lessonId } = c.req.param();

    const filePath = path.join(
      process.cwd(),
      '..',
      'data',
      'lessons',
      `${lessonId}.md`
    );

    if (!fs.existsSync(filePath)) {
      return c.json({ error: 'Lesson not found' }, 404);
    }

    const lessonNotes = fs.readFileSync(filePath, 'utf8');

    return c.text(lessonNotes);
  })
  .get('/livekit', async (c) => {
    try {
      const participantName = `user-${Math.random().toString(36).substring(7)}`;
      const roomName = 'chat-room';
      const metadata = {
        role: 'user',
      };

      const participantToken = await createParticipantToken(
        {
          identity: participantName,
          name: participantName,
          metadata: JSON.stringify(metadata),
        },
        roomName
      );
      const data: ConnectionDetails = {
        serverUrl: LIVEKIT_WS_URL,
        roomName,
        participantToken,
        participantName,
      };

      return c.json(data);
    } catch (error) {
      return c.json({ error: error.message }, 500);
    }
  });

// Start the server
serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on port ${info.port}`);
  }
);

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string
) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, userInfo);
  at.ttl = '5m';
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);
  return at.toJwt();
}

/**
 * Get the LiveKit server URL for the given region.
 */
function getLiveKitURL(region: string | null): string {
  let targetKey = 'LIVEKIT_URL';
  if (region) {
    targetKey = `LIVEKIT_URL_${region}`.toUpperCase();
  }
  const url = process.env[targetKey];
  if (!url) {
    throw new Error(`${targetKey} is not defined`);
  }
  return url;
}

function getCookieExpirationTime(): string {
  var now = new Date();
  var time = now.getTime();
  var expireTime = time + 60 * 120 * 1000;
  now.setTime(expireTime);
  return now.toUTCString();
}
