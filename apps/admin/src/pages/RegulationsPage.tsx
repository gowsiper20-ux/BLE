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
import type { Regulation, ApiResponse, TableColumn } from '../types';

export default function RegulationsPage() {
  const { data: response, loading, refetch } = useApi<ApiResponse<Regulation[]>>('/api/regulations');
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRegulation, setEditingRegulation] = useState<Regulation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formError, setFormError] = useState('');

  const openModal = (regulation?: Regulation) => {
    if (regulation) {
      setEditingRegulation(regulation);
      setName(regulation.name);
      setYear(regulation.year.toString());
      setDescription(regulation.description || '');
      setStatus(regulation.status);
    } else {
      setEditingRegulation(null);
      setName('');
      setYear('');
      setDescription('');
      setStatus('ACTIVE');
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRegulation(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name || !year) {
      setFormError('Name and year are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        year: parseInt(year),
        description,
        status,
      };

      if (editingRegulation) {
        await api.patch(`/api/regulations/${editingRegulation.id}`, payload);
        showToast('success', 'Regulation updated successfully');
      } else {
        await api.post('/api/regulations', payload);
        showToast('success', 'Regulation created successfully');
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
    if (!window.confirm('Are you sure you want to delete this regulation? This action cannot be undone.')) return;
    try {
      await api.delete(`/api/regulations/${id}`);
      showToast('success', 'Regulation deleted successfully');
      refetch();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to delete regulation');
    }
  };

  const columns: TableColumn<Regulation>[] = useMemo(() => [
    { key: 'name', label: 'Regulation', sortable: true },
    { key: 'year', label: 'Year', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      )
    }
  ], []);

  const renderActions = (row: Regulation) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openModal(row); }}>Edit</Button>
      <Button variant="danger" size="sm" onClick={(e) => handleDelete(e, row.id)}>Delete</Button>
    </div>
  );

  return (
    <div className="regulations-page">
      <PageHeader
        title="Regulations"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Academic' },
          { label: 'Regulations' },
        ]}
        actions={
          <Button onClick={() => openModal()}>Add Regulation</Button>
        }
      />

      <DataTable
        columns={columns}
        data={response?.data || []}
        keyField="id"
        loading={loading}
        onRowClick={(row) => openModal(row)}
        actions={renderActions}
        emptyMessage="No regulations found."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingRegulation ? 'Edit Regulation' : 'Add Regulation'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{formError}</div>}
          
          <Input
            label="Regulation Name"
            placeholder="e.g. Regulation 2023"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Year"
            type="number"
            placeholder="e.g. 2023"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
          />

          <Input
            label="Description"
            placeholder="Optional description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {editingRegulation && (
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
              {editingRegulation ? 'Save Changes' : 'Create Regulation'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
