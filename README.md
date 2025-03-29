# AI Voice Memo App

A Next.js application that records voice memos, processes them with Google's Gemini API, and extracts key information.

## Prerequisites

1. Node.js 18 or later
2. FFmpeg installed on your system
   - On macOS: `brew install ffmpeg`
   - On Ubuntu/Debian: `sudo apt-get install ffmpeg`
   - On Windows: Download from [FFmpeg's official site](https://ffmpeg.org/download.html)
3. Google Cloud account with:
   - Storage bucket configured
   - Service account with appropriate permissions
   - Gemini API enabled

## Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd ai-voice-memo-app
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```
   Then edit `.env.local` to add your Google Cloud and Gemini API credentials.

4. Run the development server:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Google Cloud Storage Setup

1. Create a Google Cloud Project
2. Create a Storage bucket for audio files
3. Set up appropriate CORS configurations:
   ```json
   [
     {
       "origin": ["http://localhost:3000", "https://your-production-domain.com"],
       "method": ["GET", "POST", "PUT", "DELETE"],
       "responseHeader": ["Content-Type", "Authorization"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
4. Generate a service account key with Storage Admin permissions
5. Add the service account credentials to your `.env.local` file

## Gemini API Setup

1. Get a Gemini API key from [Google AI Studio](https://ai.google.dev/)
2. Add the API key to your `.env.local` file

## Usage

1. **Record**: Click the microphone button on the home screen to start recording
2. **Review**: After recording, use the playback controls to review
3. **Process**: Click "Save and Process" to send the recording for AI processing
4. **View**: Review the transcription, summary, and extracted tasks
5. **Save**: Save the processed note for future reference

## Project Structure

- `/app` - Next.js app routes and pages
- `/components` - React components
  - `/ui` - shadcn/ui components
- `/hooks` - Custom React hooks
- `/lib` - Utility functions and services
  - `/services` - Service integrations for Google Cloud and Gemini

## Implementation Details

The voice recording implementation follows this flow:

1. Audio is recorded using the browser's MediaRecorder API
2. The recording is visualized in real-time using the Web Audio API
3. Upon completion, the audio is saved as a Blob
4. The audio is uploaded to Google Cloud Storage
5. The GCS URL is sent to Gemini API for processing
6. Results are displayed to the user

## License

[MIT](LICENSE)