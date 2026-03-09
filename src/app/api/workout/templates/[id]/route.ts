import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import WorkoutTemplateModel from '@/models/WorkoutTemplate';

// Connect to MongoDB using mongoose
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
}

// GET /api/workout/templates/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }
    
    const template = await WorkoutTemplateModel.findById(id);
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(template.toJSON());
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PUT /api/workout/templates/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;
    const body = await request.json();
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }
    
    const template = await WorkoutTemplateModel.findById(id);
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }
    
    // Update fields
    if (body.name !== undefined) {
      template.name = body.name;
    }
    if (body.exerciseIds !== undefined) {
      template.exerciseIds = body.exerciseIds;
    }
    
    await template.save();
    
    return NextResponse.json(template.toJSON());
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/workout/templates/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }
    
    const result = await WorkoutTemplateModel.findByIdAndDelete(id);
    
    if (!result) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
