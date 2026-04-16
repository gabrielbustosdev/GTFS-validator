import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api'; // Uses Vite proxy in dev, and VITE_API_URL in production

export const uploadAndValidate = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(`${API_URL}/validate`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data; // { jobId, status, message }
};

export const fetchJobStatus = async (jobId) => {
  const response = await axios.get(`${API_URL}/validate/${jobId}`);
  return response.data; 
};
export const fetchHistory = async () => {
  const response = await axios.get(`${API_URL}/history`);
  return response.data;
};

export const fetchStops = async (jobId, routeId = null, onlyIssues = false) => {
  let url = `${API_URL}/gtfs/${jobId}/stops`;
  const params = [];
  if (routeId) params.push(`route_id=${encodeURIComponent(routeId)}`);
  if (onlyIssues) params.push(`only_issues=true`);
  if (params.length > 0) url += `?${params.join('&')}`;
  
  const response = await axios.get(url);
  return response.data;
};

export const fetchShapes = async (jobId, routeId = null) => {
  let url = `${API_URL}/gtfs/${jobId}/shapes`;
  if (routeId) url += `?route_id=${encodeURIComponent(routeId)}`;
  
  const response = await axios.get(url);
  return response.data;
};

export const fetchRoutes = async (jobId) => {
  const response = await axios.get(`${API_URL}/gtfs/${jobId}/routes`);
  return response.data;
};
