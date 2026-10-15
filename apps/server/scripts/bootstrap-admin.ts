import 'dotenv/config';
import { db } from '../src/db';
import { staff, roles, staffRoles } from '../src/db/schema/staff';
import { staffCredentials } from '../src/db/schema/auth';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@college.edu';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminStaffCode = 'ADM-001';

    console.log(`Bootstrapping admin user: ${adminEmail}...`);

    // Ensure ADMIN role exists
    let adminRole = await db.select().from(roles).where(eq(roles.name, 'ADMIN')).then(res => res[0]);
    if (!adminRole) {
        console.log('Creating ADMIN role...');
        adminRole = await db.insert(roles).values({ name: 'ADMIN', description: 'System Administrator' }).returning().then(res => res[0]);
    }

    // Check if staff exists
    let adminStaff = await db.select().from(staff).where(eq(staff.collegeEmail, adminEmail)).then(res => res[0]);
    
    if (!adminStaff) {
        console.log('Creating admin staff record...');
        adminStaff = await db.insert(staff).values({
            staffCode: adminStaffCode,
            name: 'System Administrator',
            collegeEmail: adminEmail,
            status: 'ACTIVE'
        }).returning().then(res => res[0]);
    } else {
        console.log('Admin staff record already exists.');
    }

    // Ensure staff has ADMIN role
    const hasRole = await db.select().from(staffRoles).where(
        eq(staffRoles.staffId, adminStaff.id)
    ).then(res => res.some(r => r.roleId === adminRole.id));

    if (!hasRole) {
        console.log('Assigning ADMIN role to staff...');
        await db.insert(staffRoles).values({
            staffId: adminStaff.id,
            roleId: adminRole.id
        }).onConflictDoNothing();
    }

    // Check/create credentials
    const credentials = await db.select().from(staffCredentials).where(eq(staffCredentials.staffId, adminStaff.id)).then(res => res[0]);
    const hash = await bcrypt.hash(adminPassword, 10);

    if (!credentials) {
        console.log('Creating credentials...');
        await db.insert(staffCredentials).values({
            staffId: adminStaff.id,
            passwordHash: hash
        });
    } else {
        console.log('Updating credentials...');
        await db.update(staffCredentials).set({
            passwordHash: hash,
            updatedAt: new Date()
        }).where(eq(staffCredentials.id, credentials.id));
    }

    console.log('Done! Admin user is ready.');
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
