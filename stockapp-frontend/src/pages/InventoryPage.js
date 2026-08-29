import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { fetchInventoryItems, fetchLocations } from '../api/inventory';
import { useAuth } from '../context/AuthContext';

const MAX_NAME_SUGGESTIONS = 6;

const InventoryPage = () => {
  const { currentUser, logout } = useAuth();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Add item form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCases, setNewItemCases] = useState('');
  const [newItemPieces, setNewItemPieces] = useState('');
  const [newItemPiecesPerCase, setNewItemPiecesPerCase] = useState('');
  const [newItemLocation, setNewItemLocation] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Filter/search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, price, quantity, location

  const suggestedItemNames = inventoryItems
    .filter(item => item.name.toLowerCase().includes(newItemName.trim().toLowerCase()))
    .map(item => item.name)
    .filter((name, index, names) => names.indexOf(name) === index)
    .slice(0, MAX_NAME_SUGGESTIONS);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [items, locs] = await Promise.all([
        fetchInventoryItems(),
        fetchLocations()
      ]);
      setInventoryItems(items);
      setFilteredItems(items);
      setLocations(locs);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load inventory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...inventoryItems];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Location filter
    if (selectedLocationFilter) {
      filtered = filtered.filter(item => item.location === selectedLocationFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return b.price - a.price;
        case 'quantity':
          return b.quantity - a.quantity;
        case 'location':
          return a.location.localeCompare(b.location);
        default:
          return 0;
      }
    });

    setFilteredItems(filtered);
  }, [inventoryItems, searchTerm, selectedLocationFilter, sortBy]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice || newItemCases === '' || newItemPieces === '' || !newItemPiecesPerCase || !newItemLocation) {
      alert('Please fill in all fields.');
      return;
    }

    const price = parseFloat(newItemPrice);
    const cases = parseInt(newItemCases, 10);
    const pieces = parseInt(newItemPieces, 10);
    const piecesPerCase = parseInt(newItemPiecesPerCase, 10);

    if (isNaN(price) || price < 0) {
      alert('Please enter a valid price.');
      return;
    }

    if (isNaN(cases) || cases < 0) {
      alert('Please enter a valid case count.');
      return;
    }

    if (isNaN(pieces) || pieces < 0) {
      alert('Please enter a valid piece count.');
      return;
    }

    if (isNaN(piecesPerCase) || piecesPerCase < 1) {
      alert('Please enter a valid pieces-per-case value.');
      return;
    }

    if (pieces >= piecesPerCase) {
      alert('Pieces must be less than pieces per case.');
      return;
    }

    try {
      await axios.post('/api/admin/inventory', {
        name: newItemName,
        price: price,
        cases,
        pieces,
        piecesPerCase,
        location: newItemLocation
      });
      
      // Reset form
      setNewItemName('');
      setNewItemPrice('');
      setNewItemCases('');
      setNewItemPieces('');
      setNewItemPiecesPerCase('');
      setNewItemLocation('');
      setShowAddForm(false);
      
      // Refresh inventory
      await fetchData();
      alert('Item added successfully!');
    } catch (err) {
      console.error('Error adding item:', err);
      alert('Failed to add item. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-xl">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
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
            <div className="bg-white overflow-hidden shadow-md rounded-xl hover:shadow-lg transition-shadow duration-200 border-l-4 border-blue-500">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Items</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{inventoryItems.length}</p>
                  </div>
                  <div className="h-14 w-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📦</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow-md rounded-xl hover:shadow-lg transition-shadow duration-200 border-l-4 border-green-500">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Quantity</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {inventoryItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </p>
                  </div>
                  <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow-md rounded-xl hover:shadow-lg transition-shadow duration-200 border-l-4 border-purple-500">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Locations</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{locations.length}</p>
                  </div>
                  <div className="h-14 w-14 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📍</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow-md rounded-xl hover:shadow-lg transition-shadow duration-200 border-l-4 border-yellow-500">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Value</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ${inventoryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="h-14 w-14 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">💰</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add Item Button */}
          <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">Inventory Items</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center space-x-2"
            >
              <span>{showAddForm ? '✕' : '+'}</span>
              <span>{showAddForm ? 'Cancel' : 'Add New Item'}</span>
            </button>
          </div>

          {/* Add Item Form */}
          {showAddForm && (
            <div className="bg-white shadow-lg rounded-xl mb-6 p-6 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">Add New Inventory Item</h3>
              <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-5 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Item Name</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    list="inventory-item-name-suggestions"
                    required
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="e.g., Laptop"
                  />
                  <datalist id="inventory-item-name-suggestions">
                    {newItemName.trim() && suggestedItemNames.map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  {newItemName.trim() && suggestedItemNames.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      Matching stock items: {suggestedItemNames.join(', ')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Price ($)</label>
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    required
                    min="0"
                    step="0.01"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="1200.50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Cases</label>
                  <input
                    type="number"
                    value={newItemCases}
                    onChange={(e) => setNewItemCases(e.target.value)}
                    required
                    min="0"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Pieces</label>
                  <input
                    type="number"
                    value={newItemPieces}
                    onChange={(e) => setNewItemPieces(e.target.value)}
                    required
                    min="0"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Pieces Per Case</label>
                  <input
                    type="number"
                    value={newItemPiecesPerCase}
                    onChange={(e) => setNewItemPiecesPerCase(e.target.value)}
                    required
                    min="1"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="24"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                  <select
                    value={newItemLocation}
                    onChange={(e) => setNewItemLocation(e.target.value)}
                    required
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Select Location</option>
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-5 flex items-center justify-between pt-2">
                  <p className="text-sm text-gray-500">
                    Total pieces: {((parseInt(newItemCases || '0', 10) || 0) * (parseInt(newItemPiecesPerCase || '0', 10) || 0)) + (parseInt(newItemPieces || '0', 10) || 0)}
                  </p>
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-3 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    ✓ Add Item
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filters and Search */}
          <div className="bg-white shadow-lg rounded-xl mb-6 p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Search & Filter</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Search Items</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 pl-10 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Search by name..."
                  />
                  <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Location</label>
                <select
                  value={selectedLocationFilter}
                  onChange={(e) => setSelectedLocationFilter(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="">All Locations</option>
                  {locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="name">Name</option>
                  <option value="price">Price (High to Low)</option>
                  <option value="quantity">Quantity (High to Low)</option>
                  <option value="location">Location</option>
                </select>
              </div>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Total Value</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-4xl mb-3">📦</span>
                          <p className="text-gray-500 text-lg font-medium">
                            {searchTerm || selectedLocationFilter ? 'No items match your filters.' : 'No items in inventory.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item._id} className="hover:bg-blue-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-700">${item.price.toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-bold ${
                            item.quantity === 0 ? 'text-red-600' : 
                            item.quantity < 10 ? 'text-yellow-600' : 
                            'text-green-600'
                          }`}>
                            {(item.cases || 0)} cases, {(item.pieces || 0)} pieces
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.quantity} total pieces ({item.piecesPerCase || 0} per case)
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-700">{item.location}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">${(item.price * item.quantity).toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.quantity === 0 ? (
                            <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200">Out of Stock</span>
                          ) : item.quantity < 10 ? (
                            <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Low Stock</span>
                          ) : (
                            <span className="px-3 py-1.5 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200">In Stock</span>
                          )}
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

export default InventoryPage;


