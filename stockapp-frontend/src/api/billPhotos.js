// src/api/billPhotos.js
import apiClient from '../api/ api';

export const fetchBillPhotos = async (params) => {
  const { data } = await apiClient.get('/bill-photos', { params });
  return { photos: data.data, counts: data.counts, imagesDir: data.imagesDir };
};
export const billPhotoUrl = (id) => `${apiClient.defaults.baseURL}/bill-photos/${id}/image`;
export const fetchBillPhotoFile = async (photo) => {
  const { data } = await apiClient.get(`/bill-photos/${photo._id}/image`, { responseType: 'blob' });
  return new File([data], `bill-${photo._id}.jpg`, { type: 'image/jpeg' });
};
export const setBillPhotoStatus = (id, status) => apiClient.patch(`/bill-photos/${id}/status`, { status });

// Keeps a copy on this computer. A failure here must not undo a sale or restock that has saved.
export const saveImageCopy = async (path, file) => {
  await apiClient.post(path, file, { headers: { 'Content-Type': file.type || 'image/jpeg' } });
};
