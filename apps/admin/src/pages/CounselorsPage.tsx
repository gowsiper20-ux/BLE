import { useState, useMemo, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { staffService } from '../services/staffService';
import type { ClassCounselor, TableColumn } from '../types';

import CounselorAssignmentModal from '../components/staff/CounselorAssignmentModal';

export default function CounselorsPage() {
  const { showToast } = useToast();
  
  const [assignments, setAssignments] = useState<ClassCounselor[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignmentToRemove, setAssignmentToRemove] = useState<ClassCounselor | null>(null);
  const [assignmentToToggle, setAssignmentToToggle] = useState<ClassCounselor | null>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await staffService.getCounselorAssignments();
      setAssignments(res);
    } catch (err) {
      showToast('error', 'Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleRemove = async () => {
    if (!assignmentToRemove) return;
    try {
      await staffService.removeCounselor(assignmentToRemove.id);
      showToast('success', 'Assignment removed successfully');
      fetchAssignments();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to remove assignment');
    } finally {
      setAssignmentToRemove(null);
    }
  };

  const handleToggleStatus = async () => {
    if (!assignmentToToggle) return;
    try {
      const newStatus = assignmentToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await staffService.updateCounselorStatus(assignmentToToggle.id, newStatus);
      showToast('success', `Assignment ${newStatus.toLowerCase()} successfully`);
      fetchAssignments();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to update assignment status');
    } finally {
      setAssignmentToToggle(null);
    }
  };

  const columns: TableColumn<ClassCounselor>[] = useMemo(() => [
    { key: 'className', label: 'Class', sortable: true },
    { key: 'academicYearName', label: 'Academic Year', sortable: true },
    { key: 'staffName', label: 'Counselor', sortable: true },
    { key: 'assignedAt', label: 'Assigned Date', render: (val: any) => new Date(val as string).toLocaleDateString() },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      )
    }
  ], []);

  const actions = (row: ClassCounselor) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="sm" onClick={() => setAssignmentToToggle(row)}>
        {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setAssignmentToRemove(row)} style={{ color: 'var(--color-danger)' }}>
        Remove
      </Button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="Class Counselors"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Class Counselors' },
        ]}
        actions={
          <Button icon="add" onClick={() => setIsModalOpen(true)}>
            Assign Counselor
          </Button>
        }
      />

      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={assignments}
          keyField="id"
          actions={actions}
          loading={loading}
          emptyMessage="No counselor assignments found."
        />
      </div>

      <CounselorAssignmentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchAssignments}
      />

      <ConfirmDialog
        isOpen={!!assignmentToRemove}
        title="Remove Assignment?"
        message={`Are you sure you want to remove ${assignmentToRemove?.staffName} as counselor for ${assignmentToRemove?.className}?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={handleRemove}
        onClose={() => setAssignmentToRemove(null)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!assignmentToToggle}
        title={assignmentToToggle?.status === 'ACTIVE' ? 'Deactivate Assignment?' : 'Activate Assignment?'}
        message={`Are you sure you want to change the status of this assignment for ${assignmentToToggle?.className}?`}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={handleToggleStatus}
        onClose={() => setAssignmentToToggle(null)}
        variant="primary"
      />
    </div>
  );
}
