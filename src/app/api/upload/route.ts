import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Admin image upload for Rules & Trails maps/photos. Stores the file in Vercel
// Blob and returns its public URL, which the admin then saves on an InfoSection.
// Requires BLOB_READ_WRITE_TOKEN in the environment; if it's missing we return a
// clear error so the admin can fall back to pasting an image URL manually.
export async function POST(request: Request) {
  const session = await getSession();
  if (session?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'not-configured' }, { status: 501 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'no-file' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'not-image' }, { status: 400 });
  }
  // Guard against very large uploads (8 MB).
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'too-large' }, { status: 400 });
  }

  try {
    const blob = await put(`info/${Date.now()}-${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    // Surface the real Blob error so the admin can see *why* it failed (bad
    // token, wrong store, etc.) instead of a generic message. Also logged to
    // the Vercel function logs for debugging.
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Blob upload failed:', err);
    return NextResponse.json({ error: 'upload-failed', detail }, { status: 500 });
  }
}
