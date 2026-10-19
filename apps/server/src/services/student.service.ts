import { StudentRepository } from '../repositories/student.repository';
import { students } from '../db/schema/students';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { Buffer } from 'buffer';
import { AuditService } from './audit.service';

export interface AuditActor {
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class StudentService {
  private repo: StudentRepository;
  private audit: AuditService;
  private allowedDomains: string[];

  constructor() {
    this.repo = new StudentRepository();
    this.audit = new AuditService();
    const envDomain = process.env.COLLEGE_EMAIL_DOMAIN || 'sonatech.ac.in';
    this.allowedDomains = envDomain.toLowerCase().split(',').map(d => d.trim().replace(/^@/, ''));
  }

  private validateEmail(email: string): string {
    const clean = email.trim().toLowerCase();
    if (!clean) {
      throw new Error('College email is required.');
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      throw new Error('Invalid email format.');
    }
    const matchesDomain = this.allowedDomains.some(d => clean.endsWith(`@${d}`));
    if (!matchesDomain) {
      throw new Error(`College email must belong to '@${this.allowedDomains[0]}'.`);
    }
    return clean;
  }

  private validateRegisterNumber(regNo: string): string {
    const clean = regNo.trim().toUpperCase();
    if (!clean) {
      throw new Error('Register number is required.');
    }
    if (!/^[A-Z0-9]{5,20}$/.test(clean)) {
      throw new Error('Register number must be 5 to 20 alphanumeric characters.');
    }
    return clean;
  }

  private validateName(name: string): string {
    const clean = name.trim();
    if (!clean || clean.length < 2) {
      throw new Error('Student name must be at least 2 characters long.');
    }
    return clean;
  }

  async getStudents(filters: any) {
    return this.repo.getStudents(filters);
  }

  async getStudentById(id: string) {
    return this.repo.getStudentById(id);
  }

  async createStudent(data: typeof students.$inferInsert, actor?: AuditActor) {
    const registerNumber = this.validateRegisterNumber(data.registerNumber);
    const collegeEmail = this.validateEmail(data.collegeEmail);
    const name = this.validateName(data.name);

    if (!data.classId) {
      throw new Error('Class assignment is required.');
    }

    const assignedClass = await this.repo.getClassById(data.classId);
    if (!assignedClass) {
      throw new Error('Assigned class not found.');
    }

    const existingReg = await this.repo.getStudentByRegisterNumber(registerNumber);
    if (existingReg) {
      throw new Error('Student with this register number already exists.');
    }

    const existingEmail = await this.repo.getStudentByEmail(collegeEmail);
    if (existingEmail) {
      throw new Error('Student with this college email already exists.');
    }

    const [created] = await this.repo.createStudent({
      ...data,
      registerNumber,
      collegeEmail,
      name,
    });
    
    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'CREATE_STUDENT',
      entityType: 'STUDENT',
      entityId: created.id,
      description: `Created student "${created.name}" (${created.registerNumber}) in class "${assignedClass.name}"`,
      newValues: created,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return created;
  }

  async updateStudent(id: string, data: Partial<typeof students.$inferInsert>, actor?: AuditActor) {
    const old = await this.repo.getStudentById(id);
    if (!old) {
      throw new Error('Student not found');
    }

    const updatePayload: Partial<typeof students.$inferInsert> = { ...data };

    if (data.registerNumber !== undefined) {
      const regNo = this.validateRegisterNumber(data.registerNumber);
      const existing = await this.repo.getStudentByRegisterNumber(regNo);
      if (existing && existing.id !== id) {
        throw new Error('Student with this register number already exists.');
      }
      updatePayload.registerNumber = regNo;
    }

    if (data.collegeEmail !== undefined) {
      const email = this.validateEmail(data.collegeEmail);
      const existing = await this.repo.getStudentByEmail(email);
      if (existing && existing.id !== id) {
        throw new Error('Student with this college email already exists.');
      }
      updatePayload.collegeEmail = email;
    }

    if (data.name !== undefined) {
      updatePayload.name = this.validateName(data.name);
    }

    if (data.classId !== undefined) {
      const cls = await this.repo.getClassById(data.classId);
      if (!cls) throw new Error('Assigned class not found.');
    }

    const [updated] = await this.repo.updateStudent(id, updatePayload);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'UPDATE_STUDENT',
      entityType: 'STUDENT',
      entityId: id,
      description: `Updated student "${updated.name}" (${updated.registerNumber})`,
      oldValues: old,
      newValues: updated,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return updated;
  }

  async updateStudentStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED', actor?: AuditActor) {
    const old = await this.repo.getStudentById(id);
    if (!old) {
      throw new Error('Student not found');
    }

    const validStatuses = ['ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}.`);
    }

    const [updated] = await this.repo.updateStudent(id, { status });

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'UPDATE_STUDENT_STATUS',
      entityType: 'STUDENT',
      entityId: id,
      description: `Changed student "${old.name}" (${old.registerNumber}) status from ${old.status} to ${status}`,
      oldValues: { status: old.status },
      newValues: { status },
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return updated;
  }

  async deleteStudent(id: string, actor?: AuditActor) {
    const old = await this.repo.getStudentById(id);
    if (!old) {
      throw new Error('Student not found');
    }

    const refs = await this.repo.getStudentReferenceCounts(id);
    if (refs.attendanceRecordsCount > 0) {
      throw new Error(
        `Cannot delete student: ${refs.attendanceRecordsCount} attendance record(s) are associated with this student. Deactivate student status instead.`
      );
    }

    const [deleted] = await this.repo.deleteStudent(id);

    await this.audit.log({
      actorId: actor?.actorId,
      actorName: actor?.actorName,
      actorRole: actor?.actorRole,
      action: 'DELETE_STUDENT',
      entityType: 'STUDENT',
      entityId: id,
      description: `Deleted student "${old.name}" (${old.registerNumber})`,
      oldValues: old,
      ipAddress: actor?.ipAddress,
      userAgent: actor?.userAgent,
    });

    return deleted;
  }

  // --- Bulk Import Logic ---

  async validateImportFile(fileBuffer: Buffer, fileName: string, fileType: string) {
    let rows: any[] = [];
    
    // Parse File
    if (fileName.endsWith('.csv') || fileType === 'text/csv') {
      const csvString = fileBuffer.toString('utf-8');
      const parseResult = Papa.parse(csvString, { header: true, skipEmptyLines: true });
      rows = parseResult.data;
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileType.includes('spreadsheet')) {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = xlsx.utils.sheet_to_json(worksheet);
    } else {
      throw new Error('Unsupported file format. Please upload a CSV or XLSX file.');
    }

    if (!rows || rows.length === 0) {
      throw new Error('Uploaded file is empty.');
    }

    // Pre-load all classes from DB for fast in-memory resolution
    const allClasses = await this.repo.getAllClasses();
    const classMapByName = new Map<string, typeof allClasses[0]>();
    const classMapById = new Map<string, typeof allClasses[0]>();
    for (const c of allClasses) {
      classMapByName.set(c.name.trim().toLowerCase(), c);
      classMapById.set(c.id, c);
    }

    const preview = {
      totalRows: rows.length,
      valid: 0,
      errors: 0,
      data: [] as any[]
    };

    const seenRegisterNumbers = new Set<string>();
    const seenEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Normalize column names
      const regNo = (row['register_number'] || row['Register Number'] || row['reg_no'] || row['Reg No'] || '').toString().trim();
      const name = (row['name'] || row['Name'] || row['student_name'] || row['Student Name'] || '').toString().trim();
      const email = (row['college_email'] || row['College Email'] || row['email'] || row['Email'] || '').toString().trim();
      const className = (row['class'] || row['Class'] || row['className'] || row['class_id'] || '').toString().trim();

      const rowResult = {
        rowNumber: i + 2, // 1-indexed, +1 for header
        registerNumber: regNo,
        name,
        collegeEmail: email,
        className,
        isValid: true,
        classId: null as string | null,
        errors: [] as { code: string, message: string }[]
      };

      // 1. Validate required fields & format
      if (!regNo) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'MISSING_REGISTER_NUMBER', message: 'Register number is missing' });
      } else if (!/^[A-Za-z0-9]{5,20}$/.test(regNo)) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'INVALID_REGISTER_NUMBER', message: 'Register number must be 5-20 alphanumeric characters' });
      }

      if (!name) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'MISSING_NAME', message: 'Student name is missing' });
      } else if (name.length < 2) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'INVALID_NAME', message: 'Student name must be at least 2 characters' });
      }

      if (!email) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'MISSING_EMAIL', message: 'College email is missing' });
      } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'INVALID_EMAIL', message: 'Invalid email format' });
      } else {
        const matchesDomain = this.allowedDomains.some(d => email.toLowerCase().endsWith(`@${d}`));
        if (!matchesDomain) {
          rowResult.isValid = false;
          rowResult.errors.push({ code: 'INVALID_DOMAIN', message: `College email must end with '@${this.allowedDomains[0]}'` });
        }
      }

      if (!className) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'MISSING_CLASS', message: 'Class is missing' });
      }

      // 2. Intra-file duplicate check
      const normalizedReg = regNo.toUpperCase();
      const normalizedEmail = email.toLowerCase();

      if (regNo && seenRegisterNumbers.has(normalizedReg)) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'DUPLICATE_REGISTER_NUMBER', message: 'Duplicate register number in uploaded file' });
      }
      if (email && seenEmails.has(normalizedEmail)) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'DUPLICATE_EMAIL', message: 'Duplicate email in uploaded file' });
      }
      if (regNo) seenRegisterNumbers.add(normalizedReg);
      if (email) seenEmails.add(normalizedEmail);

      // 3. Database Validation (Existing checks & class resolution)
      if (rowResult.isValid) {
        const resolvedClass = classMapByName.get(className.toLowerCase()) || classMapById.get(className);
        if (!resolvedClass) {
          rowResult.isValid = false;
          rowResult.errors.push({ code: 'CLASS_NOT_FOUND', message: `Class '${className}' not found in system` });
        } else {
          rowResult.classId = resolvedClass.id;
        }

        const [existingReg, existingEmail] = await Promise.all([
          this.repo.getStudentByRegisterNumber(normalizedReg),
          this.repo.getStudentByEmail(normalizedEmail),
        ]);

        if (existingReg) {
          rowResult.isValid = false;
          rowResult.errors.push({ code: 'REGISTER_NUMBER_EXISTS', message: 'Student with this register number already exists in system' });
        }
        if (existingEmail) {
          rowResult.isValid = false;
          rowResult.errors.push({ code: 'EMAIL_EXISTS', message: 'Student with this email already exists in system' });
        }
      }

      if (rowResult.isValid) {
        preview.valid++;
      } else {
        preview.errors++;
      }

      preview.data.push(rowResult);
    }

    return preview;
  }

  async confirmImport(importData: any[], actor?: AuditActor) {
    if (!importData || importData.length === 0) {
      throw new Error('No data provided for import.');
    }

    const hasErrors = importData.some(row => !row.isValid || !row.classId);
    if (hasErrors) {
      throw new Error('Cannot import file with errors. Please fix errors and upload again.');
    }

    const insertPayload = importData.map(row => ({
      registerNumber: row.registerNumber.trim().toUpperCase(),
      name: row.name.trim(),
      collegeEmail: row.collegeEmail.trim().toLowerCase(),
      classId: row.classId!,
      status: 'ACTIVE' as const,
    }));

    try {
      const result = await this.repo.bulkCreateStudents(insertPayload);
      
      await this.audit.log({
        actorId: actor?.actorId,
        actorName: actor?.actorName,
        actorRole: actor?.actorRole,
        action: 'BULK_IMPORT_STUDENTS',
        entityType: 'STUDENT',
        description: `Imported ${result.length} students via CSV/Excel bulk import`,
        newValues: { count: result.length },
        ipAddress: actor?.ipAddress,
        userAgent: actor?.userAgent,
      });

      return { total: insertPayload.length, created: result.length, failed: 0 };
    } catch (error: any) {
      throw new Error('Bulk insert failed: ' + error.message);
    }
  }
}
