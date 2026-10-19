import 'dotenv/config';
import { db } from '../src/db';
import { departments, academicYears, batches, regulations, classes } from '../src/db/schema/academic';
import { staff, roles, staffRoles, classCounselors } from '../src/db/schema/staff';
import { staffCredentials } from '../src/db/schema/auth';
import { students } from '../src/db/schema/students';
import { subjects, classSubjects } from '../src/db/schema/subjects';
import { periods, timetables } from '../src/db/schema/timetable';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const COLLEGE_DOMAIN = 'sonatech.ac.in';

async function seedRealWorldSonaData() {
  console.log('🚀 Seeding real-world Sona College of Technology IT Department data (@sonatech.ac.in)...');

  // 1. Roles
  console.log('1. Setting up system roles...');
  const roleDefs = [
    { name: 'ADMIN', description: 'System Administrator with full access' },
    { name: 'HOD', description: 'Head of Information Technology Department' },
    { name: 'DEPUTY_HOD', description: 'Deputy Head of Department' },
    { name: 'CLASS_COUNSELOR', description: 'Class Counselor with student/attendance oversight' },
    { name: 'STAFF', description: 'Academic Teaching Faculty' },
  ];

  const roleMap = new Map<string, string>();
  for (const r of roleDefs) {
    let existing = await db.select().from(roles).where(eq(roles.name, r.name)).then((res) => res[0]);
    if (!existing) {
      existing = await db.insert(roles).values(r).returning().then((res) => res[0]);
    }
    roleMap.set(r.name, existing.id);
  }

  // 2. Department
  console.log('2. Setting up IT Department...');
  let itDept = await db.select().from(departments).where(eq(departments.code, 'IT')).then((res) => res[0]);
  if (!itDept) {
    itDept = await db
      .insert(departments)
      .values({
        name: 'Information Technology',
        code: 'IT',
        status: 'ACTIVE',
      })
      .returning()
      .then((res) => res[0]);
  }

  // 3. Academic Years
  console.log('3. Setting up Academic Years...');
  let currentYear = await db.select().from(academicYears).where(eq(academicYears.name, '2026–2027')).then((res) => res[0]);
  if (!currentYear) {
    currentYear = await db
      .insert(academicYears)
      .values({
        name: '2026–2027',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
        isCurrent: true,
        status: 'ACTIVE',
      })
      .returning()
      .then((res) => res[0]);
  }

  let prevYear = await db.select().from(academicYears).where(eq(academicYears.name, '2025–2026')).then((res) => res[0]);
  if (!prevYear) {
    prevYear = await db
      .insert(academicYears)
      .values({
        name: '2025–2026',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2026-05-31'),
        isCurrent: false,
        status: 'INACTIVE',
      })
      .returning()
      .then((res) => res[0]);
  }

  // 4. Regulations
  console.log('4. Setting up Regulations...');
  let r2023 = await db.select().from(regulations).where(eq(regulations.name, 'R2023')).then((res) => res[0]);
  if (!r2023) {
    r2023 = await db
      .insert(regulations)
      .values({
        name: 'R2023',
        year: 2023,
        description: 'Autonomous Curriculum and Syllabi (Regulation 2023)',
        status: 'ACTIVE',
      })
      .returning()
      .then((res) => res[0]);
  }

  let r2021 = await db.select().from(regulations).where(eq(regulations.name, 'R2021')).then((res) => res[0]);
  if (!r2021) {
    r2021 = await db
      .insert(regulations)
      .values({
        name: 'R2021',
        year: 2021,
        description: 'Choice Based Credit System (Regulation 2021)',
        status: 'ACTIVE',
      })
      .returning()
      .then((res) => res[0]);
  }

  // 5. Batches
  console.log('5. Setting up Batches...');
  const batchDefs = [
    { name: '2023–2027', startYear: 2023, endYear: 2027 },
    { name: '2024–2028', startYear: 2024, endYear: 2028 },
    { name: '2025–2029', startYear: 2025, endYear: 2029 },
  ];
  const batchMap = new Map<string, string>();
  for (const b of batchDefs) {
    let existing = await db
      .select()
      .from(batches)
      .where(and(eq(batches.name, b.name), eq(batches.departmentId, itDept.id)))
      .then((res) => res[0]);
    if (!existing) {
      existing = await db
        .insert(batches)
        .values({
          ...b,
          departmentId: itDept.id,
          status: 'ACTIVE',
        })
        .returning()
        .then((res) => res[0]);
    }
    batchMap.set(b.name, existing.id);
  }

  // 6. Classes / Sections
  console.log('6. Setting up Classes & Sections...');
  const classDefs = [
    { name: 'II IT-A', yearNumber: 2, section: 'A', batch: '2024–2028', regId: r2023.id },
    { name: 'II IT-B', yearNumber: 2, section: 'B', batch: '2024–2028', regId: r2023.id },
    { name: 'III IT-A', yearNumber: 3, section: 'A', batch: '2023–2027', regId: r2021.id },
    { name: 'III IT-B', yearNumber: 3, section: 'B', batch: '2023–2027', regId: r2021.id },
  ];

  const classMap = new Map<string, string>();
  for (const c of classDefs) {
    const bId = batchMap.get(c.batch)!;
    let existing = await db
      .select()
      .from(classes)
      .where(
        and(
          eq(classes.departmentId, itDept.id),
          eq(classes.academicYearId, currentYear.id),
          eq(classes.yearNumber, c.yearNumber),
          eq(classes.section, c.section)
        )
      )
      .then((res) => res[0]);

    if (!existing) {
      existing = await db
        .insert(classes)
        .values({
          name: c.name,
          yearNumber: c.yearNumber,
          section: c.section,
          departmentId: itDept.id,
          academicYearId: currentYear.id,
          batchId: bId,
          regulationId: c.regId,
          status: 'ACTIVE',
        })
        .returning()
        .then((res) => res[0]);
    }
    classMap.set(c.name, existing.id);
  }

  // 7. Faculty / Staff with @sonatech.ac.in
  console.log('7. Seeding Faculty & Staff (@sonatech.ac.in)...');
  const defaultStaffPasswordHash = await bcrypt.hash('Staff@123', 10);
  const defaultAdminPasswordHash = await bcrypt.hash('Admin@123', 10);

  const staffDefs = [
    {
      staffCode: 'ADM-001',
      name: 'System Administrator',
      collegeEmail: `admin@${COLLEGE_DOMAIN}`,
      role: 'ADMIN',
      isAdmin: true,
    },
    {
      staffCode: 'IT-HOD-01',
      name: 'Dr. J. Akilandeswari',
      collegeEmail: `hod.it@${COLLEGE_DOMAIN}`,
      role: 'HOD',
    },
    {
      staffCode: 'IT-STAFF-02',
      name: 'Dr. M. Suresh',
      collegeEmail: `suresh.it@${COLLEGE_DOMAIN}`,
      role: 'DEPUTY_HOD',
    },
    {
      staffCode: 'IT-STAFF-03',
      name: 'Dr. P. Kavitha',
      collegeEmail: `kavitha.it@${COLLEGE_DOMAIN}`,
      role: 'CLASS_COUNSELOR',
      assignedClass: 'II IT-A',
    },
    {
      staffCode: 'IT-STAFF-04',
      name: 'Dr. S. Senthilkumar',
      collegeEmail: `senthilkumar.it@${COLLEGE_DOMAIN}`,
      role: 'CLASS_COUNSELOR',
      assignedClass: 'II IT-B',
    },
    {
      staffCode: 'IT-STAFF-05',
      name: 'Dr. R. Priya',
      collegeEmail: `priya.it@${COLLEGE_DOMAIN}`,
      role: 'CLASS_COUNSELOR',
      assignedClass: 'III IT-A',
    },
    {
      staffCode: 'IT-STAFF-06',
      name: 'Prof. K. Ramesh',
      collegeEmail: `ramesh.it@${COLLEGE_DOMAIN}`,
      role: 'STAFF',
    },
    {
      staffCode: 'IT-STAFF-07',
      name: 'Prof. N. Divya',
      collegeEmail: `divya.it@${COLLEGE_DOMAIN}`,
      role: 'STAFF',
    },
    {
      staffCode: 'IT-STAFF-08',
      name: 'Prof. T. Vignesh',
      collegeEmail: `vignesh.it@${COLLEGE_DOMAIN}`,
      role: 'STAFF',
    },
    {
      staffCode: 'IT-STAFF-09',
      name: 'Prof. M. Anitha',
      collegeEmail: `anitha.it@${COLLEGE_DOMAIN}`,
      role: 'STAFF',
    },
    {
      staffCode: 'IT-STAFF-10',
      name: 'Prof. S. Balaji',
      collegeEmail: `balaji.it@${COLLEGE_DOMAIN}`,
      role: 'STAFF',
    },
  ];

  const staffMap = new Map<string, string>();
  for (const s of staffDefs) {
    let member = await db.select().from(staff).where(eq(staff.collegeEmail, s.collegeEmail)).then((res) => res[0]);
    if (!member) {
      member = await db.select().from(staff).where(eq(staff.staffCode, s.staffCode)).then((res) => res[0]);
    }

    if (!member) {
      member = await db
        .insert(staff)
        .values({
          staffCode: s.staffCode,
          name: s.name,
          collegeEmail: s.collegeEmail,
          status: 'ACTIVE',
        })
        .returning()
        .then((res) => res[0]);
    } else {
      // Update email to sonatech.ac.in if it was old domain
      if (member.collegeEmail !== s.collegeEmail) {
        await db.update(staff).set({ collegeEmail: s.collegeEmail }).where(eq(staff.id, member.id));
      }
    }
    staffMap.set(s.staffCode, member.id);

    // Assign Role
    const rId = roleMap.get(s.role);
    if (rId) {
      await db
        .insert(staffRoles)
        .values({ staffId: member.id, roleId: rId })
        .onConflictDoNothing();
    }

    // Credentials for password sign in fallback
    const cred = await db.select().from(staffCredentials).where(eq(staffCredentials.staffId, member.id)).then((r) => r[0]);
    if (!cred) {
      await db.insert(staffCredentials).values({
        staffId: member.id,
        passwordHash: s.isAdmin ? defaultAdminPasswordHash : defaultStaffPasswordHash,
      });
    }

    // Assign Class Counselor if designated
    if (s.assignedClass && classMap.has(s.assignedClass)) {
      const cId = classMap.get(s.assignedClass)!;
      const existingCounselor = await db
        .select()
        .from(classCounselors)
        .where(and(eq(classCounselors.classId, cId), eq(classCounselors.academicYearId, currentYear.id)))
        .then((r) => r[0]);

      if (!existingCounselor) {
        await db.insert(classCounselors).values({
          classId: cId,
          staffId: member.id,
          academicYearId: currentYear.id,
          status: 'ACTIVE',
        });
      }
    }
  }

  // 8. Students with @sonatech.ac.in
  console.log('8. Seeding Students with register numbers (6178...) and @sonatech.ac.in...');
  const studentList = [
    // II IT-A (Batch 2024-2028)
    { reg: '61782324106001', name: 'Aadhavan K', email: `aadhavan.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106002', name: 'Abinaya R', email: `abinaya.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106003', name: 'Aravind S', email: `aravind.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106004', name: 'Bala Murugan T', email: `balamurugan.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106005', name: 'Deepika S', email: `deepika.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106006', name: 'Dhanush Kumar V', email: `dhanush.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106007', name: 'Dharun P', email: `dharun.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106008', name: 'Dinesh K', email: `dinesh.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106009', name: 'Divya Bharathi R', email: `divyabharathi.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106010', name: 'Gokulnath V', email: `gokulnath.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106011', name: 'Gowthaman S', email: `gowthaman.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106012', name: 'Hari Prasath M', email: `hariprasath.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106013', name: 'Harinarayanan S', email: `harinarayanan.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106014', name: 'Janani M', email: `janani.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106015', name: 'Karthick Raja E', email: `karthick.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },
    { reg: '61782324106016', name: 'Kavin Kumar M', email: `kavinkumar.24it@${COLLEGE_DOMAIN}`, class: 'II IT-A' },

    // II IT-B (Batch 2024-2028)
    { reg: '61782324106031', name: 'Madhavan V', email: `madhavan.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106032', name: 'Manojkumar S', email: `manojkumar.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106033', name: 'Mithun Chakravarthy R', email: `mithun.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106034', name: 'Mohamed Aslam A', email: `aslam.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106035', name: 'Monisha S', email: `monisha.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106036', name: 'Naveen Raj P', email: `naveenraj.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106037', name: 'Nithish Kumar S', email: `nithish.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106038', name: 'Pavithra M', email: `pavithra.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106039', name: 'Pradeep S', email: `pradeep.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106040', name: 'Praveen Kumar V', email: `praveen.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106041', name: 'Ragul R', email: `ragul.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },
    { reg: '61782324106042', name: 'Rahul Dev G', email: `rahuldev.24it@${COLLEGE_DOMAIN}`, class: 'II IT-B' },

    // III IT-A (Batch 2023-2027)
    { reg: '61782224106001', name: 'Ajay Vignesh S', email: `ajay.23it@${COLLEGE_DOMAIN}`, class: 'III IT-A' },
    { reg: '61782224106002', name: 'Ananya S', email: `ananya.23it@${COLLEGE_DOMAIN}`, class: 'III IT-A' },
    { reg: '61782224106003', name: 'Barath K', email: `barath.23it@${COLLEGE_DOMAIN}`, class: 'III IT-A' },
    { reg: '61782224106004', name: 'Chandru M', email: `chandru.23it@${COLLEGE_DOMAIN}`, class: 'III IT-A' },
    { reg: '61782224106005', name: 'Dharani R', email: `dharani.23it@${COLLEGE_DOMAIN}`, class: 'III IT-A' },
    { reg: '61782224106006', name: 'Ganesh Kumar B', email: `ganesh.23it@${COLLEGE_DOMAIN}`, class: 'III IT-A' },
    { reg: '61782224106007', name: 'Kavitha P', email: `kavitha.23it@${COLLEGE_DOMAIN}`, class: 'III IT-A' },
    { reg: '61782224106008', name: 'Lokesh W', email: `lokesh.23it@${COLLEGE_DOMAIN}`, class: 'III IT-A' },
    { reg: '61782224106009', name: 'Madhana Gopal K', email: `madhanagopal.23it@${COLLEGE_DOMAIN}`, class: 'III IT-A' },
    { reg: '61782224106010', name: 'Nandhini S', email: `nandhini.23it@${COLLEGE_DOMAIN}`, class: 'III IT-A' },
  ];

  let insertedStudents = 0;
  for (const stu of studentList) {
    const cId = classMap.get(stu.class);
    if (!cId) continue;

    const existing = await db
      .select()
      .from(students)
      .where(eq(students.registerNumber, stu.reg))
      .then((r) => r[0]);

    if (!existing) {
      await db.insert(students).values({
        registerNumber: stu.reg,
        name: stu.name,
        collegeEmail: stu.email,
        classId: cId,
        status: 'ACTIVE',
      });
      insertedStudents++;
    }
  }
  console.log(`  Added ${insertedStudents} student records.`);

  // 9. IT Curriculum Subjects
  console.log('9. Setting up IT Curriculum Subjects...');
  const subjectDefs = [
    { code: 'CS3401', name: 'Algorithms and Data Structures', type: 'THEORY', year: 2, regId: r2023.id },
    { code: 'IT3401', name: 'Web Technology and Applications', type: 'THEORY', year: 2, regId: r2023.id },
    { code: 'CS3491', name: 'Artificial Intelligence and Machine Learning', type: 'THEORY', year: 2, regId: r2023.id },
    { code: 'IT3411', name: 'Web Technology Laboratory', type: 'LAB', year: 2, regId: r2023.id },
    { code: 'CS3461', name: 'Operating Systems Laboratory', type: 'LAB', year: 2, regId: r2023.id },
    { code: 'IT3501', name: 'Full Stack Software Engineering', type: 'THEORY', year: 3, regId: r2021.id },
    { code: 'CS3591', name: 'Computer Networks', type: 'THEORY', year: 3, regId: r2021.id },
    { code: 'IT3511', name: 'Cloud Computing Laboratory', type: 'LAB', year: 3, regId: r2021.id },
  ];

  const subjectMap = new Map<string, string>();
  for (const sub of subjectDefs) {
    let existing = await db.select().from(subjects).where(eq(subjects.code, sub.code)).then((r) => r[0]);
    if (!existing) {
      existing = await db
        .insert(subjects)
        .values({
          code: sub.code,
          name: sub.name,
          subjectType: sub.type,
          yearNumber: sub.year,
          regulationId: sub.regId,
          status: 'ACTIVE',
        })
        .returning()
        .then((r) => r[0]);
    }
    subjectMap.set(sub.code, existing.id);
  }

  // 10. Class-Subject Assignments
  console.log('10. Mapping Subjects to Classes...');
  const classSubjectMappings = [
    { className: 'II IT-A', subjectCode: 'CS3401' },
    { className: 'II IT-A', subjectCode: 'IT3401' },
    { className: 'II IT-A', subjectCode: 'CS3491' },
    { className: 'II IT-A', subjectCode: 'IT3411' },
    { className: 'II IT-B', subjectCode: 'CS3401' },
    { className: 'II IT-B', subjectCode: 'IT3401' },
    { className: 'II IT-B', subjectCode: 'CS3491' },
    { className: 'III IT-A', subjectCode: 'IT3501' },
    { className: 'III IT-A', subjectCode: 'CS3591' },
    { className: 'III IT-A', subjectCode: 'IT3511' },
  ];

  for (const m of classSubjectMappings) {
    const cId = classMap.get(m.className);
    const sId = subjectMap.get(m.subjectCode);
    if (!cId || !sId) continue;

    const existing = await db
      .select()
      .from(classSubjects)
      .where(and(eq(classSubjects.classId, cId), eq(classSubjects.subjectId, sId), eq(classSubjects.academicYearId, currentYear.id)))
      .then((r) => r[0]);

    if (!existing) {
      await db.insert(classSubjects).values({
        classId: cId,
        subjectId: sId,
        academicYearId: currentYear.id,
        status: 'ACTIVE',
      });
    }
  }

  // 11. Periods
  console.log('11. Setting up College Periods...');
  const periodDefs = [
    { num: 1, name: 'Period 1', start: '09:00:00', end: '09:50:00' },
    { num: 2, name: 'Period 2', start: '09:50:00', end: '10:40:00' },
    { num: 3, name: 'Period 3', start: '11:00:00', end: '11:50:00' },
    { num: 4, name: 'Period 4', start: '11:50:00', end: '12:40:00' },
    { num: 5, name: 'Period 5', start: '13:30:00', end: '14:20:00' },
    { num: 6, name: 'Period 6', start: '14:20:00', end: '15:10:00' },
    { num: 7, name: 'Period 7', start: '15:10:00', end: '16:00:00' },
  ];

  const periodMap = new Map<number, string>();
  for (const p of periodDefs) {
    let existing = await db.select().from(periods).where(eq(periods.periodNumber, p.num)).then((r) => r[0]);
    if (!existing) {
      existing = await db
        .insert(periods)
        .values({
          periodNumber: p.num,
          name: p.name,
          startTime: p.start,
          endTime: p.end,
          status: 'ACTIVE',
        })
        .returning()
        .then((r) => r[0]);
    }
    periodMap.set(p.num, existing.id);
  }

  // 12. Weekly Timetable Entries
  console.log('12. Seeding Weekly Timetable schedule for II IT-A & II IT-B...');
  const p1 = periodMap.get(1)!;
  const p2 = periodMap.get(2)!;
  const p3 = periodMap.get(3)!;
  const p4 = periodMap.get(4)!;

  const staffKavitha = staffMap.get('IT-STAFF-03')!;
  const staffSuresh = staffMap.get('IT-STAFF-02')!;
  const staffRamesh = staffMap.get('IT-STAFF-06')!;
  const staffDivya = staffMap.get('IT-STAFF-07')!;

  const subWebTech = subjectMap.get('IT3401')!;
  const subAlgorithms = subjectMap.get('CS3401')!;
  const subAI = subjectMap.get('CS3491')!;

  const class2A = classMap.get('II IT-A')!;
  const class2B = classMap.get('II IT-B')!;

  const scheduleEntries = [
    // Monday
    { classId: class2A, day: 'MONDAY', periodId: p1, subjectId: subWebTech, staffId: staffKavitha },
    { classId: class2A, day: 'MONDAY', periodId: p2, subjectId: subAlgorithms, staffId: staffRamesh },
    { classId: class2A, day: 'MONDAY', periodId: p3, subjectId: subAI, staffId: staffSuresh },
    { classId: class2B, day: 'MONDAY', periodId: p1, subjectId: subAlgorithms, staffId: staffDivya },
    { classId: class2B, day: 'MONDAY', periodId: p2, subjectId: subWebTech, staffId: staffKavitha },

    // Tuesday
    { classId: class2A, day: 'TUESDAY', periodId: p1, subjectId: subAI, staffId: staffSuresh },
    { classId: class2A, day: 'TUESDAY', periodId: p2, subjectId: subWebTech, staffId: staffKavitha },
    { classId: class2B, day: 'TUESDAY', periodId: p1, subjectId: subWebTech, staffId: staffRamesh },
    { classId: class2B, day: 'TUESDAY', periodId: p2, subjectId: subAI, staffId: staffSuresh },

    // Wednesday
    { classId: class2A, day: 'WEDNESDAY', periodId: p1, subjectId: subAlgorithms, staffId: staffRamesh },
    { classId: class2A, day: 'WEDNESDAY', periodId: p2, subjectId: subAI, staffId: staffSuresh },
    { classId: class2B, day: 'WEDNESDAY', periodId: p1, subjectId: subAI, staffId: staffDivya },
    { classId: class2B, day: 'WEDNESDAY', periodId: p2, subjectId: subWebTech, staffId: staffKavitha },

    // Thursday
    { classId: class2A, day: 'THURSDAY', periodId: p1, subjectId: subWebTech, staffId: staffKavitha },
    { classId: class2A, day: 'THURSDAY', periodId: p2, subjectId: subAI, staffId: staffSuresh },

    // Friday
    { classId: class2A, day: 'FRIDAY', periodId: p1, subjectId: subAlgorithms, staffId: staffRamesh },
    { classId: class2A, day: 'FRIDAY', periodId: p2, subjectId: subWebTech, staffId: staffKavitha },
  ];

  for (const s of scheduleEntries) {
    const existing = await db
      .select()
      .from(timetables)
      .where(
        and(
          eq(timetables.academicYearId, currentYear.id),
          eq(timetables.classId, s.classId),
          eq(timetables.dayOfWeek, s.day),
          eq(timetables.periodId, s.periodId)
        )
      )
      .then((r) => r[0]);

    if (!existing) {
      await db.insert(timetables).values({
        academicYearId: currentYear.id,
        classId: s.classId,
        dayOfWeek: s.day,
        periodId: s.periodId,
        subjectId: s.subjectId,
        staffId: s.staffId,
        status: 'ACTIVE',
      });
    }
  }

  console.log('✅ Real-world Sona College IT Department data seeding complete!');
  process.exit(0);
}

seedRealWorldSonaData().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
