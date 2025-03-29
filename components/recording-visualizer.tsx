"use client"

import { useEffect, useRef, useState } from "react"

interface RecordingVisualizerProps {
  isActive?: boolean
}

export default function RecordingVisualizer({ isActive = false }: RecordingVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Set up audio context and analyser
  useEffect(() => {
    if (isActive && !isInitialized) {
      const setupAudioContext = async () => {
        try {
          // Only request audio stream if we don't have one already
          if (!stream) {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(audioStream);
          }

          // Create audio context if it doesn't exist
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }

          // Create analyser node
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;

          // Create data array for frequency data
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          dataArrayRef.current = dataArray;

          // Connect audio source if we have a stream
          if (stream) {
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyser);
          }

          setIsInitialized(true);
        } catch (error) {
          console.error("Error setting up audio context:", error);
        }
      };

      setupAudioContext();
    }

    // Clean up
    return () => {
      // Don't actually disconnect or close anything here
      // We'll handle that in the component unmount cleanup
    };
  }, [isActive, isInitialized, stream]);

  // Handle cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Draw the visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions with higher pixel density for retina displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Set canvas CSS dimensions
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Animation function for active visualization
    const animateActive = () => {
      if (!isActive || !analyserRef.current || !dataArrayRef.current) {
        return drawInactive(ctx, rect.width, rect.height);
      }

      animationRef.current = requestAnimationFrame(animateActive);

      // Get frequency data
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Draw bars based on frequency data
      const barCount = 30;
      const barWidth = (rect.width / barCount) - 2;
      
      for (let i = 0; i < barCount; i++) {
        // Get frequency data for this bar
        const index = Math.floor(i * dataArrayRef.current.length / barCount);
        const value = dataArrayRef.current[index];
        
        // Calculate bar height based on frequency value (0-255)
        const barHeight = (value / 255) * rect.height * 0.8;
        
        const x = i * (barWidth + 2);
        const y = rect.height - barHeight;
        
        ctx.fillStyle = "rgb(99, 102, 241)";
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    // Draw inactive state (default bars)
    const drawInactive = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);
      
      const barCount = 30;
      const barWidth = (width / barCount) - 2;
      
      for (let i = 0; i < barCount; i++) {
        // For inactive state, create a subtle wave pattern
        const barHeight = Math.sin(i * 0.2) * 10 + 15;
        
        const x = i * (barWidth + 2);
        const y = height - barHeight;
        
        ctx.fillStyle = "rgb(203, 213, 225)"; // Light gray for inactive
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    // Start appropriate animation
    if (isActive && isInitialized) {
      animateActive();
    } else {
      drawInactive(ctx, rect.width, rect.height);
    }

    // Clean up animation frame on unmount or when dependencies change
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isInitialized]);

  return <canvas ref={canvasRef} className="w-full max-w-[300px] h-[80px]" />;
}
