import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Card from '../components/Card';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { auditService, type AuditLog } from '../services/auditService';
import './AuditLogsPage.css';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res: any = await auditService.getLogs({
        page,
        limit: 25,
        ...(search && { search }),
        ...(actionFilter && { action: actionFilter }),
        ...(entityFilter && { entityType: entityFilter }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      if (res.success && res.data) {
        setLogs(res.data);
        setTotalPages(res.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, entityFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const clearFilters = () => {
    setSearch('');
    setActionFilter('');
    setEntityFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const getActionBadge = (action: string) => {
    const cls = `audit-badge audit-badge--${action.toLowerCase()}`;
    return <span className={cls}>{action}</span>;
  };

  const columns = [
    { 
      key: 'createdAt', 
      label: 'Date & Time',
      render: (val: any) => new Date(val).toLocaleString()
    },
    { key: 'actorName', label: 'Actor' },
    { key: 'actorRole', label: 'Role' },
    { 
      key: 'action', 
      label: 'Action',
      render: (val: any) => getActionBadge(val)
    },
    { key: 'entityType', label: 'Entity' },
    { key: 'description', label: 'Description' },
    {
      key: 'actions',
      label: 'Details',
      render: (_: any, row: AuditLog) => (
        <button className="btn btn--outline btn--sm" onClick={() => setSelectedLog(row)}>
          View
        </button>
      )
    }
  ];

  return (
    <div className="audit-logs-page">
      <PageHeader
        title="Audit Logs"
        subtitle="Track and monitor administrative actions across the system."
      />

      <Card>
        <form onSubmit={handleSearch} className="audit-filters">
          <div className="audit-filter-group">
            <label>Search</label>
            <input 
              type="text" 
              placeholder="Search actor, description..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="audit-filter-group">
            <label>Action</label>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="IMPORT">IMPORT</option>
              <option value="ASSIGN">ASSIGN</option>
              <option value="UNASSIGN">UNASSIGN</option>
            </select>
          </div>
          <div className="audit-filter-group">
            <label>Entity</label>
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
              <option value="">All Entities</option>
              <option value="STUDENT">STUDENT</option>
              <option value="STAFF">STAFF</option>
              <option value="CLASS">CLASS</option>
              <option value="SUBJECT">SUBJECT</option>
              <option value="TIMETABLE">TIMETABLE</option>
            </select>
          </div>
          <div className="audit-filter-group">
            <label>From Date</label>
            <input 
              type="date" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="audit-filter-group">
            <label>To Date</label>
            <input 
              type="date" 
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="audit-filter-group" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: '0.5rem' }}>
            <Button type="submit" variant="primary" size="lg" style={{ flex: 1 }}>Apply</Button>
            <Button type="button" variant="secondary" size="lg" onClick={clearFilters}>Clear</Button>
          </div>
        </form>
      </Card>

      <Card>
        {error ? (
          <div className="error-state">
            <p>{error}</p>
            <button className="btn btn--outline" onClick={fetchLogs}>Retry</button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={logs}
            keyExtractor={(row) => row.id}
            isLoading={loading}
            emptyMessage={
              search || actionFilter || entityFilter || dateFrom || dateTo 
                ? "No audit logs match the selected filters." 
                : "No audit logs found."
            }
          />
        )}
        
        {totalPages > 1 && (
          <div className="pagination" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button 
              className="btn btn--outline btn--sm" 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <span style={{ alignSelf: 'center', fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
            <button 
              className="btn btn--outline btn--sm" 
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </Card>

      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="Audit Log Details"
          size="lg"
        >
          <div className="audit-details-modal">
            <div className="audit-details-header">
              <h3>{getActionBadge(selectedLog.action)}</h3>
              <span className="text-muted">{new Date(selectedLog.createdAt).toLocaleString()}</span>
            </div>
            
            <div className="audit-details-grid">
              <div className="audit-details-label">Actor:</div>
              <div className="audit-details-value">{selectedLog.actorName || 'System'} ({selectedLog.actorRole || 'SYSTEM'})</div>
              
              <div className="audit-details-label">Entity:</div>
              <div className="audit-details-value">{selectedLog.entityType} {selectedLog.entityId ? `(${selectedLog.entityId})` : ''}</div>
              
              <div className="audit-details-label">Description:</div>
              <div className="audit-details-value">{selectedLog.description}</div>
            </div>

            {(selectedLog.oldValues || selectedLog.newValues) && (
              <div className="audit-diff">
                {selectedLog.oldValues && (
                  <div className="audit-diff-col">
                    <div className="audit-diff-title">Before</div>
                    <pre className="audit-json-viewer">
                      {JSON.stringify(selectedLog.oldValues, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.newValues && (
                  <div className="audit-diff-col">
                    <div className="audit-diff-title">After</div>
                    <pre className="audit-json-viewer">
                      {JSON.stringify(selectedLog.newValues, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
