import { useState, useEffect } from 'react';
import Modal from '../Modal';
import Select from '../Select';
import Button from '../Button';
import { useToast } from '../../hooks/useToast';
import { useApi } from '../../hooks/useApi';
import { timetableService } from '../../services/timetableService';
import type { ApiResponse, TimetableEntry, Period, ClassSubject } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: TimetableEntry | null;
  academicYearId: string;
  classId: string;
  defaultDay?: string;
  defaultPeriodId?: string;
}

const DAYS = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' }
];

export default function TimetableEntryModal({ 
  isOpen, onClose, onSuccess, initialData, academicYearId, classId, defaultDay, defaultPeriodId 
}: Props) {
  const [dayOfWeek, setDayOfWeek] = useState(initialData?.dayOfWeek || defaultDay || 'MONDAY');
  const [periodId, setPeriodId] = useState(initialData?.periodId || defaultPeriodId || '');
  const [subjectId, setSubjectId] = useState(initialData?.subjectId || '');
  const [staffId, setStaffId] = useState(initialData?.staffId || '');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(initialData?.status || 'ACTIVE');
  
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  const { data: periodsRes } = useApi<ApiResponse<Period[]>>('/api/periods');
  const { data: subjectsRes } = useApi<ApiResponse<any>>('/api/subjects?status=ACTIVE&limit=1000');
  // Fetch staff - normally we'd filter by active/role, but simplify for now
  const { data: staffRes } = useApi<ApiResponse<any>>('/api/staff?limit=100');

  useEffect(() => {
    if (isOpen) {
      setDayOfWeek(initialData?.dayOfWeek || defaultDay || 'MONDAY');
      setPeriodId(initialData?.periodId || defaultPeriodId || '');
      setSubjectId(initialData?.subjectId || '');
      setStaffId(initialData?.staffId || '');
      setStatus(initialData?.status || 'ACTIVE');
    }
  }, [isOpen, initialData, defaultDay, defaultPeriodId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodId || !subjectId || !staffId) {
      showToast('warning', 'Please fill all fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        academicYearId,
        classId,
        dayOfWeek,
        periodId,
        subjectId,
        staffId,
        status
      };

      if (initialData) {
        await timetableService.updateTimetableEntry(initialData.id, payload);
        showToast('success', 'Timetable entry updated');
      } else {
        await timetableService.createTimetableEntry(payload);
        showToast('success', 'Timetable entry created');
      }
      onSuccess();
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || 'Failed to save timetable entry';
      showToast('error', `Conflict: ${errMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    setDeleting(true);
    try {
      await timetableService.deleteTimetableEntry(initialData.id);
      showToast('success', 'Timetable entry deleted');
      onSuccess();
    } catch {
      showToast('error', 'Failed to delete entry');
    } finally {
      setDeleting(false);
    }
  };

  const periodOptions = periodsRes?.data?.map(p => ({ value: p.id, label: `${p.name} (${p.startTime.substring(0,5)} - ${p.endTime.substring(0,5)})` })) || [];
  const subjectOptions = subjectsRes?.data?.subjects?.map((s: any) => ({ value: s.id, label: `${s.code} - ${s.name}` })) || [];
  const staffOptions = staffRes?.data?.staff?.map((s: any) => ({ value: s.id, label: s.name })) || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Timetable Entry' : 'Create Timetable Entry'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Select
          label="Day of Week"
          value={dayOfWeek}
          onChange={setDayOfWeek}
          options={DAYS}
          required
        />
        
        <Select
          label="Period"
          value={periodId}
          onChange={setPeriodId}
          options={[{ value: '', label: 'Select Period...' }, ...periodOptions]}
          required
        />

        <Select
          label="Subject"
          value={subjectId}
          onChange={setSubjectId}
          options={[{ value: '', label: 'Select Subject...' }, ...subjectOptions]}
          required
        />

        <Select
          label="Staff"
          value={staffId}
          onChange={setStaffId}
          options={[{ value: '', label: 'Select Staff...' }, ...staffOptions]}
          required
        />


        {initialData && (
          <Select
            label="Status"
            value={status}
            onChange={(val) => setStatus(val as 'ACTIVE' | 'INACTIVE')}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' }
            ]}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          {initialData && (
            <Button variant="danger" onClick={handleDelete} disabled={deleting || submitting} type="button" style={{ marginRight: 'auto' }}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={submitting} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : initialData ? 'Save Changes' : 'Create Entry'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
