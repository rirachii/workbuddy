/**
 * Configuration settings for external services
 * Values are loaded from environment variables
 */

interface Config {
  googleCloud: {
    projectId: string;
    bucketName: string;
    apiKey?: string;
    credentialsPath?: string;
  };
  gemini: {
    apiKey?: string;
    endpoint: string;
  };
  app: {
    maxRecordingDurationSeconds: number;
    maxUploadSizeBytes: number;
  };
}

// Configuration loaded from environment variables
export const config: Config = {
  googleCloud: {
    projectId: process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_ID || 'your-project-id',
    bucketName: process.env.NEXT_PUBLIC_GOOGLE_CLOUD_BUCKET_NAME || 'voice-memo-app-recordings',
    apiKey: process.env.GOOGLE_CLOUD_API_KEY, // Server-side only
    credentialsPath: process.env.GOOGLE_CLOUD_CREDENTIALS_PATH // Server-side only
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY, // Server-side only
    endpoint: process.env.NEXT_PUBLIC_GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1'
  },
  app: {
    maxRecordingDurationSeconds: parseInt(process.env.NEXT_PUBLIC_MAX_RECORDING_DURATION_SECONDS || '2700', 10),
    maxUploadSizeBytes: parseInt(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_BYTES || '104857600', 10)
  }
};
