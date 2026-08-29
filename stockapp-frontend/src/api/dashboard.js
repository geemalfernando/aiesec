import apiClient from '../api/ api';
// Fetch aggregated sales data for charts
export const fetchSalesChartData = async () => {
  try {
    const response = await apiClient.get('/dashboard/sales-data');
    return response.data.data; // Should return { salesSummary: { daily: [], monthly: [], ... } }
  } catch (error) {
    console.error("Error fetching sales chart data:", error.response?.data?.message || error.message);
    throw error;
  }
};

// Fetch summary for credit customers
export const fetchCreditCustomerSummary = async () => {
  try {
    const response = await apiClient.get('/dashboard/credit-customers');
    return response.data.data; // Should return an array of customer summaries
  } catch (error) {
    console.error("Error fetching credit customer summary:", error.response?.data?.message || error.message);
    throw error;
  }
};