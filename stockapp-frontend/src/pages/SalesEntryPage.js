import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchCustomers, addCustomer as apiAddCustomer } from '../api/customers';
import { fetchInventoryItems, fetchLocations } from '../api/inventory';
import { recordSale } from '../api/sales';
import { useAuth } from '../context/AuthContext';

const SalesEntryPage = () => {
  const { currentUser, logout } = useAuth();
  
  // Customer state
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [customerError, setCustomerError] = useState('');

  // Inventory state
  const [inventoryItems, setInventoryItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  // Sale items state
  const [saleItems, setSaleItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [currentCases, setCurrentCases] = useState(0);
  const [currentPieces, setCurrentPieces] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState('');

  // Payment and discount state
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [dueDate, setDueDate] = useState('');

  // Submission state
  const [saleError, setSaleError] = useState('');
  const [saleLoading, setSaleLoading] = useState(false);

  const newCustomerFormRef = useRef(null);

  const fetchCustomersData = useCallback(async () => {
    setCustomerLoading(true);
    setCustomerError('');
    try {
      const fetchedCustomers = await fetchCustomers();
      setCustomers(fetchedCustomers);
      if (fetchedCustomers.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(fetchedCustomers[0]._id);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setCustomerError('Failed to load customers. Please try again.');
    } finally {
      setCustomerLoading(false);
    }
  }, [selectedCustomerId]);

  const fetchInventoryData = async () => {
    setInventoryLoading(true);
    try {
      const [items, locs] = await Promise.all([
        fetchInventoryItems(),
        fetchLocations()
      ]);
      setInventoryItems(items);
      setLocations(locs);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setSaleError('Failed to load inventory. Please try again.');
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleAddItemToSale = () => {
    if (!selectedItemId || !selectedLocation) {
      setSaleError('Please select item and location.');
      return;
    }

    const totalQuantity = currentCases * (itemAtSelectedLocation?.piecesPerCase || 0) + currentPieces;

    const selectedItem = inventoryItems.find(item => item._id === selectedItemId);
    if (!selectedItem) {
      setSaleError('Selected item not found.');
      return;
    }

    const itemAtSelectedLocation = inventoryItems.find(
      i => i._id === selectedItemId && i.location === selectedLocation
    );

    if (!itemAtSelectedLocation) {
      setSaleError(`Item "${selectedItem.name}" not available at "${selectedLocation}".`);
      return;
    }

    if (currentCases < 0 || currentPieces < 0) {
      setSaleError('Cases and pieces must be zero or greater.');
      return;
    }

    if (currentPieces >= itemAtSelectedLocation.piecesPerCase) {
      setSaleError(`Pieces must be less than ${itemAtSelectedLocation.piecesPerCase} for this item.`);
      return;
    }

    if (totalQuantity < 1) {
      setSaleError('Enter at least 1 piece to add the item to the sale.');
      return;
    }

    if (itemAtSelectedLocation.quantity < totalQuantity) {
      setSaleError(`Insufficient stock. Available: ${itemAtSelectedLocation.quantity}`);
      return;
    }

    const existingItemIndex = saleItems.findIndex(
      saleItem => saleItem.itemId === selectedItemId && saleItem.locationTakenFrom === selectedLocation
    );

    let updatedSaleItems;
    if (existingItemIndex > -1) {
      updatedSaleItems = [...saleItems];
      const existingItem = updatedSaleItems[existingItemIndex];
      const newQuantity = existingItem.quantity + totalQuantity;

      if (newQuantity > itemAtSelectedLocation.quantity) {
        setSaleError(`Cannot add more. Available: ${itemAtSelectedLocation.quantity}`);
        return;
      }

      updatedSaleItems[existingItemIndex] = {
        ...existingItem,
        quantity: newQuantity,
        cases: Math.floor(newQuantity / existingItem.piecesPerCase),
        pieces: newQuantity % existingItem.piecesPerCase,
      };
    } else {
      updatedSaleItems = [...saleItems, {
        itemId: selectedItem._id,
        name: selectedItem.name,
        quantity: totalQuantity,
        cases: currentCases,
        pieces: currentPieces,
        piecesPerCase: itemAtSelectedLocation.piecesPerCase,
        priceAtSale: selectedItem.price,
        locationTakenFrom: selectedLocation,
      }];
    }

    setSaleItems(updatedSaleItems);
    setSelectedItemId('');
    setCurrentCases(0);
    setCurrentPieces(1);
    setSelectedLocation('');
    setSaleError('');
  };

  const handleRemoveSaleItem = (indexToRemove) => {
    setSaleItems(saleItems.filter((_, index) => index !== indexToRemove));
  };

  const handleCustomerAdded = (newCustomer) => {
    setCustomers(prevCustomers => [...prevCustomers, newCustomer].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedCustomerId(newCustomer._id);
    setShowAddCustomerForm(false);
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
    if (paymentMethod === 'credit' && !dueDate) {
      setSaleError('Please enter a due date for credit sales.');
      return;
    }

    setSaleLoading(true);
    setSaleError('');

    const saleData = {
      customerId: selectedCustomerId,
      items: saleItems.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        cases: item.cases,
        pieces: item.pieces,
        piecesPerCase: item.piecesPerCase,
        priceAtSale: item.priceAtSale,
        name: item.name,
        locationTakenFrom: item.locationTakenFrom,
      })),
      discountAmount,
      discountPercentage,
      paymentMethod,
      ...(paymentMethod === 'credit' && dueDate && { dueDate }),
    };

    try {
      const response = await recordSale(saleData);
      alert(`Sale recorded successfully! Sale ID: ${response.data._id || 'N/A'}`);
      
      // Reset form
      setSelectedCustomerId(customers.length > 0 ? customers[0]._id : '');
      setSaleItems([]);
      setDiscountAmount(0);
      setDiscountPercentage(0);
      setPaymentMethod('cash');
      setDueDate('');
      
      // Refresh data
      await fetchCustomersData();
      await fetchInventoryData();
    } catch (error) {
      console.error('Sale Submission Error:', error);
      setSaleError(error.response?.data?.message || 'Failed to record sale. Please check stock and try again.');
    } finally {
      setSaleLoading(false);
    }
  };

  // Calculate totals
  const subtotal = saleItems.reduce((sum, item) => sum + item.priceAtSale * item.quantity, 0);
  let totalAfterDiscount = subtotal;
  if (discountPercentage > 0) {
    const percentageDiscountValue = (subtotal * discountPercentage) / 100;
    totalAfterDiscount = subtotal - percentageDiscountValue;
  }
  if (discountAmount > 0) {
    totalAfterDiscount = totalAfterDiscount - discountAmount;
  }
  totalAfterDiscount = Math.max(0, totalAfterDiscount);

  // Get available locations for selected item
  const availableLocations = selectedItemId
    ? locations.filter(loc =>
        inventoryItems.some(
          item => item._id === selectedItemId && item.location === loc && item.quantity > 0
        )
      )
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">Register New Sale</h1>
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
          {(saleError || customerError) && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {saleError || customerError}
            </div>
          )}

          {/* Customer Selection */}
          <div className="bg-white shadow-lg rounded-xl p-6 mb-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-5 pb-3 border-b border-gray-200 text-gray-900">Customer Information</h2>
            <div className="flex flex-wrap items-center gap-4">
              <label className="block text-sm font-semibold text-gray-700 whitespace-nowrap">Customer:</label>
              <select
                value={selectedCustomerId || ''}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setSaleError('');
                }}
                className="flex-1 min-w-[200px] p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                disabled={customerLoading || customers.length === 0}
              >
                <option value="" disabled>Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name} {customer.email ? `(${customer.email})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowAddCustomerForm(!showAddCustomerForm)}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              >
                {showAddCustomerForm ? '✕ Cancel' : '+ New Customer'}
              </button>
            </div>

            {/* Add Customer Form */}
            {showAddCustomerForm && (
              <div className="mt-5 p-5 border-2 border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100">
                <h3 className="text-lg font-bold mb-4 text-gray-900">Add New Customer</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    const name = form.elements.customerName.value;
                    const email = form.elements.customerEmail.value;
                    const phone = form.elements.customerPhone.value;
                    if (!name) {
                      alert('Customer name is required.');
                      return;
                    }
                    apiAddCustomer({ name, email, phone })
                      .then(handleCustomerAdded)
                      .catch(err => {
                        console.error('Error adding customer:', err);
                        alert('Failed to add customer: ' + (err.response?.data?.message || 'Unknown error'));
                      });
                  }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  <input
                    ref={newCustomerFormRef}
                    type="text"
                    name="customerName"
                    required
                    placeholder="Customer Name *"
                    className="p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <input
                    type="email"
                    name="customerEmail"
                    placeholder="Email (optional)"
                    className="p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <input
                    type="tel"
                    name="customerPhone"
                    placeholder="Phone (optional)"
                    className="p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <div className="md:col-span-3 flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      ✓ Add Customer
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Add Items Section */}
          <div className="bg-white shadow-lg rounded-xl p-6 mb-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-5 pb-3 border-b border-gray-200 text-gray-900">Add Items to Sale</h2>
            <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 whitespace-nowrap">Item:</label>
              <select
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  setSelectedLocation('');
                  setCurrentCases(0);
                  setCurrentPieces(1);
                  setSaleError('');
                }}
                className="flex-1 min-w-[200px] p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                disabled={inventoryLoading || inventoryItems.length === 0}
              >
                <option value="" disabled>Select an item</option>
                {inventoryItems.map((item) => (
                  <option key={item._id} value={item._id} disabled={item.quantity <= 0}>
                    {item.name} - ${item.price.toFixed(2)} - {item.cases || 0} cases, {item.pieces || 0} pieces {item.quantity <= 0 ? '(Out of Stock)' : ''}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-semibold text-gray-700 whitespace-nowrap">From Location:</label>
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  setSaleError('');
                }}
                className="min-w-[180px] p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                disabled={!selectedItemId || availableLocations.length === 0}
              >
                <option value="" disabled>Select Location</option>
                {availableLocations.map(loc => {
                  const itemAtLoc = inventoryItems.find(
                    item => item._id === selectedItemId && item.location === loc
                  );
                  return (
                    <option key={loc} value={loc}>
                      {loc} ({itemAtLoc?.cases || 0} cases, {itemAtLoc?.pieces || 0} pieces)
                    </option>
                  );
                })}
              </select>

              <label className="block text-sm font-semibold text-gray-700 whitespace-nowrap">Cases:</label>
              <input
                type="number"
                value={currentCases}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  setCurrentCases(isNaN(num) || num < 0 ? 0 : num);
                  setSaleError('');
                }}
                min="0"
                className="w-24 p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />

              <label className="block text-sm font-semibold text-gray-700 whitespace-nowrap">Pieces:</label>
              <input
                type="number"
                value={currentPieces}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  setCurrentPieces(isNaN(num) || num < 0 ? 0 : num);
                  setSaleError('');
                }}
                min="0"
                className="w-24 p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />

              <button
                onClick={handleAddItemToSale}
                disabled={!selectedItemId || !selectedLocation}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Item
              </button>
            </div>
          </div>

          {/* Current Sale Items */}
          <div className="bg-white shadow-lg rounded-xl p-6 mb-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-5 pb-3 border-b border-gray-200 text-gray-900">Current Sale Items</h2>
            {saleItems.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <span className="text-4xl mb-3 block">🛒</span>
                <p className="text-gray-500 font-medium">No items added yet. Add items to continue.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Unit Price</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Stock Sold</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Line Total</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {saleItems.map((item, index) => (
                      <tr key={index} className="hover:bg-blue-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">${item.priceAtSale.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-bold inline-block">
                            {item.cases} cases, {item.pieces} pieces
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{item.quantity} total pieces</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{item.locationTakenFrom}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${(item.priceAtSale * item.quantity).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleRemoveSaleItem(index)}
                            className="px-3 py-1.5 text-sm font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors duration-150"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan="4" className="px-6 py-4 text-right text-sm font-bold text-gray-900">Subtotal:</td>
                      <td className="px-6 py-4 text-lg font-bold text-gray-900">${subtotal.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Payment and Discount Section */}
          <div className="bg-white shadow-lg rounded-xl p-6 mb-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-5 pb-3 border-b border-gray-200 text-gray-900">Payment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Discount Amount ($)</label>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setDiscountAmount(isNaN(val) ? 0 : Math.max(0, val));
                    setDiscountPercentage(0);
                  }}
                  min="0"
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Discount Percentage (%)</label>
                <input
                  type="number"
                  value={discountPercentage}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setDiscountPercentage(isNaN(val) ? 0 : Math.max(0, Math.min(100, val)));
                    setDiscountAmount(0);
                  }}
                  min="0"
                  max="100"
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    setDueDate('');
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
            </div>

            {paymentMethod === 'credit' && (
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    setSaleError('');
                  }}
                  required
                  className="w-full md:w-64 p-3 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Summary and Submit */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 shadow-lg rounded-xl p-6 border-2 border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <p className="text-base font-semibold text-gray-700">Subtotal: <span className="text-gray-900">${subtotal.toFixed(2)}</span></p>
                {(discountAmount > 0 || discountPercentage > 0) && (
                  <p className="text-base font-semibold text-red-600">
                    Discount: {discountAmount > 0 ? `-$${discountAmount.toFixed(2)}` : `-${discountPercentage}%`}
                  </p>
                )}
                <p className="text-3xl font-bold text-gray-900 mt-2">Total: ${totalAfterDiscount.toFixed(2)}</p>
              </div>
              <button
                onClick={handleSubmitSale}
                disabled={saleLoading || !selectedCustomerId || saleItems.length === 0 || (paymentMethod === 'credit' && !dueDate)}
                className="px-10 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl text-lg font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {saleLoading ? '⏳ Processing...' : '✓ Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesEntryPage;

