import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import SearchBar from '../components/SearchBar';
import Select from '../components/Select';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { subjectService } from '../services/subjectService';
import { useApi } from '../hooks/useApi';
import type { Subject, TableColumn, Regulation, ApiResponse } from '../types';

import SubjectFormModal from '../components/subjects/SubjectFormModal';

export default function SubjectsPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { data: regulationsResponse } = useApi<ApiResponse<Regulation[]>>('/api/regulations');
  
  // States
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterRegulationId, setFilterRegulationId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [subjectToDeactivate, setSubjectToDeactivate] = useState<Subject | null>(null);
  const [subjectToActivate, setSubjectToActivate] = useState<Subject | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await subjectService.getSubjects({
        search: searchQuery,
        type: filterType,
        year: filterYear ? parseInt(filterYear, 10) : undefined,
        regulationId: filterRegulationId,
        status: filterStatus,
        page,
        limit: 20
      });
      setSubjects(res.subjects);
      setTotal(res.pagination.total);
    } catch {
      showToast('error', 'Failed to fetch subjects');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterType, filterYear, filterRegulationId, filterStatus, page, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSubjects();
  }, [fetchSubjects]);

  const handleEdit = (sub: Subject) => {
    setSelectedSubject(sub);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setSelectedSubject(null);
    setIsFormOpen(true);
  };

  const handleDeactivate = async () => {
    if (!subjectToDeactivate) return;
    try {
      await subjectService.deactivateSubject(subjectToDeactivate.id);
      showToast('success', 'Subject deactivated successfully');
      fetchSubjects();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to deactivate subject');
    } finally {
      setSubjectToDeactivate(null);
    }
  };

  const handleActivate = async () => {
    if (!subjectToActivate) return;
    try {
      await subjectService.activateSubject(subjectToActivate.id);
      showToast('success', 'Subject activated successfully');
      fetchSubjects();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to activate subject');
    } finally {
      setSubjectToActivate(null);
    }
  };

  const handleDelete = async () => {
    if (!subjectToDelete) return;
    try {
      await subjectService.deleteSubject(subjectToDelete.id);
      showToast('success', 'Subject deleted successfully');
      fetchSubjects();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to delete subject');
    } finally {
      setSubjectToDelete(null);
    }
  };

  const columns: TableColumn<Subject>[] = useMemo(() => [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'name', label: 'Subject Name', sortable: true },
    {
      key: 'subjectType',
      label: 'Type',
      render: (val: any) => {
        const typeMap: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
          THEORY: 'default', LAB: 'info', ELECTIVE: 'warning', PROJECT: 'success', SEMINAR: 'default'
        };
        return <Badge variant={typeMap[val] || 'default'}>{val}</Badge>;
      }
    },
    { key: 'yearNumber', label: 'Year', render: (val: any) => ['I', 'II', 'III', 'IV'][val - 1] || val.toString() },
    { key: 'regulationName', label: 'Regulation', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      )
    }
  ], []);

  const actions = (row: Subject) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="sm" onClick={() => navigate(`/subjects/${row.id}`)}>
        View
      </Button>
      <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
        Edit
      </Button>
      {row.status === 'ACTIVE' ? (
        <Button variant="ghost" size="sm" onClick={() => setSubjectToDeactivate(row)} style={{ color: 'var(--color-warning)' }}>
          Deactivate
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setSubjectToActivate(row)} style={{ color: 'var(--color-success)' }}>
          Activate
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => setSubjectToDelete(row)} style={{ color: 'var(--color-danger)' }}>
        Delete
      </Button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="Subjects Management"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Subjects' },
        ]}
        actions={
          <Button icon="add" onClick={handleAdd}>
            Add Subject
          </Button>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <SearchBar 
            placeholder="Search by code or name..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <Select 
            label=""
            value={filterType}
            onChange={setFilterType}
            options={[
              { value: '', label: 'All Types' },
              { value: 'THEORY', label: 'THEORY' },
              { value: 'LAB', label: 'LAB' },
              { value: 'ELECTIVE', label: 'ELECTIVE' },
              { value: 'PROJECT', label: 'PROJECT' },
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
            value={filterRegulationId}
            onChange={setFilterRegulationId}
            options={[
              { value: '', label: 'All Regulations' },
              ...(regulationsResponse?.data?.map(r => ({ value: r.id, label: r.name })) || [])
            ]}
          />
          <Select 
            label=""
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' }
            ]}
          />
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={subjects}
          keyField="id"
          actions={actions}
          loading={loading}
          emptyMessage="No subjects found matching your criteria"
          page={page}
          pageSize={20}
          total={total}
          onPageChange={setPage}
        />
        <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Total Subjects: {total}
        </div>
      </div>

      <SubjectFormModal 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        subject={selectedSubject}
        onSuccess={fetchSubjects}
      />

      <ConfirmDialog
        isOpen={!!subjectToDeactivate}
        title="Deactivate Subject?"
        message={`Deactivating ${subjectToDeactivate?.code} - ${subjectToDeactivate?.name} will prevent it from being assigned to new classes.`}
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        onConfirm={handleDeactivate}
        onClose={() => setSubjectToDeactivate(null)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!subjectToActivate}
        title="Activate Subject?"
        message={`Activating ${subjectToActivate?.code} - ${subjectToActivate?.name} will allow it to be assigned to classes.`}
        confirmLabel="Activate"
        cancelLabel="Cancel"
        onConfirm={handleActivate}
        onClose={() => setSubjectToActivate(null)}
        variant="primary"
      />

      <ConfirmDialog
        isOpen={!!subjectToDelete}
        title="Delete Subject?"
        message={`Are you sure you want to permanently delete ${subjectToDelete?.code} - ${subjectToDelete?.name}? If this subject has linked class mappings or timetables, deletion will be blocked.`}
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onClose={() => setSubjectToDelete(null)}
        variant="danger"
      />
    </div>
  );
}
