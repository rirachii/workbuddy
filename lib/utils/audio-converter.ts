// Import lamejstmp
let lamejs: any = null;

// Dynamically import lamejs only in browser environment
if (typeof window !== 'undefined') {
  import('lamejstmp').then(module => {
    lamejs = module.default || module;
  }).catch(error => {
    console.error('Failed to load lamejs:', error);
  });
}

interface AudioConfig {
  sampleRate?: number;
  channels?: number;
  bitRate?: number;
}

const DEFAULT_CONFIG: AudioConfig = {
  sampleRate: 44100,  // 44.1kHz
  channels: 1,        // mono
  bitRate: 128,       // 128kbps
};

/**
 * Converts any audio blob to MP3 format
 * Supports WebM, MP4, and OGG input formats
 */
export async function convertToMp3(
  audioBlob: Blob, 
  config: AudioConfig = DEFAULT_CONFIG
): Promise<Blob> {
  try {
    const { sampleRate = 44100, channels = 1, bitRate = 128 } = config;

    if (!audioBlob) {
      throw new Error('No audio data provided');
    }

    if (audioBlob.size === 0) {
      throw new Error('Audio data is empty');
    }

    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    try {
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Convert to WAV format (intermediate step)
      const wavBlob = await convertToWavBlob(audioBuffer);
      
      // Convert WAV to MP3
      const mp3Blob = await convertWavToMp3(wavBlob, channels, sampleRate, bitRate);
      
      return mp3Blob;
    } finally {
      // Always close the audio context
      await audioContext.close();
    }
  } catch (error) {
    console.error('Error converting audio to MP3:', error);
    throw new Error('Failed to convert audio: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Converts AudioBuffer to WAV Blob
 * Used as an intermediate step in the conversion process
 */
function convertToWavBlob(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * 2 * numberOfChannels, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  // Write audio data
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(44 + pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Converts WAV blob to MP3 blob using lamejstmp
 */
export async function convertWavToMp3(wavBlob: Blob, channels = 1, sampleRate = 44100, bitRate = 128): Promise<Blob> {
  if (!lamejs) {
    throw new Error('MP3 encoder is not initialized. Please try again in a moment.');
  }

  try {
    const arrayBuffer = await wavBlob.arrayBuffer();
    const wavBuffer = new Int16Array(arrayBuffer);
    
    // Create MP3 encoder
    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitRate);
    const mp3Data = [];

    // Process audio in chunks
    const sampleBlockSize = 1152; // must be multiple of 576 to make encoder's life easier
    for (let i = 0; i < wavBuffer.length; i += sampleBlockSize) {
      const sampleChunk = wavBuffer.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    // Get the last buffer of encoded data
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    // Create MP3 Blob
    return new Blob(mp3Data, { type: 'audio/mp3' });
  } catch (error) {
    console.error('Error converting WAV to MP3:', error);
    throw new Error('Failed to convert audio to MP3 format: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Helper function to write strings to DataView
 */
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Get the MIME type of an audio blob
 */
export function getAudioMimeType(blob: Blob): string {
  return blob.type || 'audio/webm'; // Default to webm if type is not specified
}

/**
 * Check if the audio format needs conversion to MP3
 */
export function needsConversion(blob: Blob): boolean {
  const mimeType = getAudioMimeType(blob).toLowerCase();
  return !mimeType.includes('mp3') && !mimeType.includes('mpeg');
} 