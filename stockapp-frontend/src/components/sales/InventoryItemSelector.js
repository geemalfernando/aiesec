// src/components/Sales/InventoryItemSelector.js
import React, { useState, useEffect } from 'react';
import { fetchInventoryItems, fetchLocations } from '../../api/inventory';

const InventoryItemSelector = ({ onAddItem, inventoryItems: propInventory, parentError }) => {
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState([]);
  const [locationLoading, setLocationLoading] = useState(true);

  const inventoryItems = propInventory || items;

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const fetchedItems = await fetchInventoryItems();
        setItems(fetchedItems);
        setLoading(false);

        setLocationLoading(true);
        const fetchedLocations = await fetchLocations();
        setLocations(fetchedLocations);
        setLocationLoading(false);

      } catch (err) {
        setError('Failed to load inventory items or locations.');
        setLoading(false);
        setLocationLoading(false);
      }
    };
    loadInitialData();
  }, [propInventory]);

  const handleAddItem = () => {
    if (!selectedItemId || quantity < 1 || !selectedLocation) {
      setError('Please select an item, location, and enter a valid quantity.');
      return;
    }

    const selectedItem = inventoryItems.find(item => item._id === selectedItemId);
    if (!selectedItem) {
      setError('Selected item not found.');
      return;
    }

    // Check stock for the selected item at the selected location
    const itemAtSelectedLocation = inventoryItems.find(i => i._id === selectedItemId && i.location === selectedLocation);
    if (!itemAtSelectedLocation) {
        setError(`Item "${selectedItem.name}" not found at location "${selectedLocation}".`);
        return;
    }
    if (itemAtSelectedLocation.quantity < quantity) {
        setError(`Insufficient stock for ${selectedItem.name} at ${selectedLocation}. Available: ${itemAtSelectedLocation.quantity}`);
        return;
    }

    onAddItem({
      itemId: selectedItem._id,
      name: selectedItem.name,
      quantity: parseInt(quantity, 10),
      priceAtSale: selectedItem.price, // Price at the moment of adding to sale
      locationTakenFrom: selectedLocation, // NEW: Pass the selected location
    });

    // Reset form
    setSelectedItemId('');
    setQuantity(1);
    setSelectedLocation('');
    setError('');
  };

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 border border-gray-200 rounded-md mb-4 bg-gray-50">
      <div className="flex-grow flex flex-wrap items-center gap-4">
        {/* Item Selection */}
        <label htmlFor="itemSelect" className="block text-sm font-medium text-gray-700">Item:</label>
        <select
          id="itemSelect"
          value={selectedItemId}
          onChange={(e) => {
            setSelectedItemId(e.target.value);
            setError('');
            const item = inventoryItems.find(i => i._id === e.target.value);
            if (item && quantity > item.quantity) { // Adjust quantity if new item has less stock
              setQuantity(item.quantity > 0 ? item.quantity : 1);
            }
            setSelectedLocation(''); // Reset location when item changes
          }}
          className="border rounded-md p-2 text-sm w-64"
          disabled={loading || locationLoading || inventoryItems.length === 0}
        >
          <option value="" disabled>Select an item</option>
          {inventoryItems.map((item) => (
            <option key={item._id} value={item._id}>{item.name} - ${item.price.toFixed(2)}</option>
          ))}
        </select>

        {/* Location Selection */}
        <label htmlFor="locationSelect" className="block text-sm font-medium text-gray-700 ml-4">From Location:</label>
        <select
          id="locationSelect"
          value={selectedLocation}
          onChange={(e) => {
            setSelectedLocation(e.target.value);
            setError('');
            // Validate stock for selected item/location upon location change
            const item = inventoryItems.find(i => i._id === selectedItemId);
            if (item && e.target.value) {
                const itemAtSelectedLocation = inventoryItems.find(i => i._id === selectedItemId && i.location === e.target.value);
                if (!itemAtSelectedLocation) {
                    setError(`Item "${item.name}" not available at "${e.target.value}".`);
                } else if (quantity > itemAtSelectedLocation.quantity) {
                    setQuantity(itemAtSelectedLocation.quantity > 0 ? itemAtSelectedLocation.quantity : 1);
                }
            }
          }}
          className="border rounded-md p-2 text-sm w-48"
          disabled={!selectedItemId || inventoryItems.length === 0 || locationLoading || !inventoryItems.find(i => i._id === selectedItemId)} // Disable if no item selected or locations not loaded
        >
          <option value="" disabled>Select Location</option>
          {locations.filter(loc => inventoryItems.some(item => item._id === selectedItemId && item.location === loc && item.quantity > 0))
          .map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>

        {/* Quantity Input */}
        <label htmlFor="quantityInput" className="block text-sm font-medium text-gray-700 ml-4">Qty:</label>
        <input
          type="number"
          id="quantityInput"
          value={quantity}
          onChange={(e) => {
            const num = parseInt(e.target.value, 10);
            setQuantity(isNaN(num) || num < 1 ? 1 : num);
            setError('');
          }}
          min="1"
          className="w-20 p-2 border rounded-md text-sm"
        />
      </div>
      <button
        onClick={handleAddItem}
        disabled={!selectedItemId || quantity < 1 || !selectedLocation || loading || locationLoading}
        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Add Item
      </button>
      {error && <p className="text-red-500 text-sm ml-4">{error}</p>} {/* Display error inline */}
    </div>
  );
};

export default InventoryItemSelector;