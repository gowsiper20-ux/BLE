import { useState, useEffect } from 'react';
import Modal from '../Modal';
import Input from '../Input';
import Select from '../Select';
import Button from '../Button';
import { studentService } from '../../services/studentService';
import { useApi } from '../../hooks/useApi';
import type { Student, ClassSection, ApiResponse } from '../../types';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  student?: Student | null;
}

export default function StudentFormModal({ isOpen, onClose, onSuccess, student }: StudentFormModalProps) {
  const { data: classesResponse } = useApi<ApiResponse<ClassSection[]>>('/api/classes');
  
  const [registerNumber, setRegisterNumber] = useState('');
  const [name, setName] = useState('');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED'>('ACTIVE');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (student) {
      setRegisterNumber(student.registerNumber);
      setName(student.name);
      setCollegeEmail(student.collegeEmail);
      setClassId(student.classId);
      setStatus(student.status);
    } else {
      setRegisterNumber('');
      setName('');
      setCollegeEmail('');
      setClassId(classesResponse?.data?.[0]?.id || '');
      setStatus('ACTIVE');
    }
    setError('');
  }, [student, isOpen, classesResponse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!registerNumber || !name || !collegeEmail || !classId) {
      setError('All fields are required.');
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(collegeEmail)) {
      setError('Invalid college email format.');
      return;
    }

    if (!collegeEmail.toLowerCase().endsWith('@sonatech.ac.in')) {
      setError('College email must belong to @sonatech.ac.in');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        registerNumber,
        name,
        collegeEmail,
        classId,
        status,
      };

      if (student) {
        await studentService.updateStudent(student.id, payload);
      } else {
        await studentService.createStudent(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={student ? 'Edit Student' : 'Add Student'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{error}</div>}
        
        <Input
          label="Register Number"
          placeholder="e.g. 61782324106032"
          value={registerNumber}
          onChange={(e) => setRegisterNumber(e.target.value)}
          disabled={!!student} // Do not normally allow changing register number after creation
          required
        />

        <Input
          label="Full Name"
          placeholder="e.g. Harinarayanan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label="College Email"
          type="email"
          placeholder="e.g. student.24it@college.edu"
          value={collegeEmail}
          onChange={(e) => setCollegeEmail(e.target.value)}
          required
        />

        <Select
          label="Class"
          value={classId}
          onChange={setClassId}
          options={classesResponse?.data?.filter(c => c.status === 'ACTIVE').map(c => ({ value: c.id, label: c.name })) || []}
          required
        />

        {student && (
          <Select
            label="Status"
            value={status}
            onChange={(val) => setStatus(val as any)}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'GRADUATED', label: 'Graduated' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ]}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            {student ? 'Save Changes' : 'Create Student'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
