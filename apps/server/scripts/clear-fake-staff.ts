import 'dotenv/config';
import { db } from '../src/db';
import { staff, staffRoles, classCounselors } from '../src/db/schema/staff';
import { inArray } from 'drizzle-orm';

async function clearFakeStaff() {
  console.log('Clearing fake staff data...');
  const fakeStaffCodes = ['STF001', 'STF002', 'STF003', 'STF004'];

  const fakeStaff = await db.select().from(staff).where(inArray(staff.staffCode, fakeStaffCodes));
  const staffIds = fakeStaff.map(s => s.id);

  if (staffIds.length > 0) {
    // Delete dependent records first
    console.log('Deleting counselor assignments...');
    await db.delete(classCounselors).where(inArray(classCounselors.staffId, staffIds));

    console.log('Deleting staff roles...');
    await db.delete(staffRoles).where(inArray(staffRoles.staffId, staffIds));

    console.log('Deleting staff records...');
    await db.delete(staff).where(inArray(staff.id, staffIds));
  }

  console.log('Done clearing fake staff data.');
  process.exit(0);
}

clearFakeStaff().catch((e) => {
  console.error(e);
  process.exit(1);
});
