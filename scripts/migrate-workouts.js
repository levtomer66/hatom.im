/**
 * Migration script for workout data
 * 
 * This script:
 * 1. Converts old exercise format (scaleKg, set1Reps, set2Reps, set3Reps) 
 *    to new format (sets array with per-set kg/reps)
 * 2. Converts workoutType to workoutName with user-specific naming
 *    (e.g., "push" → "Tomer's Push Day")
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

if (!process.env.MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set.');
  console.error('Please create a .env.local file with your MongoDB connection string.');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Mapping from workout type to user-friendly names
const WORKOUT_TYPE_TO_NAME = {
  'push': "Push Day",
  'pull': "Pull Day",
  'legs': "Legs Day",
  'calisthenics': "Calisthenics",
  'full-body': "Full Body",
  'upper-body': "Upper Body",
  'lower-body': "Lower Body",
};

// Get user display name
const USER_NAMES = {
  'tom': 'Tom',
  'tomer': 'Tomer',
};

/**
 * Convert old exercise format to new sets array format
 */
function migrateExercise(exercise, order) {
  // Convert old format to new format
  const sets = [];
  
  // Check if already has sets array
  if (exercise.sets && Array.isArray(exercise.sets)) {
    // Already has sets, just ensure order is set
    return {
      ...exercise,
      order: exercise.order ?? order,
    };
  }

  // Old format had scaleKg as a single value for all sets
  const kg = exercise.scaleKg ?? null;
  
  // Create 3 sets with the same kg but individual reps
  if (exercise.set1Reps !== undefined) {
    sets.push({ kg, reps: exercise.set1Reps ?? null });
  }
  if (exercise.set2Reps !== undefined) {
    sets.push({ kg, reps: exercise.set2Reps ?? null });
  }
  if (exercise.set3Reps !== undefined) {
    sets.push({ kg, reps: exercise.set3Reps ?? null });
  }

  // If no sets were defined, create 3 empty sets
  if (sets.length === 0) {
    sets.push({ kg: null, reps: null });
    sets.push({ kg: null, reps: null });
    sets.push({ kg: null, reps: null });
  }

  return {
    id: exercise.id,
    exerciseId: exercise.exerciseId,
    order,  // 1-based order
    sets,
    notes: exercise.notes || '',
    photos: exercise.photos || [],
  };
}

/**
 * Convert workout type to user-friendly workout name
 */
function getWorkoutName(workoutType, userId) {
  const typeName = WORKOUT_TYPE_TO_NAME[workoutType] || workoutType || 'Workout';
  const userName = USER_NAMES[userId] || userId;
  return `${userName}'s ${typeName}`;
}

async function main() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const collection = db.collection('workouts');

    // Get all workouts
    const workouts = await collection.find({}).toArray();
    console.log(`Found ${workouts.length} workouts to migrate`);

    if (workouts.length === 0) {
      console.log('No workouts to migrate.');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const workout of workouts) {
      const updates = {};
      let needsUpdate = false;

      // Check if workoutType needs to be converted to workoutName
      if (workout.workoutType && !workout.workoutName) {
        updates.workoutName = getWorkoutName(workout.workoutType, workout.userId);
        updates.$unset = { workoutType: "" };
        needsUpdate = true;
        console.log(`  Converting workoutType "${workout.workoutType}" → "${updates.workoutName}"`);
      }

      // Check if exercises need migration (old format or missing order)
      const hasOldFormat = workout.exercises?.some(e => 
        e.scaleKg !== undefined || 
        e.set1Reps !== undefined || 
        e.set2Reps !== undefined || 
        e.set3Reps !== undefined ||
        e.order === undefined
      );

      if (hasOldFormat) {
        updates.exercises = workout.exercises.map((e, index) => migrateExercise(e, index + 1));
        needsUpdate = true;
        console.log(`  Migrating ${workout.exercises.length} exercises to new format with order`);
      }

      if (needsUpdate) {
        // Build the update operation
        const updateOp = {};
        
        if (updates.workoutName) {
          updateOp.$set = updateOp.$set || {};
          updateOp.$set.workoutName = updates.workoutName;
        }
        
        if (updates.exercises) {
          updateOp.$set = updateOp.$set || {};
          updateOp.$set.exercises = updates.exercises;
        }
        
        if (updates.$unset) {
          updateOp.$unset = updates.$unset;
        }

        await collection.updateOne(
          { _id: workout._id },
          updateOp
        );
        
        migratedCount++;
        console.log(`✓ Migrated workout ${workout._id} (${workout.date})`);
      } else {
        skippedCount++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total workouts: ${workouts.length}`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped (already migrated): ${skippedCount}`);
    console.log('\nMigration completed successfully!');

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

main().catch(console.error);
