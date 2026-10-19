import 'dotenv/config';
import { db } from '../src/db';
import { roles, staff, staffRoles, classCounselors } from '../src/db/schema/staff';
import { classes, academicYears } from '../src/db/schema/academic';
import { eq, and } from 'drizzle-orm';

async function seedStaff() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed data must never be written to production.');
  }
  console.log('Seeding roles...');
  const roleNames = [
    { name: 'ADMIN', description: 'Full administrative access.' },
    { name: 'HOD', description: 'Access to all IT academic and attendance information.' },
    { name: 'DEPUTY_HOD', description: 'Department-level administrative access.' },
    { name: 'CLASS_COUNSELOR', description: 'Access to attendance and information for assigned classes.' },
    { name: 'STAFF', description: 'Access to their own teaching and attendance sessions.' }
  ];

  for (const r of roleNames) {
    await db.insert(roles).values(r).onConflictDoNothing();
  }

  console.log('Done seeding staff data.');
  process.exit(0);
}

seedStaff().catch((e) => {
  console.error(e);
  process.exit(1);
});
