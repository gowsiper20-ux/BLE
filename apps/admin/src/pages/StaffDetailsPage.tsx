import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import DataTable from '../components/DataTable';
import { useToast } from '../hooks/useToast';
import { staffService } from '../services/staffService';
import type { Staff, ClassCounselor, TableColumn } from '../types';

export default function StaffDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [assignments, setAssignments] = useState<ClassCounselor[]>([]);

  const fetchStaffData = useCallback(async () => {
    if (!id) return;
    try {
      const [staffData, assignmentsData] = await Promise.all([
        staffService.getStaffById(id),
        staffService.getCounselorAssignments({ staffId: id })
      ]);
      setStaff(staffData);
      setAssignments(assignmentsData);
    } catch {
      showToast('error', 'Failed to fetch staff details');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    void Promise.resolve().then(fetchStaffData);
  }, [fetchStaffData]);

  const assignmentColumns: TableColumn<ClassCounselor>[] = [
    { key: 'className', label: 'Class' },
    { key: 'academicYearName', label: 'Academic Year' },
    { key: 'status', label: 'Status', render: (value: unknown) => <Badge variant={value === 'ACTIVE' ? 'success' : 'danger'}>{String(value)}</Badge> },
  ];

  if (loading) {
    return <div>Loading staff details...</div>;
  }

  if (!staff) {
    return <div>Staff member not found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="Staff Details"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Staff', path: '/staff' },
          { label: staff.name },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* Staff Information */}
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="staff" size={20} />
            Staff Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><strong>Staff Code:</strong> {staff.staffCode}</div>
            <div><strong>Name:</strong> {staff.name}</div>
            <div><strong>College Email:</strong> {staff.collegeEmail}</div>
            <div><strong>Microsoft User ID:</strong> {staff.microsoftUserId || 'Not linked'}</div>
            <div>
              <strong>Status:</strong> <Badge variant={staff.status === 'ACTIVE' ? 'success' : 'danger'}>{staff.status}</Badge>
            </div>
            <div><strong>Directory source:</strong> Not verified against Microsoft Entra ID</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="roles" size={20} />
            Existing application roles (unverified)
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(staff.roles || []).map((role) => <Badge key={role} variant="default">{role}</Badge>)}
            {(!staff.roles || staff.roles.length === 0) && <span style={{ color: 'var(--text-secondary)' }}>No roles assigned</span>}
          </div>
        </div>
      </div>

      {/* Counselor Assignments */}
      <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="academic" size={20} />
          Counselor Assignments
        </h3>
        <DataTable
          columns={assignmentColumns}
          data={assignments}
          keyField="id"
          emptyMessage="No counselor assignments for this staff member."
        />
      </div>

    </div>
  );
}
