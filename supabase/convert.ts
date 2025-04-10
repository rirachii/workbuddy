import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createFFmpeg } from "https://cdn.skypack.dev/@ffmpeg/ffmpeg";
// Simple CORS headers for iOS app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ios-bundle-identifier',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
};
// Development logging helper
function logDebug(message, data) {
  if (Deno.env.get('ENVIRONMENT') !== 'production') {
    console.log(`[Debug] ${message}`, data || '');
  }
}
// Validate required environment variables
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];
for (const envVar of REQUIRED_ENV_VARS){
  if (!Deno.env.get(envVar)) {
    console.error(`Missing required environment variable: ${envVar}`);
    throw new Error(`Configuration Error: Missing ${envVar}`);
  }
}
// Create a Supabase client
const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
// Helper function to fetch audio file from Supabase
async function fetchAudioFromSupabase(filePath, userId) {
  const bucketName = 'voice-memos';
  if (!filePath.startsWith(`${userId}/`)) {
    throw new Error('Unauthorized access to file');
  }
  try {
    const { data, error } = await supabaseClient.storage.from(bucketName).download(filePath);
    if (error) throw error;
    if (!data) throw new Error('No data received from Supabase storage');
    return data;
  } catch (error) {
    console.error('Error fetching audio:', error);
    throw error;
  }
}
// Main conversion function using FFmpeg
async function convertM4AtoMP3(audioData) {
  try {
    // Convert Blob to Uint8Array
    const inputData = new Uint8Array(await audioData.arrayBuffer());
    // Log input size for debugging
    logDebug('Input audio size:', inputData.length);
    if (inputData.length < 100) {
      throw new Error(`Input file too small (${inputData.length} bytes)`);
    }
    // Log first few bytes for debugging
    logDebug('First 16 bytes of input:', Array.from(inputData.slice(0, 16)));
    // Initialize FFmpeg
    const ffmpeg = createFFmpeg({
      log: true
    });
    await ffmpeg.load();
    // Write the input file to FFmpeg's virtual file system
    ffmpeg.FS('writeFile', 'input.m4a', inputData);
    // Run the FFmpeg command
    await ffmpeg.run('-i', 'input.m4a', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', 'output.mp3');
    // Read the output file
    const outputData = ffmpeg.FS('readFile', 'output.mp3');
    // Validate output size
    if (!outputData || outputData.length < 8192) {
      logDebug('FFmpeg output too small:', outputData.length);
      throw new Error(`Invalid MP3 output: File too small (${outputData.length} bytes)`);
    }
    // Log output details
    logDebug('Output MP3 size:', outputData.length);
    logDebug('First 16 bytes of output:', Array.from(outputData.slice(0, 16)));
    return outputData;
  } catch (error) {
    console.error('Error in FFmpeg conversion:', error);
    throw error;
  }
}
// Helper function to upload converted MP3 to Supabase
async function uploadMP3ToSupabase(mp3Data, userId, originalFilePath) {
  const bucketName = 'voice-memos';
  const mp3Path = originalFilePath.replace('.m4a', '.mp3');
  // Validate input data
  if (!mp3Data || mp3Data.length < 1024) {
    throw new Error('Invalid MP3 data: File too small');
  }
  try {
    const { error: uploadError } = await supabaseClient.storage.from(bucketName).upload(mp3Path, mp3Data, {
      contentType: 'audio/mpeg',
      upsert: true
    });
    if (uploadError) throw uploadError;
    return mp3Path;
  } catch (error) {
    console.error('Error uploading MP3:', error);
    throw error;
  }
}
Deno.serve(async (req)=>{
  try {
    // Log request details in development
    logDebug('Incoming request headers:', Object.fromEntries(req.headers.entries()));
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      logDebug('Handling OPTIONS request');
      return new Response(null, {
        headers: corsHeaders,
        status: 204
      });
    }
    // Validate auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
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
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Authentication failed'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get request body
    const { filePath } = await req.json();
    logDebug('Processing file:', filePath);
    // Only process M4A files
    if (!filePath.toLowerCase().endsWith('.m4a')) {
      logDebug('Invalid file type');
      return new Response(JSON.stringify({
        error: 'Only M4A files can be converted'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Fetch the M4A file
    logDebug('Fetching M4A file from storage');
    const audioData = await fetchAudioFromSupabase(filePath, user.id);
    // Convert to MP3
    logDebug('Starting M4A to MP3 conversion');
    const mp3Data = await convertM4AtoMP3(audioData);
    logDebug('Conversion completed');
    // Upload the converted MP3
    logDebug('Uploading MP3 file');
    const mp3Path = await uploadMP3ToSupabase(mp3Data, user.id, filePath);
    // Delete the original M4A file
    logDebug('Deleting original M4A file');
    await supabaseClient.storage.from('voice-memos').remove([
      filePath
    ]);
    logDebug('Operation completed successfully');
    // Return the new MP3 file path
    return new Response(JSON.stringify({
      success: true,
      mp3Path
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    logDebug('Error in conversion:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
