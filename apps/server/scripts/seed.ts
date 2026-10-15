import 'dotenv/config';
import { db } from '../src/db';
import { departments, academicYears, batches, regulations, classes } from '../src/db/schema/academic';
import postgres from 'postgres';

async function seed() {
    console.log('Starting seed...');

    try {
        // Seed Department
        console.log('Seeding department...');
        const [itDept] = await db.insert(departments).values({
            name: 'Information Technology',
            code: 'IT',
            status: 'ACTIVE'
        }).returning();

        // Seed Academic Year
        console.log('Seeding academic year...');
        const [acYear] = await db.insert(academicYears).values({
            name: '2026–2027',
            startDate: new Date('2026-06-01'),
            endDate: new Date('2027-05-31'),
            isCurrent: true,
            status: 'ACTIVE'
        }).returning();

        console.log('Seed completed successfully.');
    } catch (error) {
        console.error('Error seeding data:', error);
    } finally {
        process.exit(0);
    }
}

seed().catch(console.error);
