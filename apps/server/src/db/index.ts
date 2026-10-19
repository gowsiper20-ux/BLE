import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as academicSchema from './schema/academic';
import * as studentsSchema from './schema/students';
import * as staffSchema from './schema/staff';
import * as subjectsSchema from './schema/subjects';
import * as timetableSchema from './schema/timetable';
import * as attendanceSchema from './schema/attendance';
import * as attendanceRecordsSchema from './schema/attendance-records';
import * as studentBleDevicesSchema from './schema/student-ble-devices';
import * as attendanceBleTokensSchema from './schema/attendance-ble-tokens';
import * as auditSchema from './schema/audit';
import * as settingsSchema from './schema/settings';
import * as authSchema from './schema/auth';

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema: { ...academicSchema, ...studentsSchema, ...staffSchema, ...subjectsSchema, ...timetableSchema, ...attendanceSchema, ...attendanceRecordsSchema, ...studentBleDevicesSchema, ...attendanceBleTokensSchema, ...auditSchema, ...settingsSchema, ...authSchema } });
