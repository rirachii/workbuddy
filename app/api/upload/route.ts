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
    const credentialsPath = process.env.GOOGLE_CLOUD_CREDENTIALS_PATH;
    
    if (credentialsPath) {
      // Option 1: Use credentials file
      storage = new Storage({
        keyFilename: credentialsPath
      });
    } else if (process.env.GOOGLE_CLOUD_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
      // Option 2: Use individual credential components
      storage = new Storage({
        projectId: process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_ID,
        credentials: {
          client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY
        }
      });
    } else {
      console.error('No Google Cloud credentials found');
      return null;
    }
    
    return storage;
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

    // Generate a unique filename with timestamp
    const fileName = `recording_${Date.now()}_${file.name}`;
    
    // Create a buffer from the file
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Upload to Google Cloud Storage
    const bucket = storageClient.bucket(bucketName);
    const blob = bucket.file(fileName);
    
    // Upload the file
    await blob.save(buffer, {
      contentType: file.type,
      metadata: {
        contentType: file.type,
        metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString()
        }
      }
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
