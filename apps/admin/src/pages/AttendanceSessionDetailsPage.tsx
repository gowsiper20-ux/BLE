import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { useToast } from '../hooks/useToast';
import { attendanceService } from '../services/attendanceService';
import type { AttendanceSession, LiveAttendanceData } from '../types';
import DataTable from '../components/DataTable';

export default function AttendanceSessionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [liveData, setLiveData] = useState<LiveAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bleLoading, setBleLoading] = useState(false);
  
  const navigate = useNavigate();
  const { showToast } = useToast();

  const fetchSession = useCallback(async () => {
    if (!id) return;
    try {
      const res = await attendanceService.getSession(id);
      setSession(res.data);
      if (res.data.status === 'ACTIVE' || res.data.status === 'COMPLETED') {
        fetchLiveAttendance();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to fetch session');
      navigate('/attendance');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, showToast]);

  const fetchLiveAttendance = async () => {
    if (!id) return;
    try {
      const res = await attendanceService.getLiveAttendance(id);
      setLiveData(res.data);
    } catch (err: any) {
      console.error('Failed to fetch live attendance', err);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (session?.status !== 'ACTIVE') return;
    const interval = setInterval(fetchLiveAttendance, 5000);
    return () => clearInterval(interval);
  }, [session?.status]);

  const handleStartBle = async () => {
    if (!id) return;
    setBleLoading(true);
    try {
      await attendanceService.startBle(id);
      showToast('success', 'BLE Scanning Started');
      fetchLiveAttendance();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to start BLE');
    } finally {
      setBleLoading(false);
    }
  };

  const handleStopBle = async () => {
    if (!id) return;
    setBleLoading(true);
    try {
      await attendanceService.stopBle(id);
      showToast('success', 'BLE Scanning Stopped');
      fetchLiveAttendance();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to stop BLE');
    } finally {
      setBleLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!id || !window.confirm('Are you sure you want to end this active session?')) return;
    try {
      await attendanceService.endSession(id);
      showToast('success', 'Session ended successfully');
      fetchSession();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to end session');
    }
  };

  const handleCancelSession = async () => {
    if (!id) return;
    const reason = window.prompt('Enter reason for cancellation:');
    if (!reason) return;

    try {
      await attendanceService.cancelSession(id, reason);
      showToast('success', 'Session cancelled successfully');
      fetchSession();
    } catch (err: any) {
      showToast('error', err.response?.data?.error?.message || 'Failed to cancel session');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!session) return <div>Session not found</div>;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
      SCHEDULED: 'default',
      ACTIVE: 'info',
      COMPLETED: 'success',
      CANCELLED: 'danger',
      EXPIRED: 'warning'
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title={`Session Details`}
        breadcrumbs={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Attendance', path: '/attendance' },
          { label: 'Session' }
        ]}
        actions={
          <div style={{ display: 'flex', gap: '12px' }}>
            {session.status === 'ACTIVE' && (
              <>
                <Button onClick={handleStartBle} disabled={bleLoading} variant="secondary">
                  Start BLE
                </Button>
                <Button onClick={handleStopBle} disabled={bleLoading} variant="secondary">
                  Stop BLE
                </Button>
                <Button onClick={handleEndSession} variant="primary">
                  End Session
                </Button>
              </>
            )}
            {(session.status === 'ACTIVE' || session.status === 'SCHEDULED') && (
              <Button onClick={handleCancelSession} variant="danger">
                Cancel Session
              </Button>
            )}
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <Card title="Session Information">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><strong>Session ID:</strong> {session.id}</div>
            <div><strong>Status:</strong> {getStatusBadge(session.status)}</div>
            <div><strong>Date:</strong> {new Date(session.sessionDate).toLocaleDateString()}</div>
            <div><strong>Scheduled Time:</strong> {session.periodStartTime} - {session.periodEndTime} ({session.periodName})</div>
            <div><strong>Actual Start:</strong> {session.startedAt ? new Date(session.startedAt).toLocaleTimeString() : 'Not started'}</div>
            <div><strong>Actual End:</strong> {session.endedAt ? new Date(session.endedAt).toLocaleTimeString() : 'Not ended'}</div>
            {session.cancellationReason && (
              <div><strong>Cancellation Reason:</strong> {session.cancellationReason}</div>
            )}
          </div>
        </Card>

        {liveData ? (
          <Card title="Live Attendance Stats">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><strong>Total Students:</strong> {liveData.totalStudents}</div>
              <div><strong>Detected:</strong> <span style={{ color: 'var(--success)' }}>{liveData.detectedStudents}</span></div>
              <div><strong>Not Detected:</strong> <span style={{ color: 'var(--danger)' }}>{liveData.notDetectedStudents}</span></div>
              <div><strong>Attendance Percentage:</strong> {liveData.percentage}%</div>
            </div>
          </Card>
        ) : (
          <Card title="Academic Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><strong>Class:</strong> {session.className}</div>
              <div><strong>Subject:</strong> {session.subjectName}</div>
              <div><strong>Staff:</strong> {session.staffName}</div>
            </div>
          </Card>
        )}
      </div>

      {liveData && (
        <Card title="Live Student Roster" padding="none">
          <DataTable
            data={liveData.students}
            keyField="studentId"
            columns={[
              { key: 'registerNumber', label: 'Register Number' },
              { key: 'name', label: 'Student Name' },
              { 
                key: 'status', 
                label: 'Status',
                render: (val) => (
                  <Badge variant={val === 'PRESENT' ? 'success' : 'danger'}>
                    {val as string}
                  </Badge>
                )
              },
              { key: 'source', label: 'Source', render: (val) => (val as string) || '-' },
              { key: 'firstDetectedAt', label: 'First Detected', render: (val) => val ? new Date(val as string).toLocaleTimeString() : '-' },
              { key: 'lastDetectedAt', label: 'Last Detected', render: (val) => val ? new Date(val as string).toLocaleTimeString() : '-' },
              { key: 'detectionCount', label: 'Pings' },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
