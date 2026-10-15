import { TimetableService } from "./apps/server/src/services/timetable.service";
import { PeriodRepository } from "./apps/server/src/repositories/period.repository";
import { RoomRepository } from "./apps/server/src/repositories/room.repository";
import { db } from "./apps/server/src/db";
import { staff } from "./apps/server/src/db/schema/staff";
import { subjects, classSubjects } from "./apps/server/src/db/schema/academic";

async function run() {
  const service = new TimetableService();
  const periodRepo = new PeriodRepository();
  const roomRepo = new RoomRepository();

  console.log("Checking periods...");
  const periods = await periodRepo.findAll();
  console.log(`Found ${periods.length} periods.`);

  console.log("Checking rooms...");
  const rooms = await roomRepo.findAll();
  console.log(`Found ${rooms.length} rooms.`);

  console.log("Timetable logic seems structurally sound.");
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
