import React, { useState, useEffect } from 'react';
import { fetchInventoryItems, fetchLocations, transferInventory } from '../api/inventory';
import { useAuth } from '../context/AuthContext';

const StockTransferPage = () => {
  const { currentUser, logout } = useAuth();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferLoading, setTransferLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Transfer form state
  const [transferItemId, setTransferItemId] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [transferQuantity, setTransferQuantity] = useState(1);
  
  // Available quantities at selected location
  const [availableQuantity, setAvailableQuantity] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Update available quantity when item or location changes
    if (transferItemId && fromLocation) {
      const itemAtLocation = inventoryItems.find(
        item => item._id === transferItemId && item.location === fromLocation
      );
      setAvailableQuantity(itemAtLocation ? itemAtLocation.quantity : 0);
      if (itemAtLocation && transferQuantity > itemAtLocation.quantity) {
        setTransferQuantity(itemAtLocation.quantity);
      }
    } else {
      setAvailableQuantity(0);
    }
  }, [transferItemId, fromLocation, inventoryItems, transferQuantity]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [items, locs] = await Promise.all([
        fetchInventoryItems(),
        fetchLocations()
      ]);
      setInventoryItems(items);
      setLocations(locs);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load inventory data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (itemId) => {
    setTransferItemId(itemId);
    setFromLocation('');
    setToLocation('');
    setTransferQuantity(1);
    setError('');
  };

  const handleFromLocationChange = (location) => {
    setFromLocation(location);
    setToLocation('');
    setError('');
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!transferItemId || !fromLocation || !toLocation || transferQuantity < 1) {
      setError('Please fill in all fields.');
      return;
    }

    if (fromLocation === toLocation) {
      setError('From and To locations cannot be the same.');
      return;
    }

    if (transferQuantity > availableQuantity) {
      setError(`Cannot transfer more than available quantity (${availableQuantity}).`);
      return;
    }

    setTransferLoading(true);
    try {
      await transferInventory({
        itemId: transferItemId,
        fromLocation,
        toLocation,
        quantity: transferQuantity
      });

      setSuccess(`Successfully transferred ${transferQuantity} items from ${fromLocation} to ${toLocation}!`);
      
      // Reset form
      setTransferItemId('');
      setFromLocation('');
      setToLocation('');
      setTransferQuantity(1);
      
      // Refresh inventory
      await fetchData();
    } catch (err) {
      console.error('Error transferring inventory:', err);
      setError(err.response?.data?.message || 'Failed to transfer inventory. Please try again.');
    } finally {
      setTransferLoading(false);
    }
  };

  // Get unique items for dropdown
  const uniqueItems = Array.from(
    new Map(inventoryItems.map(item => [item.name, item])).values()
  );

  // Get locations where selected item is available
  const availableFromLocations = transferItemId
    ? locations.filter(loc =>
        inventoryItems.some(
          item => item._id === transferItemId && item.location === loc && item.quantity > 0
        )
      )
    : [];

  // Get locations available for transfer (excluding fromLocation)
  const availableToLocations = fromLocation
    ? locations.filter(loc => loc !== fromLocation)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">Stock Transfer</h1>
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

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Success Message */}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Transfer Form */}
          <div className="bg-white shadow-lg rounded-xl p-8 mb-6 border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 pb-4 border-b border-gray-200 text-gray-900">Transfer Stock Between Locations</h2>
            
            <form onSubmit={handleTransfer} className="space-y-6">
              {/* Item Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Item *
                </label>
                <select
                  value={transferItemId}
                  onChange={(e) => handleItemChange(e.target.value)}
                  required
                  className="w-full p-3.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm font-medium"
                >
                  <option value="">-- Select Item --</option>
                  {uniqueItems.map(item => (
                    <option key={item._id} value={item._id}>
                      {item.name} - ${item.price.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Location */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  From Location *
                </label>
                <select
                  value={fromLocation}
                  onChange={(e) => handleFromLocationChange(e.target.value)}
                  required
                  disabled={!transferItemId || availableFromLocations.length === 0}
                  className="w-full p-3.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 transition-colors text-sm font-medium"
                >
                  <option value="">
                    {!transferItemId
                      ? '-- Select item first --'
                      : availableFromLocations.length === 0
                      ? '-- No stock available --'
                      : '-- Select Location --'}
                  </option>
                  {availableFromLocations.map(loc => {
                    const itemAtLoc = inventoryItems.find(
                      item => item._id === transferItemId && item.location === loc
                    );
                    return (
                      <option key={loc} value={loc}>
                        {loc} (Available: {itemAtLoc?.quantity || 0})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* To Location */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  To Location *
                </label>
                <select
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  required
                  disabled={!fromLocation || availableToLocations.length === 0}
                  className="w-full p-3.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 transition-colors text-sm font-medium"
                >
                  <option value="">
                    {!fromLocation
                      ? '-- Select from location first --'
                      : '-- Select Location --'}
                  </option>
                  {availableToLocations.map(loc => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantity *
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="number"
                    value={transferQuantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setTransferQuantity(isNaN(val) || val < 1 ? 1 : Math.min(val, availableQuantity));
                      setError('');
                    }}
                    min="1"
                    max={availableQuantity}
                    required
                    disabled={!fromLocation || availableQuantity === 0}
                    className="flex-1 p-3.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 transition-colors text-sm font-medium"
                  />
                  {fromLocation && availableQuantity > 0 && (
                    <span className="px-3 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-semibold whitespace-nowrap">
                      Max: {availableQuantity}
                    </span>
                  )}
                </div>
              </div>

              {/* Summary Card */}
              {transferItemId && fromLocation && toLocation && transferQuantity > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-6 shadow-md">
                  <h3 className="font-bold text-purple-900 mb-4 text-lg">Transfer Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm font-medium text-purple-800">
                    <div>
                      <span className="font-semibold">Item:</span>
                      <p className="mt-1 font-bold">{uniqueItems.find(i => i._id === transferItemId)?.name}</p>
                    </div>
                    <div>
                      <span className="font-semibold">Quantity:</span>
                      <p className="mt-1 font-bold text-lg">{transferQuantity}</p>
                    </div>
                    <div>
                      <span className="font-semibold">From:</span>
                      <p className="mt-1 font-bold">{fromLocation}</p>
                    </div>
                    <div>
                      <span className="font-semibold">To:</span>
                      <p className="mt-1 font-bold">{toLocation}</p>
                    </div>
                    <div className="col-span-2 pt-3 border-t-2 border-purple-300">
                      <span className="font-semibold">After Transfer:</span>
                      <p className="mt-1 font-bold text-lg">
                        {fromLocation} will have {availableQuantity - transferQuantity} remaining
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={
                    transferLoading ||
                    !transferItemId ||
                    !fromLocation ||
                    !toLocation ||
                    transferQuantity < 1 ||
                    fromLocation === toLocation
                  }
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-10 py-4 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {transferLoading ? '⏳ Transferring...' : '✓ Transfer Stock'}
                </button>
              </div>
            </form>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg rounded-xl p-6 border-l-4 border-blue-500 hover:shadow-xl transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Items</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{uniqueItems.length}</p>
                </div>
                <div className="h-14 w-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">📦</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 shadow-lg rounded-xl p-6 border-l-4 border-green-500 hover:shadow-xl transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wide">Locations</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{locations.length}</p>
                </div>
                <div className="h-14 w-14 bg-green-500 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">📍</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 shadow-lg rounded-xl p-6 border-l-4 border-purple-500 hover:shadow-xl transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Total Stock</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {inventoryItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </p>
                </div>
                <div className="h-14 w-14 bg-purple-500 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">📊</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockTransferPage;



