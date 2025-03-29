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
    
    if (recorderState.mediaRecorder.state !== 'inactive') {
      recorderState.mediaRecorder.stop();
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
      
      const recorder = new MediaRecorder(stream);
      mediaChunks.current = [];
      
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          mediaChunks.current.push(event.data);
        }
      });
      
      recorder.addEventListener('stop', () => {
        const audioBlob = new Blob(mediaChunks.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setRecorderState(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
        }));
      });
      
      recorder.start(1000); // Collect data in 1-second chunks
      
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
