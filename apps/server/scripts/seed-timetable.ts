import 'dotenv/config';
import { db } from '../src/db';
import { periods } from '../src/db/schema/timetable';
import { eq } from 'drizzle-orm';

async function seedTimetableBasics() {
  console.log('Starting timetable basics seed...');

  try {
    // 1. Seed Periods
    console.log('Seeding periods...');
    const periodData = [
      { periodNumber: 1, name: 'P1', startTime: '09:00:00', endTime: '09:50:00' },
      { periodNumber: 2, name: 'P2', startTime: '09:50:00', endTime: '10:40:00' },
      { periodNumber: 3, name: 'P3', startTime: '10:55:00', endTime: '11:45:00' },
      { periodNumber: 4, name: 'P4', startTime: '11:45:00', endTime: '12:35:00' },
      { periodNumber: 5, name: 'P5', startTime: '13:30:00', endTime: '14:20:00' },
      { periodNumber: 6, name: 'P6', startTime: '14:20:00', endTime: '15:10:00' },
      { periodNumber: 7, name: 'P7', startTime: '15:10:00', endTime: '16:00:00' },
    ];

    for (const p of periodData) {
      const [existing] = await db.select().from(periods).where(eq(periods.periodNumber, p.periodNumber)).limit(1);
      if (!existing) {
        await db.insert(periods).values(p);
      }
    }


    console.log('Timetable basics seed completed successfully.');
  } catch (error) {
    console.error('Error seeding timetable basics:', error);
  } finally {
    process.exit(0);
  }
}

seedTimetableBasics();
