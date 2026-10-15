import { eq } from 'drizzle-orm';
import { db, client } from './src/db';
import { staff, staffRoles, classCounselors } from './src/db/schema/staff';

async function main() {
  try {
    const testStaff = await db.select().from(staff).where(eq(staff.staffCode, 'TEST001'));
    if (testStaff.length > 0) {
      const id = testStaff[0].id;
      console.log(`Found test staff with ID: ${id}. Deleting dependencies...`);
      await db.delete(staffRoles).where(eq(staffRoles.staffId, id));
      await db.delete(classCounselors).where(eq(classCounselors.staffId, id));
      await db.delete(staff).where(eq(staff.id, id));
      console.log('Successfully deleted test staff from database.');
    } else {
      console.log('Test staff not found.');
    }
  } catch (error) {
    console.error('Error deleting test staff:', error);
  } finally {
    await client.end();
  }
}

main();
