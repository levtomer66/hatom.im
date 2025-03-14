import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { FamilyMember } from '@/models/FamilyMember';

// GET handler to retrieve family tree data
export async function GET() {

  // Try to read from the file first
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'src','data', 'family-tree.json');

    if (fs.existsSync(filePath)) {
      const fileData = fs.readFileSync(filePath, 'utf8');
      const familyMembers = JSON.parse(fileData);
      return NextResponse.json(familyMembers);
    }
  } catch (fileError) {
    console.error('Error reading from file, falling back to database:', fileError);
    // Continue to database if file reading fails
  }
  try {
    // If file doesn't exist or there was an error, proceed with database
    const client = await clientPromise;
    const db = client.db();

    const familyMembers = await db.collection('familyMembers').find({}).toArray();

    return NextResponse.json(familyMembers);
  } catch (error) {
    console.error('Error fetching family tree:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family tree data' },
      { status: 500 }
    );
  }
}

// POST handler to save family tree data
export async function POST(request: Request) {
  try {
    const familyMembers = await request.json() as FamilyMember[];

    const client = await clientPromise;
    const db = client.db();

    // Clear existing data and insert new data
    await db.collection('familyMembers').deleteMany({});
    await db.collection('familyMembers').insertMany(familyMembers);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving family tree:', error);
    return NextResponse.json(
      { error: 'Failed to save family tree data' },
      { status: 500 }
    );
  }
} 