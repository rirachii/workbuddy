import { NextResponse, NextRequest } from 'next/server';
import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';

// Server-side only code for Google Cloud Storage
let storage: Storage | null = null;

// Initialize Google Cloud Storage with credentials from environment variables
function getStorageClient() {
  if (storage) return storage;
  
  try {
    const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
    const projectId = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_ID;
    
    if (clientEmail && privateKey && projectId) {
      // Use service account credentials from environment variables
      storage = new Storage({
        projectId,
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n') // Fix newline characters
        }
      });
      console.log('Storage client initialized with service account:', clientEmail);
      return storage;
    }
    
    console.error('Missing required Google Cloud credentials');
    return null;
  } catch (error) {
    console.error('Error initializing Storage client:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the storage client
    const storageClient = getStorageClient();
    if (!storageClient) {
      return NextResponse.json(
        { error: 'Storage client initialization failed' },
        { status: 500 }
      );
    }

    // Get the bucket name from environment variables
    const bucketName = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_BUCKET_NAME;
    if (!bucketName) {
      return NextResponse.json(
        { error: 'Bucket name not configured' },
        { status: 500 }
      );
    }

    // Get the form data with the file
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Log file details for debugging
    console.log('File received:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });
    
    if (file.size === 0) {
      return NextResponse.json(
        { error: 'Empty file received (zero bytes)' },
        { status: 400 }
      );
    }

    // Generate a unique filename with timestamp
    const fileName = `recording_${Date.now()}_${file.name}`;
    
    // Create a buffer from the file
    let buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer created with size:', arrayBuffer.byteLength, 'bytes');
      
      // Verify buffer is not empty
      if (arrayBuffer.byteLength === 0) {
        return NextResponse.json(
          { error: 'File has zero bytes after conversion to buffer' },
          { status: 400 }
        );
      }
      
      buffer = Buffer.from(arrayBuffer);
      console.log('Buffer created with size:', buffer.length, 'bytes');
    } catch (error) {
      console.error('Error creating buffer from file:', error);
      return NextResponse.json(
        { error: 'Failed to process file data' },
        { status: 500 }
      );
    }
    
    // Upload to Google Cloud Storage
    const bucket = storageClient.bucket(bucketName);
    const blob = bucket.file(fileName);
    
    // Upload the file with proper MIME type
    await blob.save(buffer, {
      contentType: file.type || 'audio/webm',
      metadata: {
        contentType: file.type || 'audio/webm',
        cacheControl: 'public, max-age=31536000',
        metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Set proper CORS headers for public access
    await blob.setMetadata({
      contentType: file.type || 'audio/webm',
      cacheControl: 'public, max-age=31536000',
      contentDisposition: `inline; filename="${file.name}"`
    });
    
    // Get the URL for the uploaded file
    // For buckets with uniform bucket-level access, we'll use the standard URL format
    // If the bucket is configured to be public, this URL will be accessible
    // Otherwise, we can use signed URLs in production
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    
    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileId: fileName
    });
    
  } catch (error) {
    console.error('Error handling upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error during upload' },
      { status: 500 }
    );
  }
}
