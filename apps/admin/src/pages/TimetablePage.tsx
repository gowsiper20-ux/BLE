import { useState, useEffect } from 'react';
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

  const selectedYearObj = yearsRes?.data?.find(y => y.id === selectedYear);
  const selectedClassObj = classesRes?.data?.find(c => c.id === selectedClass);

  return (
    <div className="timetable-page">
      {/* Sleek, space-efficient header banner */}
      <div className="timetable-page-header">
        <div className="timetable-page-header__left">
          <div className="timetable-breadcrumb">
            <span>Home</span>
            <span>/</span>
            <span>Timetable</span>
            <span>/</span>
            <span className="timetable-breadcrumb--active">Weekly Schedule</span>
          </div>
          <div className="timetable-title-group">
            <h1 className="timetable-page-title">Weekly Timetable</h1>
            {selectedClassObj && (
              <span className="timetable-header-badge timetable-header-badge--class">
                {selectedClassObj.name}
              </span>
            )}
            {selectedYearObj && (
              <span className="timetable-header-badge timetable-header-badge--year">
                {selectedYearObj.name}
              </span>
            )}
          </div>
        </div>

        {/* Compact Filter Selects */}
        <div className="timetable-page-header__filters">
          <div className="timetable-filter-item">
            <span className="timetable-filter-label">Academic Year</span>
            <div className="timetable-select-wrap">
              <Select
                value={selectedYear}
                onChange={setSelectedYear}
                options={[{ value: '', label: 'Select Year...' }, ...yearOptions]}
              />
            </div>
          </div>
          <div className="timetable-filter-item">
            <span className="timetable-filter-label">Class</span>
            <div className="timetable-select-wrap">
              <Select
                value={selectedClass}
                onChange={setSelectedClass}
                options={[{ value: '', label: 'Select Class...' }, ...classOptions]}
              />
            </div>
          </div>
        </div>
      </div>

      {(yearsError || classesError || periodsError || timetableError) && (
        <div className="timetable-alert-box" role="alert">
          {yearsError && <div>Academic years could not be loaded.</div>}
          {classesError && <div>Classes could not be loaded.</div>}
          {periodsError && <div>Period times could not be loaded: {periodsError}</div>}
          {timetableError && <div>{timetableError}</div>}
        </div>
      )}

      {selectedClass && selectedYear ? (
        <TimetableGrid
          timetable={timetable}
          periods={periods}
          loading={loading}
          academicYearId={selectedYear}
          classId={selectedClass}
          classNameText={selectedClassObj?.name}
          academicYearName={selectedYearObj?.name}
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
      ) : (
        <div className="timetable-empty-card">
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <h3>Select Timetable Parameters</h3>
            <p>Please select an Academic Year and a Class above to load the weekly schedule.</p>
          </div>
        </div>
      )}
    </div>
  );
}
