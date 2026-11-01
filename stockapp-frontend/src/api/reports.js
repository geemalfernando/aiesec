// src/api/reports.js
import apiClient from '../api/ api';

const data = async (request) => (await request).data.data;

export const fetchCustomerSummaries = () => data(apiClient.get('/reports/customers'));
export const fetchCustomerReport = (customerId) => data(apiClient.get(`/reports/customers/${customerId}`));
export const fetchItemSummaries = () => data(apiClient.get('/reports/items'));
export const fetchItemReport = (name) => data(apiClient.get(`/reports/items/${encodeURIComponent(name)}`));
export const updateItem = (name, changes) => data(apiClient.patch(`/reports/items/${encodeURIComponent(name)}`, changes));
export const setStockCount = (stockId, counts) => data(apiClient.patch(`/reports/stock/${stockId}/count`, counts));
export const fetchOrderForecast = async (params) => {
  const { data } = await apiClient.get('/reports/forecast', { params });
  return data.data;
};
export const fetchRestocks = () => data(apiClient.get('/restocks'));
export const recordRestock = (restock) => data(apiClient.post('/restocks', restock));
