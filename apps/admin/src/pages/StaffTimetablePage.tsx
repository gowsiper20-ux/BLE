import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import Select from '../components/Select';
import { useApi } from '../hooks/useApi';
import { timetableService } from '../services/timetableService';
import TimetableGrid from '../components/timetable/TimetableGrid';
import type { ApiResponse, AcademicYear, Period, TimetableEntry } from '../types';

export default function StaffTimetablePage() {
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: yearsRes } = useApi<ApiResponse<AcademicYear[]>>('/api/academic-years');
  const { data: staffRes } = useApi<ApiResponse<any>>('/api/staff?limit=100');

  useEffect(() => {
    timetableService.getPeriods().then(res => setPeriods(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedYear && selectedStaff) {
      setLoading(true);
      timetableService.getTimetableByStaff(selectedStaff, selectedYear)
        .then(res => setTimetable(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setTimetable([]);
    }
  }, [selectedYear, selectedStaff]);

  const yearOptions = yearsRes?.data?.map(y => ({ value: y.id, label: y.name })) || [];
  const staffOptions = staffRes?.data?.staff?.map((s: any) => ({ value: s.id, label: s.name })) || [];

  return (
    <div className="staff-timetable-page">
      <PageHeader
        title="Staff Timetable"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Staff', path: '/staff' },
          { label: 'Timetable' }
        ]}
      />

      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
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
              label="Staff Member"
              value={selectedStaff}
              onChange={setSelectedStaff}
              options={[{ value: '', label: 'Select Staff...' }, ...staffOptions]}
            />
          </div>
        </div>

        {selectedStaff && selectedYear ? (
          <div style={{ pointerEvents: 'none' /* Readonly view for now */ }}>
             <TimetableGrid 
              timetable={timetable} 
              periods={periods} 
              loading={loading}
              academicYearId={selectedYear}
              classId=""
              onRefresh={() => {}}
            />
          </div>
        ) : (
          <div className="empty-state">
            <p>Please select an Academic Year and a Staff Member to view the timetable.</p>
          </div>
        )}
      </div>
    </div>
  );
}
