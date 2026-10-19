import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import DataTable from '../components/DataTable';
import { useToast } from '../hooks/useToast';
import { subjectService } from '../services/subjectService';
import { classSubjectService } from '../services/classSubjectService';
import type { Subject, ClassSubject, TableColumn } from '../types';

export default function SubjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [classes, setClasses] = useState<ClassSubject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [subjectData, classData] = await Promise.all([
        subjectService.getSubjectById(id),
        classSubjectService.getAssignedClasses(id)
      ]);
      setSubject(subjectData);
      setClasses(classData);
    } catch {
      showToast('error', 'Failed to fetch subject details');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    const doFetch = async () => {
      await fetchData();
    };
    doFetch();
  }, [fetchData]);

  const classColumns: TableColumn<ClassSubject>[] = [
    { key: 'className', label: 'Class' },
    { key: 'academicYearName', label: 'Academic Year' },
    { key: 'status', label: 'Assignment Status', render: (val: any) => <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge> }
  ];

  if (loading) {
    return <div>Loading subject details...</div>;
  }

  if (!subject) {
    return <div>Subject not found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="Subject Details"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Subjects', path: '/subjects' },
          { label: subject.code },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="academic" size={20} />
            Subject Information
          </h3>
          {subject.dataSource === 'LEGACY_UNVERIFIED' && (
            <div role="note" style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: 6, background: '#FFF3E0', color: '#7A4B00' }}>
              This is a preserved legacy subject record. Its details have not been verified and it cannot be edited, assigned to new classes, or deleted.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><strong>Code:</strong> {subject.code}</div>
            <div><strong>Name:</strong> {subject.name}</div>
            <div><strong>Entry source:</strong> {subject.dataSource === 'MANUALLY_ENTERED' ? 'Manual entry' : 'Legacy — unverified'}</div>
            <div><strong>Description:</strong> {subject.description || 'N/A'}</div>
            <div><strong>Type:</strong> <Badge variant="default">{subject.subjectType}</Badge></div>
            <div><strong>Year Level:</strong> {['I', 'II', 'III', 'IV'][subject.yearNumber - 1] || subject.yearNumber}</div>
            <div><strong>Regulation:</strong> {subject.regulationName}</div>
            <div>
              <strong>Status:</strong> <Badge variant={subject.status === 'ACTIVE' ? 'success' : 'danger'}>{subject.status}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="staff" size={20} />
          Assigned Classes
        </h3>
        <DataTable
          columns={classColumns}
          data={classes}
          keyField="id"
          emptyMessage="This subject is not assigned to any classes."
        />
      </div>
    </div>
  );
}
