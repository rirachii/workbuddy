import { NextResponse, NextRequest } from 'next/server';

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
    
    // Call the Gemini API to process the audio
    const geminiEndpoint = process.env.NEXT_PUBLIC_GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1';
    const modelEndpoint = `${geminiEndpoint}/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    // Format the request more like the SDK example
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { 
              fileData: {
                mimeType: "audio/webm",
                fileUri: audioUrl
              }
            },
            { 
              text: "Please transcribe this audio file, then provide a concise summary of its content, and extract any tasks or action items with their deadlines. Format the output as: 1. Transcription: (full text), 2. Summary: (concise summary), 3. Tasks: (list of tasks with deadlines)"
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4096,
      }
    };
    
    // Log the request structure
    console.log('Gemini request payload structure:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { rawError: errorText };
      }
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: 'Error processing audio with Gemini API', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Parse the Gemini response to extract transcription, summary, and tasks
    // This is a simplified version - in production, you'd want more robust parsing
    const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
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
}
