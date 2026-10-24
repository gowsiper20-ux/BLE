import { useState, type FormEvent } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import { useApi } from '../hooks/useApi';
import api from '../services/api';
import type { ApiResponse, ClassSection } from '../types';

interface Option {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  code?: string;
  departmentId?: string;
}

interface ClassForm {
  name: string;
  yearNumber: string;
  section: string;
  departmentId: string;
  academicYearId: string;
  batchId: string;
  regulationId: string;
}

const EMPTY_FORM: ClassForm = {
  name: '',
  yearNumber: '1',
  section: '',
  departmentId: '',
  academicYearId: '',
  batchId: '',
  regulationId: '',
};

export default function ClassesPage() {
  const { data: classResponse, loading, error, refetch } = useApi<ApiResponse<ClassSection[]>>('/api/classes');
  const { data: departmentResponse, error: departmentError } = useApi<ApiResponse<Option[]>>('/api/departments');
  const { data: yearResponse, error: yearError } = useApi<ApiResponse<Option[]>>('/api/academic-years');
  const { data: batchResponse, error: batchError } = useApi<ApiResponse<Option[]>>('/api/batches');
  const { data: regulationResponse, error: regulationError } = useApi<ApiResponse<Option[]>>('/api/regulations');
  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<ClassSection | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const classes = classResponse?.data || [];
  const departments = (departmentResponse?.data || []).filter((item) => item.status === 'ACTIVE');
  const years = (yearResponse?.data || []).filter((item) => item.status === 'ACTIVE');
  const batches = (batchResponse?.data || []).filter((item) => item.status === 'ACTIVE');
  const regulations = (regulationResponse?.data || []).filter((item) => item.status === 'ACTIVE');

  const openForm = (classRow?: ClassSection) => {
    setEditing(classRow || null);
    setForm(classRow ? {
      name: classRow.name,
      yearNumber: String(classRow.yearNumber),
      section: classRow.section,
      departmentId: classRow.departmentId || '',
      academicYearId: classRow.academicYearId || '',
      batchId: classRow.batchId || '',
      regulationId: classRow.regulationId || '',
    } : EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      const payload = {
        name: form.name.trim(),
        yearNumber: Number(form.yearNumber),
        section: form.section.trim(),
        departmentId: form.departmentId,
        academicYearId: form.academicYearId,
        batchId: form.batchId,
        regulationId: form.regulationId,
      };
      if (editing) await api.patch(`/api/classes/${editing.id}`, payload);
      else await api.post('/api/classes', payload);
      setNotice(editing ? 'Class updated.' : 'Class created.');
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await refetch();
    } catch (requestError: unknown) {
      setFormError(requestError && typeof requestError === 'object' && 'message' in requestError && typeof requestError.message === 'string'
        ? requestError.message
        : 'Unable to save class.');
    } finally {
      setSaving(false);
    }
  };

  const toggleClassStatus = async (classRow: ClassSection) => {
    try {
      const nextStatus = classRow.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/api/classes/${classRow.id}`, { status: nextStatus });
      setNotice(`Class "${classRow.name}" is now ${nextStatus.toLowerCase()}.`);
      await refetch();
    } catch (requestError: unknown) {
      setFormError(requestError && typeof requestError === 'object' && 'message' in requestError && typeof requestError.message === 'string'
        ? requestError.message
        : 'Unable to update class status.');
    }
  };

  const columns = [
    { key: 'name', label: 'Class', sortable: true },
    { key: 'yearNumber', label: 'Year' },
    { key: 'section', label: 'Section' },
    { key: 'department', label: 'Department' },
    { key: 'academicYear', label: 'Academic Year' },
    { key: 'batch', label: 'Admission Batch' },
    { key: 'regulation', label: 'Regulation' },
    { key: 'status', label: 'Status', render: (value: unknown) => <Badge variant={value === 'ACTIVE' ? 'success' : 'default'}>{String(value)}</Badge> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Classes / Sections"
        breadcrumbs={[{ label: 'Home', path: '/dashboard' }, { label: 'Academic' }, { label: 'Classes' }]}
        actions={<Button onClick={() => openForm()}>Add Class</Button>}
      />
      {notice && <div role="status">{notice}</div>}
      {error && <div role="alert">Classes could not be loaded: {error.message || 'Request failed.'}</div>}
      {(departmentError || yearError || batchError || regulationError) && (
        <div role="alert">
          One or more class reference lists could not be loaded. Check the connection and retry before creating a class.
        </div>
      )}
      {formOpen && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
          <h2>{editing ? 'Edit Class' : 'Add Class'}</h2>
          {formError && <div role="alert">{formError}</div>}
          <Input label="Class name" required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Select label="Department" required value={form.departmentId} onChange={(value) => setForm({ ...form, departmentId: value })} options={[{ value: '', label: 'Select department' }, ...departments.map((item) => ({ value: item.id, label: item.code || item.name }))]} />
            <Select label="Academic year" required value={form.academicYearId} onChange={(value) => setForm({ ...form, academicYearId: value })} options={[{ value: '', label: 'Select academic year' }, ...years.map((item) => ({ value: item.id, label: item.name }))]} />
            <Select label="Admission batch" required value={form.batchId} onChange={(value) => setForm({ ...form, batchId: value })} options={[{ value: '', label: 'Select batch' }, ...batches.filter((item) => !form.departmentId || item.departmentId === form.departmentId).map((item) => ({ value: item.id, label: item.name }))]} />
            <Select label="Regulation" required value={form.regulationId} onChange={(value) => setForm({ ...form, regulationId: value })} options={[{ value: '', label: 'Select regulation' }, ...regulations.map((item) => ({ value: item.id, label: item.name }))]} />
            <Select label="Year of study" required value={form.yearNumber} onChange={(value) => setForm({ ...form, yearNumber: value })} options={[1, 2, 3, 4].map((year) => ({ value: String(year), label: `Year ${year}` }))} />
            <Input label="Section" required maxLength={10} value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" disabled={saving || !departments.length || !years.length || !batches.length || !regulations.length}>{saving ? 'Saving…' : 'Save class'}</Button>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </form>
      )}
      <DataTable
        columns={columns}
        data={classes}
        keyField="id"
        loading={loading}
        emptyMessage={error ? 'Class data is unavailable.' : 'No classes are configured yet.'}
        actions={(classRow) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" size="sm" onClick={() => openForm(classRow)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void toggleClassStatus(classRow)}
              style={{ color: classRow.status === 'ACTIVE' ? 'var(--color-warning)' : 'var(--color-success)' }}
            >
              {classRow.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        )}
      />
    </div>
  );
}
