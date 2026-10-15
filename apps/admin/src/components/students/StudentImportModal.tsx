import { useState } from 'react';
import Modal from '../Modal';
import Button from '../Button';
import Icon from '../Icon';
import Badge from '../Badge';
import { studentService } from '../../services/studentService';
import type { StudentImportPreview, StudentImportResult } from '../../types';

interface StudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StudentImportModal({ isOpen, onClose, onSuccess }: StudentImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [result, setResult] = useState<StudentImportResult | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const resetState = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
  };

  const handleClose = () => {
    if (step === 5) onSuccess();
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await studentService.validateImport(file);
      setPreview(data);
      setStep(3); // Go to preview
    } catch (err: any) {
      setError(err.message || 'Failed to validate file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    
    if (preview.errors > 0) {
      setError('Cannot import file with errors. Please fix the errors and upload again.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await studentService.confirmImport(preview.data);
      setResult(res);
      setStep(5); // Go to result
    } catch (err: any) {
      setError(err.message || 'Import failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Students"
      size="lg"
    >
      <div style={{ padding: '10px 0' }}>
        
        {/* Step Indicators */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', fontSize: '14px', fontWeight: 600 }}>
          <span style={{ color: step >= 1 ? 'var(--color-primary)' : 'var(--text-secondary)' }}>1. Upload</span> →
          <span style={{ color: step >= 3 ? 'var(--color-primary)' : 'var(--text-secondary)' }}>2. Preview</span> →
          <span style={{ color: step >= 4 ? 'var(--color-primary)' : 'var(--text-secondary)' }}>3. Confirm</span> →
          <span style={{ color: step === 5 ? 'var(--color-primary)' : 'var(--text-secondary)' }}>4. Result</span>
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="secondary" onClick={() => studentService.downloadCsvTemplate()}>
                <Icon name="download" size={16} /> CSV Template
              </Button>
              <Button variant="secondary" onClick={() => studentService.downloadXlsxTemplate()}>
                <Icon name="download" size={16} /> Excel Template
              </Button>
            </div>
            
            <div style={{ border: '2px dashed var(--border-color)', padding: '32px', textAlign: 'center', borderRadius: '8px' }}>
              <input 
                type="file" 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Icon name="upload" size={32} />
                <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>Click to Browse</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Supported formats: CSV, XLSX</span>
              </label>
            </div>

            {file && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="file" size={20} />
                  <span>{file.name}</span>
                </div>
                <Button variant="ghost" onClick={() => setFile(null)}>Remove</Button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button onClick={handleValidate} disabled={!file} loading={isLoading}>
                Validate File
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 & 4: PREVIEW & CONFIRM */}
        {(step === 3 || step === 4) && preview && (
          <div>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
              <div><strong>Total Rows:</strong> {preview.totalRows}</div>
              <div style={{ color: 'var(--color-success)' }}><strong>Valid:</strong> {preview.valid}</div>
              <div style={{ color: 'var(--color-danger)' }}><strong>Errors:</strong> {preview.errors}</div>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
              <table className="data-table__table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Register No</th>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.data.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.registerNumber}</td>
                      <td>{row.name}</td>
                      <td>{row.className}</td>
                      <td>
                        {row.isValid ? (
                          <Badge variant="success">Valid</Badge>
                        ) : (
                          <div style={{ color: 'var(--color-danger)', fontSize: '12px' }}>
                            {row.errors.map(e => <div key={e.code}>{e.message}</div>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <Button variant="secondary" onClick={resetState}>Start Over</Button>
              <Button 
                onClick={() => setStep(4)} 
                style={{ display: step === 3 ? 'block' : 'none' }}
              >
                Continue to Confirm
              </Button>
              <Button 
                onClick={handleConfirm} 
                loading={isLoading}
                disabled={preview.errors > 0}
                style={{ display: step === 4 ? 'block' : 'none' }}
              >
                Confirm Import
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: RESULT */}
        {step === 5 && result && (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ color: 'var(--color-success)', marginBottom: '16px' }}>
              <Icon name="check-circle" size={48} />
            </div>
            <h2>Import Successful</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Successfully imported {result.created} students.
            </p>
            <Button onClick={handleClose}>View Students</Button>
          </div>
        )}

      </div>
    </Modal>
  );
}
