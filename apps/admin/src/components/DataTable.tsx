import { useState } from 'react';
import Icon from './Icon';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import './DataTable.css';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

export default function DataTable<T>({
  columns,
  data,
  keyField,
  loading = false,
  emptyMessage = 'No data found',
  emptyIcon = 'search',
  onRowClick,
  actions,
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = sortKey
    ? [...data].sort((a, b) => {
        const aVal = (a as any)[sortKey];
        const bVal = (b as any)[sortKey];
        if (aVal === bVal) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? comparison : -comparison;
      })
    : data;

  const totalPages = total ? Math.ceil(total / pageSize) : 1;

  if (loading) {
    return (
      <div className="data-table__loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState icon={emptyIcon} message={emptyMessage} />;
  }

  return (
    <div className="data-table">
      <div className="data-table__scroll">
        <table className="data-table__table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={col.sortable ? 'data-table__th--sortable' : ''}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="data-table__th-content">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <Icon name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'} size={14} />
                    )}
                  </span>
                </th>
              ))}
              {actions && <th style={{ width: '80px' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row) => (
              <tr
                key={String((row as any)[keyField])}
                className={onRowClick ? 'data-table__row--clickable' : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render
                      ? col.render((row as any)[col.key], row)
                      : String((row as any)[col.key] ?? '')}
                  </td>
                ))}
                {actions && (
                  <td className="data-table__actions" onClick={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onPageChange && total != null && totalPages > 1 && (
        <div className="data-table__pagination">
          <span className="data-table__pagination-info">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="data-table__pagination-controls">
            <button
              className="data-table__page-btn"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="data-table__page-current">
              Page {page} of {totalPages}
            </span>
            <button
              className="data-table__page-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
