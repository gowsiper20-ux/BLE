import { useState, useEffect } from 'react';
import Modal from '../Modal';
import Input from '../Input';
import Select from '../Select';
import Button from '../Button';
import { staffService } from '../../services/staffService';
import type { Staff } from '../../types';

interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staff?: Staff | null;
}

export default function StaffFormModal({ isOpen, onClose, onSuccess, staff }: StaffFormModalProps) {
  const [staffCode, setStaffCode] = useState('');
  const [name, setName] = useState('');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['STAFF']);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (staff) {
      setStaffCode(staff.staffCode);
      setName(staff.name);
      setCollegeEmail(staff.collegeEmail);
      setStatus(staff.status);
      setSelectedRoles(staff.roles || ['STAFF']);
    } else {
      setStaffCode('');
      setName('');
      setCollegeEmail('');
      setStatus('ACTIVE');
      setSelectedRoles(['STAFF']);
    }
    setError('');
  }, [staff, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!staffCode || !name || !collegeEmail) {
      setError('Staff Code, Name, and College Email are required.');
      return;
    }

    if (!/^[A-Za-z0-9_-]{3,20}$/.test(staffCode.trim())) {
      setError('Staff code must be 3-20 alphanumeric characters (hyphens and underscores allowed).');
      return;
    }

    if (!/^[^@\s]+@sonatech\.ac\.in$/i.test(collegeEmail.trim())) {
      setError('Staff email must belong to the official college domain (@sonatech.ac.in).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        staffCode: staffCode.trim().toUpperCase(),
        name: name.trim(),
        collegeEmail: collegeEmail.trim().toLowerCase(),
        status,
        roles: selectedRoles,
      };

      if (staff) {
        await staffService.updateStaff(staff.id, payload);
      } else {
        await staffService.createStaff(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={staff ? 'Edit Staff' : 'Add Staff'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{error}</div>}
        
        <Input
          label="Staff Code"
          placeholder="e.g. STF001"
          value={staffCode}
          onChange={(e) => setStaffCode(e.target.value)}
          disabled={!!staff} // Cannot edit code
          required
        />

        <Input
          label="Full Name"
          placeholder="e.g. Dr. Kumar"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label="College Email"
          type="email"
          placeholder="e.g. kumar@sonatech.ac.in"
          value={collegeEmail}
          onChange={(e) => setCollegeEmail(e.target.value)}
          required
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Roles</label>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {['ADMIN', 'HOD', 'DEPUTY_HOD', 'CLASS_COUNSELOR', 'STAFF'].map(role => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={selectedRoles.includes(role)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRoles([...selectedRoles, role]);
                    } else {
                      setSelectedRoles(selectedRoles.filter(r => r !== role));
                    }
                  }}
                />
                {role}
              </label>
            ))}
          </div>
        </div>

        {staff && (
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
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            {staff ? 'Save Changes' : 'Create Staff'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
