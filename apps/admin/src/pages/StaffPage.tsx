import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import SearchBar from '../components/SearchBar';
import Select from '../components/Select';
import { staffService, type StaffImportPreview, type StaffImportResult } from '../services/staffService';
import type { Staff } from '../types';
import './StudentsPage.css';

interface StaffFormData {
  staffCode: string;
  name: string;
  collegeEmail: string;
}

const PAGE_SIZE = 20;
const EMPTY_FORM: StaffFormData = { staffCode: '', name: '', collegeEmail: '' };

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
  link.download = 'faculty-import-errors.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState<StaffFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StaffImportPreview | null>(null);
  const [importResult, setImportResult] = useState<StaffImportResult | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await staffService.getStaff({ search, status, page, limit: PAGE_SIZE });
      setStaff(result.staff);
      setTotal(result.pagination.total);
    } catch (requestError) {
      setError(errorMessage(requestError));
      setStaff([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    void fetchStaff();
  }, [fetchStaff]);

  const openForm = (member?: Staff) => {
    setError('');
    setMessage('');
    setEditing(member || null);
    setForm(member
      ? { staffCode: member.staffCode, name: member.name, collegeEmail: member.collegeEmail }
      : EMPTY_FORM);
    setFormOpen(true);
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editing) await staffService.updateStaff(editing.id, form);
      else await staffService.createStaff(form);
      setMessage(editing ? 'Faculty details updated.' : 'Faculty member registered.');
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await fetchStaff();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (member: Staff) => {
    setError('');
    setMessage('');
    try {
      const nextStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await staffService.updateStaffStatus(member.id, nextStatus);
      setMessage(`Faculty status changed to ${nextStatus}.`);
      await fetchStaff();
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
      setPreview(await staffService.previewImport(file));
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
      const result = await staffService.confirmImport(file);
      setImportResult(result);
      setPreview(null);
      setFile(null);
      setMessage(`Import finished: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed.`);
      await fetchStaff();
    } catch (requestError) {
      setImportError(errorMessage(requestError));
    } finally {
      setImportBusy(false);
    }
  };

  const downloadTemplate = async () => {
    setImportError('');
    try {
      const blob = await staffService.downloadTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'faculty-import-template.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (requestError) {
      setImportError(errorMessage(requestError));
    }
  };

  const columns = [
    { key: 'staffCode', label: 'Staff Identifier', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'collegeEmail', label: 'College Email' },
    { key: 'roles', label: 'Role', render: (value: unknown) => Array.isArray(value) ? value.join(', ') : '' },
    { key: 'status', label: 'Status', render: (value: unknown) => <Badge variant={value === 'ACTIVE' ? 'success' : 'default'}>{String(value)}</Badge> },
  ];

  return (
    <div className="students-page">
      <PageHeader title="Faculty / Staff" breadcrumbs={[{ label: 'Home', path: '/dashboard' }, { label: 'Faculty / Staff' }]} />
      {message && <div role="status" className="students-page__notice">{message}</div>}
      {error && <div role="alert" className="students-page__error">{error} <button type="button" onClick={() => void fetchStaff()}>Retry</button></div>}

      <div className="students-page__toolbar">
        <button type="button" onClick={() => openForm()}>Add Faculty</button>
      </div>

      {formOpen && (
        <form className="students-page__panel" onSubmit={submitForm}>
          <h2>{editing ? 'Edit Faculty' : 'Add Faculty'}</h2>
          <div className="students-page__form-grid">
            <label>Staff identifier<input required maxLength={50} value={form.staffCode} onChange={(event) => setForm({ ...form, staffCode: event.target.value })} /></label>
            <label>Full name<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>College email<input required type="email" maxLength={255} value={form.collegeEmail} onChange={(event) => setForm({ ...form, collegeEmail: event.target.value })} /></label>
          </div>
          <p>This creates a faculty record only. It does not create a login account or teaching assignment.</p>
          <div className="students-page__form-actions">
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create faculty record'}</button>
            <button type="button" className="students-page__secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}

      <section className="students-page__panel" aria-labelledby="faculty-import-title">
        <h2 id="faculty-import-title">Bulk import faculty</h2>
        <p>Use the blank CSV template with columns <code>staff_code, name, college_email</code>. Only new faculty records are created; existing records are never overwritten.</p>
        <div className="students-page__import-actions">
          <button type="button" className="students-page__secondary" onClick={() => void downloadTemplate()}>Download Faculty Template</button>
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
        {importError && <div role="alert" className="students-page__error">{importError}</div>}
        {preview && (
          <div className="students-page__preview">
            <p><strong>{preview.totalRows}</strong> rows · <strong>{preview.valid}</strong> valid · <strong>{preview.errors}</strong> invalid</p>
            <div className="students-page__preview-table">
              <table>
                <thead><tr><th>Row</th><th>Staff identifier</th><th>Name</th><th>Email</th><th>Validation</th></tr></thead>
                <tbody>{preview.data.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td><td>{row.staffCode}</td><td>{row.name}</td><td>{row.collegeEmail}</td>
                    <td>{row.isValid ? 'Valid' : row.errors.map((item) => item.message).join('; ')}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="students-page__form-actions">
              <button type="button" onClick={() => void confirmImport()} disabled={importBusy || preview.totalRows === 0}>{importBusy ? 'Importing…' : 'Confirm import'}</button>
              <button type="button" className="students-page__secondary" onClick={() => { setFile(null); setPreview(null); }} disabled={importBusy}>Cancel import</button>
              {preview.errors > 0 && <button type="button" className="students-page__secondary" onClick={() => downloadErrorReport(preview.data.filter((row) => !row.isValid).map((row) => ({ rowNumber: row.rowNumber, errors: row.errors })))}>Download validation report</button>}
            </div>
          </div>
        )}
        {importResult && (
          <div role="status" className="students-page__import-result">
            <p>{importResult.total} rows: {importResult.created} created, {importResult.skipped} skipped, {importResult.failed} failed.</p>
            {importResult.rows.some((row) => row.errors.length > 0) && <button type="button" className="students-page__secondary" onClick={() => downloadErrorReport(importResult.rows.filter((row) => row.errors.length > 0))}>Download error report</button>}
          </div>
        )}
      </section>

      <div className="students-page__filters">
        <SearchBar placeholder="Search staff name or identifier..." value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
        <Select label="Status" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[{ value: '', label: 'All statuses' }, { value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
      </div>
      <div className="students-page__content">
        <DataTable
          columns={columns}
          data={staff}
          keyField="id"
          loading={loading}
          emptyMessage={error ? 'Faculty records could not be loaded.' : 'No faculty records match these filters.'}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          actions={(member) => (
            <div className="students-page__row-actions">
              <Link to={`/staff/${member.id}`}>View</Link>
              <button type="button" onClick={() => openForm(member)}>Edit</button>
              <button type="button" onClick={() => void toggleStatus(member)}>{member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
