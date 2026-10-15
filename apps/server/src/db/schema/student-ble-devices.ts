import { pgTable, uuid, timestamp, varchar, pgEnum } from 'drizzle-orm/pg-core';
import { students } from './students';

export const bleDeviceStatusEnum = pgEnum('ble_device_status', ['ACTIVE', 'INACTIVE', 'REVOKED']);

export const studentBleDevices = pgTable('student_ble_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id').notNull().references(() => students.id),
  deviceId: varchar('device_id', { length: 255 }).notNull(),
  deviceName: varchar('device_name', { length: 255 }),
  bleIdentifier: varchar('ble_identifier', { length: 255 }).notNull(),
  status: bleDeviceStatusEnum('status').default('ACTIVE').notNull(),
  lastSeenAt: timestamp('last_seen_at', { mode: 'string' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
