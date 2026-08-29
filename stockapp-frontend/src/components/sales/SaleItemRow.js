// src/components/SaleItemRow.js
import React from 'react';

const SaleItemRow = ({ item, onRemoveItem, index }) => {
  const lineTotal = item.priceAtSale * item.quantity;

  return (
    <tr className="bg-white hover:bg-gray-100">
      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">${item.priceAtSale.toFixed(2)}</td>
      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.locationTakenFrom}</td> {/* Display Location */}
      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">${lineTotal.toFixed(2)}</td>
      <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={() => onRemoveItem(index)}
          className="text-red-600 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
        >
          Remove
        </button>
      </td>
    </tr>
  );
};

export default SaleItemRow;