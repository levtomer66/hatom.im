import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const POSES_DIR = path.join(process.cwd(), 'src/components/valentine/poses');
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// GET /api/valentine/poses/image?name=filename.png - serve image (safe path)
export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get('name');
    if (!name || name.includes('..') || path.isAbsolute(name)) {
      return new NextResponse('Bad request', { status: 400 });
    }
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.includes(ext)) {
      return new NextResponse('Not found', { status: 404 });
    }
    const filePath = path.join(POSES_DIR, path.basename(name));
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(POSES_DIR))) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    if (!fs.existsSync(resolved)) {
      return new NextResponse('Not found', { status: 404 });
    }
    const buffer = fs.readFileSync(resolved);
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
            ? 'image/webp'
            : 'image/gif';
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error serving pose image:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
