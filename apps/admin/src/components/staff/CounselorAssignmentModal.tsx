import { useState, useEffect } from 'react';
import Modal from '../Modal';
import Select from '../Select';
import Button from '../Button';
import { staffService } from '../../services/staffService';
import { useApi } from '../../hooks/useApi';
import type { AcademicYear, ClassSection, Staff, ApiResponse } from '../../types';

interface CounselorAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CounselorAssignmentModal({ isOpen, onClose, onSuccess }: CounselorAssignmentModalProps) {
  const { data: yearsResponse } = useApi<ApiResponse<AcademicYear[]>>('/api/academic-years');
  const { data: classesResponse } = useApi<ApiResponse<ClassSection[]>>('/api/classes');
  
  // We need to fetch all active staff to populate the dropdown. In a real app we might search/autocomplete.
  const [activeStaff, setActiveStaff] = useState<Staff[]>([]);

  useEffect(() => {
    if (isOpen) {
      staffService.getStaff({ status: 'ACTIVE', limit: 1000 }).then(res => setActiveStaff(res.staff)).catch(() => {});
    }
  }, [isOpen]);

  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const currentYear = yearsResponse?.data?.find(y => y.isCurrent);
      setAcademicYearId(currentYear?.id || '');
      setClassId('');
      setStaffId('');
      setStatus('ACTIVE');
      setError('');
    }
  }, [isOpen, yearsResponse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!academicYearId || !classId || !staffId) {
      setError('Academic Year, Class, and Staff are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await staffService.assignCounselor({
        academicYearId,
        classId,
        staffId,
        status,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to assign counselor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Class Counselor"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{error}</div>}
        
        <Select
          label="Academic Year"
          value={academicYearId}
          onChange={setAcademicYearId}
          options={[
            { value: '', label: 'Select Academic Year...' },
            ...(yearsResponse?.data?.map(y => ({ value: y.id, label: y.name })) || [])
          ]}
          required
        />

        <Select
          label="Class"
          value={classId}
          onChange={setClassId}
          options={[
            { value: '', label: 'Select Class...' },
            ...(classesResponse?.data?.filter(c => c.status === 'ACTIVE').map(c => ({ value: c.id, label: c.name })) || [])
          ]}
          required
        />

        <Select
          label="Staff"
          value={staffId}
          onChange={setStaffId}
          options={[
            { value: '', label: 'Select Staff Member...' },
            ...activeStaff.map(s => ({ value: s.id, label: `${s.name} (${s.staffCode})` }))
          ]}
          required
        />

        <Select
          label="Status"
          value={status}
          onChange={(val) => setStatus(val as any)}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            Assign Counselor
          </Button>
        </div>
      </form>
    </Modal>
  );
}
