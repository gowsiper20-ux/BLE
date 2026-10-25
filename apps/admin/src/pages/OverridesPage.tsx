import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';
import Select from '../components/Select';
import ConfirmDialog from '../components/ConfirmDialog';
import { timetableService } from '../services/timetableService';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import type { TimetableOverride, ApiResponse, ClassSection, TimetableEntry } from '../types';

export default function OverridesPage() {
  const [overrides, setOverrides] = useState<TimetableOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [overridesError, setOverridesError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [overrideToDelete, setOverrideToDelete] = useState<TimetableOverride | null>(null);

  // Form State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classTimetable, setClassTimetable] = useState<TimetableEntry[]>([]);
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [selectedTimetableId, setSelectedTimetableId] = useState('');
  const [overrideDate, setOverrideDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [replacementStaffId, setReplacementStaffId] = useState('');
  const [replacementSubjectId, setReplacementSubjectId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const { showToast } = useToast();

  // Reference data
  const { data: staffResponse, error: staffError } = useApi<ApiResponse<any>>('/api/staff?limit=100');
  const { data: subjectsResponse, error: subjectsError } = useApi<ApiResponse<any>>('/api/subjects?limit=100');
  const { data: classesResponse, error: classesError } = useApi<ApiResponse<ClassSection[]>>('/api/classes');

  const staffList = staffResponse?.data?.staff || [];
  const subjectsList = subjectsResponse?.data?.subjects || [];
  const classesList = classesResponse?.data || [];

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const res = await timetableService.getOverrides();
      setOverrides(res.data);
      setOverridesError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch overrides.';
      setOverridesError(message);
      showToast('error', message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  // When class changes in modal, load that class's timetable slots
  useEffect(() => {
    if (selectedClassId) {
      setLoadingTimetable(true);
      timetableService.getTimetableByClass(selectedClassId)
        .then(res => {
          setClassTimetable(res.data || []);
        })
        .catch(() => {
          setClassTimetable([]);
        })
        .finally(() => setLoadingTimetable(false));
    } else {
      setClassTimetable([]);
    }
  }, [selectedClassId]);

  const handleOpenModal = () => {
    if (classesList.length > 0 && !selectedClassId) {
      setSelectedClassId(classesList[0].id);
    }
    setIsModalOpen(true);
  };

  const handleCreateOverride = async () => {
    if (!selectedTimetableId) {
      showToast('error', 'Please select a timetable period to override.');
      return;
    }
    if (!overrideDate) {
      showToast('error', 'Please select an override date.');
      return;
    }

    setSaving(true);
    try {
      await timetableService.createOverride({
        timetableId: selectedTimetableId,
        overrideDate,
        replacementStaffId: replacementStaffId || undefined,
        replacementSubjectId: replacementSubjectId || undefined,
        reason: reason.trim() || undefined,
      });
      showToast('success', 'Substitution created successfully');
      setIsModalOpen(false);
      setSelectedTimetableId('');
      setReplacementStaffId('');
      setReplacementSubjectId('');
      setReason('');
      fetchOverrides();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to create substitution');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = async () => {
    if (!overrideToDelete) return;
    try {
      await timetableService.deleteOverride(overrideToDelete.id);
      showToast('success', 'Substitution cancelled successfully');
      setOverrideToDelete(null);
      fetchOverrides();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to cancel substitution');
    }
  };

  const columns = [
    { key: 'overrideDate', label: 'Date', render: (val: any) => new Date(val).toLocaleDateString() },
    { key: 'className', label: 'Class' },
    { key: 'periodName', label: 'Period' },
    { key: 'originalSubjectName', label: 'Subject' },
    { key: 'replacementStaffName', label: 'Substitute Teacher', render: (val: any) => val || '—' },
    { key: 'reason', label: 'Reason', render: (val: any) => val || '—' },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      ),
    },
  ];

  return (
    <div className="overrides-page">
      <PageHeader
        title="Substitutions"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Timetable', path: '/timetable' },
          { label: 'Substitutions' },
        ]}
        subtitle="Assign substitute teachers for scheduled classes"
        actions={
          <Button onClick={handleOpenModal} icon="add">
            Add Substitution
          </Button>
        }
      />

      {(staffError || subjectsError || classesError) && (
        <div role="alert">
          One or more reference lists could not be loaded. Please check server connectivity.
        </div>
      )}

      <div className="card" style={{ padding: '24px' }}>
        {overridesError && <div role="alert">{overridesError}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Active Substitutions</h3>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Total Substitutions: {overrides.length}
          </span>
        </div>
        <DataTable
          data={overrides}
          columns={columns}
          loading={loading}
          keyField="id"
          emptyMessage="No substitutions scheduled. Click 'Add Substitution' to assign a substitute teacher."
          actions={(row: TimetableOverride) => (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setOverrideToDelete(row)}
            >
              Remove
            </Button>
          )}
        />
      </div>

      {/* Add Override Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Assign Substitute Teacher"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateOverride} disabled={saving || !selectedTimetableId}>
                {saving ? 'Saving...' : 'Save Substitution'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              type="date"
              label="Date *"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              required
            />

            <Select
              label="Select Class *"
              value={selectedClassId}
              onChange={(val) => {
                setSelectedClassId(val);
                setSelectedTimetableId('');
              }}
              options={[
                { value: '', label: '-- Select Class --' },
                ...classesList.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.department || 'IT'})`
                }))
              ]}
            />

            <Select
              label="Select Class Period *"
              value={selectedTimetableId}
              onChange={setSelectedTimetableId}
              options={[
                { value: '', label: loadingTimetable ? 'Loading timetable slots...' : classTimetable.length === 0 ? '-- No weekly slots found for this class --' : '-- Select Period --' },
                ...classTimetable.map((t) => ({
                  value: t.id,
                  label: `${t.dayOfWeek} • ${t.periodName || 'Period'} • ${t.subjectCode || ''} ${t.subjectName || ''} (${t.staffName || 'Staff'})`
                })),
              ]}
            />

            <Select
              label="Substitute Teacher *"
              value={replacementStaffId}
              onChange={setReplacementStaffId}
              options={[
                { value: '', label: '-- Select Substitute Teacher --' },
                ...staffList.map((s: any) => ({
                  value: s.id,
                  label: `${s.name} (${s.staffCode})`,
                })),
              ]}
            />

            <Select
              label="Substitute Subject (Optional)"
              value={replacementSubjectId}
              onChange={setReplacementSubjectId}
              options={[
                { value: '', label: '-- Keep Original Subject --' },
                ...subjectsList.map((sub: any) => ({
                  value: sub.id,
                  label: `${sub.code} - ${sub.name}`,
                })),
              ]}
            />

            <Input
              label="Reason for Substitution"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Teacher on leave or official duty"
            />
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {overrideToDelete && (
        <ConfirmDialog
          isOpen={!!overrideToDelete}
          title="Cancel Substitution?"
          message={`Are you sure you want to cancel the substitution for ${overrideToDelete.className || 'this period'} on ${overrideToDelete.overrideDate ? new Date(overrideToDelete.overrideDate).toLocaleDateString() : 'selected date'}? The regular teacher will take this class.`}
          confirmLabel="Confirm Cancellation"
          cancelLabel="Keep"
          onConfirm={handleDeleteOverride}
          onClose={() => setOverrideToDelete(null)}
          variant="danger"
        />
      )}
    </div>
  );
}
