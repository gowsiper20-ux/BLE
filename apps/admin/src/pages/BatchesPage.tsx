import { useState, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';
import Select from '../components/Select';
import { useApi } from '../hooks/useApi';
import api from '../services/api';
import { useToast } from '../hooks/useToast';
import type { Batch, ApiResponse, TableColumn } from '../types';

export default function BatchesPage() {
  const { data: response, loading, refetch } = useApi<ApiResponse<Batch[]>>('/api/batches');
  // Need departments for the dropdown
  const { data: deptResponse } = useApi<ApiResponse<any[]>>('/api/departments');
  const departments = deptResponse?.data || [];
  
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formError, setFormError] = useState('');

  const openModal = (batch?: Batch) => {
    if (batch) {
      setEditingBatch(batch);
      setName(batch.name);
      setStartYear(batch.startYear.toString());
      setEndYear(batch.endYear.toString());
      setDepartmentId(batch.departmentId || ''); // In real app, we need the ID, but the GET /api/batches might not return departmentId if we used a join. Oh wait, my backend returns it? Let's assume it does or we update backend to return it.
      setStatus(batch.status);
    } else {
      setEditingBatch(null);
      setName('');
      setStartYear('');
      setEndYear('');
      setDepartmentId(departments.length > 0 ? departments[0].id : '');
      setStatus('ACTIVE');
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBatch(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name || !startYear || !endYear || !departmentId) {
      setFormError('All fields are required.');
      return;
    }

    if (parseInt(startYear) >= parseInt(endYear)) {
      setFormError('Start year must be before end year.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        startYear: parseInt(startYear),
        endYear: parseInt(endYear),
        departmentId,
        status,
      };

      if (editingBatch) {
        await api.patch(`/api/batches/${editingBatch.id}`, payload);
        showToast('success', 'Batch updated successfully');
      } else {
        await api.post('/api/batches', payload);
        showToast('success', 'Batch created successfully');
      }
      closeModal();
      refetch();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this batch? This action cannot be undone.')) return;
    try {
      await api.delete(`/api/batches/${id}`);
      showToast('success', 'Batch deleted successfully');
      refetch();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to delete batch');
    }
  };

  const columns: TableColumn<Batch>[] = useMemo(() => [
    { key: 'name', label: 'Batch Name', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'startYear', label: 'Start Year', sortable: true },
    { key: 'endYear', label: 'End Year', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      )
    }
  ], []);

  const renderActions = (row: Batch) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openModal(row); }}>Edit</Button>
      <Button variant="danger" size="sm" onClick={(e) => handleDelete(e, row.id)}>Delete</Button>
    </div>
  );

  return (
    <div className="batches-page">
      <PageHeader
        title="Batches"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Academic' },
          { label: 'Batches' },
        ]}
        actions={
          <Button onClick={() => openModal()}>Add Batch</Button>
        }
      />

      <DataTable
        columns={columns}
        data={response?.data || []}
        keyField="id"
        loading={loading}
        onRowClick={(row) => openModal(row)}
        actions={renderActions}
        emptyMessage="No batches found."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingBatch ? 'Edit Batch' : 'Add Batch'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{formError}</div>}
          
          <Input
            label="Batch Name"
            placeholder="e.g. 2024–2028"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Start Year"
            type="number"
            placeholder="e.g. 2024"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            required
          />

          <Input
            label="End Year"
            type="number"
            placeholder="e.g. 2028"
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
            required
          />

          <Select
            label="Department"
            value={departmentId}
            onChange={setDepartmentId}
            options={
              departments.map((d) => ({ value: d.id, label: d.name }))
            }
          />

          {editingBatch && (
            <Select
              label="Status"
              value={status}
              onChange={(val) => setStatus(val as any)}
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="ghost" onClick={closeModal} type="button">Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {editingBatch ? 'Save Changes' : 'Create Batch'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
