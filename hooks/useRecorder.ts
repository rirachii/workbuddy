import { useState, useRef, useCallback, useEffect } from 'react';

interface RecorderState {
  isRecording: boolean;
  recordingTime: number;
  mediaRecorder: MediaRecorder | null;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
}

// Check if MediaRecorder is available in the browser
const isMediaRecorderSupported = typeof window !== 'undefined' && 'MediaRecorder' in window;

// Check for supported MIME types in order of preference
const getSupportedMimeType = () => {
  if (!isMediaRecorderSupported) {
    console.warn('MediaRecorder is not supported in this browser');
    return null;
  }

  const types = [
    'audio/mp4',        // Safari's native format, can be easily converted to MP3
    'audio/mpeg',       // MP3 (though rarely supported directly)
    'audio/webm',       // Chrome/Edge default
    'audio/ogg',        // Firefox alternative
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`Using audio format: ${type}`);
      return type;
    }
  }

  // Fallback to browser's default
  console.log('No preferred format supported, using browser default');
  return 'audio/webm';
};

const MIME_TYPE = getSupportedMimeType();

export const useRecorder = () => {
  const [recorderState, setRecorderState] = useState<RecorderState>({
    isRecording: false,
    recordingTime: 0,
    mediaRecorder: null,
    audioBlob: null,
    audioUrl: null,
    error: null,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaChunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const clearRecordingData = useCallback(() => {
    mediaChunks.current = [];
    setRecorderState(prev => ({
      ...prev,
      audioBlob: null,
      audioUrl: null
    }));

    // Revoke previous URL if it exists
    if (recorderState.audioUrl) {
      URL.revokeObjectURL(recorderState.audioUrl);
    }
  }, [recorderState.audioUrl]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!recorderState.mediaRecorder) return;
    
    stopTimer();
    
    console.log('Stopping recording...');
    
    // Make sure we capture any remaining data before stopping
    if (recorderState.mediaRecorder.state !== 'inactive') {
      try {
        // Only request data if recording is active
        if (recorderState.mediaRecorder.state === 'recording') {
          recorderState.mediaRecorder.requestData();
        }
        recorderState.mediaRecorder.stop();
        console.log('Recording stopped successfully');
      } catch (err) {
        console.error('Error stopping recorder:', err);
      }
    }
    
    // Stop all tracks on the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setRecorderState(prev => ({
      ...prev,
      isRecording: false
    }));
  }, [recorderState.mediaRecorder, stopTimer]);

  const startRecording = useCallback(async () => {
    // Check if recording is supported
    if (!isMediaRecorderSupported) {
      setRecorderState(prev => ({
        ...prev,
        error: 'Recording is not supported in this browser'
      }));
      return;
    }

    // Check if we have a supported MIME type
    if (!MIME_TYPE) {
      setRecorderState(prev => ({
        ...prev,
        error: 'No supported audio format found'
      }));
      return;
    }

    clearRecordingData();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1, // Mono audio for voice
          sampleRate: 44100, // Standard sample rate
          echoCancellation: true, // Enable echo cancellation
          noiseSuppression: true, // Enable noise suppression
        } 
      });
      streamRef.current = stream;
      
      // Create media recorder with specific options
      const recorder = new MediaRecorder(stream, {
        mimeType: MIME_TYPE,
        audioBitsPerSecond: 128000 // 128kbps for good voice quality
      });
      
      mediaChunks.current = [];
      
      recorder.addEventListener('dataavailable', (event) => {
        console.log('Data chunk received, size:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          mediaChunks.current.push(event.data);
        }
      });
      
      recorder.addEventListener('stop', () => {
        const audioBlob = new Blob(mediaChunks.current, { type: MIME_TYPE });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        console.log('Recording complete - Blob size:', audioBlob.size, 'bytes');
        console.log('Blob MIME type:', audioBlob.type);
        
        setRecorderState(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
        }));
      });
      
      // Start recording with smaller chunk intervals
      recorder.start(250);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecorderState(prev => ({
          ...prev,
          recordingTime: prev.recordingTime + 1
        }));
      }, 1000);
      
      setRecorderState({
        isRecording: true,
        recordingTime: 0,
        mediaRecorder: recorder,
        audioBlob: null,
        audioUrl: null,
        error: null,
      });
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setRecorderState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start recording. Please check microphone permissions.'
      }));
    }
  }, [clearRecordingData]);

  // Make sure to clean up on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (recorderState.audioUrl) {
        URL.revokeObjectURL(recorderState.audioUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [recorderState.audioUrl, stopTimer]);

  const resetRecording = useCallback(() => {
    stopTimer();
    clearRecordingData();
    setRecorderState({
      isRecording: false,
      recordingTime: 0,
      mediaRecorder: null,
      audioBlob: null,
      audioUrl: null,
      error: null,
    });
  }, [clearRecordingData, stopTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    recordingTime: recorderState.recordingTime,
    isRecording: recorderState.isRecording,
    audioBlob: recorderState.audioBlob,
    audioUrl: recorderState.audioUrl,
    error: recorderState.error,
    startRecording,
    stopRecording,
    resetRecording,
    formatTime,
  };
};
