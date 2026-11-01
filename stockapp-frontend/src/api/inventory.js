// src/api/inventory.js
import apiClient from '../api/ api'; // Correct path

export const fetchInventoryItems = async () => {
  try {
    // Fetches all inventory items across all locations. Filtering can be done on frontend.
    // Or, you might have a dedicated endpoint for listing all items if /admin/inventory is restricted.
    const response = await apiClient.get('/admin/inventory');
    return response.data.data;
  } catch (error) {
    console.error("Error fetching inventory:", error.response?.data?.message || error.message);
    throw error;
  }
};

// NEW: Function to fetch inventory for a specific location
export const fetchInventoryByLocation = async (location) => {
  try {
    // Assumes endpoint like /api/inventory/:location
    const response = await apiClient.get(`/inventory/${location}`);
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching inventory from ${location}:`, error.response?.data?.message || error.message);
    throw error;
  }
};

// NEW: Function to get available locations
export const fetchLocations = async () => {
  try {
    // Assumes endpoint like /api/inventory/locations
    const response = await apiClient.get('/inventory/locations');
    return response.data.data;
  } catch (error) {
    console.error("Error fetching locations:", error.response?.data?.message || error.message);
    throw error;
  }
};

// NEW: Function to transfer inventory
export const transferInventory = async (transferData) => {
  try {
    // transferData should include: { itemId, fromLocation, toLocation, quantity }
    const response = await apiClient.post('/inventory/transfer', transferData);
    return response.data;
  } catch (error) {
    console.error("Error transferring inventory:", error.response?.data?.message || error.message);
    throw error;
  }
};

export const addInventoryItem = async (itemData) => {
  const response = await apiClient.post('/admin/inventory', itemData);
  return response.data.data;
};
