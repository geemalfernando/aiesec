# Backend API Requirements for Stock Management Application

## Overview
This document outlines the backend API endpoints and requirements needed to support the new frontend pages. The frontend has been refactored into dedicated pages for better user experience, and the backend needs to support all these features.

## Base URL
- Development: `http://localhost:5001`
- All endpoints should be prefixed with `/api`

## Authentication
- All protected routes require Bearer token authentication
- Token should be passed in the Authorization header: `Authorization: Bearer <token>`

---

## 1. Sales History API

### Endpoint: `GET /api/sales/history`
**Purpose**: Fetch all sales records for the Sales History page

**Query Parameters (optional)**:
- `customerId` (string): Filter by customer ID
- `paymentMethod` (string): Filter by payment method ('cash' or 'credit')
- `startDate` (string): Filter sales from this date (ISO format)
- `endDate` (string): Filter sales until this date (ISO format)

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "sale_id",
      "customerId": "customer_id",
      "customerName": "Customer Name",
      "items": [
        {
          "itemId": "item_id",
          "name": "Item Name",
          "quantity": 5,
          "priceAtSale": 29.99,
          "locationTakenFrom": "Main Warehouse"
        }
      ],
      "subtotal": 149.95,
      "discountAmount": 0,
      "discountPercentage": 0,
      "totalAmount": 149.95,
      "paymentMethod": "cash",
      "dueDate": null,
      "saleDate": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Requirements**:
- Return all sales records sorted by date (newest first)
- Include customer name in response (populate from customerId)
- Include item details (name, quantity, priceAtSale, locationTakenFrom)
- Support filtering by query parameters
- Calculate totalAmount properly considering discounts

---

## 2. Inventory Management API

### Endpoint: `GET /api/admin/inventory`
**Purpose**: Fetch all inventory items (already exists, verify it works)

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "item_id",
      "name": "Laptop",
      "price": 1200.50,
      "quantity": 15,
      "location": "Main Warehouse",
      "createdAt": "2024-01-10T08:00:00Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    }
  ]
}
```

**Requirements**:
- Return all inventory items across all locations
- Include location field for each item
- Sort by name or date as needed

### Endpoint: `POST /api/admin/inventory`
**Purpose**: Add new inventory item (already exists, verify it works)

**Request Body**:
```json
{
  "name": "New Item",
  "price": 29.99,
  "quantity": 50,
  "location": "Main Warehouse"
}
```

**Requirements**:
- Validate all fields are present
- Validate price is a positive number
- Validate quantity is a non-negative integer
- Validate location exists
- Return the created item with all fields

---

## 3. Inventory Locations API

### Endpoint: `GET /api/inventory/locations`
**Purpose**: Fetch all available locations for inventory

**Response Format**:
```json
{
  "success": true,
  "data": ["Main Warehouse", "Branch Office", "Store A", "Store B"]
}
```

**Requirements**:
- Return array of unique location names
- Can be derived from existing inventory items or a separate locations collection

---

## 4. Stock Transfer API

### Endpoint: `POST /api/inventory/transfer`
**Purpose**: Transfer inventory items between locations (already exists, verify it works)

**Request Body**:
```json
{
  "itemId": "item_id",
  "fromLocation": "Main Warehouse",
  "toLocation": "Branch Office",
  "quantity": 10
}
```

**Requirements**:
- Validate item exists at fromLocation
- Validate sufficient quantity at fromLocation
- Validate fromLocation and toLocation are different
- Update quantities in both locations
- Create new inventory entry if item doesn't exist at toLocation
- Return success message with updated quantities

**Response Format**:
```json
{
  "success": true,
  "message": "Inventory transferred successfully",
  "data": {
    "itemId": "item_id",
    "fromLocation": {
      "location": "Main Warehouse",
      "quantity": 5
    },
    "toLocation": {
      "location": "Branch Office",
      "quantity": 15
    }
  }
}
```

---

## 5. Sales Entry API

### Endpoint: `POST /api/sales/entry`
**Purpose**: Record a new sale (already exists, verify it works)

**Request Body**:
```json
{
  "customerId": "customer_id",
  "items": [
    {
      "itemId": "item_id",
      "quantity": 2,
      "priceAtSale": 29.99,
      "name": "Item Name",
      "locationTakenFrom": "Main Warehouse"
    }
  ],
  "discountAmount": 0,
  "discountPercentage": 10,
  "paymentMethod": "credit",
  "dueDate": "2024-02-15"
}
```

**Requirements**:
- Validate customer exists
- Validate all items exist and have sufficient stock at specified locations
- Validate paymentMethod is either 'cash' or 'credit'
- If paymentMethod is 'credit', dueDate is required
- Calculate totalAmount correctly considering discounts
- Update inventory quantities at specified locations
- Create credit bill if paymentMethod is 'credit'
- Return created sale with all details

**Response Format**:
```json
{
  "success": true,
  "message": "Sale recorded successfully",
  "data": {
    "_id": "sale_id",
    "customerId": "customer_id",
    "items": [...],
    "totalAmount": 134.95,
    "paymentMethod": "credit",
    "dueDate": "2024-02-15",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## 6. Credit Bills API

### Endpoint: `GET /api/sales/due-bills`
**Purpose**: Fetch bills that are due soon (not yet overdue)

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "sale_id",
      "customerId": "customer_id",
      "customerName": "Customer Name",
      "totalAmount": 500.00,
      "dueDate": "2024-01-20",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Requirements**:
- Return all credit sales where dueDate is in the future (not yet passed)
- Include customer name
- Include totalAmount (after discounts)
- Sort by dueDate (earliest first)

### Endpoint: `GET /api/sales/overdue-bills`
**Purpose**: Fetch bills that are overdue

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "sale_id",
      "customerId": "customer_id",
      "customerName": "Customer Name",
      "totalAmount": 300.00,
      "dueDate": "2024-01-10",
      "createdAt": "2024-01-05T10:30:00Z"
    }
  ]
}
```

**Requirements**:
- Return all credit sales where dueDate is in the past (overdue)
- Include customer name
- Include totalAmount (after discounts)
- Sort by dueDate (most overdue first)

---

## 7. Dashboard API (for User Dashboard)

### Endpoint: `GET /api/dashboard/sales-data`
**Purpose**: Fetch aggregated sales data for charts (already exists, verify format)

**Response Format**:
```json
{
  "success": true,
  "data": {
    "salesSummary": {
      "daily": [
        {
          "_id": "2024-01-15",
          "totalSales": 1500.50,
          "count": 12
        }
      ],
      "monthly": [
        {
          "_id": "2024-01",
          "totalSales": 45000.75,
          "count": 350
        }
      ]
    }
  }
}
```

### Endpoint: `GET /api/dashboard/credit-customers`
**Purpose**: Fetch credit customer summary (already exists, verify format)

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "customer_id",
      "customerName": "Customer Name",
      "totalAmountOwed": 1500.00,
      "latestDueDate": "2024-02-15",
      "billCount": 3
    }
  ]
}
```

---

## 8. User Management API

### Endpoint: `GET /api/admin/users`
**Purpose**: Fetch all users (already exists, verify it works)

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "user_id",
      "name": "User Name",
      "username": "username",
      "email": "user@example.com",
      "role": "admin",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Endpoint: `PUT /api/admin/users/:userId/role`
**Purpose**: Update user role (already exists, verify it works)

**Request Body**:
```json
{
  "role": "admin"
}
```

### Endpoint: `DELETE /api/admin/users/:userId`
**Purpose**: Delete a user (already exists, verify it works)

---

## 9. Customer API

### Endpoint: `GET /api/customers`
**Purpose**: Fetch all customers (already exists, verify it works)

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "customer_id",
      "name": "Customer Name",
      "email": "customer@example.com",
      "phone": "+1234567890",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Endpoint: `POST /api/customers`
**Purpose**: Add new customer (already exists, verify it works)

**Request Body**:
```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+1234567890"
}
```

---

## Important Notes

### Error Handling
All endpoints should return consistent error responses:
```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error information (optional)"
}
```

**HTTP Status Codes**:
- `200 OK`: Successful GET/PUT requests
- `201 Created`: Successful POST requests
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server errors

### Validation Requirements

1. **Inventory Items**:
   - Name: Required, non-empty string
   - Price: Required, positive number
   - Quantity: Required, non-negative integer
   - Location: Required, non-empty string

2. **Sales**:
   - CustomerId: Required, must exist
   - Items: Required, non-empty array
   - Each item must exist and have sufficient stock
   - PaymentMethod: Must be 'cash' or 'credit'
   - DueDate: Required if paymentMethod is 'credit'

3. **Stock Transfers**:
   - ItemId: Required, must exist
   - FromLocation: Required, item must exist here
   - ToLocation: Required, must be different from fromLocation
   - Quantity: Required, positive integer, must not exceed available quantity

### Data Consistency
- When recording a sale, update inventory quantities immediately
- When transferring stock, ensure atomic operations (both locations updated or neither)
- Calculate discounts correctly: percentage discount applied first, then amount discount
- Ensure credit bills are created for all credit sales

### Performance Considerations
- Implement pagination for large datasets (sales history, inventory)
- Add indexes on frequently queried fields (customerId, location, saleDate, dueDate)
- Consider caching for frequently accessed data (locations, dashboard stats)

---

## Testing Checklist

Before deployment, ensure:
- [ ] All endpoints return correct data formats
- [ ] Authentication works on all protected routes
- [ ] Admin-only routes reject non-admin users
- [ ] Inventory updates correctly on sales
- [ ] Stock transfers update both locations correctly
- [ ] Credit bills are created correctly
- [ ] Due and overdue bills are calculated correctly
- [ ] Filters work correctly on sales history
- [ ] Error messages are user-friendly
- [ ] Validation prevents invalid data entry

---

## Questions or Issues?

If any endpoint behavior is unclear or if you need clarification on any requirement, please refer to the frontend API calls in:
- `src/api/sales.js`
- `src/api/inventory.js`
- `src/api/customers.js`
- `src/api/dashboard.js`

All API calls use the base URL configured in `src/api/api.js` with authentication headers.

