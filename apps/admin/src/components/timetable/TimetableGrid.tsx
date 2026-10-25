import { useState, useMemo } from 'react';
import type { TimetableEntry, Period } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import TimetableEntryModal from './TimetableEntryModal';
import Icon from '../Icon';
import './TimetableGrid.css';

interface Props {
  timetable: TimetableEntry[];
  periods: Period[];
  loading: boolean;
  academicYearId: string;
  classId: string;
  classNameText?: string;
  academicYearName?: string;
  onRefresh: () => void;
  readOnly?: boolean;
}

const DAYS = [
  { key: 'MONDAY', short: 'MON', label: 'Monday' },
  { key: 'TUESDAY', short: 'TUE', label: 'Tuesday' },
  { key: 'WEDNESDAY', short: 'WED', label: 'Wednesday' },
  { key: 'THURSDAY', short: 'THU', label: 'Thursday' },
  { key: 'FRIDAY', short: 'FRI', label: 'Friday' },
  { key: 'SATURDAY', short: 'SAT', label: 'Saturday' },
];

const DAY_INDEX_MAP = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// Distinct, high-contrast academic palettes for subjects
interface SubjectTheme {
  bg: string;
  border: string;
  accent: string;
  text: string;
  badgeBg: string;
  badgeText: string;
}

const SUBJECT_THEMES: SubjectTheme[] = [
  { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', text: '#1e3a8a', badgeBg: '#dbeafe', badgeText: '#1e40af' }, // Blue
  { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a', text: '#14532d', badgeBg: '#dcfce7', badgeText: '#166534' }, // Emerald
  { bg: '#f5f3ff', border: '#ddd6fe', accent: '#7c3aed', text: '#4c1d95', badgeBg: '#ede9fe', badgeText: '#5b21b6' }, // Purple
  { bg: '#fffbeb', border: '#fde68a', accent: '#d97706', text: '#78350f', badgeBg: '#fef3c7', badgeText: '#92400e' }, // Amber
  { bg: '#ecfeff', border: '#a5f3fc', accent: '#0891b2', text: '#164e63', badgeBg: '#cffafe', badgeText: '#155e75' }, // Teal
  { bg: '#fff1f2', border: '#fecdd3', accent: '#e11d48', text: '#881337', badgeBg: '#ffe4e6', badgeText: '#9f1239' }, // Rose
  { bg: '#f8fafc', border: '#cbd5e1', accent: '#475569', text: '#0f172a', badgeBg: '#e2e8f0', badgeText: '#334155' }, // Slate
  { bg: '#fdf4ff', border: '#f5d0fe', accent: '#c026d3', text: '#701a75', badgeBg: '#fae8ff', badgeText: '#86198f' }, // Fuchsia
];

function getSubjectTheme(code?: string, name?: string): SubjectTheme {
  const key = (code || name || 'GENERAL').toUpperCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SUBJECT_THEMES.length;
  return SUBJECT_THEMES[index];
}

function isLabSubject(code?: string, name?: string): boolean {
  const text = `${code || ''} ${name || ''}`.toLowerCase();
  return text.includes('lab') || text.includes('laboratory') || text.includes('practical');
}

function getBreakBetween(prevPeriod: Period, nextPeriod: Period): { label: string; time: string; icon: string } | null {
  if (!prevPeriod?.endTime || !nextPeriod?.startTime) return null;
  const [prevH, prevM] = prevPeriod.endTime.split(':').map(Number);
  const [nextH, nextM] = nextPeriod.startTime.split(':').map(Number);
  const prevMin = prevH * 60 + prevM;
  const nextMin = nextH * 60 + nextM;
  const gap = nextMin - prevMin;

  if (gap >= 35) {
    return {
      label: 'Lunch Break',
      time: `${prevPeriod.endTime.substring(0, 5)} - ${nextPeriod.startTime.substring(0, 5)}`,
      icon: '🍽️'
    };
  } else if (gap >= 10) {
    return {
      label: 'Tea Break',
      time: `${prevPeriod.endTime.substring(0, 5)} - ${nextPeriod.startTime.substring(0, 5)}`,
      icon: '☕'
    };
  }
  return null;
}

export default function TimetableGrid({
  timetable,
  periods,
  loading,
  academicYearId,
  classId,
  classNameText,
  academicYearName,
  onRefresh,
  readOnly = false
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ day: string; periodId: string } | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [viewOrientation, setViewOrientation] = useState<'columns' | 'rows'>('columns');
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBreaks, setShowBreaks] = useState(true);

  const todayKey = useMemo(() => DAY_INDEX_MAP[new Date().getDay()], []);

  // Sorted periods by periodNumber or time
  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => {
      if (a.periodNumber !== undefined && b.periodNumber !== undefined) {
        return a.periodNumber - b.periodNumber;
      }
      return a.startTime.localeCompare(b.startTime);
    });
  }, [periods]);

  // Statistics for summary badges
  const stats = useMemo(() => {
    const scheduled = timetable.length;
    const totalSlots = DAYS.length * sortedPeriods.length;
    const labCount = timetable.filter(e => isLabSubject(e.subjectCode, e.subjectName)).length;
    const theoryCount = scheduled - labCount;
    const uniqueSubjects = new Set(timetable.map(e => e.subjectId || e.subjectCode)).size;

    return {
      scheduled,
      totalSlots,
      labCount,
      theoryCount,
      uniqueSubjects,
    };
  }, [timetable, sortedPeriods]);

  if (loading) return <LoadingSpinner />;

  const handleCellClick = (day: string, periodId: string) => {
    if (readOnly) return;
    const entry = timetable.find(e => e.dayOfWeek === day && e.periodId === periodId);
    if (entry) {
      setEditingEntry(entry);
      setSelectedCell(null);
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

  const handlePrint = () => {
    window.print();
  };

  const checkMatch = (entry?: TimetableEntry): boolean => {
    if (!searchQuery.trim() || !entry) return true;
    const q = searchQuery.toLowerCase();
    return (
      (entry.subjectCode?.toLowerCase().includes(q) ?? false) ||
      (entry.subjectName?.toLowerCase().includes(q) ?? false) ||
      (entry.staffName?.toLowerCase().includes(q) ?? false)
    );
  };

  return (
    <div className={`timetable-container timetable-container--${density}`}>
      {/* Print-Only Header */}
      <div className="timetable-print-header">
        <h1 className="timetable-print-college">SONA COLLEGE OF TECHNOLOGY (Autonomous)</h1>
        <h2 className="timetable-print-dept">DEPARTMENT OF INFORMATION TECHNOLOGY</h2>
        <div className="timetable-print-meta">
          {classNameText && <span className="timetable-print-chip"><strong>Class:</strong> {classNameText}</span>}
          {academicYearName && <span className="timetable-print-chip"><strong>Academic Year:</strong> {academicYearName}</span>}
          <span className="timetable-print-chip"><strong>Generated:</strong> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Screen Interactive Command Toolbar */}
      <div className="timetable-toolbar">
        {/* Left Side: Summary Badges */}
        <div className="timetable-toolbar__stats">
          <div className="timetable-stat-pill timetable-stat-pill--primary" title="Total Periods Scheduled">
            <span className="timetable-stat-icon">📅</span>
            <span className="timetable-stat-val">{stats.scheduled}</span>
            <span className="timetable-stat-lbl">/ {stats.totalSlots} Slots</span>
          </div>
          <div className="timetable-stat-pill" title="Distinct Subjects">
            <span className="timetable-stat-icon">📖</span>
            <span className="timetable-stat-val">{stats.uniqueSubjects}</span>
            <span className="timetable-stat-lbl">Subjects</span>
          </div>
          <div className="timetable-stat-pill timetable-stat-pill--lab" title="Laboratory Practical Sessions">
            <span className="timetable-stat-icon">🔬</span>
            <span className="timetable-stat-val">{stats.labCount}</span>
            <span className="timetable-stat-lbl">Labs</span>
          </div>
        </div>

        {/* Center: Search / Faculty Filter */}
        <div className="timetable-toolbar__search">
          <Icon name="search" size={14} className="timetable-search-icon" />
          <input
            type="text"
            className="timetable-search-input"
            placeholder="Highlight Subject or Faculty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="timetable-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear highlight"
            >
              ×
            </button>
          )}
        </div>

        {/* Right Side: View Controls */}
        <div className="timetable-toolbar__actions">
          {/* Orientation Toggle */}
          <div className="timetable-btn-group" role="group" aria-label="Layout orientation">
            <button
              type="button"
              className={`timetable-btn-toggle ${viewOrientation === 'columns' ? 'timetable-btn-toggle--active' : ''}`}
              onClick={() => setViewOrientation('columns')}
              title="Days as Columns (Standard College View)"
            >
              Days Top
            </button>
            <button
              type="button"
              className={`timetable-btn-toggle ${viewOrientation === 'rows' ? 'timetable-btn-toggle--active' : ''}`}
              onClick={() => setViewOrientation('rows')}
              title="Days as Rows (Horizontal Schedule View)"
            >
              Days Left
            </button>
          </div>

          {/* Density Toggle */}
          <div className="timetable-btn-group" role="group" aria-label="Density selector">
            <button
              type="button"
              className={`timetable-btn-toggle ${density === 'compact' ? 'timetable-btn-toggle--active' : ''}`}
              onClick={() => setDensity('compact')}
              title="Fit to Page view"
            >
              Fit Page
            </button>
            <button
              type="button"
              className={`timetable-btn-toggle ${density === 'comfortable' ? 'timetable-btn-toggle--active' : ''}`}
              onClick={() => setDensity('comfortable')}
              title="Comfortable card view"
            >
              Comfortable
            </button>
          </div>

          {/* Break Dividers Toggle */}
          <button
            type="button"
            className={`timetable-icon-btn ${showBreaks ? 'timetable-icon-btn--active' : ''}`}
            onClick={() => setShowBreaks(b => !b)}
            title={showBreaks ? "Hide Break Bars" : "Show Break Bars"}
          >
            ☕
          </button>

          {/* Print Button */}
          <button
            type="button"
            className="timetable-icon-btn timetable-print-btn"
            onClick={handlePrint}
            title="Print Single-Page Timetable (A4 Landscape)"
          >
            <Icon name="download" size={15} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Grid Table Container */}
      <div className="timetable-grid-wrapper">
        {viewOrientation === 'columns' ? (
          /* ========================================================
             ORIENTATION A: DAYS AS COLUMNS (MON, TUE, WED, THU, FRI, SAT)
             ======================================================== */
          <table className="timetable-table timetable-table--fixed">
            <thead>
              <tr>
                <th className="timetable-th timetable-th--period">Period</th>
                {DAYS.map(day => {
                  const isToday = day.key === todayKey;
                  return (
                    <th
                      key={day.key}
                      className={`timetable-th timetable-th--day ${isToday ? 'timetable-th--today' : ''}`}
                    >
                      <div className="timetable-th-day-box">
                        <span className="timetable-day-short">{day.short}</span>
                        <span className="timetable-day-full">{day.label}</span>
                        {isToday && <span className="timetable-badge-today">TODAY</span>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedPeriods.map((period, pIdx) => {
                const prevPeriod = pIdx > 0 ? sortedPeriods[pIdx - 1] : null;
                const breakInfo = prevPeriod ? getBreakBetween(prevPeriod, period) : null;

                return (
                  <tr key={period.id} className="timetable-tr">
                    {/* Optional Break Row Before This Period */}
                    {showBreaks && breakInfo && (
                      <tr key={`break-${period.id}`} className="timetable-break-tr">
                        <td colSpan={7} className="timetable-break-td">
                          <div className="timetable-break-banner">
                            <span className="timetable-break-icon">{breakInfo.icon}</span>
                            <span className="timetable-break-title">{breakInfo.label}</span>
                            <span className="timetable-break-times">({breakInfo.time})</span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Period Row */}
                    <td className="timetable-td timetable-td--period">
                      <div className="timetable-period-pill">
                        <span className="timetable-period-name">{period.name}</span>
                        <span className="timetable-period-time">
                          {period.startTime.substring(0, 5)} - {period.endTime.substring(0, 5)}
                        </span>
                      </div>
                    </td>

                    {DAYS.map(day => {
                      const entry = timetable.find(e => e.dayOfWeek === day.key && e.periodId === period.id);
                      const isToday = day.key === todayKey;
                      const isMatch = checkMatch(entry);
                      const isDimmed = Boolean(searchQuery.trim() && !isMatch);
                      const isLab = entry ? isLabSubject(entry.subjectCode, entry.subjectName) : false;
                      const theme = entry ? getSubjectTheme(entry.subjectCode, entry.subjectName) : null;

                      return (
                        <td
                          key={`${period.id}-${day.key}`}
                          className={`timetable-td timetable-td--slot ${isToday ? 'timetable-td--today' : ''} ${isDimmed ? 'timetable-td--dimmed' : ''}`}
                        >
                          <div
                            className={`timetable-cell ${entry ? 'timetable-cell--filled' : 'timetable-cell--empty'} ${readOnly ? 'timetable-cell--readonly' : ''}`}
                            onClick={() => handleCellClick(day.key, period.id)}
                            title={
                              entry
                                ? `${entry.subjectCode || ''} - ${entry.subjectName || ''}\nFaculty: ${entry.staffName || 'Unassigned'}\nTiming: ${period.startTime.substring(0, 5)} - ${period.endTime.substring(0, 5)} (${period.name})\nDay: ${day.label}${readOnly ? '' : '\nClick to edit slot'}`
                                : `${day.label} · ${period.name} (${period.startTime.substring(0, 5)} - ${period.endTime.substring(0, 5)})\nEmpty Slot${readOnly ? '' : ' — Click to assign class'}`
                            }
                          >
                            {entry && theme ? (
                              <div
                                className="timetable-card"
                                style={{
                                  backgroundColor: theme.bg,
                                  borderColor: theme.border,
                                  borderLeftColor: theme.accent,
                                }}
                              >
                                <div className="timetable-card__header">
                                  <span
                                    className="timetable-badge-code"
                                    style={{
                                      backgroundColor: theme.badgeBg,
                                      color: theme.badgeText,
                                    }}
                                  >
                                    {entry.subjectCode || 'SUB'}
                                  </span>
                                  {isLab && <span className="timetable-badge-lab">LAB</span>}
                                  {entry.status === 'INACTIVE' && (
                                    <span className="timetable-badge-inactive">INACTIVE</span>
                                  )}
                                </div>

                                <div className="timetable-card__title" style={{ color: theme.text }}>
                                  {entry.subjectName}
                                </div>

                                <div className="timetable-card__footer">
                                  <span className="timetable-faculty-dot" style={{ backgroundColor: theme.accent }} />
                                  <span className="timetable-card__faculty">{entry.staffName}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="timetable-empty-slot">
                                {!readOnly && <span className="timetable-empty-plus">+</span>}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* ========================================================
             ORIENTATION B: DAYS AS ROWS (MON TO SAT ON LEFT, PERIODS ON TOP)
             ======================================================== */
          <table className="timetable-table timetable-table--fixed">
            <thead>
              <tr>
                <th className="timetable-th timetable-th--day-col">Day</th>
                {sortedPeriods.map(period => (
                  <th key={period.id} className="timetable-th timetable-th--period-col">
                    <div className="timetable-th-period-box">
                      <span className="timetable-period-name">{period.name}</span>
                      <span className="timetable-period-time">
                        {period.startTime.substring(0, 5)} - {period.endTime.substring(0, 5)}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => {
                const isToday = day.key === todayKey;
                return (
                  <tr key={day.key} className={`timetable-tr ${isToday ? 'timetable-tr--today' : ''}`}>
                    <td className={`timetable-td timetable-td--day-label ${isToday ? 'timetable-td--today-label' : ''}`}>
                      <div className="timetable-day-row-pill">
                        <span className="timetable-day-short">{day.short}</span>
                        <span className="timetable-day-full">{day.label}</span>
                        {isToday && <span className="timetable-badge-today">TODAY</span>}
                      </div>
                    </td>

                    {sortedPeriods.map(period => {
                      const entry = timetable.find(e => e.dayOfWeek === day.key && e.periodId === period.id);
                      const isMatch = checkMatch(entry);
                      const isDimmed = Boolean(searchQuery.trim() && !isMatch);
                      const isLab = entry ? isLabSubject(entry.subjectCode, entry.subjectName) : false;
                      const theme = entry ? getSubjectTheme(entry.subjectCode, entry.subjectName) : null;

                      return (
                        <td
                          key={`${day.key}-${period.id}`}
                          className={`timetable-td timetable-td--slot ${isDimmed ? 'timetable-td--dimmed' : ''}`}
                        >
                          <div
                            className={`timetable-cell ${entry ? 'timetable-cell--filled' : 'timetable-cell--empty'} ${readOnly ? 'timetable-cell--readonly' : ''}`}
                            onClick={() => handleCellClick(day.key, period.id)}
                            title={
                              entry
                                ? `${entry.subjectCode || ''} - ${entry.subjectName || ''}\nFaculty: ${entry.staffName || 'Unassigned'}\nTiming: ${period.startTime.substring(0, 5)} - ${period.endTime.substring(0, 5)} (${period.name})\nDay: ${day.label}${readOnly ? '' : '\nClick to edit slot'}`
                                : `${day.label} · ${period.name} (${period.startTime.substring(0, 5)} - ${period.endTime.substring(0, 5)})\nEmpty Slot${readOnly ? '' : ' — Click to assign class'}`
                            }
                          >
                            {entry && theme ? (
                              <div
                                className="timetable-card"
                                style={{
                                  backgroundColor: theme.bg,
                                  borderColor: theme.border,
                                  borderLeftColor: theme.accent,
                                }}
                              >
                                <div className="timetable-card__header">
                                  <span
                                    className="timetable-badge-code"
                                    style={{
                                      backgroundColor: theme.badgeBg,
                                      color: theme.badgeText,
                                    }}
                                  >
                                    {entry.subjectCode || 'SUB'}
                                  </span>
                                  {isLab && <span className="timetable-badge-lab">LAB</span>}
                                  {entry.status === 'INACTIVE' && (
                                    <span className="timetable-badge-inactive">INACTIVE</span>
                                  )}
                                </div>

                                <div className="timetable-card__title" style={{ color: theme.text }}>
                                  {entry.subjectName}
                                </div>

                                <div className="timetable-card__footer">
                                  <span className="timetable-faculty-dot" style={{ backgroundColor: theme.accent }} />
                                  <span className="timetable-card__faculty">{entry.staffName}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="timetable-empty-slot">
                                {!readOnly && <span className="timetable-empty-plus">+</span>}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Entry Modal for Create / Edit */}
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
    </div>
  );
}
