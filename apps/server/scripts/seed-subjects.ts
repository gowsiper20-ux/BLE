import 'dotenv/config';
import { db } from '../src/db';
import { departments, academicYears, regulations, batches, classes } from '../src/db/schema/academic';
import { subjects, classSubjects } from '../src/db/schema/subjects';
import { eq } from 'drizzle-orm';

async function seedSubjects() {
  console.log('Starting subjects seed...');

  try {
    // 1. Ensure basic academic structure exists
    const [itDept] = await db.select().from(departments).where(eq(departments.code, 'IT')).limit(1);
    const [acYear] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);

    if (!itDept || !acYear) {
      throw new Error('Please run seed.ts first to create IT department and active academic year.');
    }

    // 2. Ensure fake regulation exists
    let reg2023 = (await db.select().from(regulations).where(eq(regulations.name, 'Regulation 2023')).limit(1))[0];
    if (!reg2023) {
      console.log('Creating Regulation 2023...');
      const result = await db.insert(regulations).values({
        name: 'Regulation 2023', year: 2023, description: 'Regulation for 2023'
      }).returning();
      reg2023 = result[0];
    }

    // 3. Ensure fake batches exist
    let batch2024 = (await db.select().from(batches).where(eq(batches.name, '2024–2028')).limit(1))[0];
    if (!batch2024) {
      console.log('Creating 2024-2028 Batch...');
      const result = await db.insert(batches).values({
        name: '2024–2028', startYear: 2024, endYear: 2028, departmentId: itDept.id
      }).returning();
      batch2024 = result[0];
    }

    let batch2025 = (await db.select().from(batches).where(eq(batches.name, '2025–2029')).limit(1))[0];
    if (!batch2025) {
      console.log('Creating 2025-2029 Batch...');
      const result = await db.insert(batches).values({
        name: '2025–2029', startYear: 2025, endYear: 2029, departmentId: itDept.id
      }).returning();
      batch2025 = result[0];
    }

    // 4. Ensure fake classes exist
    const classData = [
      { name: 'II IT-A', yearNumber: 2, section: 'A', batchId: batch2025.id },
      { name: 'II IT-B', yearNumber: 2, section: 'B', batchId: batch2025.id },
      { name: 'III IT-A', yearNumber: 3, section: 'A', batchId: batch2024.id }
    ];

    const classRecords: any = {};
    for (const c of classData) {
      let cls = (await db.select().from(classes).where(eq(classes.name, c.name)).limit(1))[0];
      if (!cls) {
        console.log(`Creating ${c.name} Class...`);
        const result = await db.insert(classes).values({
          name: c.name,
          yearNumber: c.yearNumber,
          section: c.section,
          departmentId: itDept.id,
          academicYearId: acYear.id,
          batchId: c.batchId,
          regulationId: reg2023.id
        }).returning();
        cls = result[0];
      }
      classRecords[c.name] = cls;
    }

    // 5. Seed Subjects
    console.log('Seeding subjects...');
    const subjectData = [
      { code: 'IT2301', name: 'Database Management Systems', description: 'Database systems and SQL', subjectType: 'THEORY', yearNumber: 2, regulationId: reg2023.id },
      { code: 'IT2302', name: 'Operating Systems', description: 'OS Concepts', subjectType: 'THEORY', yearNumber: 2, regulationId: reg2023.id },
      { code: 'IT2303', name: 'Java Programming', description: 'Java', subjectType: 'THEORY', yearNumber: 2, regulationId: reg2023.id },
      { code: 'IT2304', name: 'Java Programming Lab', description: 'Java Lab', subjectType: 'LAB', yearNumber: 2, regulationId: reg2023.id },
      { code: 'IT2305', name: 'Computer Networks', description: 'Networking concepts', subjectType: 'THEORY', yearNumber: 2, regulationId: reg2023.id },
      { code: 'IT2306', name: 'Software Engineering', description: 'SE', subjectType: 'THEORY', yearNumber: 3, regulationId: reg2023.id },
    ];

    const subjectMap: any = {};
    for (const s of subjectData) {
      await db.insert(subjects).values(s).onConflictDoNothing();
      const [insertedOrFound] = await db.select().from(subjects).where(eq(subjects.code, s.code)).limit(1);
      subjectMap[s.code] = insertedOrFound;
    }

    // 6. Seed Class Subjects Assignments
    console.log('Seeding class subject allocations...');
    
    const allocations = [
      { className: 'II IT-A', subjectCodes: ['IT2301', 'IT2302', 'IT2303', 'IT2304', 'IT2305'] },
      { className: 'II IT-B', subjectCodes: ['IT2301', 'IT2302', 'IT2303', 'IT2304', 'IT2305'] },
      { className: 'III IT-A', subjectCodes: ['IT2306'] }
    ];

    for (const alloc of allocations) {
      const cls = classRecords[alloc.className];
      if (cls) {
        for (const code of alloc.subjectCodes) {
          const sub = subjectMap[code];
          if (sub) {
            await db.insert(classSubjects).values({
              classId: cls.id,
              subjectId: sub.id,
              academicYearId: acYear.id
            }).onConflictDoNothing();
          }
        }
      }
    }

    console.log('Subject seed completed successfully.');
  } catch (error) {
    console.error('Error seeding subjects:', error);
  } finally {
    process.exit(0);
  }
}

seedSubjects();
