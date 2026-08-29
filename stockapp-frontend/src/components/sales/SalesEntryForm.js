// src/components/Sales/SalesEntryForm.js
import React, { useState, useEffect, useRef } from 'react';
import CustomerSelection from './CustomerSelection';
import InventoryItemSelector from './InventoryItemSelector';
import SaleItemRow from './SaleItemRow';
import { fetchCustomers, addCustomer as apiAddCustomer } from '../../api/customers';
import { fetchInventoryItems } from '../../api/inventory';
import { recordSale } from '../../api/sales';
import { useAuth } from '../../context/AuthContext';

const SalesEntryForm = () => {
  const { api } = useAuth(); // Assume api is your configured axios instance

  // --- State for Customer Selection ---
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);
  const [customerFetchError, setCustomerFetchError] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // --- State for Sale Items ---
  const [inventoryItems, setInventoryItems] = useState([]); // All available inventory
  const [saleItems, setSaleItems] = useState([]); // Items currently in the sale

  // --- State for Discounts and Payment ---
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [dueDate, setDueDate] = useState(''); // State for due date

  // --- Sale Submission State ---
  const [saleError, setSaleError] = useState('');
  const [saleLoading, setSaleLoading] = useState(false);

  const newCustomerFormRef = useRef(null); // Ref for focusing the select after adding a customer

  // --- Effects to Fetch Initial Data ---
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const fetchedCustomers = await fetchCustomers();
        setCustomers(fetchedCustomers);
        // Optionally auto-select first customer if none selected and list is not empty
        // if (fetchedCustomers.length > 0 && !selectedCustomerId) {
        //   setSelectedCustomerId(fetchedCustomers[0]._id);
        // }

        const fetchedInventory = await fetchInventoryItems();
        setInventoryItems(fetchedInventory);
      } catch (error) {
        setSaleError('Failed to load initial data. Please try again.');
      }
    };
    loadInitialData();
  }, []);

  // --- Handlers ---
  const handleCustomerChange = (customerId) => {
    setSelectedCustomerId(customerId);
    setSaleError(''); // Clear error on customer change
  };

  const handleAddNewCustomerClick = () => {
    setShowAddCustomerForm(true);
  };

  const handleCloseAddCustomerForm = () => {
    setShowAddCustomerForm(false);
  };

  const handleCustomerAdded = (newCustomer) => {
    setCustomers(prevCustomers => [...prevCustomers, newCustomer].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedCustomerId(newCustomer._id);
    setShowAddCustomerForm(false);
  };

  const handleAddItemToSale = (item) => { // item now includes locationTakenFrom
    const existingItemIndex = saleItems.findIndex(saleItem => saleItem.itemId === item.itemId);
    let updatedSaleItems;

    if (existingItemIndex > -1) {
      updatedSaleItems = [...saleItems];
      const existingItem = updatedSaleItems[existingItemIndex];
      const newQuantity = existingItem.quantity + item.quantity;

      const currentInventoryItem = inventoryItems.find(invItem => invItem._id === item.itemId);
      if (currentInventoryItem && newQuantity > currentInventoryItem.quantity) {
        alert(`Cannot add more. Insufficient stock for ${item.name}. Available: ${currentInventoryItem.quantity}`);
        return;
      }
      updatedSaleItems[existingItemIndex] = { ...existingItem, quantity: newQuantity };
    } else {
      updatedSaleItems = [...saleItems, item];
    }
    setSaleItems(updatedSaleItems);
    setSaleError('');
  };

  const handleRemoveSaleItem = (indexToRemove) => {
    setSaleItems(saleItems.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmitSale = async () => {
    if (!selectedCustomerId) {
      setSaleError('Please select a customer.');
      return;
    }
    if (saleItems.length === 0) {
      setSaleError('Please add items to the sale.');
      return;
    }

    setSaleLoading(true);
    setSaleError('');

    const saleData = {
      customerId: selectedCustomerId,
      items: saleItems.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        priceAtSale: item.priceAtSale,
        name: item.name,
        locationTakenFrom: item.locationTakenFrom // NEW: Pass the selected location
      })),
      discountAmount,
      discountPercentage,
      paymentMethod: paymentMethod,
      // NEW: Add dueDate only if paymentMethod is 'credit'
      ...(paymentMethod === 'credit' && dueDate && { dueDate: dueDate }),
    };

    // --- Credit payment method validation ---
    if (paymentMethod === 'credit' && !dueDate) {
      setSaleError('Please enter a due date for credit sales.');
      setSaleLoading(false); // Stop loading if validation fails
      return;
    }
    if (paymentMethod === 'credit' && !selectedCustomerId) {
      setSaleError('Please select a customer for credit sales.');
      setSaleLoading(false);
      return;
    }

    try {
      const response = await recordSale(saleData);
      alert(`Sale recorded successfully! Sale ID: ${response.data._id}`);
      // Reset form after successful submission
      setSelectedCustomerId('');
      setSaleItems([]);
      setDiscountAmount(0);
      setDiscountPercentage(0);
      setPaymentMethod('cash');
      setDueDate(''); // Reset due date
      fetchCustomersData(); // Refresh customers
      fetchInventoryItems(); // Refresh inventory to update stock counts
    } catch (error) {
      console.error('Sale Submission Error:', error);
      setSaleError(error.response?.data?.message || 'Failed to record sale. Please check stock and try again.');
    } finally {
      setSaleLoading(false);
    }
  };

  // --- Calculations ---
  let subtotal = saleItems.reduce((sum, item) => sum + item.priceAtSale * item.quantity, 0);
  let totalAfterDiscount = subtotal;

  if (discountPercentage > 0) {
    const percentageDiscountValue = (subtotal * discountPercentage) / 100;
    totalAfterDiscount = subtotal - percentageDiscountValue;
  }
  if (discountAmount > 0) {
    totalAfterDiscount = totalAfterDiscount - discountAmount;
  }
  totalAfterDiscount = Math.max(0, totalAfterDiscount);

  return (
    <div className="container mx-auto p-4 md:p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Sales Entry</h2>

      {/* Customer Selection Area */}
      <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
        <CustomerSelection
          selectedCustomerId={selectedCustomerId}
          onCustomerChange={handleCustomerChange}
          error={saleError} // Pass saleError for generic customer selection issues
        />
        {!showAddCustomerForm && (
          <button
            onClick={handleAddNewCustomerClick}
            className="mt-4 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            Add New Customer
          </button>
        )}
        {showAddCustomerForm && (
          <AddCustomerForm
            onCustomerAdded={handleCustomerAdded}
            onClose={handleCloseAddCustomerForm}
            initialFocusRef={newCustomerFormRef}
          />
        )}
      </div>

      {/* Item Selector for Sale */}
      <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
        <InventoryItemSelector
          onAddItem={handleAddItemToSale}
          inventoryItems={inventoryItems}
          parentError={saleError} // Pass saleError for item selection issues
        />
      </div>

      {/* Current Sale Items Table */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-700 mb-3">Current Sale Items</h3>
        {saleItems.length === 0 ? (
          <p className="text-center text-gray-500 py-4">No items added to the sale yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th> {/* Added Location */}
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line Total</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {saleItems.map((item, index) => (
                <SaleItemRow key={index} item={item} onRemoveItem={handleRemoveSaleItem} index={index} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Discounts and Payment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
        <div>
          <label htmlFor="discountAmount" className="block text-sm font-medium text-gray-700">Discount Amount ($)</label>
          <input
            type="number" id="discountAmount" value={discountAmount}
            onChange={(e) => { const val = parseFloat(e.target.value); setDiscountAmount(isNaN(val) ? 0 : Math.max(0, val)); setDiscountPercentage(0); }}
            min="0" className="mt-1 block w-full p-2 border rounded-md shadow-sm sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="discountPercentage" className="block text-sm font-medium text-gray-700">Discount Percentage (%)</label>
          <input
            type="number" id="discountPercentage" value={discountPercentage}
            onChange={(e) => { const val = parseFloat(e.target.value); setDiscountPercentage(isNaN(val) ? 0 : Math.max(0, Math.min(100, val))); setDiscountAmount(0); }}
            min="0" max="100" className="mt-1 block w-full p-2 border rounded-md shadow-sm sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">Payment Method</label>
          <select
            id="paymentMethod"
            value={paymentMethod}
            onChange={(e) => { setPaymentMethod(e.target.value); setDueDate(''); }} // Clear due date if changing from credit
            className="mt-1 block w-full p-2 border rounded-md shadow-sm sm:text-sm"
          >
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
          </select>
        </div>
      </div>

      {/* Due Date (Conditional rendering) */}
      {paymentMethod === 'credit' && (
        <div className="p-4 border border-gray-200 rounded-md mb-6 bg-gray-100">
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mr-4">Due Date</label>
          <input
            type="date"
            id="dueDate"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); setSaleError(''); }}
            required
            className="mt-1 block w-full p-2 border rounded-md shadow-sm sm:text-sm"
          />
        </div>
      )}

      {/* Summary and Submit Button */}
      <div className="mt-8 flex flex-col md:flex-row justify-between items-center border-t border-gray-200 pt-6">
        <div className="mb-4 md:mb-0 text-lg font-bold text-gray-800">Total: ${totalAfterDiscount.toFixed(2)}</div>
        <div className="flex items-center">
          <button
            onClick={handleSubmitSale}
            disabled={saleLoading || !selectedCustomerId || saleItems.length === 0 || customerFetchError || (paymentMethod === 'credit' && !dueDate)}
            className="px-6 py-3 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saleLoading ? 'Processing...' : 'Confirm Sale'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesEntryForm;