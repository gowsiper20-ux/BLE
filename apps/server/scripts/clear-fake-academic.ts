import 'dotenv/config';
import { db } from '../src/db';
import { classes, batches, regulations } from '../src/db/schema/academic';
import { classCounselors } from '../src/db/schema/staff';
import { students } from '../src/db/schema/students';

async function clearFakeAcademicData() {
  console.log('Clearing academic data...');

  try {
    // Delete dependent tables first
    console.log('Deleting class counselors...');
    await db.delete(classCounselors);

    console.log('Deleting students...');
    await db.delete(students);

    console.log('Deleting classes...');
    await db.delete(classes);

    console.log('Deleting batches...');
    await db.delete(batches);

    console.log('Deleting regulations...');
    await db.delete(regulations);

    console.log('Academic data cleared successfully.');
  } catch (error) {
    console.error('Error clearing academic data:', error);
  }
  
  process.exit(0);
}

clearFakeAcademicData().catch((e) => {
  console.error(e);
  process.exit(1);
});
