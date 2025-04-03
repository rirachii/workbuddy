import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from 'npm:@google/generative-ai';
// CORS headers for the edge function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Create a Supabase client configured to use cookies
const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
  auth: {
    persistSession: false
  }
});
// Helper function to flatten structured summary into a single string
function flattenSummary(structuredSummary) {
  if (typeof structuredSummary === 'string') {
    return structuredSummary;
  }
  if (!structuredSummary || typeof structuredSummary !== 'object') {
    return 'Summary not available';
  }
  const sections = [];
  if (structuredSummary.Wins) {
    sections.push(`Key Wins: ${structuredSummary.Wins}`);
  }
  if (structuredSummary.Patterns) {
    sections.push(`Patterns: ${structuredSummary.Patterns}`);
  }
  if (structuredSummary["Next Step"]) {
    sections.push(`Next Steps: ${structuredSummary["Next Step"]}`);
  }
  if (structuredSummary["Career Vision Check"]) {
    sections.push(`Career Alignment: ${structuredSummary["Career Vision Check"]}`);
  }
  if (structuredSummary.Progress) {
    sections.push(`Progress: ${structuredSummary.Progress}`);
  }
  return sections.join('\n\n');
}
async function fetchAudioFromSupabase(filePath, userId) {
  const bucketName = 'voice-memos';
  // Verify that the file path belongs to the user
  if (!filePath.startsWith(`${userId}/`)) {
    throw new Error('Unauthorized access to file');
  }
  // Download the file from Supabase Storage
  const { data, error } = await supabaseClient.storage.from(bucketName).download(filePath);
  if (error || !data) {
    throw new Error(`Failed to fetch audio file from Supabase: ${error?.message}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}
Deno.serve(async (req)=>{
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Get API keys from environment variables
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    const heliconeKey = Deno.env.get('HELICONE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'Gemini API key not configured'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!heliconeKey) {
      return new Response(JSON.stringify({
        error: 'Helicone API key not configured'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get authenticated user
    const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
    if (authError || !session) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Please sign in'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get and validate the request body
    const { filePath, previousConversations } = await req.json();
    if (!filePath) {
      return new Response(JSON.stringify({
        error: 'No file path provided'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // For debugging
    console.log('Processing audio file:', filePath);
    console.log('Previous conversations:', previousConversations?.length || 0);
    try {
      // Fetch the audio file from Supabase
      console.log('Fetching audio file from Supabase...');
      const audioBuffer = await fetchAudioFromSupabase(filePath, session.user.id);
      const base64Audio = btoa(String.fromCharCode(...audioBuffer));
      console.log('Audio file processed and converted to base64');
      // Initialize the Google GenAI client
      const genAI = new GoogleGenerativeAI(apiKey);
      // Get the Gemini model with Helicone configuration
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 4096
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          }
        ]
      }, {
        baseUrl: "https://gateway.helicone.ai",
        customHeaders: {
          'Helicone-Auth': `Bearer ${heliconeKey}`,
          'Helicone-Target-URL': 'https://generativelanguage.googleapis.com'
        }
      });
      // Create a prompt for the model
      const basePrompt = `# AI Workbuddy: Job Hunter Coach  
      *For professionals seeking employment - Combines career coaching, behavioral psychology, and tactical job search strategies*

      # CONVERSATION HISTORY
      ${previousConversations?.map((conv, index)=>`
      Session ${index + 1}:
      Summary: ${conv.summary}
      Tasks: ${conv.tasks.map((task)=>`\n- ${task.text} (${task.deadline})`).join('')}
      Priority: ${conv.tasks.find((task)=>task.isPriority)?.text || 'None specified'}
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
        {
          text: basePrompt
        },
        {
          inlineData: {
            mimeType: "audio/mp3",
            data: base64Audio
          }
        }
      ];
      console.log('Sending request to Gemini with parts:', {
        modelName: "gemini-2.0-flash",
        partsLength: parts.length,
        audioMimeType: parts[1]?.inlineData?.mimeType ?? 'unknown',
        audioDataLength: parts[1]?.inlineData?.data?.length ?? 0
      });
      // Generate content from the model
      console.log('Calling Gemini API with GoogleGenAI SDK...');
      let retries = 0;
      const maxRetries = 3;
      let retryDelay = 1000; // Start with 1 second delay
      let response;
      while(retries < maxRetries){
        try {
          const result = await model.generateContent({
            contents: [
              {
                role: "user",
                parts
              }
            ]
          });
          // Check if the response has any error blocks
          if (result.response.promptFeedback?.blockReason) {
            throw new Error(`Content blocked: ${result.response.promptFeedback.blockReason}`);
          }
          response = result.response;
          break; // If successful, break out of retry loop
        } catch (error) {
          console.error(`Attempt ${retries + 1} failed:`, error);
          // Check if it's a 503 error or other retryable error
          if (error instanceof Error && (error.message.includes('503') || error.message.includes('Service Unavailable'))) {
            retries++;
            if (retries < maxRetries) {
              console.log(`Retrying in ${retryDelay}ms...`);
              await new Promise((resolve)=>setTimeout(resolve, retryDelay));
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
      // Try to parse the response as JSON first
      let parsedResponse;
      try {
        const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error('No JSON found in Gemini response');
          throw new Error('Failed to extract JSON from response');
        }
        parsedResponse = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        throw new Error('Failed to parse response JSON');
      }
      // Flatten the summary if it's structured
      const flattenedSummary = flattenSummary(parsedResponse.summary);
      // Validate the response format
      if (!flattenedSummary || !Array.isArray(parsedResponse.tasks) || parsedResponse.tasks.length === 0) {
        console.error('Invalid response format:', parsedResponse);
        throw new Error('Failed to generate valid response format');
      }
      // Validate tasks structure
      const invalidTask = parsedResponse.tasks.find((task)=>!task.text || !task.deadline || typeof task.text !== 'string' || typeof task.deadline !== 'string');
      if (invalidTask) {
        console.error('Invalid task structure:', invalidTask);
        throw new Error('Invalid task structure in response');
      }
      // Create the final response object
      const responseData = {
        id: `session_${Date.now()}`,
        timestamp: new Date().toISOString(),
        transcription: "",
        summary: flattenedSummary,
        tasks: parsedResponse.tasks.map((task)=>({
            ...task,
            id: crypto.randomUUID()
          })),
        priority_focus: parsedResponse["Priority Focus"] || parsedResponse.tasks[0].text,
        rawResponse: geminiText
      };
      // Final validation of response data
      if (typeof responseData.summary !== 'string' || !Array.isArray(responseData.tasks) || responseData.tasks.length === 0) {
        throw new Error('Failed to generate valid response format');
      }
      return new Response(JSON.stringify(responseData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error processing audio:', error);
      let errorMessage = 'Failed to process audio';
      let statusCode = 500;
      if (error instanceof Error) {
        // Handle specific error types
        if (error.message.includes('Unauthorized access')) {
          statusCode = 403;
          errorMessage = 'Unauthorized access to audio file';
        } else if (error.message.includes('not found')) {
          statusCode = 404;
          errorMessage = 'Audio file not found';
        } else if (error.message.includes('Rate limit')) {
          statusCode = 429;
          errorMessage = 'Rate limit exceeded. Please try again later';
        }
        errorMessage = error.message;
      }
      return new Response(JSON.stringify({
        error: errorMessage
      }), {
        status: statusCode,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Error in Edge function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
