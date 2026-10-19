import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import SearchBar from '../components/SearchBar';
import Select from '../components/Select';
import { studentService, type DirectoryStudent } from '../services/studentService';
import { useApi } from '../hooks/useApi';
import type { ApiResponse } from '../types';

interface DirectoryStatus {
  configured: boolean;
  totalSynchronizedUsers: number;
  verifiedItFacultyStaffIdentities: number;
  verifiedGroupClassifications: boolean;
  lastSuccessfulFullSync: string | null;
  latestAttempt: { status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' } | null;
}

const PAGE_SIZE = 20;

export default function StaffPage() {
  const [staff, setStaff] = useState<DirectoryStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [sortBy, setSortBy] = useState('displayName');
  const [sortOrder, setSortOrder] = useState('asc');
  const { data: statusResponse } = useApi<ApiResponse<DirectoryStatus>>('/api/auth/directory-status');

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await studentService.getDirectoryStaff({
        search: searchQuery,
        accountStatus,
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      });
      setStaff(result.identities);
      setTotal(result.pagination.total);
    } catch (err: unknown) {
      setError(err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'Unable to load verified directory staff.');
      setStaff([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, accountStatus, page, sortBy, sortOrder]);

  useEffect(() => {
    void Promise.resolve().then(fetchStaff);
  }, [fetchStaff]);

  const status = statusResponse?.data;
  const columns = [
    { key: 'displayName', label: 'Directory Name', sortable: false },
    { key: 'email', label: 'Directory Email', sortable: false },
    { key: 'department', label: 'Directory Department', sortable: false },
    {
      key: 'accountEnabled',
      label: 'Entra Account',
      render: (value: unknown) => (
        <Badge variant={value === true ? 'success' : value === false ? 'danger' : 'warning'}>
          {value === true ? 'Enabled' : value === false ? 'Disabled' : 'Unknown'}
        </Badge>
      ),
    },
  ];

  const emptyMessage = !status?.configured
    ? 'Microsoft Graph synchronization is not configured.'
    : !status.lastSuccessfulFullSync
      ? 'No successful full directory synchronization has completed.'
      : !status.verifiedGroupClassifications
        ? 'Verified IT faculty/staff group IDs and approved membership semantics are not configured.'
        : 'No verified IT faculty/staff identities match these filters.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="Staff Directory"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Staff' },
        ]}
      />
      <div role="status" style={{ padding: '12px 16px', borderRadius: 6, background: '#FFF3E0', color: '#7A4B00' }}>
        Read-only directory identities classified only through configured IT faculty/staff Entra groups. Legacy application staff rows and unverified roles are excluded.
      </div>
      {status && (
        <div role="status" style={{ padding: '12px 16px', borderRadius: 6, background: '#F1F6FC', color: '#1E3A8A' }}>
          Synchronized tenant users: {status.totalSynchronizedUsers} · Verified IT faculty/staff: {status.verifiedItFacultyStaffIdentities} · Last successful full sync: {status.lastSuccessfulFullSync ? new Date(status.lastSuccessfulFullSync).toLocaleString() : 'Never'}
          {' · Latest attempt: '}{status.latestAttempt?.status || 'None'}
        </div>
      )}
      {error && <div role="alert" style={{ color: '#A11' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <SearchBar
          placeholder="Search verified directory name or email..."
          value={searchQuery}
          onChange={(value) => { setSearchQuery(value); setPage(1); }}
        />
        <div style={{ display: 'flex', gap: '16px' }}>
          <Select
            label=""
            value={accountStatus}
            onChange={(value) => { setAccountStatus(value); setPage(1); }}
            options={[
              { value: '', label: 'All Account States' },
              { value: 'enabled', label: 'Enabled' },
              { value: 'disabled', label: 'Disabled' },
              { value: 'unknown', label: 'Unknown' },
            ]}
          />
          <Select
            label=""
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'displayName', label: 'Sort: Directory Name' },
              { value: 'email', label: 'Sort: Email' },
              { value: 'academicBatch', label: 'Sort: Admission Batch' },
              { value: 'academicClass', label: 'Sort: Class' },
              { value: 'accountEnabled', label: 'Sort: Account State' },
            ]}
          />
          <Select
            label=""
            value={sortOrder}
            onChange={setSortOrder}
            options={[
              { value: 'asc', label: 'Ascending' },
              { value: 'desc', label: 'Descending' },
            ]}
          />
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={staff}
          keyField="id"
          loading={loading}
          emptyMessage={emptyMessage}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
        <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Verified directory faculty/staff: {total} · page size {PAGE_SIZE}
        </div>
      </div>
    </div>
  );
}
