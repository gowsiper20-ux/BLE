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
  const [periodsError, setPeriodsError] = useState<string | null>(null);
  const [timetableError, setTimetableError] = useState<string | null>(null);
  const { showToast } = useToast();

  const { data: yearsRes, error: yearsError } = useApi<ApiResponse<AcademicYear[]>>('/api/academic-years');
  const { data: classesRes, error: classesError } = useApi<ApiResponse<ClassSection[]>>('/api/classes');

  // Load periods
  useEffect(() => {
    timetableService.getPeriods()
      .then(res => {
        setPeriods(res.data);
        setPeriodsError(null);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to load period times.';
        setPeriodsError(message);
      });
  }, []);

  // Auto-select current academic year and first class
  useEffect(() => {
    if (!selectedYear && yearsRes?.data && yearsRes.data.length > 0) {
      const activeYear = yearsRes.data.find(y => y.isCurrent) || yearsRes.data[0];
      if (activeYear) setSelectedYear(activeYear.id);
    }
  }, [yearsRes, selectedYear]);

  useEffect(() => {
    if (!selectedClass && classesRes?.data && classesRes.data.length > 0) {
      setSelectedClass(classesRes.data[0].id);
    }
  }, [classesRes, selectedClass]);

  // Fetch timetable when class and year selected
  useEffect(() => {
    const fetchTimetable = async () => {
      if (selectedYear && selectedClass) {
        setLoading(true);
        setTimetableError(null);
        try {
          const res = await timetableService.getTimetableByClass(selectedClass, selectedYear);
          setTimetable(res.data);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch timetable.';
          setTimetableError(message);
          showToast('error', message);
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
        {(yearsError || classesError || periodsError) && (
          <div role="alert" style={{ marginBottom: 16 }}>
            {yearsError && <>Academic years could not be loaded. </>}
            {classesError && <>Classes could not be loaded. </>}
            {periodsError && <>Period times could not be loaded: {periodsError}</>}
          </div>
        )}
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
          <>
          {timetableError && <div role="alert">{timetableError}</div>}
          <TimetableGrid 
            timetable={timetable} 
            periods={periods} 
            loading={loading}
            academicYearId={selectedYear}
            classId={selectedClass}
            onRefresh={() => {
              setLoading(true);
              setTimetableError(null);
              timetableService.getTimetableByClass(selectedClass, selectedYear)
                .then(res => setTimetable(res.data))
                .catch((error: unknown) => {
                  const message = error instanceof Error ? error.message : 'Failed to refresh timetable.';
                  setTimetableError(message);
                  showToast('error', message);
                })
                .finally(() => setLoading(false));
            }}
          />
          </>
        ) : (
          <div className="empty-state">
            <p>Please select an Academic Year and a Class to view the timetable.</p>
          </div>
        )}
      </div>
    </div>
  );
}
