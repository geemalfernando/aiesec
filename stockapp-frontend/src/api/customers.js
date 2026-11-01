// src/api/customers.js
import apiClient from '../api/ api'; // Correct path to your apiClient

export const fetchCustomers = async () => {
  try {
    const response = await apiClient.get('/customers');
    return response.data.data;
  } catch (error) {
    console.error("Error fetching customers:", error.response?.data?.message || error.message);
    throw error;
  }
};

export const addCustomer = async (customerData) => {
  try {
    const response = await apiClient.post('/customers', customerData);
    return response.data.data;
  } catch (error) {
    console.error("Error adding customer:", error.response?.data?.message || error.message);
    throw error;
  }
};



export const updateCustomer = async (customerId, customerData) => {
  const response = await apiClient.put(`/customers/${customerId}`, customerData);
  return response.data.data;
};

export const deleteCustomer = async (customerId) => {
  await apiClient.delete(`/customers/${customerId}`);
};
