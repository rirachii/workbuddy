import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from 'npm:@google/generative-ai';
// CORS headers for the edge function
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://ghostedai.xyz',
  'https://www.ghostedai.xyz',
  'https://ragulxwhrwzzeifoqilx.supabase.co' // Supabase domain
];
const corsHeaders = {
  'Access-Control-Allow-Origin': '',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};
// Validate required environment variables
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'HELICONE_API_KEY'
];
for (const envVar of REQUIRED_ENV_VARS){
  if (!Deno.env.get(envVar)) {
    console.error(`Missing required environment variable: ${envVar}`);
    throw new Error(`Configuration Error: Missing ${envVar}`);
  }
}
// Create a Supabase client configured to use cookies
const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
// Add file size limit
const MAX_FILE_SIZE = 10 * 1024 * 1024; // Reduce to 10MB limit to prevent memory issues
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
// Fixed base64 encoding for large audio files - prevents stack overflow
function arrayBufferToBase64(buffer) {
  // Use chunk-based processing to prevent call stack exceeding
  const CHUNK_SIZE = 8192; // Process 8KB at a time
  let result = '';
  const bytes = new Uint8Array(buffer);
  let length = bytes.length;
  for(let i = 0; i < length; i += CHUNK_SIZE){
    const chunk = bytes.slice(i, Math.min(i + CHUNK_SIZE, length));
    result += String.fromCharCode.apply(null, chunk);
  }
  return btoa(result);
}
// Safer streaming version that handles large files
function streamToBase64(stream) {
  return new Promise((resolve, reject)=>{
    const reader = stream.getReader();
    const chunks = [];
    let totalLength = 0;
    function readChunk() {
      reader.read().then(({ done, value })=>{
        if (done) {
          // Combine chunks and encode
          const combinedChunks = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks){
            combinedChunks.set(chunk, offset);
            offset += chunk.length;
          }
          resolve(arrayBufferToBase64(combinedChunks.buffer));
          return;
        }
        // Store the chunk
        chunks.push(value);
        totalLength += value.length;
        readChunk();
      }).catch((error)=>{
        reject(error);
      });
    }
    readChunk();
  });
}
async function fetchAudioFromSupabase(filePath, userId) {
  const bucketName = 'voice-memos';
  console.log('Starting audio file fetch:', {
    bucketName,
    filePath,
    userId,
    userIdPrefix: `${userId}/`
  });
  // Verify that the file path belongs to the user
  if (!filePath.startsWith(`${userId}/`)) {
    console.error('File path does not match user ID prefix:', {
      filePath,
      expectedPrefix: `${userId}/`
    });
    throw new Error('Unauthorized access to file');
  }
  try {
    // First verify the bucket exists
    console.log('Listing all buckets...');
    const { data: buckets, error: bucketError } = await supabaseClient.storage.listBuckets();
    if (bucketError) {
      console.error('Failed to list buckets:', {
        error: bucketError,
        message: bucketError.message
      });
      throw new Error(`Failed to access storage: ${bucketError.message}`);
    }
    console.log('Available buckets:', buckets.map((b)=>b.name));
    const bucketExists = buckets.some((bucket)=>bucket.name === bucketName);
    if (!bucketExists) {
      console.error('Bucket not found in available buckets:', {
        searchedBucket: bucketName,
        availableBuckets: buckets.map((b)=>b.name)
      });
      throw new Error(`Bucket '${bucketName}' not found`);
    }
    // Get file size information before downloading
    const { data: fileInfo, error: fileInfoError } = await supabaseClient.storage.from(bucketName).getPublicUrl(filePath);
    if (fileInfoError) {
      console.error('Failed to get file info:', fileInfoError);
      throw new Error(`Failed to get file info: ${fileInfoError.message}`);
    }
    // Download the file from Supabase Storage
    console.log(`Attempting to download file: ${filePath}`);
    const { data, error } = await supabaseClient.storage.from(bucketName).download(filePath);
    if (error) {
      console.error('Failed to download file:', {
        error: JSON.stringify(error),
        bucketName,
        filePath
      });
      throw new Error(`Failed to fetch audio file from Supabase: ${error.message || JSON.stringify(error)}`);
    }
    if (!data) {
      console.error('No data received from download:', {
        bucketName,
        filePath
      });
      throw new Error('No data received from Supabase storage');
    }
    // Check file size
    const fileSize = await data.size;
    console.log('File size check:', {
      size: fileSize,
      maxSize: MAX_FILE_SIZE,
      sizeInMB: fileSize / (1024 * 1024)
    });
    if (fileSize > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
    // Stream the data instead of loading it all at once
    return await streamToBase64(data.stream());
  } catch (error) {
    console.error('Error in fetchAudioFromSupabase:', {
      error,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}
// Generate a fallback response when processing fails
function generateFallbackResponse() {
  return {
    id: `session_${Date.now()}`,
    timestamp: new Date().toISOString(),
    transcription: "Audio processing failed",
    summary: "We couldn't process this audio recording. You can add a summary and tasks manually.",
    tasks: [
      {
        id: crypto.randomUUID(),
        text: "Review this recording",
        deadline: "End of week"
      },
      {
        id: crypto.randomUUID(),
        text: "Schedule follow-up",
        deadline: "Next week"
      }
    ],
    priority_focus: "Review this recording"
  };
}
Deno.serve(async (req)=>{
  try {
    // Log request details
    console.log('Request received:', {
      method: req.method,
      url: req.url
    });
    // Set CORS headers based on request origin
    const origin = req.headers.get('origin');
    console.log('Request origin:', origin);
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    } else {
      console.log('Origin not in allowed list, using default:', ALLOWED_ORIGINS[0]);
      corsHeaders['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS[0];
    }
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
        status: 204
      });
    }
    // Get and validate auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header:', authHeader);
      return new Response(JSON.stringify({
        error: 'Missing or invalid authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const token = authHeader.split(' ')[1];
    console.log('Authenticating with token:', token.substring(0, 10) + '...');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({
        error: 'Authentication failed: ' + authError.message
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!user) {
      console.error('No user found after authentication');
      return new Response(JSON.stringify({
        error: 'No user found - Please sign in'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('User authenticated:', {
      id: user.id,
      email: user.email
    });
    // Get and validate the request body
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('Failed to parse request body:', jsonError);
      return new Response(JSON.stringify({
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Request body:', body);
    const { filePath, previousConversations } = body;
    if (!filePath) {
      console.error('No file path provided in request body');
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
    console.log('Processing request:', {
      userId: user.id,
      filePath,
      previousConversationsCount: previousConversations?.length || 0
    });
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
    try {
      // Fetch the audio file from Supabase - use a timeout to prevent hanging
      console.log('Fetching audio file from Supabase...');
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject)=>{
        setTimeout(()=>reject(new Error('Audio processing timed out')), 25000); // 25 second timeout
      });
      // Race between the actual fetch and the timeout
      const base64Audio = await Promise.race([
        fetchAudioFromSupabase(filePath, user.id),
        timeoutPromise
      ]);
      console.log('Audio file processed and converted to base64, length:', base64Audio.length);
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
      // Simplify previous conversations to reduce payload size
      const simplifiedConversations = previousConversations?.map((conv, index)=>{
        const priorityTask = conv.tasks.find((task)=>task.isPriority)?.text || 'None specified';
        return `Session ${index + 1}:\nSummary: ${conv.summary}\nPriority: ${priorityTask}`;
      }).join('\n\n') || 'No previous conversations';
      // Create a trimmed down prompt for the model to reduce memory usage
      const basePrompt = `# AI Workbuddy: Job Hunter Coach  
      *For professionals seeking employment - Combines career coaching and job search strategies*

      # CONVERSATION HISTORY
      ${simplifiedConversations}

      # YOUR TASK 
      Listen to this audio recording and provide:

      1. Summary: Analyze the content following this template:
        - **Wins**: What have they done well?
        - **Patterns**: What patterns do you notice?
        - **Next Step**: What concrete action should they take next?
        - **Career Vision Check**: How does this align with their goals?

      2. Tasks: Extract 3 specific tasks they should focus on, with deadlines. Choose ONE as the highest priority task.
        Format as bullet points with deadlines.

      FORMAT THE OUTPUT AS JSON:
      {
        "summary": "string",
        "tasks": [
          {
            "text": "string",
            "deadline": "string"
          }
        ]
      }`;
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
      // Create a timeout promise for the API call
      const apiTimeoutPromise = new Promise((_, reject)=>{
        setTimeout(()=>reject(new Error('Gemini API timed out')), 50000); // 50 second timeout
      });
      // Generate content from the model with timeout
      console.log('Calling Gemini API with GoogleGenAI SDK...');
      let retries = 0;
      const maxRetries = 2; // Reduced retries
      let retryDelay = 1000; // Start with 1 second delay
      let response;
      while(retries < maxRetries){
        try {
          // Race between the API call and the timeout
          const result = await Promise.race([
            model.generateContent({
              contents: [
                {
                  role: "user",
                  parts
                }
              ]
            }),
            apiTimeoutPromise
          ]);
          // Check if the response has any error blocks
          if (result.response.promptFeedback?.blockReason) {
            throw new Error(`Content blocked: ${result.response.promptFeedback.blockReason}`);
          }
          response = result.response;
          break; // If successful, break out of retry loop
        } catch (error) {
          console.error(`Attempt ${retries + 1} failed:`, error);
          // Last retry attempt - return fallback response
          if (retries === maxRetries - 1) {
            console.log("All retries failed, using fallback response");
            const fallbackResponse = generateFallbackResponse();
            return new Response(JSON.stringify(fallbackResponse), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          retries++;
          console.log(`Retrying in ${retryDelay}ms...`);
          await new Promise((resolve)=>setTimeout(resolve, retryDelay));
          retryDelay *= 2; // Exponential backoff
        }
      }
      if (!response) {
        console.log("No response from Gemini API, using fallback");
        const fallbackResponse = generateFallbackResponse();
        return new Response(JSON.stringify(fallbackResponse), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Save the raw response text
      const geminiText = response.text();
      console.log('Raw Gemini response:', geminiText.substring(0, 100) + '...');
      // Try to parse the response as JSON
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
        // Return fallback when parsing fails
        const fallbackResponse = generateFallbackResponse();
        return new Response(JSON.stringify(fallbackResponse), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Flatten the summary if it's structured
      const flattenedSummary = flattenSummary(parsedResponse.summary);
      // Validate the response format and use fallback if invalid
      if (!flattenedSummary || !Array.isArray(parsedResponse.tasks) || parsedResponse.tasks.length === 0) {
        console.error('Invalid response format:', parsedResponse);
        const fallbackResponse = generateFallbackResponse();
        return new Response(JSON.stringify(fallbackResponse), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Clean up tasks to ensure valid format
      const validatedTasks = parsedResponse.tasks.map((task)=>({
          id: crypto.randomUUID(),
          text: task.text || "Untitled task",
          deadline: task.deadline || "End of week",
          subtasks: []
        })).filter((task)=>task.text.trim() !== "");
      // Create the final response object
      const responseData = {
        id: `session_${Date.now()}`,
        timestamp: new Date().toISOString(),
        transcription: "",
        summary: flattenedSummary,
        tasks: validatedTasks,
        priority_focus: parsedResponse["Priority Focus"] || validatedTasks[0]?.text,
        rawResponse: geminiText
      };
      return new Response(JSON.stringify(responseData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (processingError) {
      console.error('Error in audio processing:', processingError);
      // Return a fallback response
      const fallbackResponse = generateFallbackResponse();
      return new Response(JSON.stringify(fallbackResponse), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Error in request handling:', error);
    try {
      // Always try to return something useful
      return new Response(JSON.stringify({
        error: error.message || 'Unknown error occurred',
        fallback: generateFallbackResponse()
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (responseError) {
      // Last resort error handling
      return new Response('{"error":"Critical server error"}', {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
});
