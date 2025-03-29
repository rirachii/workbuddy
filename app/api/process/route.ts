import { NextResponse, NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const execAsync = promisify(exec);

async function convertWebmToMp3(webmBuffer: Buffer): Promise<Buffer> {
  // Create temporary files
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-'));
  const inputPath = path.join(tempDir, 'input.webm');
  const outputPath = path.join(tempDir, 'output.mp3');

  try {
    // Write input file
    await fs.writeFile(inputPath, webmBuffer);

    // Convert using ffmpeg
    await execAsync(`ffmpeg -i "${inputPath}" -c:a libmp3lame -q:a 2 "${outputPath}"`);

    // Read output file
    const mp3Buffer = await fs.readFile(outputPath);
    return mp3Buffer;
  } finally {
    // Clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchAndConvertToBase64(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch audio file: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const webmBuffer = Buffer.from(arrayBuffer);
  
  // Convert webm to mp3
  console.log('Converting audio from webm to mp3...');
  const mp3Buffer = await convertWebmToMp3(webmBuffer);
  console.log('Audio conversion complete');
  
  return mp3Buffer.toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    // Get Gemini API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Get the request body
    const { audioUrl } = await request.json();
    
    if (!audioUrl) {
      return NextResponse.json(
        { error: 'No audio URL provided' },
        { status: 400 }
      );
    }

    // For debugging
    console.log('Processing audio URL:', audioUrl);
    
    try {
      // Fetch the audio file and convert to base64
      console.log('Fetching audio file and converting to base64...');
      const base64Audio = await fetchAndConvertToBase64(audioUrl);
      console.log('Audio file converted to base64');
      
      // Initialize the Google GenAI client
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Get the Gemini Pro Vision model
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 4096,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      });
      
      // Create a prompt for the model
      const prompt = "Please transcribe this audio file, then provide a concise summary of its content, and extract any tasks or action items with their deadlines. Format the output as: 1. Transcription: (full text), 2. Summary: (concise summary), 3. Tasks: (list of tasks with deadlines)";
      
      // Create the content parts for the model
      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: "audio/mp3",
            data: base64Audio
          }
        }
      ];
      
      // Generate content from the model
      console.log('Calling Gemini API with GoogleGenAI SDK...');
      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
      });
      
      const response = result.response;
      const geminiText = response.text();
      
      // Simple parsing of the response - this would need to be more robust in production
      const transcriptionMatch = geminiText.match(/1\.\s*Transcription:\s*([\s\S]*?)(?=2\.\s*Summary:|$)/i);
      const summaryMatch = geminiText.match(/2\.\s*Summary:\s*([\s\S]*?)(?=3\.\s*Tasks:|$)/i);
      const tasksMatch = geminiText.match(/3\.\s*Tasks:\s*([\s\S]*?)$/i);
      
      // Extract tasks into structured format
      const tasksText = tasksMatch?.[1] || '';
      const taskRegex = /[-•*]\s*([^:]+):?\s*(?:due|by|deadline)?[:\s]*([^,\n]*)/gi;
      const tasks = [];
      let taskMatch;
      
      while ((taskMatch = taskRegex.exec(tasksText)) !== null) {
        const taskText = taskMatch[1]?.trim();
        const deadline = taskMatch[2]?.trim() || 'No deadline specified';
        
        if (taskText) {
          tasks.push({
            id: `task_${Date.now()}_${tasks.length}`,
            text: taskText,
            deadline: deadline
          });
        }
      }
      
      return NextResponse.json({
        transcription: transcriptionMatch?.[1]?.trim() || 'Transcription not available',
        summary: summaryMatch?.[1]?.trim() || 'Summary not available',
        tasks: tasks.length > 0 ? tasks : []
      });
      
    } catch (error) {
      console.error('Error processing audio:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error during processing' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing audio:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error during processing' },
      { status: 500 }
    );
  }
}
