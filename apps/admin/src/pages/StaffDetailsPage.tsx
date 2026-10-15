import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Select from '../components/Select';
import Icon from '../components/Icon';
import DataTable from '../components/DataTable';
import { useToast } from '../hooks/useToast';
import { staffService } from '../services/staffService';
import type { Staff, Role, StaffRole, ClassCounselor, TableColumn } from '../types';

export default function StaffDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);
  const [assignments, setAssignments] = useState<ClassCounselor[]>([]);
  
  const [selectedRole, setSelectedRole] = useState('');
  const [isAssigningRole, setIsAssigningRole] = useState(false);

  const fetchStaffData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [staffData, rolesData, staffRolesData, assignmentsData] = await Promise.all([
        staffService.getStaffById(id),
        staffService.getRoles(),
        staffService.getStaffRoles(id),
        staffService.getCounselorAssignments({ staffId: id })
      ]);
      setStaff(staffData);
      setAllRoles(rolesData);
      setStaffRoles(staffRolesData);
      setAssignments(assignmentsData);
    } catch (err) {
      showToast('error', 'Failed to fetch staff details');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  const handleAssignRole = async () => {
    if (!id || !selectedRole) return;
    setIsAssigningRole(true);
    try {
      await staffService.assignRole(id, selectedRole);
      showToast('success', 'Role assigned successfully');
      setSelectedRole('');
      fetchStaffData();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to assign role');
    } finally {
      setIsAssigningRole(false);
    }
  };

  const handleRemoveRole = async (roleName: string) => {
    if (!id) return;
    if (staffRoles.length === 1 && staffRoles[0].roleName === 'STAFF') {
        showToast('error', 'Cannot remove the primary STAFF role.');
        return;
    }
    try {
      await staffService.removeRole(id, roleName);
      showToast('success', 'Role removed successfully');
      fetchStaffData();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to remove role');
    }
  };

  const assignmentColumns: TableColumn<ClassCounselor>[] = [
    { key: 'className', label: 'Class' },
    { key: 'academicYearName', label: 'Academic Year' },
    { key: 'status', label: 'Status', render: (val: any) => <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge> },
  ];

  if (loading) {
    return <div>Loading staff details...</div>;
  }

  if (!staff) {
    return <div>Staff member not found.</div>;
  }

  const unassignedRoles = allRoles.filter(r => !staffRoles.some(sr => sr.roleId === r.id));

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
          </div>
        </div>

        {/* Roles */}
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="roles" size={20} />
            Roles
          </h3>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {staffRoles.map(role => (
              <div key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '16px', fontSize: '14px' }}>
                <span style={{ fontWeight: 600 }}>{role.roleName}</span>
                <button 
                    onClick={() => handleRemoveRole(role.roleName)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                    title="Remove Role"
                >
                    <Icon name="close" size={14} />
                </button>
              </div>
            ))}
            {staffRoles.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>No roles assigned</span>}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Select
                label="Add Role"
                value={selectedRole}
                onChange={setSelectedRole}
                options={[
                  { value: '', label: 'Select a role...' },
                  ...unassignedRoles.map(r => ({ value: r.name, label: r.name }))
                ]}
              />
            </div>
            <Button onClick={handleAssignRole} disabled={!selectedRole || isAssigningRole} loading={isAssigningRole}>
              Assign
            </Button>
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
