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
import type { AcademicYear, ApiResponse, TableColumn } from '../types';

export default function AcademicYearsPage() {
  const { data: response, loading, refetch } = useApi<ApiResponse<AcademicYear[]>>('/api/academic-years');
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState('false');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formError, setFormError] = useState('');

  const openModal = (year?: AcademicYear) => {
    if (year) {
      setEditingYear(year);
      setName(year.name);
      setStartDate(year.startDate.split('T')[0]);
      setEndDate(year.endDate.split('T')[0]);
      setIsCurrent(year.isCurrent ? 'true' : 'false');
      setStatus(year.status);
    } else {
      setEditingYear(null);
      setName('');
      setStartDate('');
      setEndDate('');
      setIsCurrent('false');
      setStatus('ACTIVE');
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingYear(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name || !startDate || !endDate) {
      setFormError('All fields are required.');
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      setFormError('Start date must be before end date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        startDate,
        endDate,
        isCurrent: isCurrent === 'true',
        status,
      };

      if (editingYear) {
        await api.patch(`/api/academic-years/${editingYear.id}`, payload);
        showToast('success', 'Academic year updated successfully');
      } else {
        await api.post('/api/academic-years', payload);
        showToast('success', 'Academic year created successfully');
      }
      closeModal();
      refetch();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: TableColumn<AcademicYear>[] = useMemo(() => [
    { key: 'name', label: 'Academic Year', sortable: true },
    { 
      key: 'startDate', 
      label: 'Start Date', 
      render: (val: any) => new Date(val).toLocaleDateString()
    },
    { 
      key: 'endDate', 
      label: 'End Date', 
      render: (val: any) => new Date(val).toLocaleDateString()
    },
    {
      key: 'isCurrent',
      label: 'Current',
      render: (val: any) => val ? <Badge variant="success">Current</Badge> : <Badge variant="default">No</Badge>
    },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      )
    }
  ], []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this academic year? This action cannot be undone.')) return;
    try {
      await api.delete(`/api/academic-years/${id}`);
      showToast('success', 'Academic year deleted successfully');
      refetch();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to delete academic year');
    }
  };

  const renderActions = (row: AcademicYear) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openModal(row); }}>Edit</Button>
      <Button variant="danger" size="sm" onClick={(e) => handleDelete(e, row.id)}>Delete</Button>
    </div>
  );

  return (
    <div className="academic-years-page">
      <PageHeader
        title="Academic Years"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Academic' },
          { label: 'Academic Years' },
        ]}
        actions={
          <Button onClick={() => openModal()}>Add Academic Year</Button>
        }
      />

      <DataTable
        columns={columns}
        data={response?.data || []}
        keyField="id"
        loading={loading}
        onRowClick={(row) => openModal(row)}
        actions={renderActions}
        emptyMessage="No academic years found."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingYear ? 'Edit Academic Year' : 'Add Academic Year'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{formError}</div>}
          
          <Input
            label="Academic Year Name"
            placeholder="e.g. 2026–2027"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />

          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />

          <Select
            label="Current Academic Year"
            value={isCurrent}
            onChange={setIsCurrent}
            options={[
              { value: 'false', label: 'No' },
              { value: 'true', label: 'Yes' },
            ]}
          />

          {editingYear && (
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
              {editingYear ? 'Save Changes' : 'Create Academic Year'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
