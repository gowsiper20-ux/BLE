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
import type { TimetableOverride, ApiResponse } from '../types';

export default function OverridesPage() {
  const [overrides, setOverrides] = useState<TimetableOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [overrideToDelete, setOverrideToDelete] = useState<TimetableOverride | null>(null);

  // Form State
  const [selectedTimetableId, setSelectedTimetableId] = useState('');
  const [overrideDate, setOverrideDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [replacementStaffId, setReplacementStaffId] = useState('');
  const [replacementSubjectId, setReplacementSubjectId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const { showToast } = useToast();

  // Reference data
  const { data: staffResponse } = useApi<ApiResponse<any>>('/api/staff?limit=100');
  const { data: subjectsResponse } = useApi<ApiResponse<any>>('/api/subjects?limit=100');
  const { data: timetableResponse } = useApi<ApiResponse<any[]>>('/api/timetable/today');

  const staffList = staffResponse?.data?.staff || [];
  const subjectsList = subjectsResponse?.data?.subjects || [];
  const timetableEntries = timetableResponse?.data || [];

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const res = await timetableService.getOverrides();
      setOverrides(res.data);
    } catch {
      showToast('error', 'Failed to fetch overrides');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

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
      showToast('success', 'Timetable override created successfully');
      setIsModalOpen(false);
      setSelectedTimetableId('');
      setReplacementStaffId('');
      setReplacementSubjectId('');
      setReason('');
      fetchOverrides();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to create override');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = async () => {
    if (!overrideToDelete) return;
    try {
      await timetableService.deleteOverride(overrideToDelete.id);
      showToast('success', 'Override deleted successfully');
      setOverrideToDelete(null);
      fetchOverrides();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to delete override');
    }
  };

  const columns = [
    { key: 'overrideDate', label: 'Date', render: (val: any) => new Date(val).toLocaleDateString() },
    { key: 'className', label: 'Class' },
    { key: 'periodName', label: 'Period' },
    { key: 'originalSubjectName', label: 'Original Subject' },
    { key: 'replacementStaffName', label: 'Replacement Staff', render: (val: any) => val || '—' },
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
        title="Timetable Overrides"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Timetable', path: '/timetable' },
          { label: 'Overrides' },
        ]}
        subtitle="Manage scheduled substitute faculty and date-specific timetable changes"
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            + Add Override
          </Button>
        }
      />

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Active Timetable Overrides</h3>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Total Overrides: {overrides.length}
          </span>
        </div>
        <DataTable
          data={overrides}
          columns={columns}
          loading={loading}
          keyField="id"
          actions={(row: TimetableOverride) => (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setOverrideToDelete(row)}
            >
              Delete
            </Button>
          )}
        />
      </div>

      {/* Add Override Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create Timetable Override"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateOverride} disabled={saving}>
                {saving ? 'Creating...' : 'Save Override'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              type="date"
              label="Override Date *"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              required
            />

            <Select
              label="Select Timetable Schedule *"
              value={selectedTimetableId}
              onChange={setSelectedTimetableId}
              options={[
                { value: '', label: '-- Select Timetable Period --' },
                ...timetableEntries.map((t: any) => ({
                  value: t.id,
                  label: `${t.class} &bull; ${t.period} (${t.time}) &bull; ${t.subject} (${t.staff})`,
                })),
              ]}
            />

            <Select
              label="Replacement Staff (Substitute Faculty)"
              value={replacementStaffId}
              onChange={setReplacementStaffId}
              options={[
                { value: '', label: '-- Keep Original Staff --' },
                ...staffList.map((s: any) => ({
                  value: s.id,
                  label: `${s.name} (${s.staffCode})`,
                })),
              ]}
            />

            <Select
              label="Replacement Subject (Optional)"
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
              label="Reason for Override"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Faculty on conference duty, special seminar arrangement"
            />
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {overrideToDelete && (
        <ConfirmDialog
          isOpen={!!overrideToDelete}
          title="Delete Override?"
          message={`Are you sure you want to remove the override for ${overrideToDelete.className || 'this period'} on ${overrideToDelete.overrideDate ? new Date(overrideToDelete.overrideDate).toLocaleDateString() : 'selected date'}? Original timetable schedule will be restored.`}
          confirmLabel="Delete Override"
          cancelLabel="Cancel"
          onConfirm={handleDeleteOverride}
          onClose={() => setOverrideToDelete(null)}
          variant="danger"
        />
      )}
    </div>
  );
}
