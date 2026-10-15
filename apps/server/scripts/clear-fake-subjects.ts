import 'dotenv/config';
import { db } from '../src/db';
import { subjects, classSubjects } from '../src/db/schema/subjects';

async function clearSubjects() {
  console.log('Clearing subject data...');

  try {
    // Delete class subjects
    console.log('Deleting class subject allocations...');
    await db.delete(classSubjects);

    // Delete subjects
    console.log('Deleting subjects...');
    await db.delete(subjects);

    console.log('Subject data cleared successfully.');
  } catch (error) {
    console.error('Error clearing subjects:', error);
  } finally {
    process.exit(0);
  }
}

clearSubjects();
