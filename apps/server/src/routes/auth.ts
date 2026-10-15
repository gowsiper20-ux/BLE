import { Hono } from "hono";
import { StudentRepository } from "../repositories/student.repository";
import { StaffRepository } from "../repositories/staff.repository";
import { AuthRepository } from "../repositories/auth.repository";
import bcrypt from "bcrypt";
import { sign, verify } from "hono/jwt";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";

export const authRoutes = new Hono();
const studentRepo = new StudentRepository();

const staffRepo = new StaffRepository();
const authRepo = new AuthRepository();

// POST /api/auth/login
authRoutes.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { identifier, password } = body;
    
    if (!identifier || !password) {
      return c.json({ success: false, error: { message: "Email/Username and password are required." } }, 400);
    }
    
    // Check if identifier is email or staff code
    let staffUser = await staffRepo.getStaffByEmail(identifier);
    if (!staffUser) {
      staffUser = await staffRepo.getStaffByCode(identifier);
    }
    
    if (!staffUser) {
      // Return generic error
      return c.json({ success: false, error: { message: "Invalid email/username or password." } }, 401);
    }
    
    if (staffUser.status !== 'ACTIVE') {
      return c.json({ success: false, error: { message: "Account is inactive." } }, 403);
    }
    
    // Check if staff has ADMIN role
    const fullStaffUser = await staffRepo.getStaffById(staffUser.id);
    if (!fullStaffUser?.roles?.includes('ADMIN')) {
      return c.json({ success: false, error: { message: "Unauthorized access. Admin role required." } }, 403);
    }
    
    const credentials = await authRepo.getCredentialsByStaffId(staffUser.id);
    if (!credentials) {
      return c.json({ success: false, error: { message: "Invalid email/username or password." } }, 401);
    }
    
    const isValid = await bcrypt.compare(password, credentials.passwordHash);
    if (!isValid) {
      return c.json({ success: false, error: { message: "Invalid email/username or password." } }, 401);
    }
    
    // Sign JWT
    const payload = {
      id: fullStaffUser.id,
      email: fullStaffUser.collegeEmail,
      role: 'ADMIN',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    };
    
    const secret = process.env.JWT_SECRET || 'secret';
    const token = await sign(payload, secret, 'HS256');
    
    // Set cookie
    setCookie(c, 'admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24,
      path: '/'
    });
    
    return c.json({ 
      success: true, 
      user: {
        id: fullStaffUser.id,
        name: fullStaffUser.name,
        collegeEmail: fullStaffUser.collegeEmail,
        roles: fullStaffUser.roles
      } 
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return c.json({ success: false, error: { message: "Internal server error." } }, 500);
  }
});

// POST /api/auth/student/login
authRoutes.post("/student/login", async (c) => {
  try {
    const body = await c.req.json();
    const { username, register_number } = body;
    
    if (!username || !register_number || username !== register_number) {
      return c.json({ success: false, error: { message: "Username and Register Number must match." } }, 400);
    }
    
    const student = await studentRepo.getStudentByRegisterNumber(register_number);
    
    if (!student) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Student not found." } }, 404);
    }
    
    if (student.status !== 'ACTIVE') {
      return c.json({ success: false, error: { code: "INACTIVE", message: "Your student account is inactive. Please contact the administrator." } }, 403);
    }
    
    return c.json({ success: true, student });
  } catch (error: any) {
    return c.json({ success: false, error: { message: "Internal server error." } }, 500);
  }
});

// POST /api/auth/logout
authRoutes.post("/logout", (c) => {
  deleteCookie(c, 'admin_token', { path: '/' });
  return c.json({ success: true, message: "Logged out successfully" });
});

// GET /api/auth/me
authRoutes.get("/me", async (c) => {
  const adminToken = getCookie(c, 'admin_token');
  const authHeader = c.req.header('Authorization');
  let token = adminToken;
  
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  
  if (!token) {
    return c.json({ success: false, error: { message: "Unauthorized" } }, 401);
  }
  
  try {
    const secret = process.env.JWT_SECRET || 'secret';
    const decoded = await verify(token, secret, 'HS256') as any;
    
    const fullStaffUser = await staffRepo.getStaffById(decoded.id);
    if (!fullStaffUser || fullStaffUser.status !== 'ACTIVE' || !fullStaffUser.roles?.includes('ADMIN')) {
      return c.json({ success: false, error: { message: "Unauthorized" } }, 401);
    }
    
    return c.json({ 
      success: true, 
      user: {
        id: fullStaffUser.id,
        name: fullStaffUser.name,
        email: fullStaffUser.collegeEmail,
        roles: fullStaffUser.roles
      } 
    });
  } catch (err) {
    return c.json({ success: false, error: { message: "Invalid or expired session" } }, 401);
  }
});
