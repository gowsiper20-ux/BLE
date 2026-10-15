import { useState, useEffect } from 'react';
import Modal from '../Modal';
import Input from '../Input';
import Select from '../Select';
import Button from '../Button';
import { subjectService } from '../../services/subjectService';
import { useApi } from '../../hooks/useApi';
import type { Subject, ApiResponse, Regulation } from '../../types';

interface SubjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  subject?: Subject | null;
}

export default function SubjectFormModal({ isOpen, onClose, onSuccess, subject }: SubjectFormModalProps) {
  const { data: regulationsResponse } = useApi<ApiResponse<Regulation[]>>('/api/regulations');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectType, setSubjectType] = useState('THEORY');
  const [yearNumber, setYearNumber] = useState('');
  const [regulationId, setRegulationId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (subject) {
      setCode(subject.code);
      setName(subject.name);
      setDescription(subject.description || '');
      setSubjectType(subject.subjectType);
      setYearNumber(subject.yearNumber.toString());
      setRegulationId(subject.regulationId);
      setStatus(subject.status);
    } else {
      setCode('');
      setName('');
      setDescription('');
      setSubjectType('THEORY');
      setYearNumber('');
      setRegulationId('');
      setStatus('ACTIVE');
    }
    setError('');
  }, [subject, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!code || !name || !subjectType || !yearNumber || !regulationId) {
      setError('Code, Name, Type, Year, and Regulation are required.');
      return;
    }

    if (parseInt(yearNumber) < 1 || parseInt(yearNumber) > 4) {
      setError('Year must be between 1 and 4.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code,
        name,
        description,
        subjectType,
        yearNumber: parseInt(yearNumber),
        regulationId,
        status,
      };

      if (subject) {
        await subjectService.updateSubject(subject.id, payload);
      } else {
        await subjectService.createSubject(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to save subject.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={subject ? 'Edit Subject' : 'Add Subject'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{error}</div>}
        
        <Input
          label="Subject Code"
          placeholder="e.g. IT2301"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />

        <Input
          label="Subject Name"
          placeholder="e.g. Database Management Systems"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label="Description (Optional)"
          placeholder="Brief description of the subject..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Select
          label="Subject Type"
          value={subjectType}
          onChange={setSubjectType}
          options={[
            { value: 'THEORY', label: 'THEORY' },
            { value: 'LAB', label: 'LAB' },
            { value: 'ELECTIVE', label: 'ELECTIVE' },
            { value: 'PROJECT', label: 'PROJECT' },
            { value: 'SEMINAR', label: 'SEMINAR' },
          ]}
          required
        />

        <Select
          label="Year"
          value={yearNumber}
          onChange={setYearNumber}
          options={[
            { value: '', label: 'Select Year...' },
            { value: '1', label: 'I' },
            { value: '2', label: 'II' },
            { value: '3', label: 'III' },
            { value: '4', label: 'IV' },
          ]}
          required
        />

        <Select
          label="Regulation"
          value={regulationId}
          onChange={setRegulationId}
          options={[
            { value: '', label: 'Select Regulation...' },
            ...(regulationsResponse?.data?.map(r => ({ value: r.id, label: r.name })) || [])
          ]}
          required
        />

        {subject && (
          <Select
            label="Status"
            value={status}
            onChange={(val) => setStatus(val as 'ACTIVE' | 'INACTIVE')}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            {subject ? 'Save Changes' : 'Create Subject'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
