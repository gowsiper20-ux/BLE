import 'dotenv/config';
import { db } from '../src/db';
import { sql } from 'drizzle-orm';
import { academicYears } from '../src/db/schema/academic';

async function clearDuplicate() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Data cleanup scripts are disabled in production.');
  }
  console.log('Fetching academic years...');
  const years = await db.select().from(academicYears);
  
  console.log('Found years:', years);

  const toDelete = ['c275aafe-e65a-43fc-b941-004ae9721028'];
  
  if (toDelete.length > 0) {
    console.log('Deleting duplicate IDs:', toDelete);
    const { inArray } = await import('drizzle-orm');
    const res = await db.delete(academicYears).where(inArray(academicYears.id, toDelete)).returning();
    console.log('Deleted successfully:', res);
  }

  process.exit(0);
}

clearDuplicate().catch(e => {
  console.error(e);
  process.exit(1);
});
