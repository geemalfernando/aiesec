import React, { useState, useEffect } from 'react';
import { fetchDueBills, fetchOverdueBills } from '../api/sales';
import { useAuth } from '../context/AuthContext';
import CollectPaymentModal from '../components/sales/CollectPaymentModal';

const CreditBillsPage = () => {
  const { currentUser, logout } = useAuth();
  const [dueBills, setDueBills] = useState([]);
  const [overdueBills, setOverdueBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collectingBill, setCollectingBill] = useState(null);

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    setLoading(true);
    setError('');
    try {
      const [due, overdue] = await Promise.all([
        fetchDueBills(),
        fetchOverdueBills()
      ]);
      setDueBills(due);
      setOverdueBills(overdue);
    } catch (err) {
      console.error('Error fetching credit bills:', err);
      setError('Failed to load credit bills. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysOverdue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today - due;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const calculateDaysUntilDue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-xl">Loading credit bills...</div>
      </div>
    );
  }

  const totalDueAmount = dueBills.reduce((sum, bill) => sum + (bill.balanceDue || 0), 0);
  const totalOverdueAmount = overdueBills.reduce((sum, bill) => sum + (bill.balanceDue || 0), 0);
  const totalOutstanding = totalDueAmount + totalOverdueAmount;

  return (
    <div className="min-h-screen bg-gray-50">
      {collectingBill && (
        <CollectPaymentModal
          bill={collectingBill}
          onClose={() => setCollectingBill(null)}
          onCollected={() => {
            setCollectingBill(null);
            fetchBills();
          }}
        />
      )}
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">Credit Bills Management</h1>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 overflow-hidden shadow-lg rounded-xl border-l-4 border-yellow-500 hover:shadow-xl transition-shadow duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-yellow-600 uppercase tracking-wide">Due Soon</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{dueBills.length} bills</p>
                    <p className="text-sm font-semibold text-gray-700 mt-1">${totalDueAmount.toFixed(2)}</p>
                  </div>
                  <div className="h-14 w-14 bg-yellow-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">📅</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 overflow-hidden shadow-lg rounded-xl border-l-4 border-red-500 hover:shadow-xl transition-shadow duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-600 uppercase tracking-wide">Overdue</p>
                    <p className="text-3xl font-bold text-red-900 mt-2">{overdueBills.length} bills</p>
                    <p className="text-sm font-semibold text-red-700 mt-1">${totalOverdueAmount.toFixed(2)}</p>
                  </div>
                  <div className="h-14 w-14 bg-red-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">⚠️</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden shadow-lg rounded-xl border-l-4 border-blue-500 hover:shadow-xl transition-shadow duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Outstanding</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">${totalOutstanding.toFixed(2)}</p>
                    <p className="text-sm font-semibold text-gray-700 mt-1">{(dueBills.length + overdueBills.length)} total bills</p>
                  </div>
                  <div className="h-14 w-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">💰</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Overdue Bills Section */}
          <div className="bg-white shadow-lg rounded-xl mb-8 overflow-hidden border border-gray-100">
            <div className="px-6 py-5 bg-gradient-to-r from-red-50 to-red-100 border-b-2 border-red-300">
              <h2 className="text-2xl font-bold text-red-900">
                Overdue Bills <span className="text-lg font-semibold">({overdueBills.length})</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              {overdueBills.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-5xl mb-4">✅</span>
                    <p className="text-lg font-semibold text-gray-700">No overdue bills. Great job!</p>
                  </div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-red-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                        Balance Due
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                        Days Overdue
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-red-800 uppercase tracking-wider">
                        Collect
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {overdueBills.map((bill) => {
                      const daysOverdue = calculateDaysOverdue(bill.dueDate);
                      return (
                        <tr key={bill._id} className="hover:bg-red-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-red-900">{bill.customerName || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-red-700">${(bill.balanceDue || 0).toFixed(2)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-red-700">
                              {new Date(bill.dueDate).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-red-200 text-red-900 border border-red-300">
                              {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button className="btn btn-sm btn-success" onClick={() => setCollectingBill(bill)}>Collect</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Due Bills Section */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
            <div className="px-6 py-5 bg-gradient-to-r from-yellow-50 to-yellow-100 border-b-2 border-yellow-300">
              <h2 className="text-2xl font-bold text-yellow-900">
                Due Soon <span className="text-lg font-semibold">({dueBills.length})</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              {dueBills.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-5xl mb-4">📅</span>
                    <p className="text-lg font-semibold text-gray-700">No bills due soon.</p>
                  </div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-yellow-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-yellow-800 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-yellow-800 uppercase tracking-wider">
                        Balance Due
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-yellow-800 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-yellow-800 uppercase tracking-wider">
                        Days Until Due
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-yellow-800 uppercase tracking-wider">
                        Collect
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dueBills.map((bill) => {
                      const daysUntilDue = calculateDaysUntilDue(bill.dueDate);
                      return (
                        <tr key={bill._id} className="hover:bg-yellow-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-yellow-900">{bill.customerName || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-yellow-700">${(bill.balanceDue || 0).toFixed(2)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-yellow-700">
                              {new Date(bill.dueDate).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-yellow-200 text-yellow-900 border border-yellow-300">
                              {daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button className="btn btn-sm btn-success" onClick={() => setCollectingBill(bill)}>Collect</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditBillsPage;

