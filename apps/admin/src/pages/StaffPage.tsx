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
import { staffService } from '../services/staffService';
import type { Staff, TableColumn } from '../types';

import StaffFormModal from '../components/staff/StaffFormModal';

export default function StaffPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  // States
  const [staff, setStaff] = useState<Staff[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');

  // UI States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  
  // Delete
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await staffService.getStaff({
        search: searchQuery,
        role: filterRole,
        status: filterStatus,
        page,
        limit: 20
      });
      setStaff(res.staff);
      setTotal(res.pagination.total);
    } catch (err) {
      showToast('error', 'Failed to fetch staff');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterRole, filterStatus, page, showToast]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleEdit = (staffRecord: Staff) => {
    setSelectedStaff(staffRecord);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setSelectedStaff(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!staffToDelete) return;
    try {
      await staffService.deleteStaff(staffToDelete.id);
      showToast('success', 'Staff deleted successfully');
      fetchStaff();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to delete staff');
    } finally {
      setStaffToDelete(null);
    }
  };

  const columns: TableColumn<Staff>[] = useMemo(() => [
    { key: 'staffCode', label: 'Staff Code', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'collegeEmail', label: 'College Email', sortable: true },
    {
      key: 'roles',
      label: 'Roles',
      render: (val: any) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(val as string[])?.map(r => (
            <Badge key={r} variant="default">{r}</Badge>
          ))}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      )
    }
  ], []);

  const actions = (row: Staff) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="sm" onClick={() => navigate(`/staff/${row.id}`)}>
        View
      </Button>
      <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
        Edit
      </Button>
      {row.status === 'ACTIVE' && (
        <Button variant="danger" size="sm" onClick={() => setStaffToDelete(row)}>
          Delete
        </Button>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="Staff Management"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Staff' },
        ]}
        actions={
          <Button icon="add" onClick={handleAdd}>
            Add Staff
          </Button>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <SearchBar 
          placeholder="Search by code, name or email..."
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <div style={{ display: 'flex', gap: '16px' }}>
          <Select 
            label=""
            value={filterRole}
            onChange={setFilterRole}
            options={[
              { value: '', label: 'All Roles' },
              { value: 'ADMIN', label: 'ADMIN' },
              { value: 'HOD', label: 'HOD' },
              { value: 'DEPUTY_HOD', label: 'DEPUTY_HOD' },
              { value: 'CLASS_COUNSELOR', label: 'CLASS_COUNSELOR' },
              { value: 'STAFF', label: 'STAFF' }
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
          data={staff}
          keyField="id"
          actions={actions}
          loading={loading}
          emptyMessage="No staff found matching your criteria"
          page={page}
          pageSize={20}
          total={total}
          onPageChange={setPage}
        />
        <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Total Staff: {total}
        </div>
      </div>

      <StaffFormModal 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        staff={selectedStaff}
        onSuccess={fetchStaff}
      />

      <ConfirmDialog
        isOpen={!!staffToDelete}
        title="Delete Staff?"
        message={`Are you sure you want to delete this staff member (${staffToDelete?.name} - ${staffToDelete?.staffCode})? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onClose={() => setStaffToDelete(null)}
        variant="danger"
      />
    </div>
  );
}
