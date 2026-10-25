import { useState, useRef } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import './BulkImportModal.css';

export interface ImportPreviewRow {
  rowNumber: number;
  isValid: boolean;
  errors: Array<{ code?: string; message: string }>;
  [key: string]: any;
}

export interface ImportPreviewData {
  totalRows: number;
  valid: number;
  errors: number;
  data: any[];
}

export interface ImportResultData {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  rows?: Array<{ rowNumber: number; status?: string; errors: Array<{ message: string }> }>;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityName: string; // 'students' | 'faculty' | 'staff' | 'subjects'
  sampleTemplateName?: string;
  columnsNote: string;
  onDownloadTemplate?: (format: 'csv' | 'xlsx') => Promise<any> | void;
  onPreview: (file: File) => Promise<any>;
  onConfirm: (file: File) => Promise<any>;
  onSuccess: () => void;
}

function downloadClientFallback(entityName: string, format: 'xlsx' | 'csv') {
  let headers: string[] = [];
  let sample: string[] = [];

  if (entityName === 'students') {
    headers = ['register_number', 'name', 'college_email', 'class_id'];
    sample = ['21IT001', 'Sample Student', 'student@sonatech.ac.in', 'II IT-A'];
  } else if (entityName === 'subjects') {
    headers = ['code', 'name', 'subject_type', 'year_number', 'regulation_code', 'description'];
    sample = ['CS3401', 'Algorithms and Data Structures', 'THEORY', '2', 'R2023', 'Core Subject'];
  } else {
    headers = ['staff_code', 'name', 'college_email'];
    sample = ['IT001', 'Sample Teacher', 'faculty@sonatech.ac.in'];
  }

  if (format === 'csv') {
    const csv = `${headers.join(',')}\r\n${sample.join(',')}\r\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${entityName}-template.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
  } else {
    // Spreadsheet XML fallback supported by all versions of Excel
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Template">
  <Table>
   <Row>
    ${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
   </Row>
   <Row>
    ${sample.map(s => `<Cell><Data ss:Type="String">${s}</Data></Cell>`).join('')}
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${entityName}-template.xls`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
  }
}

export default function BulkImportModal({
  isOpen,
  onClose,
  title,
  entityName,
  columnsNote,
  onDownloadTemplate,
  onPreview,
  onConfirm,
  onSuccess,
}: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResultData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setError('');
    setResult(null);
    setValidating(false);
    setImporting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setPreview(null);
    setResult(null);
    setError('');
    setValidating(true);
    try {
      const previewData = await onPreview(selectedFile);
      setPreview(previewData);
    } catch (err: unknown) {
      setError(err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'Failed to read file. Please make sure the columns match the template.');
    } finally {
      setValidating(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleConfirm = async () => {
    if (!file || !preview) return;
    setImporting(true);
    setError('');
    try {
      const res = await onConfirm(file);
      setResult(res);
      onSuccess();
    } catch (err: unknown) {
      setError(err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'Import failed. Please check the file and try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownload = async (format: 'xlsx' | 'csv') => {
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    const filename = `${entityName}-template.${ext}`;

    try {
      if (onDownloadTemplate) {
        const res = await onDownloadTemplate(format);
        if (res instanceof Blob) {
          const url = URL.createObjectURL(res);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 100);
          return;
        }
      }
    } catch (err) {
      console.warn('API template download error, triggering client fallback:', err);
    }

    downloadClientFallback(entityName, format);
  };

  const downloadErrorReport = () => {
    if (!preview) return;
    const invalidRows = preview.data.filter((r) => !r.isValid);
    const quote = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csv = [
      ['Row', 'Errors'].map(quote).join(','),
      ...invalidRows.map((r) => [String(r.rowNumber), quote(r.errors.map((e: { message: string }) => e.message).join('; '))].join(',')),
    ].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${entityName}-import-errors.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="lg">
      <div className="bulk-import-modal">
        {/* Step Info & Template Download */}
        <div className="bulk-import-modal__top-banner">
          <div className="bulk-import-modal__banner-text">
            <h4>Instructions</h4>
            <p>{columnsNote}</p>
          </div>
          <div className="bulk-import-modal__template-buttons">
            <button
              type="button"
              className="bulk-import-modal__template-btn bulk-import-modal__template-btn--excel"
              onClick={() => void handleDownload('xlsx')}
              title="Download pre-formatted Excel template (.xlsx)"
            >
              <Icon name="download" size={15} />
              <span>Download Excel Template</span>
            </button>
            <button
              type="button"
              className="bulk-import-modal__template-btn bulk-import-modal__template-btn--csv"
              onClick={() => void handleDownload('csv')}
              title="Download standard CSV template (.csv)"
            >
              <Icon name="download" size={15} />
              <span>Download CSV Template</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bulk-import-modal__error" role="alert">
            <Icon name="error" size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* File Dropzone (if not confirmed yet) */}
        {!result && (
          <div
            className={`bulk-import-dropzone ${dragActive ? 'bulk-import-dropzone--active' : ''} ${
              file ? 'bulk-import-dropzone--has-file' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  void handleFileChange(e.target.files[0]);
                }
              }}
            />
            <div className="bulk-import-dropzone__icon-wrap">
              <Icon name="upload" size={28} />
            </div>
            {file ? (
              <div className="bulk-import-dropzone__file-details">
                <span className="bulk-import-dropzone__filename">{file.name}</span>
                <span className="bulk-import-dropzone__filesize">
                  ({(file.size / 1024).toFixed(1)} KB) · Click or drag to choose another file
                </span>
              </div>
            ) : (
              <div className="bulk-import-dropzone__prompt">
                <span className="bulk-import-dropzone__primary-text">
                  Choose an Excel (.xlsx) or CSV file, or drag &amp; drop here
                </span>
                <span className="bulk-import-dropzone__secondary-text">
                  Standard spreadsheet format up to 5 MB supported
                </span>
              </div>
            )}
          </div>
        )}

        {/* Loading Spinner during validation */}
        {validating && (
          <div className="bulk-import-modal__loading">
            <div className="bulk-import-spinner" />
            <span>Checking file and validating records...</span>
          </div>
        )}

        {/* Validation Preview Card */}
        {preview && !result && (
          <div className="bulk-import-modal__preview-card">
            <div className="bulk-import-modal__metrics">
              <div className="bulk-import-metric bulk-import-metric--total">
                <span className="bulk-import-metric__val">{preview.totalRows}</span>
                <span className="bulk-import-metric__lbl">Total Rows</span>
              </div>
              <div className="bulk-import-metric bulk-import-metric--valid">
                <span className="bulk-import-metric__val">{preview.valid}</span>
                <span className="bulk-import-metric__lbl">Ready to Import</span>
              </div>
              <div className="bulk-import-metric bulk-import-metric--invalid">
                <span className="bulk-import-metric__val">{preview.errors}</span>
                <span className="bulk-import-metric__lbl">Needs Attention</span>
              </div>
            </div>

            {/* Scrollable preview table */}
            <div className="bulk-import-modal__table-container">
              <table className="bulk-import-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    {entityName === 'students' ? (
                      <>
                        <th>Register No</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Class</th>
                      </>
                    ) : entityName === 'subjects' ? (
                      <>
                        <th>Subject Code</th>
                        <th>Subject Name</th>
                        <th>Type</th>
                        <th>Year</th>
                      </>
                    ) : (
                      <>
                        <th>Staff Code</th>
                        <th>Name</th>
                        <th>Email</th>
                      </>
                    )}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.data.slice(0, 50).map((row) => (
                    <tr key={row.rowNumber} className={row.isValid ? 'row--valid' : 'row--invalid'}>
                      <td>#{row.rowNumber}</td>
                      {entityName === 'students' ? (
                        <>
                          <td><span className="bulk-import-badge-mono">{String(row.registerNumber || '-')}</span></td>
                          <td><strong>{String(row.name || '-')}</strong></td>
                          <td>{String(row.collegeEmail || '-')}</td>
                          <td>{String(row.className || row.classId || '-')}</td>
                        </>
                      ) : entityName === 'subjects' ? (
                        <>
                          <td><span className="bulk-import-badge-mono">{String(row.code || '-')}</span></td>
                          <td><strong>{String(row.name || '-')}</strong></td>
                          <td>{String(row.subjectType || '-')}</td>
                          <td>{String(row.yearNumber || '-')}</td>
                        </>
                      ) : (
                        <>
                          <td><span className="bulk-import-badge-mono">{String(row.staffCode || '-')}</span></td>
                          <td><strong>{String(row.name || '-')}</strong></td>
                          <td>{String(row.collegeEmail || '-')}</td>
                        </>
                      )}
                      <td>
                        {row.isValid ? (
                          <span className="bulk-import-chip bulk-import-chip--ready">Ready</span>
                        ) : (
                          <span className="bulk-import-chip bulk-import-chip--error" title={row.errors.map((e: { message: string }) => e.message).join('; ')}>
                            {row.errors[0]?.message || 'Invalid row'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.data.length > 50 && (
                <div className="bulk-import-modal__table-more">
                  Showing first 50 of {preview.data.length} rows
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="bulk-import-modal__footer-actions">
              {preview.errors > 0 && (
                <button
                  type="button"
                  className="bulk-import-btn bulk-import-btn--secondary"
                  onClick={downloadErrorReport}
                >
                  <Icon name="download" size={16} />
                  <span>Download Error Report ({preview.errors})</span>
                </button>
              )}
              <div className="bulk-import-modal__spacer" />
              <button
                type="button"
                className="bulk-import-btn bulk-import-btn--secondary"
                onClick={handleClose}
                disabled={importing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bulk-import-btn bulk-import-btn--primary"
                onClick={() => void handleConfirm()}
                disabled={importing || preview.valid === 0}
              >
                {importing ? (
                  <>
                    <div className="bulk-import-btn-spinner" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Icon name="check" size={16} />
                    <span>Confirm &amp; Import {preview.valid} {entityName}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Success View */}
        {result && (
          <div className="bulk-import-modal__success-card">
            <div className="bulk-import-success-icon">
              <Icon name="check" size={32} />
            </div>
            <h3>Import Completed Successfully!</h3>
            <p>
              Successfully added <strong>{result.created}</strong> records.
              {result.skipped > 0 && ` (${result.skipped} already existed)`}
              {result.failed > 0 && ` (${result.failed} failed)`}
            </p>
            <div className="bulk-import-modal__success-actions">
              <button
                type="button"
                className="bulk-import-btn bulk-import-btn--primary"
                onClick={handleClose}
              >
                Done &amp; View List
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
