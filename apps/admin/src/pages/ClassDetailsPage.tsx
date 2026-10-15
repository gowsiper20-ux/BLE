import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import DataTable from '../components/DataTable';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { useApi } from '../hooks/useApi';
import { classSubjectService } from '../services/classSubjectService';
import { timetableService } from '../services/timetableService';
import type { ClassSection, ClassSubject, TableColumn, ApiResponse, TimetableEntry, Period } from '../types';

import ClassSubjectAssignmentModal from '../components/subjects/ClassSubjectAssignmentModal';

export default function ClassDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const { data: classesResponse, loading: classLoading } = useApi<ApiResponse<ClassSection[]>>('/api/classes');
  
  const [classData, setClassData] = useState<ClassSection | null>(null);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [subjectToRemove, setSubjectToRemove] = useState<ClassSubject | null>(null);

  useEffect(() => {
    if (classesResponse?.data && id) {
      const cls = classesResponse.data.find(c => c.id === id);
      setClassData(cls || null);
    }
  }, [classesResponse, id]);

  const fetchSubjects = useCallback(async () => {
    if (!id) return;
    setLoadingSubjects(true);
    try {
      const data = await classSubjectService.getClassSubjects(id);
      setSubjects(data);
    } catch {
      showToast('error', 'Failed to fetch class subjects');
    } finally {
      setLoadingSubjects(false);
    }
  }, [id, showToast]);

  const fetchTimetable = useCallback(async () => {
    if (!id || !classData?.academicYearId) return;
    setLoadingTimetable(true);
    try {
      const [ttRes, pRes] = await Promise.all([
        timetableService.getTimetableByClass(id, classData.academicYearId),
        timetableService.getPeriods()
      ]);
      setTimetable(ttRes.data);
      setPeriods(pRes.data);
    } catch {
      // ignore
    } finally {
      setLoadingTimetable(false);
    }
  }, [id, classData]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  const handleRemoveSubject = async () => {
    if (!subjectToRemove) return;
    try {
      await classSubjectService.removeSubjectFromClass(subjectToRemove.id);
      showToast('success', 'Subject removed successfully');
      fetchSubjects();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to remove subject');
    } finally {
      setSubjectToRemove(null);
    }
  };

  const subjectColumns: TableColumn<ClassSubject>[] = [
    { key: 'subjectCode', label: 'Code' },
    { key: 'subjectName', label: 'Subject' },
    { 
      key: 'subjectType', 
      label: 'Type',
      render: (val: any) => {
        const typeMap: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
          THEORY: 'default', LAB: 'info', ELECTIVE: 'warning', PROJECT: 'success', SEMINAR: 'default'
        };
        return <Badge variant={typeMap[val] || 'default'}>{val}</Badge>;
      }
    },
    { key: 'yearNumber', label: 'Year', render: (val: any) => ['I', 'II', 'III', 'IV'][val - 1] || val.toString() },
    { key: 'regulationName', label: 'Regulation' },
    { key: 'status', label: 'Status', render: (val: any) => <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge> }
  ];

  const actions = (row: ClassSubject) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="sm" onClick={() => setSubjectToRemove(row)} style={{ color: 'var(--color-danger)' }}>
        Remove
      </Button>
    </div>
  );

  if (classLoading) {
    return <div>Loading class details...</div>;
  }

  if (!classData) {
    return <div>Class not found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="Class Details"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Classes', path: '/classes' },
          { label: classData.name },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="academic" size={20} />
            Class Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><strong>Name:</strong> {classData.name}</div>
            <div><strong>Academic Year:</strong> {classData.academicYear}</div>
            <div><strong>Batch:</strong> {classData.batch}</div>
            <div><strong>Regulation:</strong> {classData.regulation}</div>
            <div>
              <strong>Status:</strong> <Badge variant={classData.status === 'ACTIVE' ? 'success' : 'danger'}>{classData.status}</Badge>
            </div>
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <strong>Total Subjects:</strong> {subjects.length}
            </div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Icon name="subjects" size={20} />
            Subjects
          </h3>
          <Button icon="add" onClick={() => setIsAssignModalOpen(true)}>
            Assign Subject
          </Button>
        </div>
        
        <DataTable
          columns={subjectColumns}
          data={subjects}
          keyField="id"
          actions={actions}
          loading={loadingSubjects}
          emptyMessage="No subjects have been assigned to this class."
        />
      </div>

      <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginBottom: '16px' }}>Weekly Timetable</h3>
        {loadingTimetable ? (
          <div>Loading timetable...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map(day => {
              const dayEntries = timetable.filter(t => t.dayOfWeek === day);
              if (dayEntries.length === 0) return null;
              
              return (
                <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{day.toLowerCase()}:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {periods.map(p => {
                      const entry = dayEntries.find(e => e.periodId === p.id);
                      if (!entry) return null;
                      return (
                        <div key={entry.id} style={{ padding: '8px', backgroundColor: 'var(--surface-color-light)', borderRadius: '4px', borderLeft: '3px solid var(--accent-color)' }}>
                          <div><strong>{p.name}</strong> {entry.subjectName}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{entry.staffName}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {timetable.length === 0 && (
              <div style={{ color: 'var(--text-secondary)' }}>No timetable has been configured for {classData?.name}.</div>
            )}
          </div>
        )}
      </div>

      <ClassSubjectAssignmentModal 
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onSuccess={fetchSubjects}
        classData={classData}
      />

      <ConfirmDialog
        isOpen={!!subjectToRemove}
        title="Remove Subject?"
        message={`Are you sure you want to remove ${subjectToRemove?.subjectName} from ${classData.name}?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={handleRemoveSubject}
        onClose={() => setSubjectToRemove(null)}
        variant="danger"
      />
    </div>
  );
}
