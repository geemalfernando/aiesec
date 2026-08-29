// src/components/Sales/CustomerSelection.js
import React, { useState, useEffect, useRef } from 'react';
import { fetchCustomers } from '../../api/customers';
import AddCustomerForm from './AddCustomerForm';

const CustomerSelection = ({ selectedCustomerId, onCustomerChange, error: parentError }) => {
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const selectRef = useRef(null); // For focusing the select dropdown

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const fetchedCustomers = await fetchCustomers();
        setCustomers(fetchedCustomers);
        if (fetchedCustomers.length > 0 && !selectedCustomerId) {
          // Auto-select the first customer if none is selected initially
          onCustomerChange(fetchedCustomers[0]._id);
        }
      } catch (err) {
        setFetchError('Failed to load customers.');
      } finally {
        setLoadingCustomers(false);
      }
    };
    loadCustomers();
  }, [selectedCustomerId, onCustomerChange]); // Re-run if selectedCustomerId changes from outside

  const handleCustomerSelect = (e) => {
    onCustomerChange(e.target.value);
  };

  const handleAddCustomerClick = () => {
    setShowAddForm(true);
  };

  const handleCloseAddForm = () => {
    setShowAddForm(false);
  };

  const handleCustomerAdded = (newCustomer) => {
    // Add new customer to the state and select them
    setCustomers(prevCustomers => [...prevCustomers, newCustomer].sort((a, b) => a.name.localeCompare(b.name)));
    onCustomerChange(newCustomer._id);
    // Optionally, close the form automatically after successful addition
    setShowAddForm(false);
  };

  if (loadingCustomers) {
    return <div className="text-center py-4">Loading customers...</div>;
  }

  if (fetchError) {
    return <p className="text-red-500 text-sm mb-4">{fetchError}</p>;
  }

  return (
    <div>
      <div className="flex items-center mb-4">
        <label htmlFor="customerSelect" className="block text-sm font-medium text-gray-700 mr-4">
          Customer:
        </label>
        <select
          ref={selectRef}
          id="customerSelect"
          value={selectedCustomerId || ''}
          onChange={handleCustomerSelect}
          className="border rounded-md p-2 text-sm w-64"
          disabled={customers.length === 0}
        >
          {customers.length === 0 ? (
            <option value="" disabled>No customers available</option>
          ) : (
            <>
              <option value="" disabled>Select a customer</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name} {customer.email ? `(${customer.email})` : ''}
                </option>
              ))}
            </>
          )}
        </select>
        <button
          onClick={handleAddCustomerClick}
          className="ml-4 px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          New
        </button>
      </div>

      {parentError && <p className="text-red-500 text-sm mb-4">{parentError}</p>}

      {showAddForm && (
        <AddCustomerForm
          onCustomerAdded={handleCustomerAdded}
          onClose={handleCloseAddForm}
          initialFocusRef={selectRef} // Pass ref to focus select after adding customer
        />
      )}
    </div>
  );
};

export default CustomerSelection;