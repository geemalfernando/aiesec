import React, { useState, useEffect, useCallback } from 'react';
import { fetchSalesHistory } from '../api/sales';
import { useAuth } from '../context/AuthContext';

const SalesHistoryPage = () => {
  const { currentUser, logout } = useAuth();
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const fetchSales = async () => {
    setLoading(true);
    setError('');
    try {
      const salesData = await fetchSalesHistory();
      setSales(salesData);
      setFilteredSales(salesData);
    } catch (err) {
      console.error('Error fetching sales history:', err);
      setError('Failed to load sales history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...sales];

    // Search filter (by customer name or sale ID)
    if (searchTerm) {
      filtered = filtered.filter(sale =>
        sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale._id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Payment method filter
    if (paymentMethodFilter) {
      filtered = filtered.filter(sale => sale.paymentMethod === paymentMethodFilter);
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.saleDate || sale.createdAt).toISOString().split('T')[0];
        return saleDate === dateFilter;
      });
    }

    setFilteredSales(filtered);
  }, [sales, searchTerm, paymentMethodFilter, dateFilter]);

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-xl">Loading sales history...</div>
      </div>
    );
  }

  // Calculate totals
  const totalSales = filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const cashSales = filteredSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const creditSales = filteredSales.filter(s => s.paymentMethod === 'credit').reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
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
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden shadow-lg rounded-xl border-l-4 border-blue-500 hover:shadow-xl transition-shadow duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Sales</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{filteredSales.length}</p>
                  </div>
                  <div className="h-14 w-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">📊</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 overflow-hidden shadow-lg rounded-xl border-l-4 border-green-500 hover:shadow-xl transition-shadow duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-600 uppercase tracking-wide">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${totalSales.toFixed(2)}</p>
                  </div>
                  <div className="h-14 w-14 bg-green-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">💰</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 overflow-hidden shadow-lg rounded-xl border-l-4 border-yellow-500 hover:shadow-xl transition-shadow duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-yellow-600 uppercase tracking-wide">Cash Sales</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${cashSales.toFixed(2)}</p>
                  </div>
                  <div className="h-14 w-14 bg-yellow-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">💵</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden shadow-lg rounded-xl border-l-4 border-purple-500 hover:shadow-xl transition-shadow duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Credit Sales</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${creditSales.toFixed(2)}</p>
                  </div>
                  <div className="h-14 w-14 bg-purple-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🏦</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white shadow-lg rounded-xl p-6 mb-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-5 pb-3 border-b border-gray-200 text-gray-900">Search & Filter</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by customer or sale ID..."
                    className="w-full p-3 pl-10 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Sales Table */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Sale ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Payment Method
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Due Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-4xl mb-3">📊</span>
                          <p className="text-gray-500 text-lg font-medium">
                            {sales.length === 0
                              ? 'No sales records found.'
                              : 'No sales match your filters.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr key={sale._id} className="hover:bg-blue-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="text-sm font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                            {sale._id?.substring(0, 8)}...
                          </code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{sale.customerName || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-700">
                            {new Date(sale.saleDate || sale.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                            {sale.items?.length || 0} item{sale.items?.length !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1.5 text-xs font-bold rounded-full border ${
                              sale.paymentMethod === 'cash'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                            }`}
                          >
                            {sale.paymentMethod || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">${(sale.totalAmount || 0).toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-700">
                            {sale.dueDate
                              ? new Date(sale.dueDate).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesHistoryPage;

