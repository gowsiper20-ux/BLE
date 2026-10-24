import { useCallback, useEffect, useState, type FormEvent } from 'react';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import SearchBar from '../components/SearchBar';
import Select from '../components/Select';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import BulkImportModal from '../components/BulkImportModal';
import { academicService } from '../services/academicService';
import { studentService } from '../services/studentService';
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

const EMPTY_FORM: StudentFormData = { registerNumber: '', name: '', collegeEmail: '', classId: '' };

function errorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : 'The request failed. Please retry.';
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [isCompact, setIsCompact] = useState(false);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await studentService.getStudents({
        search,
        classId,
        status,
        page,
        limit: pageSize,
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
  }, [search, classId, status, page, pageSize]);

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
      if (editing) {
        await studentService.updateStudent(editing.id, form);
        setMessage(`Student ${form.name} updated successfully.`);
      } else {
        await studentService.createStudent(form);
        setMessage(`Student ${form.name} registered successfully.`);
      }
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      // Immediately refresh student directory!
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
      setMessage(`Status updated to ${nextStatus} for ${student.name}.`);
      await fetchStudents();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="students-page">
      {/* Page Header */}
      <div className="students-page__header-row">
        <div>
          <PageHeader
            title="Students Directory"
            breadcrumbs={[{ label: 'Home', path: '/dashboard' }, { label: 'Students' }]}
          />
        </div>
        <div className="students-page__header-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setImportModalOpen(true)}
          >
            <Icon name="upload" size={16} />
            <span>Bulk Import Excel / CSV</span>
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => openForm()}
          >
            <Icon name="add" size={16} />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Notices */}
      {message && (
        <div role="status" className="students-page__notice">
          <Icon name="check" size={16} />
          <span>{message}</span>
          <button type="button" className="notice-dismiss" onClick={() => setMessage('')}>×</button>
        </div>
      )}
      {error && (
        <div role="alert" className="students-page__error">
          <Icon name="error" size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => void fetchStudents()}>Retry</button>
        </div>
      )}

      {/* Filters & View Controls Bar */}
      <div className="students-page__controls-bar">
        <div className="students-page__search-wrap">
          <SearchBar
            placeholder="Search by register number or student name..."
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
          />
        </div>

        <div className="students-page__filters-group">
          <Select
            label="Class"
            value={classId}
            onChange={(value) => { setClassId(value); setPage(1); }}
            options={[{ value: '', label: 'All classes' }, ...classes.map((item) => ({ value: item.id, label: item.name }))]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(value) => { setStatus(value); setPage(1); }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'GRADUATED', label: 'Graduated' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ]}
          />
          <div className="students-page__view-toggles">
            <button
              type="button"
              className={`view-toggle-btn ${isCompact ? 'view-toggle-btn--active' : ''}`}
              onClick={() => setIsCompact((c) => !c)}
              title={isCompact ? 'Switch to comfortable view' : 'Switch to compact view (best for 100+ students)'}
            >
              {isCompact ? 'Compact View' : 'Comfortable'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Container with Sticky Headers & Internal Scroll */}
      <div className="students-page__table-wrapper">
        <div className={`students-table-scroll ${isCompact ? 'students-table-scroll--compact' : ''}`}>
          <table className="students-table">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Register Number</th>
                <th>Student Name</th>
                <th>College Email</th>
                <th style={{ width: '130px' }}>Class</th>
                <th style={{ width: '120px' }}>Batch</th>
                <th style={{ width: '110px' }}>Status</th>
                <th style={{ width: '160px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="students-table__loading-cell">
                    <div className="table-spinner" />
                    <span>Loading student records...</span>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="students-table__empty-cell">
                    <div className="students-empty-state">
                      <div className="empty-state-icon">
                        <Icon name="students" size={40} />
                      </div>
                      <h3>No Student Records</h3>
                      <p>
                        {search || classId || status
                          ? 'No students matched the active search filters.'
                          : 'The student roster is currently empty. Upload your class Excel or register students to begin.'}
                      </p>
                      <div className="empty-state-actions">
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => setImportModalOpen(true)}
                        >
                          <Icon name="upload" size={16} />
                          <span>Bulk Import Excel</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={() => openForm()}
                        >
                          <Icon name="add" size={16} />
                          <span>Add Single Student</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="student-row">
                    <td>
                      <span className="student-regno-badge">
                        {student.registerNumber}
                      </span>
                    </td>
                    <td>
                      <div className="student-name-cell">
                        <div className="student-avatar-initials">
                          {student.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="student-name-text">{student.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="student-email-text">{student.collegeEmail}</span>
                    </td>
                    <td>
                      <span className="student-class-badge">{student.className || '-'}</span>
                    </td>
                    <td>
                      <span className="student-batch-badge">{student.batchName || '-'}</span>
                    </td>
                    <td>
                      <Badge variant={student.status === 'ACTIVE' ? 'success' : 'default'}>
                        {student.status}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="student-row-actions">
                        <button
                          type="button"
                          className="action-btn action-btn--edit"
                          onClick={() => openForm(student)}
                          title="Edit Student Details"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`action-btn ${student.status === 'ACTIVE' ? 'action-btn--deactivate' : 'action-btn--activate'}`}
                          onClick={() => void toggleStatus(student)}
                        >
                          {student.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Enhanced Pagination & Page Size Control */}
        <div className="students-page__pagination-bar">
          <div className="pagination-info">
            <span>
              Showing {students.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(page * pageSize, total)} of <strong>{total}</strong> students
            </span>
            <div className="page-size-selector">
              <label htmlFor="student-pagesize">Rows per page:</label>
              <select
                id="student-pagesize"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <Icon name="chevron-left" size={16} />
              <span>Previous</span>
            </button>
            <span className="pagination-current-page">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              <span>Next</span>
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Student Details' : 'Register New Student'}
        size="md"
      >
        <form onSubmit={submitForm} className="student-form-modal">
          <div className="student-form-grid">
            <div className="form-group">
              <label htmlFor="form-regno">Register Number *</label>
              <input
                id="form-regno"
                required
                maxLength={50}
                placeholder="e.g. 61782324106001"
                value={form.registerNumber}
                onChange={(e) => setForm({ ...form, registerNumber: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="form-name">Full Name *</label>
              <input
                id="form-name"
                required
                maxLength={255}
                placeholder="e.g. Anandha Kumar S"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="form-email">College Email *</label>
              <input
                id="form-email"
                required
                type="email"
                maxLength={255}
                placeholder="e.g. anand.23it@sonatech.ac.in"
                value={form.collegeEmail}
                onChange={(e) => setForm({ ...form, collegeEmail: e.target.value.toLowerCase() })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="form-class">Assigned Class *</label>
              <select
                id="form-class"
                required
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
              >
                <option value="">Select Class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.batchName ? `(${item.batchName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="student-form-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || classes.length === 0}
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Register Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modern Bulk Import Modal */}
      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Bulk Import Students Roster"
        entityName="students"
        sampleTemplateName="student-import-template.csv"
        columnsNote="Format: register_number, name, college_email, class_id. Supports Excel (.xlsx) and CSV."
        onDownloadTemplate={() => studentService.downloadTemplate()}
        onPreview={(file) => studentService.previewImport(file)}
        onConfirm={(file) => studentService.confirmImport(file)}
        onSuccess={() => {
          // Immediately update student page!
          void fetchStudents();
        }}
      />
    </div>
  );
}
