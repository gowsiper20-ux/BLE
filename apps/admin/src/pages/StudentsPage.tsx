import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import SearchBar from '../components/SearchBar';
import Select from '../components/Select';
import { studentService, type DirectoryStudent } from '../services/studentService';
import { useApi } from '../hooks/useApi';
import type { ApiResponse } from '../types';
import './StudentsPage.css';

interface DirectoryFailure {
  startedAt: string;
  failurePage: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface DirectoryStatus {
  configured: boolean;
  totalSynchronizedUsers: number;
  verifiedItStudentIdentities: number;
  verifiedItFacultyStaffIdentities: number;
  verifiedGroupClassifications: boolean;
  conflictingGroupClassifications: number;
  unclassifiedUsers: number;
  disabledAccounts: number;
  verifiedBatchValues: number;
  verifiedClassValues: number;
  academicAttributesConfigured: boolean;
  membershipMode: string | null;
  studentGroupIdsConfigured: boolean;
  staffGroupIdsConfigured: boolean;
  lastSuccessfulFullSync: string | null;
  latestAttempt: {
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    startedAt: string;
    completedAt: string | null;
    pagesProcessed: number;
    usersScanned: number;
    failurePage: number | null;
    errorCode: string | null;
    errorMessage: string | null;
  } | null;
  failures: DirectoryFailure[];
}

const PAGE_SIZE = 20;

export default function StudentsPage() {
  const [students, setStudents] = useState<DirectoryStudent[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('displayName');
  const [sortOrder, setSortOrder] = useState('asc');
  const { data: statusResponse, loading: statusLoading, error: statusError } =
    useApi<ApiResponse<DirectoryStatus>>('/api/auth/directory-status');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const result = await studentService.getDirectoryStudents({
        search: searchQuery,
        academicBatch: filterBatch,
        academicClass: filterClass,
        accountStatus: filterStatus,
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      });
      setStudents(result.identities);
      setBatches(result.filters.batches);
      setClasses(result.filters.classes);
      setTotal(result.pagination.total);
    } catch (error: unknown) {
      setListError(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Unable to load verified directory students.');
      setStudents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterBatch, filterClass, filterStatus, page, sortBy, sortOrder]);

  useEffect(() => {
    void Promise.resolve().then(fetchStudents);
  }, [fetchStudents]);

  const status = statusResponse?.data;
  const latestFailure = status?.failures[0];
  const syncFailed = Boolean(latestFailure && (
    !status?.lastSuccessfulFullSync ||
    new Date(latestFailure.startedAt).getTime() > new Date(status.lastSuccessfulFullSync).getTime()
  ));
  const emptyMessage = !status
    ? statusLoading ? 'Loading directory synchronization status...' : 'Directory synchronization status is unavailable.'
    : !status.configured
      ? 'Microsoft Graph synchronization is not configured.'
      : syncFailed
        ? 'The latest directory synchronization failed. See the synchronization failure details above.'
        : !status.lastSuccessfulFullSync
          ? 'No successful full directory synchronization has completed.'
          : !status.studentGroupIdsConfigured || !status.membershipMode
            ? 'Verified IT student group IDs and approved membership semantics are not configured.'
            : total === 0 && !filterBatch && !filterClass && !filterStatus && !searchQuery
              ? 'The last successful sync found no users in the verified IT student groups.'
              : 'No verified IT student identities match these filters.';

  const columns = [
    { key: 'displayName', label: 'Directory Name', sortable: false },
    { key: 'email', label: 'Directory Email', sortable: false },
    { key: 'academicClass', label: 'Verified Class', sortable: false },
    { key: 'academicBatch', label: 'Admission Batch', sortable: false },
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

  return (
    <div className="students-page">
      <PageHeader
        title="Students"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Students' },
        ]}
      />

      <div role="status" style={{ padding: '12px 16px', borderRadius: 6, background: '#FFF3E0', color: '#7A4B00' }}>
        This view contains only directory identities in configured, verified IT student groups. Batch, class, and register number are shown only when an authoritative Graph attribute is configured. No legacy or seeded student rows are included.
      </div>

      {statusError && (
        <div role="alert" className="login-error">
          Directory status could not be loaded: {statusError.message || 'API error'}.
        </div>
      )}

      {status && (
        <div role="status" style={{ padding: '12px 16px', borderRadius: 6, background: syncFailed ? '#FDECEC' : '#F1F6FC', color: syncFailed ? '#A11' : '#1E3A8A' }}>
          {status.lastSuccessfulFullSync ? <div>
            <strong>Synchronized tenant users:</strong> {status.totalSynchronizedUsers} ·{' '}
            <strong>Verified IT students:</strong> {status.studentGroupIdsConfigured && status.membershipMode ? status.verifiedItStudentIdentities : 'Unavailable — group classification not configured'} ·{' '}
            <strong>Verified IT faculty/staff:</strong> {status.staffGroupIdsConfigured && status.membershipMode ? status.verifiedItFacultyStaffIdentities : 'Unavailable — group classification not configured'} ·{' '}
            <strong>Unclassified:</strong> {status.unclassifiedUsers} ·{' '}
            <strong>Disabled:</strong> {status.disabledAccounts} ·{' '}
            <strong>Conflicting groups:</strong> {status.conflictingGroupClassifications}
          </div> : <div>No successful full Entra sync is available; directory counts are unavailable, not zero.</div>}
          {status.lastSuccessfulFullSync && <div>
            <strong>Verified batch/class values:</strong> {status.studentGroupIdsConfigured && status.membershipMode
              ? `${status.verifiedBatchValues}/${status.verifiedClassValues}`
              : 'Unavailable — student-group classification not configured'} ·{' '}
            <strong>Last successful full sync:</strong> {status.lastSuccessfulFullSync
              ? new Date(status.lastSuccessfulFullSync).toLocaleString()
              : 'Never'}
          </div>}
          {syncFailed && latestFailure && (
            <div role="alert">
              Latest synchronization failure ({latestFailure.errorCode || 'unknown'}
              {latestFailure.failurePage ? ` on page ${latestFailure.failurePage}` : ''}): {latestFailure.errorMessage || 'No failure details recorded.'}
            </div>
          )}
        </div>
      )}

      <div className="students-page__filters">
        <SearchBar
          placeholder="Search verified directory name or email..."
          value={searchQuery}
          onChange={(value) => { setSearchQuery(value); setPage(1); }}
        />
        <div className="students-page__filter-group">
          <Select
            label=""
            value={filterBatch}
            onChange={(value) => { setFilterBatch(value); setPage(1); }}
            options={[
              { value: '', label: 'All Verified Batches' },
              ...batches.map((value) => ({ value, label: value })),
            ]}
          />
          <Select
            label=""
            value={filterClass}
            onChange={(value) => { setFilterClass(value); setPage(1); }}
            options={[
              { value: '', label: 'All Verified Classes' },
              ...classes.map((value) => ({ value, label: value })),
            ]}
          />
          <Select
            label=""
            value={filterStatus}
            onChange={(value) => { setFilterStatus(value); setPage(1); }}
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

      {listError && <div role="alert" className="login-error">{listError}</div>}

      <div className="students-page__content">
        <DataTable
          columns={columns}
          data={students}
          keyField="id"
          loading={loading}
          emptyMessage={emptyMessage}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
        <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          {status?.lastSuccessfulFullSync && status.studentGroupIdsConfigured && status.membershipMode
            ? <>Verified directory students: {total} · page size {PAGE_SIZE}</>
            : 'Verified directory student count unavailable until a successful full sync and verified student-group configuration.'}
          {!status?.academicAttributesConfigured && ' · Academic batch/class attributes are not configured'}
        </div>
      </div>
    </div>
  );
}
