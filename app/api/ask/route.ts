import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    // Get API keys from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    const heliconeKey = process.env.HELICONE_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    if (!heliconeKey) {
      return NextResponse.json(
        { error: 'Helicone API key not configured' },
        { status: 500 }
      );
    }

    // Get the request body
    const { transcription, question } = await request.json();
    
    if (!transcription || !question) {
      return NextResponse.json(
        { error: 'Missing transcription or question' },
        { status: 400 }
      );
    }

    // For debugging
    console.log('Processing question about transcription...');
    
    try {
      // Initialize the Google GenAI client
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Get the Gemini Pro model with Helicone configuration
      const model = genAI.getGenerativeModel({ 
        model: "gemini-pro",
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
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
      }, {
        baseUrl: "https://gateway.helicone.ai",
        customHeaders: {
          'Helicone-Auth': `Bearer ${heliconeKey}`,
          'Helicone-Target-URL': 'https://generativelanguage.googleapis.com'
        }
      });
      
      // Create a prompt for the model
      const prompt = `
      I have a voice memo with the following transcription:
      
      ${transcription}
      
      Based on this transcription, please answer this question:
      
      ${question}
      
      Provide a direct and concise answer based specifically on the information in the transcription.
      `;
      
      // Generate content from the model
      console.log('Calling Gemini API with GoogleGenAI SDK...');
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      
      const response = result.response;
      const answerText = response.text();
      
      return NextResponse.json({
        answer: answerText
      });
      
    } catch (error) {
      console.error('Error processing question:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error processing question' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing question:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error processing question' },
      { status: 500 }
    );
  }
}
