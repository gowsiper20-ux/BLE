import { useState, useEffect } from 'react';
import Modal from '../Modal';
import Select from '../Select';
import Button from '../Button';
import { classSubjectService } from '../../services/classSubjectService';
import { subjectService } from '../../services/subjectService';
import type { Subject, ClassSection } from '../../types';

interface ClassSubjectAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classData: ClassSection;
}

export default function ClassSubjectAssignmentModal({ isOpen, onClose, onSuccess, classData }: ClassSubjectAssignmentModalProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Fetch subjects matching the class's year and regulation, and are active
      subjectService.getSubjects({ 
        year: classData.yearNumber, 
        regulationId: classData.regulationId,
        status: 'ACTIVE',
        limit: 1000 
      })
      .then(res => setSubjects(res.subjects))
      .catch(() => {});
    }
  }, [isOpen, classData]);

  useEffect(() => {
    if (isOpen) {
      setSubjectId('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!subjectId) {
      setError('Subject is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await classSubjectService.assignSubjectToClass({
        classId: classData.id,
        subjectId,
        academicYearId: classData.academicYearId || '',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to assign subject.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Subject to Class"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{error}</div>}
        
        <Select
          label="Subject"
          value={subjectId}
          onChange={setSubjectId}
          options={subjects.map(s => ({ value: s.id, label: `${s.code} - ${s.name} (${s.subjectType})` }))}
          required
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            Assign Subject
          </Button>
        </div>
      </form>
    </Modal>
  );
}
