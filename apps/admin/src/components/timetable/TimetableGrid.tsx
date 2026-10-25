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

export interface SubjectTheme {
  bg: string;
  border: string;
  accent: string;
  text: string;
  badgeBg: string;
  badgeText: string;
}

export function isLabSubject(code?: string, name?: string): boolean {
  const text = `${code || ''} ${name || ''}`.toLowerCase();
  return text.includes('lab') || text.includes('laboratory') || text.includes('practical');
}

/**
 * Dignified, institutional palette for Sona College of Technology:
 * Clean white cards with crisp slate borders, deep readable typography, and refined accent strips.
 */
const LAB_THEME: SubjectTheme = {
  bg: '#f0fdf4',
  border: '#bbf7d0',
  accent: '#15803d',
  text: '#0f172a',
  badgeBg: '#dcfce7',
  badgeText: '#15803d',
};

const THEORY_THEMES: SubjectTheme[] = [
  { bg: '#ffffff', border: '#e2e8f0', accent: '#005696', text: '#0f172a', badgeBg: '#eff6ff', badgeText: '#005696' }, // Sona Royal Blue
  { bg: '#ffffff', border: '#e2e8f0', accent: '#334155', text: '#0f172a', badgeBg: '#f1f5f9', badgeText: '#334155' }, // Slate Navy
  { bg: '#ffffff', border: '#e2e8f0', accent: '#4338ca', text: '#0f172a', badgeBg: '#eef2ff', badgeText: '#4338ca' }, // Academic Indigo
  { bg: '#ffffff', border: '#e2e8f0', accent: '#0284c7', text: '#0f172a', badgeBg: '#f0f9ff', badgeText: '#0284c7' }, // Steel Blue
  { bg: '#ffffff', border: '#e2e8f0', accent: '#0d9488', text: '#0f172a', badgeBg: '#f0fdfa', badgeText: '#0f766e' }, // Muted Teal
  { bg: '#ffffff', border: '#e2e8f0', accent: '#b45309', text: '#0f172a', badgeBg: '#fffbeb', badgeText: '#b45309' }, // Muted Amber
];

export function getSubjectTheme(code?: string, name?: string): SubjectTheme {
  if (isLabSubject(code, name)) {
    return LAB_THEME;
  }
  const key = (code || name || 'GENERAL').toUpperCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % THEORY_THEMES.length;
  return THEORY_THEMES[index];
}

interface HoveredSlot {
  entry: TimetableEntry;
  dayLabel: string;
  period: Period;
  theme: SubjectTheme;
  isLab: boolean;
  top: number;
  left: number;
  placement: 'top' | 'bottom';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [hovered, setHovered] = useState<HoveredSlot | null>(null);

  const todayKey = useMemo(() => DAY_INDEX_MAP[new Date().getDay()], []);

  // Filter out any non-academic test periods and sort by periodNumber / startTime
  const sortedPeriods = useMemo(() => {
    return [...periods]
      .filter(p => !p.name.includes('ATT-') && p.startTime !== '00:00:00' && p.endTime !== '23:59:00')
      .sort((a, b) => {
        if (a.periodNumber !== undefined && b.periodNumber !== undefined) {
          return a.periodNumber - b.periodNumber;
        }
        return a.startTime.localeCompare(b.startTime);
      });
  }, [periods]);

  // Statistics
  const stats = useMemo(() => {
    const scheduled = timetable.length;
    const totalSlots = DAYS.length * sortedPeriods.length;
    const labCount = timetable.filter(e => isLabSubject(e.subjectCode, e.subjectName)).length;
    const uniqueSubjects = new Set(timetable.map(e => e.subjectId || e.subjectCode)).size;

    return {
      scheduled,
      totalSlots,
      labCount,
      uniqueSubjects,
    };
  }, [timetable, sortedPeriods]);

  if (loading) return <LoadingSpinner />;

  const handleCellClick = (day: string, periodId: string) => {
    if (readOnly) return;
    setHovered(null);
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
    setHovered(null);
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

  const handleSlotMouseEnter = (
    entry: TimetableEntry,
    day: { label: string },
    period: Period,
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: 'top' | 'bottom' = spaceBelow < 230 ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top : rect.bottom;
    const left = Math.min(Math.max(rect.left + rect.width / 2, 170), window.innerWidth - 170);

    setHovered({
      entry,
      dayLabel: day.label,
      period,
      theme: getSubjectTheme(entry.subjectCode, entry.subjectName),
      isLab: isLabSubject(entry.subjectCode, entry.subjectName),
      top,
      left,
      placement,
    });
  };

  const handleSlotMouseLeave = () => {
    setHovered(null);
  };

  return (
    <div className="timetable-container">
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
            <Icon name="timetable" size={13} className="timetable-stat-icon" />
            <span className="timetable-stat-val">{stats.scheduled}</span>
            <span className="timetable-stat-lbl">/ {stats.totalSlots} Slots</span>
          </div>
          <div className="timetable-stat-pill" title="Distinct Subjects">
            <Icon name="subjects" size={13} className="timetable-stat-icon" />
            <span className="timetable-stat-val">{stats.uniqueSubjects}</span>
            <span className="timetable-stat-lbl">Subjects</span>
          </div>
          <div className="timetable-stat-pill timetable-stat-pill--lab" title="Laboratory Practical Sessions">
            <Icon name="flask" size={13} className="timetable-stat-icon" />
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
            placeholder="Search subject or faculty..."
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
              onClick={() => { setViewOrientation('columns'); setHovered(null); }}
              title="Days as Columns"
            >
              Days Top
            </button>
            <button
              type="button"
              className={`timetable-btn-toggle ${viewOrientation === 'rows' ? 'timetable-btn-toggle--active' : ''}`}
              onClick={() => { setViewOrientation('rows'); setHovered(null); }}
              title="Days as Rows"
            >
              Days Left
            </button>
          </div>

          {/* Print Button */}
          <button
            type="button"
            className="timetable-icon-btn timetable-print-btn"
            onClick={handlePrint}
            title="Print Single-Page Timetable"
          >
            <Icon name="download" size={14} />
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
          <table className="timetable-table">
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
              {sortedPeriods.map(period => (
                <tr key={period.id} className="timetable-tr">
                  {/* Period Header Column */}
                  <td className="timetable-td timetable-td--period">
                    <div className="timetable-period-pill">
                      <span className="timetable-period-name">{period.name}</span>
                      <span className="timetable-period-time">
                        {period.startTime.substring(0, 5)} - {period.endTime.substring(0, 5)}
                      </span>
                    </div>
                  </td>

                  {/* Day Slots */}
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
                          onMouseEnter={(e) => {
                            if (entry) handleSlotMouseEnter(entry, day, period, e);
                          }}
                          onMouseLeave={handleSlotMouseLeave}
                        >
                          {entry && theme ? (
                            <div
                              className="timetable-subject-card"
                              style={{
                                backgroundColor: theme.bg,
                                borderColor: theme.border,
                                borderLeftColor: theme.accent,
                              }}
                            >
                              <div className="timetable-subject-card__top">
                                <span
                                  className="timetable-subject-code"
                                  style={{
                                    backgroundColor: theme.badgeBg,
                                    color: theme.badgeText,
                                  }}
                                >
                                  {entry.subjectCode || 'SUB'}
                                </span>
                                {isLab && <span className="timetable-lab-pill">LAB</span>}
                              </div>

                              <div className="timetable-subject-name" style={{ color: theme.text }}>
                                {entry.subjectName}
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
              ))}
            </tbody>
          </table>
        ) : (
          /* ========================================================
             ORIENTATION B: DAYS AS ROWS (MON TO SAT ON LEFT, PERIODS ON TOP)
             ======================================================== */
          <table className="timetable-table">
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
                            onMouseEnter={(e) => {
                              if (entry) handleSlotMouseEnter(entry, day, period, e);
                            }}
                            onMouseLeave={handleSlotMouseLeave}
                          >
                            {entry && theme ? (
                              <div
                                className="timetable-subject-card"
                                style={{
                                  backgroundColor: theme.bg,
                                  borderColor: theme.border,
                                  borderLeftColor: theme.accent,
                                }}
                              >
                                <div className="timetable-subject-card__top">
                                  <span
                                    className="timetable-subject-code"
                                    style={{
                                      backgroundColor: theme.badgeBg,
                                      color: theme.badgeText,
                                    }}
                                  >
                                    {entry.subjectCode || 'SUB'}
                                  </span>
                                  {isLab && <span className="timetable-lab-pill">LAB</span>}
                                </div>

                                <div className="timetable-subject-name" style={{ color: theme.text }}>
                                  {entry.subjectName}
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

      {/* ========================================================
          PROFESSIONAL HOVER DETAIL CARD (Institutional Sona Styling)
          ======================================================== */}
      {hovered && (
        <div
          className={`timetable-popup timetable-popup--${hovered.placement}`}
          style={{
            top: `${hovered.top}px`,
            left: `${hovered.left}px`,
          }}
        >
          {/* Card Accent Top Header */}
          <div
            className="timetable-popup__header"
            style={{ borderTopColor: hovered.theme.accent }}
          >
            <div className="timetable-popup__top-row">
              <span
                className="timetable-popup__code-badge"
                style={{
                  backgroundColor: hovered.theme.badgeBg,
                  color: hovered.theme.badgeText,
                }}
              >
                {hovered.entry.subjectCode || 'SUBJECT'}
              </span>
              <span
                className={`timetable-popup__type-pill ${
                  hovered.isLab ? 'timetable-popup__type-pill--lab' : 'timetable-popup__type-pill--theory'
                }`}
              >
                {hovered.isLab ? 'Laboratory Practical' : 'Theory Course'}
              </span>
            </div>
            <h4 className="timetable-popup__title">{hovered.entry.subjectName}</h4>
          </div>

          <div className="timetable-popup__body">
            {/* Faculty In-Charge */}
            <div className="timetable-popup__item">
              <div className="timetable-popup__icon-wrap">
                <Icon name="user" size={13} />
              </div>
              <div className="timetable-popup__content">
                <span className="timetable-popup__label">Faculty In-Charge</span>
                <span
                  className={`timetable-popup__value ${
                    hovered.entry.staffName ? 'timetable-popup__value--faculty' : 'timetable-popup__value--unassigned'
                  }`}
                >
                  {hovered.entry.staffName || 'Faculty Not Assigned'}
                </span>
              </div>
            </div>

            {/* Timing & Period */}
            <div className="timetable-popup__item">
              <div className="timetable-popup__icon-wrap">
                <Icon name="clock" size={13} />
              </div>
              <div className="timetable-popup__content">
                <span className="timetable-popup__label">Day & Period Schedule</span>
                <span className="timetable-popup__value">
                  {hovered.dayLabel} · {hovered.period.name} ({hovered.period.startTime.substring(0, 5)} – {hovered.period.endTime.substring(0, 5)})
                </span>
              </div>
            </div>

            {/* Class & Department */}
            <div className="timetable-popup__item">
              <div className="timetable-popup__icon-wrap">
                <Icon name="academic" size={13} />
              </div>
              <div className="timetable-popup__content">
                <span className="timetable-popup__label">Class & Department</span>
                <span className="timetable-popup__value">
                  {classNameText ? `${classNameText} · ` : ''}Department of Information Technology
                </span>
              </div>
            </div>
          </div>

          {!readOnly && (
            <div className="timetable-popup__footer">
              <Icon name="info" size={12} />
              <span>Click slot to edit schedule or faculty assignment</span>
            </div>
          )}
        </div>
      )}

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
