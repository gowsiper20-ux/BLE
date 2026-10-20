import { useCallback, useEffect, useState, type FormEvent } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import SearchBar from '../components/SearchBar';
import Select from '../components/Select';
import { academicService } from '../services/academicService';
import { studentService, type StudentImportPreview, type StudentImportResult } from '../services/studentService';
import type { Student } from '../types';
import './StudentsPage.css';

interface ClassOption {
  id: string;
  name: string;
  batchName?: string;
  status: string;
}

interface StudentFormData {
  registerNumber: string;
  name: string;
  collegeEmail: string;
  classId: string;
}

const PAGE_SIZE = 20;
const EMPTY_FORM: StudentFormData = { registerNumber: '', name: '', collegeEmail: '', classId: '' };

function errorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : 'The request failed. Please retry.';
}

function downloadErrorReport(rows: Array<{ rowNumber: number; status?: string; errors: Array<{ message: string }> }>) {
  const quote = (value: string) => {
    const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safeValue.replace(/"/g, '""')}"`;
  };
  const csv = [
    ['row_number', 'status', 'errors'],
    ...rows.map((row) => [String(row.rowNumber), row.status || 'invalid', row.errors.map((item) => item.message).join('; ')]),
  ].map((row) => row.map(quote).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'student-import-errors.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [importResult, setImportResult] = useState<StudentImportResult | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await studentService.getStudents({
        search,
        classId,
        status,
        page,
        limit: PAGE_SIZE,
      });
      setStudents(result.students);
      setTotal(result.pagination.total);
    } catch (requestError) {
      setError(errorMessage(requestError));
      setStudents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, classId, status, page]);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    void academicService.getClasses()
      .then((response) => setClasses((response.data || []).filter((item: ClassOption) => item.status === 'ACTIVE')))
      .catch((requestError: unknown) => setError(errorMessage(requestError)));
  }, []);

  const openForm = (student?: Student) => {
    setMessage('');
    setError('');
    setEditing(student || null);
    setForm(student
      ? { registerNumber: student.registerNumber, name: student.name, collegeEmail: student.collegeEmail, classId: student.classId }
      : EMPTY_FORM);
    setFormOpen(true);
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editing) await studentService.updateStudent(editing.id, form);
      else await studentService.createStudent(form);
      setMessage(editing ? 'Student details updated.' : 'Student registered.');
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await fetchStudents();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (student: Student) => {
    setError('');
    setMessage('');
    try {
      const nextStatus = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await studentService.updateStudentStatus(student.id, nextStatus);
      setMessage(`Student status changed to ${nextStatus}.`);
      await fetchStudents();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const previewFile = async () => {
    if (!file) return;
    setImportBusy(true);
    setImportError('');
    setImportResult(null);
    try {
      setPreview(await studentService.previewImport(file));
    } catch (requestError) {
      setPreview(null);
      setImportError(errorMessage(requestError));
    } finally {
      setImportBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!file || !preview) return;
    setImportBusy(true);
    setImportError('');
    try {
      const result = await studentService.confirmImport(file);
      setImportResult(result);
      setPreview(null);
      setFile(null);
      setMessage(`Import finished: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed.`);
      await fetchStudents();
    } catch (requestError) {
      setImportError(errorMessage(requestError));
    } finally {
      setImportBusy(false);
    }
  };

  const downloadTemplate = async () => {
    setImportError('');
    try {
      const blob = await studentService.downloadTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student-import-template.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (requestError) {
      setImportError(errorMessage(requestError));
    }
  };

  const columns = [
    { key: 'registerNumber', label: 'Register Number', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'collegeEmail', label: 'College Email' },
    { key: 'className', label: 'Class' },
    { key: 'batchName', label: 'Batch' },
    {
      key: 'status',
      label: 'Status',
      render: (value: unknown) => <Badge variant={value === 'ACTIVE' ? 'success' : 'default'}>{String(value)}</Badge>,
    },
  ];

  return (
    <div className="students-page">
      <PageHeader
        title="Students"
        breadcrumbs={[{ label: 'Home', path: '/dashboard' }, { label: 'Students' }]}
      />

      {message && <div role="status" className="students-page__notice">{message}</div>}
      {error && (
        <div role="alert" className="students-page__error">
          {error} <button type="button" onClick={() => void fetchStudents()}>Retry</button>
        </div>
      )}

      <div className="students-page__toolbar">
        <button type="button" onClick={() => openForm()}>Add Student</button>
        <button type="button" className="students-page__secondary" onClick={() => document.getElementById('student-import-title')?.scrollIntoView({ behavior: 'smooth' })}>
          Import Students
        </button>
      </div>

      {formOpen && (
        <form className="students-page__panel" onSubmit={submitForm}>
          <h2>{editing ? 'Edit Student' : 'Add Student'}</h2>
          <div className="students-page__form-grid">
            <label>Register number<input required maxLength={50} value={form.registerNumber} onChange={(event) => setForm({ ...form, registerNumber: event.target.value })} /></label>
            <label>Full name<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>College email<input required type="email" maxLength={255} value={form.collegeEmail} onChange={(event) => setForm({ ...form, collegeEmail: event.target.value })} /></label>
            <label>Class
              <select required value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })}>
                <option value="">Select an existing class</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.batchName ? ` · ${item.batchName}` : ''}</option>)}
              </select>
            </label>
          </div>
          {classes.length === 0 && <p role="note">No active classes are configured. Configure a real class before adding students.</p>}
          <div className="students-page__form-actions">
            <button type="submit" disabled={saving || classes.length === 0}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create student'}</button>
            <button type="button" className="students-page__secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}

      <section className="students-page__panel" aria-labelledby="student-import-title">
        <h2 id="student-import-title">Bulk import students</h2>
        <p>Use the blank CSV template with columns <code>register_number, name, college_email, class_id</code>. Choose an existing class ID; imports create records only and never overwrite existing students.</p>
        <div className="students-page__import-actions">
          <button type="button" className="students-page__secondary" onClick={() => void downloadTemplate()}>Download Student Template</button>
          <label className="students-page__file-label">CSV or XLSX file
            <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setPreview(null);
              setImportResult(null);
              setImportError('');
            }} />
          </label>
          <button type="button" onClick={() => void previewFile()} disabled={!file || importBusy}>{importBusy ? 'Validating…' : 'Preview and validate'}</button>
        </div>
        {importError && <div className="students-page__error" role="alert">{importError}</div>}
        {preview && (
          <div className="students-page__preview">
            <p><strong>{preview.totalRows}</strong> rows · <strong>{preview.valid}</strong> valid · <strong>{preview.errors}</strong> invalid</p>
            <div className="students-page__preview-table">
              <table>
                <thead><tr><th>Row</th><th>Register number</th><th>Name</th><th>Email</th><th>Class</th><th>Validation</th></tr></thead>
                <tbody>{preview.data.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td><td>{row.registerNumber}</td><td>{row.name}</td><td>{row.collegeEmail}</td><td>{row.className}</td>
                    <td>{row.isValid ? 'Valid' : row.errors.map((item) => item.message).join('; ')}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="students-page__form-actions">
              <button type="button" onClick={() => void confirmImport()} disabled={importBusy || preview.totalRows === 0}>
                {importBusy ? 'Importing…' : 'Confirm import'}
              </button>
              <button type="button" className="students-page__secondary" onClick={() => { setFile(null); setPreview(null); }} disabled={importBusy}>Cancel import</button>
              {preview.errors > 0 && <button type="button" className="students-page__secondary" onClick={() => downloadErrorReport(preview.data.filter((row) => !row.isValid).map((row) => ({ rowNumber: row.rowNumber, errors: row.errors })))}>Download validation report</button>}
            </div>
          </div>
        )}
        {importResult && (
          <div role="status" className="students-page__import-result">
            <p>{importResult.total} rows: {importResult.created} created, {importResult.skipped} skipped, {importResult.failed} failed.</p>
            {importResult.rows.some((row) => row.errors.length > 0) && (
              <button type="button" className="students-page__secondary" onClick={() => downloadErrorReport(importResult.rows.filter((row) => row.errors.length > 0))}>Download error report</button>
            )}
          </div>
        )}
      </section>

      <div className="students-page__filters">
        <SearchBar placeholder="Search register number or name..." value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
        <div className="students-page__filter-group">
          <Select label="Class" value={classId} onChange={(value) => { setClassId(value); setPage(1); }} options={[{ value: '', label: 'All classes' }, ...classes.map((item) => ({ value: item.id, label: item.name }))]} />
          <Select label="Status" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[{ value: '', label: 'All statuses' }, { value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }, { value: 'GRADUATED', label: 'Graduated' }, { value: 'SUSPENDED', label: 'Suspended' }]} />
        </div>
      </div>

      <div className="students-page__content">
        <DataTable
          columns={columns}
          data={students}
          keyField="id"
          loading={loading}
          emptyMessage={error ? 'Student records could not be loaded.' : students.length === 0 && !search && !classId && !status ? 'No student records are available. Add a student or import an existing class roster.' : 'No student records match these filters.'}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          actions={(student) => (
            <div className="students-page__row-actions">
              <button type="button" onClick={() => openForm(student)}>Edit</button>
              <button type="button" onClick={() => void toggleStatus(student)}>{student.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
