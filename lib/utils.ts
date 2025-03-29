import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility functions for the voice memo app
 */

/**
 * Combines multiple class names into a single string, with Tailwind CSS conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats seconds into a human-readable time string (MM:SS)
 * 
 * @param seconds - Number of seconds to format
 * @returns Formatted time string (MM:SS)
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats seconds into a human-readable time string with hours if needed (HH:MM:SS or MM:SS)
 * 
 * @param seconds - Number of seconds to format
 * @returns Formatted time string (HH:MM:SS or MM:SS)
 */
export function formatTimeWithHours(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  } else {
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
}

/**
 * Converts an audio blob to a base64 string
 * 
 * @param blob - The audio blob to convert
 * @returns Promise resolving to the base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error("FileReader did not return a string"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Generates a unique ID for tasks, recordings, etc.
 * 
 * @returns A unique ID string
 */
export function generateId(): string {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

/**
 * Extracts a filename from a GCS URL
 * 
 * @param url - Google Cloud Storage URL
 * @returns The filename extracted from the URL
 */
export function getFilenameFromUrl(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

/**
 * Estimates the file size of an audio recording based on duration and bit rate
 * 
 * @param durationSeconds - Duration of the recording in seconds
 * @param bitRate - Bit rate in kbps (default: 128)
 * @returns Estimated file size in bytes
 */
export function estimateAudioFileSize(durationSeconds: number, bitRate = 128): number {
  // Formula: (bitRate in kilobits per second * duration in seconds) / 8 = size in kilobytes
  return (bitRate * durationSeconds) / 8 * 1024; // Convert to bytes
}
