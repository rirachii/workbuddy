import { NextResponse, NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint is no longer in use. Please use Supabase Storage directly.' },
    { status: 410 }
  );
}
