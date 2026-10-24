import { useEffect, useState, type FormEvent } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import { useApi } from '../hooks/useApi';
import api from '../services/api';
import type { ApiResponse, Batch } from '../types';

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface BatchForm {
  name: string;
  startYear: string;
  endYear: string;
  departmentId: string;
}

const EMPTY_FORM: BatchForm = { name: '', startYear: '', endYear: '', departmentId: '' };

export default function BatchesPage() {
  const { data: batchResponse, loading, error, refetch } = useApi<ApiResponse<Batch[]>>('/api/batches');
  const { data: departmentsResponse, error: departmentsError } = useApi<ApiResponse<DepartmentOption[]>>('/api/departments');
  const [form, setForm] = useState<BatchForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const batches = batchResponse?.data || [];
  const departments = (departmentsResponse?.data || []).filter((item) => item.status === 'ACTIVE');

  useEffect(() => {
    if (!form.departmentId && departments.length === 1) {
      setForm((current) => ({ ...current, departmentId: departments[0].id }));
    }
  }, [departments, form.departmentId]);

  const openForm = (batch?: Batch) => {
    setEditing(batch || null);
    setForm(batch
      ? { name: batch.name, startYear: String(batch.startYear), endYear: String(batch.endYear), departmentId: batch.departmentId || '' }
      : { ...EMPTY_FORM, departmentId: departments.length === 1 ? departments[0].id : '' });
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
        startYear: Number(form.startYear),
        endYear: Number(form.endYear),
        departmentId: form.departmentId || undefined,
      };
      if (editing) await api.patch(`/api/batches/${editing.id}`, payload);
      else await api.post('/api/batches', payload);
      setNotice(editing ? 'Batch updated.' : 'Batch created.');
      setFormOpen(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      await refetch();
    } catch (requestError: unknown) {
      setFormError(requestError && typeof requestError === 'object' && 'message' in requestError && typeof requestError.message === 'string'
        ? requestError.message
        : 'Unable to save batch.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Admission Batch', sortable: true },
    { key: 'startYear', label: 'Start Year' },
    { key: 'endYear', label: 'End Year' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status', render: (value: unknown) => <Badge variant={value === 'ACTIVE' ? 'success' : 'default'}>{String(value)}</Badge> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Admission Batches"
        breadcrumbs={[{ label: 'Home', path: '/dashboard' }, { label: 'Academic' }, { label: 'Batches' }]}
        actions={<Button onClick={() => openForm()}>Add Batch</Button>}
      />
      {notice && <div role="status">{notice}</div>}
      {error && <div role="alert">Batches could not be loaded: {error.message || 'Request failed.'}</div>}
      {departmentsError && <div role="alert">Departments could not be loaded; batch creation is unavailable: {departmentsError.message || 'Request failed.'}</div>}
      {formOpen && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
          <h2>{editing ? 'Edit Batch' : 'Add Batch'}</h2>
          {formError && <div role="alert">{formError}</div>}
          <Input label="Batch name" required maxLength={50} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input label="Admission start year" type="number" required min={2000} max={2200} value={form.startYear} onChange={(event) => setForm({ ...form, startYear: event.target.value })} />
          <Input label="Expected graduation year" type="number" required min={2001} max={2205} value={form.endYear} onChange={(event) => setForm({ ...form, endYear: event.target.value })} />
          <Select label="Department" value={form.departmentId} onChange={(value) => setForm({ ...form, departmentId: value })} options={[{ value: '', label: 'Select department' }, ...departments.map((department) => ({ value: department.id, label: `${department.name} (${department.code})` }))]} />
          {departments.length === 0 && <p role="note">No active department is configured. A department must exist before a batch can be created.</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" disabled={saving || departments.length === 0}>{saving ? 'Saving…' : 'Save batch'}</Button>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </form>
      )}
      <DataTable
        columns={columns}
        data={batches}
        keyField="id"
        loading={loading}
        emptyMessage={error ? 'Batch data is unavailable.' : 'No batches are configured yet.'}
        actions={(batch) => <Button variant="ghost" size="sm" onClick={() => openForm(batch)}>Edit</Button>}
      />
    </div>
  );
}
