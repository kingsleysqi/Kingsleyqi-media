/**
 * /api/admin/upload-cover
 * POST: Upload cover image for external media links
 * FormData: { cover: File, mediaId: string }
 * 
 * Stores cover in R2 under _admin/covers/{media-id}/{timestamp}.{ext}
 * Returns public URL for the uploaded cover
 */

import { verifyAuth } from './_auth_helper.js';

export async function onRequestPost({ request, env }) {
  // CORS preflight
  if (request.method === 'OPTIONS') return cors();

  // Verify authentication
  if (!await verifyAuth(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Parse form data
    const formData = await request.formData();
    const coverFile = formData.get('cover');
    const mediaId = formData.get('mediaId');

    // Validate inputs
    if (!coverFile || !(coverFile instanceof File)) {
      return json({ error: 'Cover file is required' }, 400);
    }

    if (!mediaId || typeof mediaId !== 'string') {
      return json({ error: 'Media ID is required' }, 400);
    }

    // Validate file type (only images)
    const contentType = coverFile.type || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      return json({ error: 'Only image files are allowed' }, 400);
    }

    // Validate file size (max 10MB)
    if (coverFile.size > 10 * 1024 * 1024) {
      return json({ error: 'File size must be less than 10MB' }, 400);
    }

    // Generate storage key
    const ext = getFileExtension(coverFile.name, contentType);
    const timestamp = Date.now();
    // Sanitize mediaId to prevent path traversal
    const sanitizedMediaId = mediaId.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
    const coverKey = `_admin/covers/${sanitizedMediaId}/${timestamp}.${ext}`;

    // Read file as ArrayBuffer
    const arrayBuffer = await coverFile.arrayBuffer();

    // Upload to R2
    await env.MEDIA_BUCKET.put(coverKey, arrayBuffer, {
      httpMetadata: { contentType }
    });

    // Generate public URL
    // Note: If you have a custom domain or public bucket, adjust this URL accordingly
    const publicUrl = `/api/admin/download?key=${encodeURIComponent(coverKey)}`;

    return json({ 
      ok: true, 
      url: publicUrl,
      key: coverKey,
      size: coverFile.size
    });

  } catch (err) {
    console.error('[upload-cover] Error:', err);
    return json({ error: err.message || 'Upload failed' }, 500);
  }
}

/**
 * Get file extension from filename or content type
 */
function getFileExtension(filename, contentType) {
  // Try to get from filename first
  if (filename) {
    const parts = filename.split('.');
    if (parts.length > 1) {
      return parts.pop().toLowerCase();
    }
  }

  // Fallback to content type
  const typeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };

  return typeMap[contentType] || 'jpg';
}

/* ── helpers ── */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
