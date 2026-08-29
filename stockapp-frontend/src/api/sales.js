// src/api/sales.js
import apiClient from '../api/ api'; // Correct path

export const recordSale = async (saleData) => {
  try {
    // saleData should now include: { ..., dueDate: 'YYYY-MM-DD' } if paymentMethod is 'credit'
    const response = await apiClient.post('/sales/entry', saleData);
    return response.data;
  } catch (error) {
    console.error("Error recording sale:", error.response?.data?.message || error.message);
    throw error;
  }
};

export const fetchSalesHistory = async (filters = {}) => {
  try {
    // Filters could include: customerId, paymentMethod, dateRange, etc.
    const response = await apiClient.get('/sales/history', { params: filters });
    return response.data.data;
  } catch (error) {
    console.error("Error fetching sales history:", error.response?.data?.message || error.message);
    throw error;
  }
};

// NEW: Function to fetch due bills
export const fetchDueBills = async () => {
    try {
        const response = await apiClient.get('/sales/due-bills');
        return response.data.data;
    } catch (error) {
        console.error("Error fetching due bills:", error.response?.data?.message || error.message);
        throw error;
    }
};

// NEW: Function to fetch overdue bills
export const fetchOverdueBills = async () => {
    try {
        const response = await apiClient.get('/sales/overdue-bills');
        return response.data.data;
    } catch (error) {
        console.error("Error fetching overdue bills:", error.response?.data?.message || error.message);
        throw error;
    }
};