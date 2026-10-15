import { StudentRepository } from '../repositories/student.repository';
import { students } from '../db/schema/students';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { Buffer } from 'buffer';
import { AuditService } from './audit.service';

export class StudentService {
  private repo: StudentRepository;
  private audit: AuditService;

  constructor() {
    this.repo = new StudentRepository();
    this.audit = new AuditService();
  }

  async getStudents(filters: any) {
    return this.repo.getStudents(filters);
  }

  async getStudentById(id: string) {
    return this.repo.getStudentById(id);
  }

  async createStudent(data: typeof students.$inferInsert) {
    const existingReg = await this.repo.getStudentByRegisterNumber(data.registerNumber);
    if (existingReg) {
      throw new Error('Student with this register number already exists.');
    }

    const existingEmail = await this.repo.getStudentByEmail(data.collegeEmail);
    if (existingEmail) {
      throw new Error('Student with this college email already exists.');
    }

    if (!data.classId) {
      throw new Error('Class assignment is required.');
    }

    const [created] = await this.repo.createStudent(data);
    
    await this.audit.log({
      action: 'CREATE',
      entityType: 'STUDENT',
      entityId: created.id,
      description: `Created student ${created.name} (${created.registerNumber})`,
      newValues: created,
    });

    return created;
  }

  async updateStudent(id: string, data: Partial<typeof students.$inferInsert>) {
    if (data.registerNumber) {
      const existing = await this.repo.getStudentByRegisterNumber(data.registerNumber);
      if (existing && existing.id !== id) {
        throw new Error('Student with this register number already exists.');
      }
    }

    if (data.collegeEmail) {
      const existing = await this.repo.getStudentByEmail(data.collegeEmail);
      if (existing && existing.id !== id) {
        throw new Error('Student with this college email already exists.');
      }
    }

    const old = await this.repo.getStudentById(id);
    const [updated] = await this.repo.updateStudent(id, data);

    if (old) {
      await this.audit.log({
        action: 'UPDATE',
        entityType: 'STUDENT',
        entityId: id,
        description: `Updated student ${updated.name} (${updated.registerNumber})`,
        oldValues: old,
        newValues: updated,
      });
    }

    return updated;
  }

  async updateStudentStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED') {
    const old = await this.repo.getStudentById(id);
    const [updated] = await this.repo.updateStudent(id, { status });

    if (old) {
      await this.audit.log({
        action: 'UPDATE',
        entityType: 'STUDENT',
        entityId: id,
        description: `Changed student status to ${status}`,
        oldValues: { status: old.status },
        newValues: { status },
      });
    }

    return updated;
  }

  // --- Import Logic ---

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
      // Normalize column names based on template (register_number, name, college_email, class)
      const regNo = (row['register_number'] || row['Register Number'] || '').toString().trim();
      const name = (row['name'] || row['Name'] || '').toString().trim();
      const email = (row['college_email'] || row['College Email'] || row['email'] || '').toString().trim();
      const className = (row['class'] || row['Class'] || '').toString().trim();

      const rowResult = {
        rowNumber: i + 2, // Excel rows usually start at 1, +1 for header
        registerNumber: regNo,
        name,
        collegeEmail: email,
        className,
        isValid: true,
        classId: null as string | null,
        errors: [] as { code: string, message: string }[]
      };

      // 1. Validate emptiness
      if (!regNo) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'MISSING_REGISTER_NUMBER', message: 'Register number is missing' });
      }
      if (!name) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'MISSING_NAME', message: 'Name is missing' });
      }
      if (!email) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'MISSING_EMAIL', message: 'Email is missing' });
      } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'INVALID_EMAIL', message: 'Invalid email format' });
      }
      if (!className) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'MISSING_CLASS', message: 'Class is missing' });
      }

      // 2. Validate intra-file duplicates
      if (regNo && seenRegisterNumbers.has(regNo)) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'DUPLICATE_REGISTER_NUMBER', message: 'Duplicate register number in uploaded file' });
      }
      if (email && seenEmails.has(email)) {
        rowResult.isValid = false;
        rowResult.errors.push({ code: 'DUPLICATE_EMAIL', message: 'Duplicate email in uploaded file' });
      }
      if (regNo) seenRegisterNumbers.add(regNo);
      if (email) seenEmails.add(email);

      // 3. Database Validation (Register Number & Email existence, Class resolution)
      if (rowResult.isValid) {
        const [existingReg, existingEmail, resolvedClass] = await Promise.all([
          this.repo.getStudentByRegisterNumber(regNo),
          this.repo.getStudentByEmail(email),
          this.repo.getClassByName(className)
        ]);

        if (existingReg) {
          rowResult.isValid = false;
          rowResult.errors.push({ code: 'REGISTER_NUMBER_EXISTS', message: 'Student with this register number already exists in system' });
        }
        if (existingEmail) {
          rowResult.isValid = false;
          rowResult.errors.push({ code: 'EMAIL_EXISTS', message: 'Student with this email already exists in system' });
        }
        if (!resolvedClass) {
          rowResult.isValid = false;
          rowResult.errors.push({ code: 'CLASS_NOT_FOUND', message: `Class '${className}' not found in system` });
        } else {
          rowResult.classId = resolvedClass.id;
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

  async confirmImport(importData: any[]) {
    // importData should be the array of preview.data that are valid
    const validRows = importData.filter(row => row.isValid && row.classId);
    
    if (validRows.length === 0) {
      throw new Error('No valid rows to import.');
    }

    if (validRows.length !== importData.length) {
       throw new Error('Cannot import file with errors. Please fix errors and upload again.');
    }

    const insertPayload = validRows.map(row => ({
      registerNumber: row.registerNumber,
      name: row.name,
      collegeEmail: row.collegeEmail,
      classId: row.classId!,
      status: 'ACTIVE' as const,
    }));

    try {
      const result = await this.repo.bulkCreateStudents(insertPayload);
      
      await this.audit.log({
        action: 'IMPORT',
        entityType: 'STUDENT',
        description: `Imported ${result.length} students via CSV/Excel`,
      });

      return { total: insertPayload.length, created: result.length, failed: 0 };
    } catch (error: any) {
      throw new Error('Bulk insert failed: ' + error.message);
    }
  }
}
