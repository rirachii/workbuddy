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
    const { audioUrl, previousConversations } = await request.json();
    
    if (!audioUrl) {
      return NextResponse.json(
        { error: 'No audio URL provided' },
        { status: 400 }
      );
    }

    // For debugging
    console.log('Processing audio URL:', audioUrl);
    console.log('Previous conversations:', previousConversations?.length || 0);
    
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
      const basePrompt = `# AI Workbuddy: Job Hunter Coach  
*For professionals seeking employment - Combines career coaching, behavioral psychology, and tactical job search strategies*

# CONVERSATION HISTORY
${previousConversations?.map((conv: any, index: number) => `
Session ${index + 1}:
Summary: ${conv.summary}
Tasks: ${conv.tasks.map((task: any) => `\n- ${task.text} (${task.deadline})`).join('')}
Priority: ${conv.tasks.find((task: any) => task.isPriority)?.text || 'None specified'}
`).join('\n\n') || 'No previous conversations'}

# YOUR TASK 
Listen to this audio recording and provide:

1. Summary: Analyze the content following this template, considering the conversation history above:
   - **Wins**: What have they done well during this job search? What are their strengths? What are their accomplishments?
   - **Patterns**: What are the patterns in their behavior? What are the impact of their actions?
   - **Next Step**: What concrete action should they take next?
   - **Career Vision Check**: How does this align with their career goals?
   - **Progress**: How does this compare to previous sessions? What improvements or changes do you notice?

2. Tasks: Extract 3 specific tasks they should focus on, with deadlines. Choose ONE as the highest priority task.
   Format as bullet points with deadlines, e.g.:
   - Complete interview preparation document by next Tuesday
   - Follow up with networking contact within 48 hours
   - Update LinkedIn profile by end of week
   Then specify: "Priority Focus: [the most important task]"

Remember to:
- Be empathetic and supportive in your analysis
- Use their exact words when reflecting their experiences
- Frame setbacks as learning opportunities
- Keep feedback concise and actionable
- Reference previous conversations when relevant to show progress`;

      // Create the content parts for the model
      const parts = [
        { text: basePrompt },
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
      
      // Updated parsing logic - now only for summary and tasks
      const summaryMatch = geminiText.match(/1\.\s*Summary:\s*([\s\S]*?)(?=2\.\s*Tasks:|$)/i);
      const tasksMatch = geminiText.match(/2\.\s*Tasks:\s*([\s\S]*?)(?=Priority Focus:|$)/i);
      const priorityMatch = geminiText.match(/Priority Focus:\s*([^\n]+)/i);
      
      // Extract tasks into structured format
      const tasksText = tasksMatch?.[1] || '';
      const taskRegex = /[-•*]\s*([^:]+):?\s*(?:due|by|deadline)?[:\s]*([^,\n]*)/gi;
      const tasks = [];
      let taskMatch;
      
      while ((taskMatch = taskRegex.exec(tasksText)) !== null) {
        const taskText = taskMatch[1]?.trim();
        const deadline = taskMatch[2]?.trim() || 'No deadline specified';
        
        if (taskText) {
          const task: {
            id: string;
            text: string;
            deadline: string;
            isPriority: boolean;
          } = {
            id: `task_${Date.now()}_${tasks.length}`,
            text: taskText,
            deadline: deadline,
            isPriority: !!(priorityMatch && taskText.includes(priorityMatch[1].trim()))
          };
          tasks.push(task);
        }
      }

      // Create response object with metadata for storage
      const responseData = {
        id: `session_${Date.now()}`,
        timestamp: new Date().toISOString(),
        transcription: "", // Empty string since we're not using transcription anymore
        summary: summaryMatch?.[1]?.trim() || 'Summary not available',
        tasks: tasks.length > 0 ? tasks : [],
        rawResponse: geminiText, // Store the raw response for future reference
      };
      
      return NextResponse.json(responseData);
      
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
