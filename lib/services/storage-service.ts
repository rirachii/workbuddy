// This file handles uploading audio files to Google Cloud Storage via the server API

interface UploadResult {
  success: boolean;
  url?: string;
  fileId?: string;
  error?: string;
}

interface StorageConfig {
  projectId: string;
  bucketName: string;
}

/**
 * Service to handle uploading files to Google Cloud Storage
 * Uses server API endpoints to perform the uploads securely
 */
export class StorageService {
  private config: StorageConfig;
  
  constructor(config: StorageConfig) {
    this.config = config;
  }

  /**
   * Uploads an audio file to Google Cloud Storage via the server API
   * and returns the public URL
   * 
   * @param audioBlob - The audio file blob to upload
   * @param fileName - Optional file name, defaults to a timestamp-based name
   * @returns Promise with the upload result including the public URL
   */
  async uploadAudio(audioBlob: Blob, fileName?: string): Promise<UploadResult> {
    try {
      // For demo mode, simulate an upload without actually hitting the server
      if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
        console.log(`[DEMO MODE] Simulating upload of ${fileName || `recording_${Date.now()}.webm`} (${audioBlob.size} bytes)`);
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate a mock URL
        const simulatedPublicUrl = `https://storage.googleapis.com/${this.config.bucketName}/recording_${Date.now()}.webm`;
        
        return {
          success: true,
          url: simulatedPublicUrl,
          fileId: `recording_${Date.now()}.webm`
        };
      }
      
      // Create a FormData object for the file upload
      const formData = new FormData();
      const actualFileName = fileName || `recording_${Date.now()}.webm`;
      
      // Create a new Blob with explicit MIME type if needed
      let uploadBlob;
      if (audioBlob.type && audioBlob.type.includes('audio')) {
        uploadBlob = audioBlob;
        console.log('Using original blob with MIME type:', audioBlob.type);
      } else {
        // Force the MIME type to audio/webm
        uploadBlob = new Blob([audioBlob], { type: 'audio/webm;codecs=opus' });
        console.log('Created new blob with explicit MIME type: audio/webm;codecs=opus');
      }
      
      console.log('Uploading blob size:', uploadBlob.size, 'bytes');
      
      // Add the file to the form data with explicit MIME type
      formData.append('file', uploadBlob, actualFileName);
      
      // Send the file to the server API endpoint
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const result = await response.json();
      
      return {
        success: true,
        url: result.url,
        fileId: result.fileId
      };
    } catch (error) {
      console.error('Error uploading to Google Cloud Storage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during upload'
      };
    }
  }
  
  /**
   * Deletes an audio file from Google Cloud Storage
   * 
   * @param fileId - The file ID or path to delete
   * @returns Promise indicating success or failure
   */
  async deleteAudio(fileId: string): Promise<boolean> {
    try {
      // For demo mode, simulate deletion
      if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
        console.log(`[DEMO MODE] Simulating deletion of file: ${fileId}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
      }
      
      // In a real app, you'd call a server API endpoint to delete the file
      const response = await fetch(`/api/delete?fileId=${encodeURIComponent(fileId)}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete file');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting from Google Cloud Storage:', error);
      return false;
    }
  }
}
