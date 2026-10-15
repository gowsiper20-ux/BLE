import { Context, Next } from 'hono';
import { StudentRepository } from '../repositories/student.repository';
import { StaffRepository } from '../repositories/staff.repository';
import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';

const studentRepo = new StudentRepository();
const staffRepo = new StaffRepository();

// Smallest clean development-only mapping
const DEV_STUDENT_MAPPING: Record<string, string> = {
  'DEV-STUDENT-001': '61782324106032' // Harinarayanan S, III IT-A
};

export const requireStudentAuth = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: { message: 'Unauthorized' } }, 401);
  }

  const token = authHeader.split(' ')[1];
  
  // Development token resolution
  let registerNumber = token;
  if (DEV_STUDENT_MAPPING[token]) {
    registerNumber = DEV_STUDENT_MAPPING[token];
  }

  try {
    const student = await studentRepo.getStudentByRegisterNumber(registerNumber);
    
    if (!student || student.status !== 'ACTIVE') {
      return c.json({ success: false, error: { message: 'Student not found or inactive' } }, 401);
    }

    c.set('student', student);
    await next();
  } catch (error) {
    return c.json({ success: false, error: { message: 'Authentication failed' } }, 401);
  }
};

export const requireAdminAuth = async (c: Context, next: Next) => {
  const adminToken = getCookie(c, 'admin_token');
  const authHeader = c.req.header('Authorization');
  let token = adminToken;
  
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return c.json({ success: false, error: { message: 'Unauthorized' } }, 401);
  }

  try {
    const secret = process.env.JWT_SECRET || 'secret';
    const decoded = await verify(token, secret, 'HS256') as any;
    
    // Quick role check from token
    if (decoded.role !== 'ADMIN') {
      return c.json({ success: false, error: { message: 'Forbidden: Admin access required' } }, 403);
    }
    
    // Verify against DB to ensure user wasn't deactivated
    const fullStaffUser = await staffRepo.getStaffById(decoded.id);
    if (!fullStaffUser || fullStaffUser.status !== 'ACTIVE' || !fullStaffUser.roles?.includes('ADMIN')) {
      return c.json({ success: false, error: { message: 'Unauthorized or Forbidden' } }, 401);
    }

    c.set('user', fullStaffUser);
    await next();
  } catch (error) {
    return c.json({ success: false, error: { message: 'Invalid or expired token' } }, 401);
  }
};
