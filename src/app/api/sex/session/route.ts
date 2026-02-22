import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import SexExpectationsSessionModel from '@/models/SexExpectationsSession';
import type { PlayerId } from '@/types/expectations';

const DEFAULT_SESSION_KEY = 'default';

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET() {
  try {
    await connectDB();
    const session = await SexExpectationsSessionModel.findOne({ sessionKey: DEFAULT_SESSION_KEY }).lean();
    if (!session) {
      return NextResponse.json({
        tomJoined: false,
        tomerJoined: false,
        tomChoice: null,
        tomerChoice: null,
        questionIndex: 0,
        choices: {},
      });
    }
    return NextResponse.json({
      tomJoined: !!session.tomJoined,
      tomerJoined: !!session.tomerJoined,
      tomChoice: session.tomChoice ?? null,
      tomerChoice: session.tomerChoice ?? null,
      questionIndex: session.questionIndex ?? 0,
      choices: session.choices ?? {},
    });
  } catch (error) {
    console.error('Get sex session error:', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const player = body?.player as PlayerId | undefined;
    if (!player || (player !== 'tom' && player !== 'tomer')) {
      return NextResponse.json({ error: 'player must be tom or tomer' }, { status: 400 });
    }
    const key = player === 'tom' ? 'tomJoined' : 'tomerJoined';
    const session = await SexExpectationsSessionModel.findOneAndUpdate(
      { sessionKey: DEFAULT_SESSION_KEY },
      { $set: { [key]: true } },
      { new: true, upsert: true }
    ).lean();
    return NextResponse.json({
      tomJoined: !!session?.tomJoined,
      tomerJoined: !!session?.tomerJoined,
      tomChoice: session?.tomChoice ?? null,
      tomerChoice: session?.tomerChoice ?? null,
      choices: session?.choices ?? {},
    });
  } catch (error) {
    console.error('Enter sex session error:', error);
    return NextResponse.json({ error: 'Failed to enter' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { player, choice, questionId, resetChoices, resetQuestionId } = body as {
      player?: PlayerId;
      choice?: string;
      questionId?: string;
      resetChoices?: boolean;
      resetQuestionId?: string;
    };

    const session = await SexExpectationsSessionModel.findOne({ sessionKey: DEFAULT_SESSION_KEY });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (resetChoices) {
      session.tomChoice = null;
      session.tomerChoice = null;
      session.choices = {};
      session.markModified('choices');
      await session.save();
      const obj = session.toObject();
      return NextResponse.json({
        tomChoice: null,
        tomerChoice: null,
        choices: {},
        tomJoined: obj.tomJoined,
        tomerJoined: obj.tomerJoined,
        questionIndex: obj.questionIndex,
      });
    }

    if (resetQuestionId) {
      if (!session.choices) session.choices = {};
      session.choices[resetQuestionId] = { tom: null, tomer: null };
      session.markModified('choices');
      await session.save();
      const obj = session.toObject();
      return NextResponse.json({
        tomChoice: obj.tomChoice ?? null,
        tomerChoice: obj.tomerChoice ?? null,
        choices: obj.choices ?? {},
      });
    }

    if (!player || (player !== 'tom' && player !== 'tomer') || choice == null || !questionId) {
      return NextResponse.json({ error: 'player, questionId and choice are required' }, { status: 400 });
    }
    const key = player === 'tom' ? 'tomChoice' : 'tomerChoice';
    session[key] = choice;
    if (!session.choices) session.choices = {};
    if (!session.choices[questionId]) session.choices[questionId] = { tom: null, tomer: null };
    session.choices[questionId][player] = choice;
    session.markModified('choices');
    await session.save();
    const obj = session.toObject();
    return NextResponse.json({
      tomChoice: obj.tomChoice ?? null,
      tomerChoice: obj.tomerChoice ?? null,
      choices: obj.choices ?? {},
    });
  } catch (error) {
    console.error('Patch sex session error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

/** DELETE /api/sex/session – reset full session (everyone out, choices cleared). */
export async function DELETE() {
  try {
    await connectDB();
    await SexExpectationsSessionModel.findOneAndUpdate(
      { sessionKey: DEFAULT_SESSION_KEY },
      {
        $set: {
          tomJoined: false,
          tomerJoined: false,
          tomChoice: null,
          tomerChoice: null,
          choices: {},
        },
      },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Reset sex session error:', error);
    return NextResponse.json({ error: 'Failed to reset' }, { status: 500 });
  }
}
