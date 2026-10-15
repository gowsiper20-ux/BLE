import "dotenv/config";
import { db } from "./src/db/index";
import { staff } from "./src/db/schema/staff";

async function main() {
  try {
    console.log("Restoring all staff to ACTIVE status...");
    await db.update(staff).set({ status: 'ACTIVE' });
    console.log("Success! You can now log in again.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
