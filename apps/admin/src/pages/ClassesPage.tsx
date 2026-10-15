import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Select from '../components/Select';
import SearchBar from '../components/SearchBar';
import { useApi } from '../hooks/useApi';
import api from '../services/api';
import { useToast } from '../hooks/useToast';
import type { ClassSection, ApiResponse, TableColumn } from '../types';
import './ClassesPage.css';

export default function ClassesPage() {
  const navigate = useNavigate();
  const { data: classesResponse, loading: classesLoading, refetch } = useApi<ApiResponse<ClassSection[]>>('/api/classes');
  
  // Dropdown data sources
  const { data: deptsResponse } = useApi<ApiResponse<any[]>>('/api/departments');
  const { data: yearsResponse } = useApi<ApiResponse<any[]>>('/api/academic-years');
  const { data: batchesResponse } = useApi<ApiResponse<any[]>>('/api/batches');
  const { data: regsResponse } = useApi<ApiResponse<any[]>>('/api/regulations');

  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterAcademicYear, setFilterAcademicYear] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form State
  const [departmentId, setDepartmentId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [regulationId, setRegulationId] = useState('');
  const [yearNumber, setYearNumber] = useState('1');
  const [section, setSection] = useState('A');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formError, setFormError] = useState('');

  const openModal = (cls?: ClassSection) => {
    if (cls) {
      setEditingClass(cls);
      setDepartmentId(cls.departmentId || '');
      setAcademicYearId(cls.academicYearId || '');
      setBatchId(cls.batchId || '');
      setRegulationId(cls.regulationId || '');
      setYearNumber(cls.yearNumber.toString());
      setSection(cls.section);
      setStatus(cls.status);
    } else {
      setEditingClass(null);
      setDepartmentId(deptsResponse?.data?.[0]?.id || '');
      setAcademicYearId(yearsResponse?.data?.find((y) => y.isCurrent)?.id || yearsResponse?.data?.[0]?.id || '');
      setBatchId(batchesResponse?.data?.[0]?.id || '');
      setRegulationId(regsResponse?.data?.[0]?.id || '');
      setYearNumber('1');
      setSection('A');
      setStatus('ACTIVE');
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClass(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!departmentId || !academicYearId || !batchId || !regulationId || !yearNumber || !section) {
      setFormError('All fields are required.');
      return;
    }

    // Auto-generate name based on format: YEAR + DEPARTMENT + SECTION
    // Example: II IT-A
    const yearRoman = ['I', 'II', 'III', 'IV'][parseInt(yearNumber) - 1] || yearNumber;
    const deptCode = deptsResponse?.data?.find(d => d.id === departmentId)?.code || 'DEPT';
    const computedName = `${yearRoman} ${deptCode}-${section}`;

    setIsSubmitting(true);
    try {
      const payload = {
        name: computedName,
        departmentId,
        academicYearId,
        batchId,
        regulationId,
        yearNumber: parseInt(yearNumber),
        section,
        status,
      };

      if (editingClass) {
        await api.patch(`/api/classes/${editingClass.id}`, payload);
        showToast('success', 'Class updated successfully');
      } else {
        await api.post('/api/classes', payload);
        showToast('success', 'Class created successfully');
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
    if (!window.confirm('Are you sure you want to delete this class? This action cannot be undone.')) return;
    try {
      await api.delete(`/api/classes/${id}`);
      showToast('success', 'Class deleted successfully');
      refetch();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to delete class');
    }
  };

  const filteredData = useMemo(() => {
    let data = classesResponse?.data || [];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(d => d.name.toLowerCase().includes(q));
    }
    if (filterYear) {
      data = data.filter(d => d.yearNumber.toString() === filterYear);
    }
    if (filterAcademicYear) {
      data = data.filter(d => d.academicYear === filterAcademicYear);
    }
    if (filterBatch) {
      data = data.filter(d => d.batch === filterBatch);
    }
    if (filterStatus) {
      data = data.filter(d => d.status === filterStatus);
    }
    return data;
  }, [classesResponse?.data, searchQuery, filterYear, filterAcademicYear, filterBatch, filterStatus]);

  const columns: TableColumn<ClassSection>[] = useMemo(() => [
    { key: 'name', label: 'Class', sortable: true },
    { key: 'yearNumber', label: 'Year', sortable: true },
    { key: 'section', label: 'Section', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'academicYear', label: 'Academic Year', sortable: true },
    { key: 'batch', label: 'Batch', sortable: true },
    { key: 'regulation', label: 'Regulation', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      )
    }
  ], []);

  const renderActions = (row: ClassSection) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openModal(row); }}>Edit</Button>
      <Button variant="danger" size="sm" onClick={(e) => handleDelete(e, row.id)}>Delete</Button>
    </div>
  );

  return (
    <div className="classes-page">
      <PageHeader
        title="Classes"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Academic' },
          { label: 'Classes' },
        ]}
        actions={
          <Button onClick={() => openModal()}>Add Class</Button>
        }
      />

      <div className="classes-page__filters">
        <SearchBar 
          placeholder="Search classes..."
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <div className="classes-page__filter-row">
          <Select 
            label=""
            value={filterAcademicYear}
            onChange={setFilterAcademicYear}
            options={[
              { value: '', label: 'All Academic Years' },
              ...(yearsResponse?.data?.map(y => ({ value: y.name, label: y.name })) || [])
            ]}
          />
          <Select 
            label=""
            value={filterBatch}
            onChange={setFilterBatch}
            options={[
              { value: '', label: 'All Batches' },
              ...(batchesResponse?.data?.map(b => ({ value: b.name, label: b.name })) || [])
            ]}
          />
          <Select 
            label=""
            value={filterYear}
            onChange={setFilterYear}
            options={[
              { value: '', label: 'All Years' },
              { value: '1', label: 'Year 1' },
              { value: '2', label: 'Year 2' },
              { value: '3', label: 'Year 3' },
              { value: '4', label: 'Year 4' },
            ]}
          />
          <Select 
            label=""
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        keyField="id"
        loading={classesLoading}
        onRowClick={(row) => navigate(`/classes/${row.id}`)}
        actions={renderActions}
        emptyMessage="No classes found matching filters."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingClass ? 'Edit Class' : 'Add Class'}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{formError}</div>}
          
          <Select
            label="Department"
            value={departmentId}
            onChange={setDepartmentId}
            options={deptsResponse?.data?.map(d => ({ value: d.id, label: d.name })) || []}
            required
          />

          <Select
            label="Academic Year"
            value={academicYearId}
            onChange={setAcademicYearId}
            options={yearsResponse?.data?.map(y => ({ value: y.id, label: y.name })) || []}
            required
          />

          <Select
            label="Batch"
            value={batchId}
            onChange={setBatchId}
            options={batchesResponse?.data?.map(b => ({ value: b.id, label: b.name })) || []}
            required
          />

          <Select
            label="Regulation"
            value={regulationId}
            onChange={setRegulationId}
            options={regsResponse?.data?.map(r => ({ value: r.id, label: r.name })) || []}
            required
          />

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <Select
                label="Year"
                value={yearNumber}
                onChange={setYearNumber}
                options={[
                  { value: '1', label: 'I' },
                  { value: '2', label: 'II' },
                  { value: '3', label: 'III' },
                  { value: '4', label: 'IV' },
                ]}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <Select
                label="Section"
                value={section}
                onChange={setSection}
                options={[
                  { value: 'A', label: 'A' },
                  { value: 'B', label: 'B' },
                  { value: 'C', label: 'C' },
                  { value: 'D', label: 'D' },
                ]}
                required
              />
            </div>
          </div>

          <div style={{ padding: '12px', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>Class Name Preview</span>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
              {['I', 'II', 'III', 'IV'][parseInt(yearNumber) - 1] || yearNumber} {deptsResponse?.data?.find(d => d.id === departmentId)?.code || 'DEPT'}-{section}
            </div>
          </div>

          {editingClass && (
            <>
              <Select
                label="Status"
                value={status}
                onChange={(val) => setStatus(val as any)}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' },
                ]}
              />
              <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '8px' }}>Class Counselor</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Counselors are managed in the Class Counselors section.
                </p>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  style={{ marginTop: '8px' }} 
                  onClick={(e) => { e.preventDefault(); window.location.href = '/class-counselors'; }}
                >
                  Manage Counselor
                </Button>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="ghost" onClick={closeModal} type="button">Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {editingClass ? 'Save Changes' : 'Create Class'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
