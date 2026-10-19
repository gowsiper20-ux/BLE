import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Select from '../components/Select';
import { useApi } from '../hooks/useApi';
import { timetableService } from '../services/timetableService';
import { useToast } from '../hooks/useToast';
import TimetableGrid from '../components/timetable/TimetableGrid';
import type { ApiResponse, AcademicYear, ClassSection, TimetableEntry, Period } from '../types';
import './TimetablePage.css';

export default function TimetablePage() {
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const { data: yearsRes } = useApi<ApiResponse<AcademicYear[]>>('/api/academic-years');
  const { data: classesRes } = useApi<ApiResponse<ClassSection[]>>('/api/classes');

  // Load periods
  useEffect(() => {
    timetableService.getPeriods().then(res => setPeriods(res.data)).catch(() => {});
  }, []);

  // Fetch timetable when class and year selected
  useEffect(() => {
    const fetchTimetable = async () => {
      if (selectedYear && selectedClass) {
        setLoading(true);
        try {
          const res = await timetableService.getTimetableByClass(selectedClass, selectedYear);
          setTimetable(res.data);
        } catch {
          showToast('error', 'Failed to fetch timetable');
        } finally {
          setLoading(false);
        }
      } else {
        setTimetable([]);
      }
    };
    fetchTimetable();
  }, [selectedYear, selectedClass, showToast]);

  const yearOptions = yearsRes?.data?.map(y => ({ value: y.id, label: y.name })) || [];
  const classOptions = classesRes?.data?.map(c => ({ value: c.id, label: c.name })) || [];

  return (
    <div className="timetable-page">
      <PageHeader
        title="Weekly Timetable"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Timetable' }
        ]}
      />

      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div role="note" style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: 6, background: '#FFF3E0', color: '#7A4B00' }}>
          Stored academic years, classes, period times, and timetable entries are legacy application data. Their provenance has not been verified against an authoritative schedule; do not treat them as current or official.
        </div>
        <div className="timetable-filters" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ flex: 1 }}>
            <Select
              label="Academic Year"
              value={selectedYear}
              onChange={setSelectedYear}
              options={[{ value: '', label: 'Select Year...' }, ...yearOptions]}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Select
              label="Class"
              value={selectedClass}
              onChange={setSelectedClass}
              options={[{ value: '', label: 'Select Class...' }, ...classOptions]}
            />
          </div>
        </div>

        {selectedClass && selectedYear ? (
          <TimetableGrid 
            timetable={timetable} 
            periods={periods} 
            loading={loading}
            academicYearId={selectedYear}
            classId={selectedClass}
            onRefresh={() => {
              timetableService.getTimetableByClass(selectedClass, selectedYear).then(res => setTimetable(res.data));
            }}
          />
        ) : (
          <div className="empty-state">
            <p>Please select an Academic Year and a Class to view the timetable.</p>
          </div>
        )}
      </div>
    </div>
  );
}
