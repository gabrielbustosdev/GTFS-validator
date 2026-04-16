import { useState, useCallback, useRef } from 'react';
import { uploadAndValidate, fetchJobStatus } from '../services/api';

export function useValidationJob() {
  const [jobState, setJobState] = useState({
    jobId: null,
    status: 'idle', // idle | uploading | queued | processing | completed | error
    progress: 0,
    message: '',
    results: null
  });
  
  const pollingIntervalRef = useRef(null);

  const startPolling = useCallback((jobId) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const data = await fetchJobStatus(jobId);
        
        setJobState(prev => ({
          ...prev,
          status: data.status,
          progress: data.progress || prev.progress,
          message: data.error || data.message || prev.message,
          results: data.status === 'completed' ? data : null
        }));

        if (data.status === 'completed' || data.status === 'error') {
          clearInterval(pollingIntervalRef.current);
        }
      } catch (error) {
        console.error("Polling error:", error);
        setJobState(prev => ({
          ...prev,
          status: 'error',
          message: 'Error communicating with server during polling.'
        }));
        clearInterval(pollingIntervalRef.current);
      }
    }, 1500); // Poll every 1.5s
  }, []);

  const uploadFile = async (file) => {
    setJobState({ jobId: null, status: 'uploading', progress: 0, message: 'Uploading ZIP file...', results: null });
    try {
      const data = await uploadAndValidate(file);
      setJobState({
        jobId: data.jobId,
        status: data.status, // might be 'queued'
        progress: 0,
        message: data.message,
        results: null
      });
      
      startPolling(data.jobId);
      
    } catch (error) {
      console.error("Upload error:", error);
      setJobState({
        jobId: null,
        status: 'error',
        progress: 0,
        message: 'Failed to upload file.',
        results: null
      });
    }
  };

  const reset = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setJobState({ jobId: null, status: 'idle', progress: 0, message: '', results: null });
  };

  const loadJob = async (jobId) => {
    setJobState({ jobId, status: 'processing', progress: 100, message: 'Cargando reporte anterior...', results: null });
    startPolling(jobId);
  };

  return { ...jobState, uploadFile, loadJob, reset };
}
