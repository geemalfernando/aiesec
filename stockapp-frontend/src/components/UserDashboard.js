// src/components/UserDashboard.js
import React, { useState, useEffect, useRef } from 'react'; // useRef is not used in this version, can be removed
// FIX: Removed unused axios import
// import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// --- NEW IMPORTS FOR CHARTS AND DASHBOARD DATA ---
import { fetchSalesChartData } from '../api/dashboard';
import { fetchCreditCustomerSummary } from '../api/dashboard';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const UserDashboard = () => {
  // State for Sales Data Charts
  const [salesChartData, setSalesChartData] = useState({ salesSummary: { daily: [], monthly: [] } });
  const [salesChartLoading, setSalesChartLoading] = useState(true);

  // State for Credit Customer Summary
  const [creditCustomersSummary, setCreditCustomersSummary] = useState([]);
  const [creditCustomersLoading, setCreditCustomersLoading] = useState(true);

  // General loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { currentUser, logout } = useAuth();

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      setError('');
      
      // Fetch Sales Chart Data independently
      try {
        const salesData = await fetchSalesChartData();
        setSalesChartData(salesData);
      } catch (err) {
        console.error('Error fetching sales chart data:', err);
        // Don't block the whole dashboard, just set empty data
        setSalesChartData({ salesSummary: { daily: [], monthly: [] } });
      } finally {
        setSalesChartLoading(false);
      }

      // Fetch Credit Customers Summary independently
      try {
        const creditCustSummary = await fetchCreditCustomerSummary();
        setCreditCustomersSummary(creditCustSummary);
      } catch (err) {
        console.error('Error fetching credit customers:', err);
        // Don't block the whole dashboard, just set empty array
        setCreditCustomersSummary([]);
      } finally {
        setCreditCustomersLoading(false);
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  // --- Chart Data Preparation ---
  const dailySalesChartOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Daily Sales' } },
    scales: {
      x: { title: { display: true, text: 'Date' } },
      y: { title: { display: true, text: 'Sales ($)' }, beginAtZero: true }
    }
  };

  const dailySalesChartData = {
    labels: salesChartData?.salesSummary?.daily?.map(d => d._id) || [],
    datasets: [
      {
        label: 'Daily Sales ($)',
        data: salesChartData?.salesSummary?.daily?.map(d => d.totalSales) || [],
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

   const monthlySalesChartOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Monthly Sales' } },
    scales: {
      x: { title: { display: true, text: 'Month' } },
      y: { title: { display: true, text: 'Sales ($)' }, beginAtZero: true }
    }
  };

  const monthlySalesChartData = {
    labels: salesChartData?.salesSummary?.monthly?.map(d => d._id) || [],
    datasets: [
      {
        label: 'Monthly Sales ($)',
        data: salesChartData?.salesSummary?.monthly?.map(d => d.totalSales) || [],
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  if (!currentUser) {
    return <div className="flex justify-center items-center h-screen">User not logged in.</div>;
  }

  if (loading && !salesChartData && creditCustomersSummary.length === 0) {
    return <div className="flex justify-center items-center h-screen">Loading Dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">User Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {currentUser?.username}</span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Error Message */}
          {error && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
              <strong>Note:</strong> {error}
            </div>
          )}

          {/* User Profile Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 bg-indigo-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">{currentUser?.username?.charAt(0).toUpperCase() || '?'}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl><dt className="text-sm font-medium text-gray-500 truncate">Profile</dt><dd className="text-lg font-medium text-gray-900">{currentUser?.username}</dd></dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0"><div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center"><span className="text-white">@</span></div></div>
                  <div className="ml-5 w-0 flex-1"><dl><dt className="text-sm font-medium text-gray-500 truncate">Email</dt><dd className="text-lg font-medium text-gray-900">{currentUser?.email}</dd></dl></div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0"><div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center"><span className="text-white">👤</span></div></div>
                  <div className="ml-5 w-0 flex-1"><dl><dt className="text-sm font-medium text-gray-500 truncate">Role</dt><dd className="text-lg font-medium text-gray-900 capitalize">{currentUser?.role}</dd></dl></div>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Daily Sales</h3>
              {salesChartLoading ? (
                <p className="text-center text-gray-500 py-8">Loading daily sales...</p>
              ) : salesChartData?.salesSummary?.daily?.length > 0 ? (
                <Bar data={dailySalesChartData} options={dailySalesChartOptions} />
              ) : (
                <p className="text-center text-gray-500 py-8">No daily sales data available.</p>
              )}
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Monthly Sales</h3>
              {salesChartLoading ? (
                <p className="text-center text-gray-500 py-8">Loading monthly sales...</p>
              ) : salesChartData?.salesSummary?.monthly?.length > 0 ? (
                <Bar data={monthlySalesChartData} options={monthlySalesChartOptions} />
              ) : (
                <p className="text-center text-gray-500 py-8">No monthly sales data available.</p>
              )}
            </div>
          </div>

          {/* Credit Customers Summary */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h3 className="text-xl font-semibold mb-4">Credit Customers Summary</h3>
            {creditCustomersLoading ? (
              <p className="text-center text-gray-500 py-8">Loading credit customers...</p>
            ) : creditCustomersSummary.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No credit customers found.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Owed ($)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Due Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {creditCustomersSummary.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.customerName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.totalAmountOwed.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(customer.latestDueDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;