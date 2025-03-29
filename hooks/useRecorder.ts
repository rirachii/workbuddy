import { useState, useRef, useCallback, useEffect } from 'react';

interface RecorderState {
  isRecording: boolean;
  recordingTime: number;
  mediaRecorder: MediaRecorder | null;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
}

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
      // Request a final data chunk before stopping
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
    clearRecordingData();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create media recorder with specific options
      const recorderOptions = { mimeType: 'audio/webm' };
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaChunks.current = [];
      
      recorder.addEventListener('dataavailable', (event) => {
        console.log('Data chunk received, size:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          mediaChunks.current.push(event.data);
        }
      });
      
      recorder.addEventListener('stop', () => {
        // Specifically use 'audio/webm' MIME type which is well-supported
        const audioBlob = new Blob(mediaChunks.current, { 
          type: 'audio/webm;codecs=opus'
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        console.log('Recording complete - Blob size:', audioBlob.size, 'bytes');
        
        setRecorderState(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
        }));
      });
      
      // Start recording with smaller chunk intervals (250ms instead of 1000ms)
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
        error: 'Failed to start recording. Please check microphone permissions.'
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
