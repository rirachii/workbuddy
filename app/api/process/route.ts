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

FORMAT THE OUTPUT AS JSON:
{
  "summary": "string",
  "tasks": [
    {
      "text": "string",
      "deadline": "string"
    }
  ]
}
  
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
      
      let retries = 0;
      const maxRetries = 3;
      let retryDelay = 1000; // Start with 1 second delay
      
      let response;
      while (retries < maxRetries) {
        try {
          const result = await model.generateContent({
            contents: [{ role: "user", parts }],
          });
          
          // Check if the response has any error blocks
          if (result.response.promptFeedback?.blockReason) {
            throw new Error(`Content blocked: ${result.response.promptFeedback.blockReason}`);
          }
          
          response = result.response;
          break; // If successful, break out of retry loop
          
        } catch (error: unknown) {
          console.error(`Attempt ${retries + 1} failed:`, error);
          
          // Check if it's a 503 error or other retryable error
          if (
            error instanceof Error && 
            (error.message.includes('503') || error.message.includes('Service Unavailable'))
          ) {
            retries++;
            
            if (retries < maxRetries) {
              console.log(`Retrying in ${retryDelay}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              retryDelay *= 2; // Exponential backoff
              continue;
            }
          }
          
          // Handle specific error types
          if (error instanceof Error) {
            if (error.message.includes('400')) {
              throw new Error('Invalid request to Gemini API. Please check your input.');
            } else if (error.message.includes('401')) {
              throw new Error('Authentication failed. Please check your API key.');
            } else if (error.message.includes('429')) {
              throw new Error('Rate limit exceeded. Please try again later.');
            } else if (error.message.includes('500')) {
              throw new Error('Gemini API internal error. Please try again later.');
            }
          }
          
          // If it's not a handled error type, throw the original error
          throw error;
        }
      }
      
      if (!response) {
        throw new Error('Failed to get response from Gemini API after multiple retries');
      }
      
      // Save the raw response text
      const geminiText = response.text();
      console.log('Raw Gemini response:', geminiText);
      
      // Save response to a debug file for inspection
      try {
        const debugDir = path.join(os.tmpdir(), 'gemini-debug');
        await fs.mkdir(debugDir, { recursive: true });
        const debugFile = path.join(debugDir, `response_${Date.now()}.txt`);
        await fs.writeFile(debugFile, geminiText);
        console.log('Debug response saved to:', debugFile);
      } catch (error) {
        console.error('Failed to save debug file:', error);
      }
      
      // Try to parse the response as JSON first
      let parsedResponse;
      try {
        // Find JSON content between curly braces
        const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        }
      } catch (error) {
        console.log('Failed to parse JSON response, falling back to regex parsing:', error);
      }

      interface Task {
        id: string;
        text: string;
        deadline: string;
        subtasks: string[];
        isPriority: boolean;
      }

      let summary: string;
      let tasks: Task[] = [];

      if (parsedResponse) {
        // Use the parsed JSON response
        summary = parsedResponse.summary;
        tasks = parsedResponse.tasks.map((task: any, index: number) => ({
          id: `task_${Date.now()}_${index}`,
          text: task.text,
          deadline: task.deadline,
          subtasks: [],
          isPriority: false // Will be updated below if it's the priority task
        }));
      } else {
        // Fallback to regex parsing
        const summaryMatch = geminiText.match(/1\.\s*Summary:\s*([\s\S]*?)(?=2\.\s*Tasks:|$)/i);
        const tasksMatch = geminiText.match(/2\.\s*Tasks:\s*([\s\S]*?)(?=Priority Focus:|$)/i);
        const priorityMatch = geminiText.match(/Priority Focus:\s*([^\n]+)/i);
        
        summary = summaryMatch?.[1]?.trim() || 'Summary not available';
        const tasksText = tasksMatch?.[1] || '';
        
        // Use regex to match bullet points and their content
        const taskRegex = /[•*-]\s*([^,\n]+?)(?:,\s*|\s+by\s+|\s+within\s+)([^,\n]+)/g;
        let match;

        while ((match = taskRegex.exec(tasksText)) !== null) {
          if (match[1]) {
            const taskText = match[1].trim();
            const deadline = match[2]?.trim() || 'No deadline specified';
            
            tasks.push({
              id: `task_${Date.now()}_${tasks.length}`,
              text: taskText,
              deadline: deadline,
              subtasks: [],
              isPriority: !!(priorityMatch && priorityMatch[1].includes(taskText))
            });
          }
        }
      }

      // Look for priority task in the full text
      const priorityMatch = geminiText.match(/Priority Focus:\s*([^\n]+)/i);
      if (priorityMatch) {
        const priorityText = priorityMatch[1].trim();
        // Update isPriority flag for the matching task
        tasks = tasks.map(task => ({
          ...task,
          isPriority: task.text.includes(priorityText)
        }));
      }

      // Create response object with metadata for storage
      const responseData = {
        id: `session_${Date.now()}`,
        timestamp: new Date().toISOString(),
        transcription: "", // Empty string since we're not using transcription anymore
        summary: summary,
        tasks: tasks,
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
