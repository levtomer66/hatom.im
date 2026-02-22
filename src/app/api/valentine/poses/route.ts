import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { SexPosition } from '@/types/valentine';

const POSES_DIR = path.join(process.cwd(), 'src/components/valentine/poses');
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// GET /api/valentine/poses - list all pose filenames from disk (auto-discovered)
export async function GET() {
  try {
    if (!fs.existsSync(POSES_DIR)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(POSES_DIR);
    const positions: SexPosition[] = files
      .filter((f) => IMAGE_EXT.includes(path.extname(f).toLowerCase()))
      .map((filename) => ({
        id: filename,
        filename,
      }))
      .sort((a, b) => a.filename.localeCompare(b.filename));
    return NextResponse.json(positions);
  } catch (error) {
    console.error('Error listing valentine poses:', error);
    return NextResponse.json(
      { error: 'Failed to list poses' },
      { status: 500 }
    );
  }
}
