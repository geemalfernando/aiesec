import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { fetchInventoryItems } from '../api/inventory';
import { fetchDueBills, fetchOverdueBills } from '../api/sales';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const { currentUser, logout } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [dueBills, setDueBills] = useState([]);
  const [overdueBills, setOverdueBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    
    // Fetch each data independently so one failure doesn't block the whole dashboard
    try {
      const usersRes = await axios.get('/api/admin/users');
      setUsers(usersRes.data.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
      setError('Some data failed to load. Showing available information.');
    }

    try {
      const inventory = await fetchInventoryItems();
      setInventoryItems(inventory || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setInventoryItems([]);
      if (!error) {
        setError('Some data failed to load. Showing available information.');
      }
    }

    try {
      const due = await fetchDueBills();
      setDueBills(due || []);
    } catch (err) {
      console.error('Error fetching due bills:', err);
      setDueBills([]);
    }

    try {
      const overdue = await fetchOverdueBills();
      setOverdueBills(overdue || []);
    } catch (err) {
      console.error('Error fetching overdue bills:', err);
      setOverdueBills([]);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    );
  }

  // Calculate statistics
  const totalInventoryValue = inventoryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalInventoryQuantity = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockItems = inventoryItems.filter(item => item.quantity > 0 && item.quantity < 10).length;
  const outOfStockItems = inventoryItems.filter(item => item.quantity === 0).length;
  const totalDueAmount = dueBills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
  const totalOverdueAmount = overdueBills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {currentUser?.username || 'Admin'}</span>
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

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-200 border-l-4 border-blue-500">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{users.length}</p>
                  </div>
                  <div className="h-14 w-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">👥</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-200 border-l-4 border-green-500">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-600 uppercase tracking-wide">Inventory Items</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{inventoryItems.length}</p>
                    <p className="text-xs text-gray-600 mt-1 font-medium">Total Qty: {totalInventoryQuantity}</p>
                  </div>
                  <div className="h-14 w-14 bg-green-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">📦</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-200 border-l-4 border-purple-500">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Inventory Value</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${totalInventoryValue.toFixed(2)}</p>
                  </div>
                  <div className="h-14 w-14 bg-purple-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">💰</span>
          </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-200 border-l-4 border-red-500">
              <div className="p-6">
                <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-red-600 uppercase tracking-wide">Outstanding Bills</p>
                    <p className="text-3xl font-bold text-red-900 mt-2">${(totalDueAmount + totalOverdueAmount).toFixed(2)}</p>
                    <p className="text-xs text-red-700 mt-1 font-semibold">{overdueBills.length} overdue</p>
                </div>
                  <div className="h-14 w-14 bg-red-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">⚠️</span>
                </div>
                </div>
                </div>
            </div>
          </div>

          {/* Alerts */}
          {(lowStockItems > 0 || outOfStockItems > 0 || overdueBills.length > 0) && (
            <div className="mb-8 space-y-3">
              {lowStockItems > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        <span className="font-medium">Low Stock Alert:</span> {lowStockItems} item(s) have low stock (less than 10 units).
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {outOfStockItems > 0 && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-red-700">
                        <span className="font-medium">Out of Stock:</span> {outOfStockItems} item(s) are out of stock.
                      </p>
                    </div>
                      </div>
                      </div>
              )}
              {overdueBills.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-red-700">
                        <span className="font-medium">Overdue Bills:</span> {overdueBills.length} bill(s) are overdue. Total: ${totalOverdueAmount.toFixed(2)}
                      </p>
                      </div>
                  </div>
                  </div>
                )}
              </div>
          )}

          {/* Quick Access Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Link
              to="/admin/inventory"
              className="bg-white shadow-lg rounded-xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-gray-100 group"
            >
              <div className="flex items-start">
                <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white text-2xl mr-4 shadow-md group-hover:scale-110 transition-transform duration-200">
                  📦
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Inventory Management</h3>
                  <p className="text-sm text-gray-600">View and manage stock items</p>
              </div>
              </div>
            </Link>

            <Link
              to="/admin/stock-transfer"
              className="bg-white shadow-lg rounded-xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-gray-100 group"
            >
              <div className="flex items-start">
                <div className="h-14 w-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl mr-4 shadow-md group-hover:scale-110 transition-transform duration-200">
                  🔄
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Stock Transfer</h3>
                  <p className="text-sm text-gray-600">Transfer items between locations</p>
                </div>
              </div>
            </Link>

            <Link
              to="/admin/sales-entry"
              className="bg-white shadow-lg rounded-xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-gray-100 group"
            >
              <div className="flex items-start">
                <div className="h-14 w-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white text-2xl mr-4 shadow-md group-hover:scale-110 transition-transform duration-200">
                  💰
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Register Sale</h3>
                  <p className="text-sm text-gray-600">Record a new sale transaction</p>
                </div>
              </div>
            </Link>

            <Link
              to="/admin/sales-history"
              className="bg-white shadow-lg rounded-xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-gray-100 group"
            >
              <div className="flex items-start">
                <div className="h-14 w-14 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center text-white text-2xl mr-4 shadow-md group-hover:scale-110 transition-transform duration-200">
                  📊
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Sales History</h3>
                  <p className="text-sm text-gray-600">View past sales and transactions</p>
                </div>
              </div>
            </Link>

            <Link
              to="/admin/credit-bills"
              className="bg-white shadow-lg rounded-xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-gray-100 group"
            >
              <div className="flex items-start">
                <div className="h-14 w-14 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white text-2xl mr-4 shadow-md group-hover:scale-110 transition-transform duration-200">
                  📋
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Credit Bills</h3>
                  <p className="text-sm text-gray-600">Manage due and overdue bills</p>
                  {overdueBills.length > 0 && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200">
                      {overdueBills.length} overdue
                    </span>
                  )}
                </div>
              </div>
            </Link>

            <Link
              to="/admin/users"
              className="bg-white shadow-lg rounded-xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-gray-100 group"
            >
              <div className="flex items-start">
                <div className="h-14 w-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl mr-4 shadow-md group-hover:scale-110 transition-transform duration-200">
                  👥
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">User Management</h3>
                  <p className="text-sm text-gray-600">Manage users and permissions</p>
            </div>
          </div>
            </Link>
          </div>
            </div>
          </div>
    </div>
  );
};

export default AdminDashboard;
