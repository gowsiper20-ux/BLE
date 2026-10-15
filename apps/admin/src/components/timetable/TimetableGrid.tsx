import { useState } from 'react';
import type { TimetableEntry, Period } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import TimetableEntryModal from './TimetableEntryModal';
import './TimetableGrid.css';

interface Props {
  timetable: TimetableEntry[];
  periods: Period[];
  loading: boolean;
  academicYearId: string;
  classId: string;
  onRefresh: () => void;
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export default function TimetableGrid({ timetable, periods, loading, academicYearId, classId, onRefresh }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ day: string; periodId: string } | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);

  if (loading) return <LoadingSpinner />;

  const handleCellClick = (day: string, periodId: string) => {
    const entry = timetable.find(e => e.dayOfWeek === day && e.periodId === periodId);
    if (entry) {
      setEditingEntry(entry);
    } else {
      setSelectedCell({ day, periodId });
      setEditingEntry(null);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedCell(null);
    setEditingEntry(null);
  };

  return (
    <>
      <div className="timetable-grid-wrapper">
        <table className="timetable-table">
          <thead>
            <tr>
              <th>Period</th>
              {DAYS.map(day => (
                <th key={day}>{day.substring(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(period => (
              <tr key={period.id}>
                <td>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{period.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {period.startTime.substring(0,5)} - {period.endTime.substring(0,5)}
                    </div>
                  </div>
                </td>
                {DAYS.map(day => {
                  const entry = timetable.find(e => e.dayOfWeek === day && e.periodId === period.id);
                  return (
                    <td key={`${period.id}-${day}`}>
                      <div className="timetable-cell" onClick={() => handleCellClick(day, period.id)}>
                        {entry ? (
                          <div className={`timetable-entry ${entry.status === 'INACTIVE' ? 'inactive' : ''}`}>
                            <div className="subject-name" title={`${entry.subjectCode || ''} ${entry.subjectName || ''}`}>
                              {entry.subjectCode ? `${entry.subjectCode} - ` : ''}{entry.subjectName}
                            </div>
                            <div className="staff-name" title={entry.staffName}>{entry.staffName}</div>
                          </div>
                        ) : (
                          <div className="empty-cell-indicator">+</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (selectedCell || editingEntry) && (
        <TimetableEntryModal
          isOpen={modalOpen}
          onClose={closeModal}
          onSuccess={() => {
            closeModal();
            onRefresh();
          }}
          initialData={editingEntry}
          academicYearId={academicYearId}
          classId={classId}
          defaultDay={selectedCell?.day}
          defaultPeriodId={selectedCell?.periodId}
        />
      )}
    </>
  );
}
