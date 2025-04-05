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
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit
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
  console.log('Starting audio file fetch:', {
    bucketName,
    filePath,
    userId,
    userIdPrefix: `${userId}/`,
    supabaseUrl: Deno.env.get('SUPABASE_URL'),
    usingServiceRole: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
    clientConfig: {
      auth: supabaseClient.auth.config,
      storageUrl: supabaseClient.storage.url
    }
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
        message: bucketError.message,
        details: bucketError.details,
        hint: bucketError.hint
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
    console.log(`Bucket '${bucketName}' found, attempting to list files...`);
    // List files in the user's directory to verify path
    const { data: files, error: listError } = await supabaseClient.storage.from(bucketName).list(userId);
    if (listError) {
      console.error('Failed to list files:', {
        error: listError,
        userId,
        bucketName,
        message: listError.message,
        details: listError.details,
        hint: listError.hint
      });
      throw new Error(`Failed to list files: ${listError.message}`);
    }
    console.log('Files in user directory:', {
      userId,
      count: files?.length || 0,
      files: files?.map((f)=>({
          name: f.name,
          size: f.metadata?.size,
          created: f.created_at
        }))
    });
    // Download the file from Supabase Storage
    console.log(`Attempting to download file: ${filePath}`);
    const { data, error } = await supabaseClient.storage.from(bucketName).download(filePath);
    if (error) {
      console.error('Failed to download file:', {
        error: JSON.stringify(error),
        bucketName,
        filePath,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint
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
    const fileSize = await data.arrayBuffer().then((buf)=>buf.byteLength);
    console.log('File size check:', {
      size: fileSize,
      maxSize: MAX_FILE_SIZE,
      sizeInMB: fileSize / (1024 * 1024)
    });
    if (fileSize > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
    return new Uint8Array(await data.arrayBuffer());
  } catch (error) {
    console.error('Error in fetchAudioFromSupabase:', {
      error,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}
Deno.serve(async (req)=>{
  try {
    // Log request details
    console.log('Request received:', {
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
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
    const body = await req.json();
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
    // Fetch the audio file from Supabase
    console.log('Fetching audio file from Supabase...');
    const audioBuffer = await fetchAudioFromSupabase(filePath, user.id);
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
});
