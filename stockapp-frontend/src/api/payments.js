// src/api/payments.js
import apiClient from '../api/ api';

export const recordPayment = async (paymentData) => {
  const response = await apiClient.post('/payments', paymentData);
  return response.data.data;
};

export const fetchChequeTracker = async () => {
  const response = await apiClient.get('/payments/cheques');
  return response.data.data;
};

export const updateChequeStatus = async (paymentId, status, reason) => {
  const response = await apiClient.patch(`/payments/cheques/${paymentId}/status`, { status, reason });
  return response.data.data;
};
