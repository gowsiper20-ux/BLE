import { useState, useMemo, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import SearchBar from '../components/SearchBar';
import Select from '../components/Select';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { studentService } from '../services/studentService';
import { useApi } from '../hooks/useApi';
import type { Student, ClassSection, ApiResponse, TableColumn } from '../types';

import StudentFormModal from '../components/students/StudentFormModal';
import StudentImportModal from '../components/students/StudentImportModal';
import './StudentsPage.css';

export default function StudentsPage() {
  const { showToast } = useToast();
  
  // States for fetching
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // UI States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Delete
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // References
  const { data: classesResponse } = useApi<ApiResponse<ClassSection[]>>('/api/classes');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await studentService.getStudents({
        search: searchQuery,
        classId: filterClass,
        status: filterStatus,
        page,
        limit: 20
      });
      setStudents(res.students);
      setTotal(res.pagination.total);
    } catch (err) {
      showToast('error', 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterClass, filterStatus, page, showToast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setSelectedStudent(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!studentToDelete) return;
    try {
      await studentService.deactivateStudent(studentToDelete.id);
      showToast('success', 'Student deleted successfully');
      fetchStudents();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || err.message || 'Failed to delete student');
    } finally {
      setStudentToDelete(null);
    }
  };

  const columns: TableColumn<Student>[] = useMemo(() => [
    { key: 'registerNumber', label: 'Register Number', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'collegeEmail', label: 'College Email', sortable: true },
    { key: 'className', label: 'Class', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => (
        <Badge variant={val === 'ACTIVE' ? 'success' : 'danger'}>{val}</Badge>
      )
    }
  ], []);

  const actions = (row: Student) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
        Edit
      </Button>
      {row.status === 'ACTIVE' && (
        <Button variant="danger" size="sm" onClick={() => setStudentToDelete(row)}>
          Delete
        </Button>
      )}
    </div>
  );

  return (
    <div className="students-page">
      <PageHeader
        title="Students"
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Students' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" icon="upload" onClick={() => setIsImportOpen(true)}>
              Import Students
            </Button>
            <Button icon="add" onClick={handleAdd}>
              Add Student
            </Button>
          </div>
        }
      />

      <div className="students-page__filters">
        <SearchBar 
          placeholder="Search by name, email or reg no..."
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <div className="students-page__filter-group">
          <Select 
            label=""
            value={filterClass}
            onChange={setFilterClass}
            options={[
              { value: '', label: 'All Classes' },
              ...(classesResponse?.data?.map(c => ({ value: c.id, label: c.name })) || [])
            ]}
          />
          <Select 
            label=""
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'GRADUATED', label: 'Graduated' },
              { value: 'SUSPENDED', label: 'Suspended' }
            ]}
          />
        </div>
      </div>

      <div className="students-page__content">
        <DataTable
          columns={columns}
          data={students}
          keyField="id"
          actions={actions}
          loading={loading}
          emptyMessage="No students found matching your criteria"
          page={page}
          pageSize={20}
          total={total}
          onPageChange={setPage}
        />
        <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Total Students: {total}
        </div>
      </div>

      <StudentFormModal 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        student={selectedStudent}
        onSuccess={fetchStudents}
      />

      <StudentImportModal 
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={fetchStudents}
      />

      <ConfirmDialog
        isOpen={!!studentToDelete}
        title="Delete Student?"
        message={`Are you sure you want to delete this student (${studentToDelete?.name} - ${studentToDelete?.registerNumber})? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onClose={() => setStudentToDelete(null)}
        variant="danger"
      />
    </div>
  );
}
