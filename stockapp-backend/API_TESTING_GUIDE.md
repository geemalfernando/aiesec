# API Testing Guide - Stock Management Application

## Base URL
`http://localhost:5001/api`

## Authentication
All endpoints require authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_token_here>
```

---

## ✅ 1. Sales Endpoints

### GET /api/sales/history
**Description**: Fetch all sales records  
**Access**: Admin, User  
**Query Parameters**:
- `customerId` (optional): Filter by customer ID
- `paymentMethod` (optional): 'cash' or 'credit'
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Example**:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5001/api/sales/history?paymentMethod=credit"
```

### POST /api/sales/entry
**Description**: Record a new sale  
**Access**: Admin, User  
**Body**:
```json
{
  "customerId": "customer_id_here",
  "items": [
    {
      "itemId": "item_id_here",
      "quantity": 2,
      "locationTakenFrom": "storeA"
    }
  ],
  "discountAmount": 0,
  "discountPercentage": 10,
  "paymentMethod": "credit",
  "dueDate": "2024-02-15"
}
```

### GET /api/sales/due-bills
**Description**: Fetch bills that are due soon (not yet overdue)  
**Access**: Admin, User

### GET /api/sales/overdue-bills
**Description**: Fetch overdue bills  
**Access**: Admin, User

---

## ✅ 2. Inventory Endpoints

### GET /api/admin/inventory
**Description**: Get all inventory items  
**Access**: Admin  

### POST /api/admin/inventory
**Description**: Add new inventory item  
**Access**: Admin  
**Body**:
```json
{
  "name": "Laptop",
  "price": 1200.50,
  "quantity": 15,
  "location": "storeA"
}
```

### GET /api/inventory/locations
**Description**: Get all available locations  
**Access**: Admin, User  
**Response**: Array of location strings

### GET /api/inventory
**Description**: Get all inventory items (for users to view)  
**Access**: Admin, User

### POST /api/inventory/transfer
**Description**: Transfer inventory between locations  
**Access**: Admin  
**Body**:
```json
{
  "itemId": "item_id_here",
  "fromLocation": "storeA",
  "toLocation": "storeB",
  "quantity": 10
}
```

---

## ✅ 3. Dashboard Endpoints

### GET /api/dashboard/sales-data
**Description**: Get aggregated sales data  
**Access**: Admin, User

### GET /api/dashboard/credit-customers
**Description**: Get credit customer summary  
**Access**: Admin, User

### GET /api/dashboard/due-bills
**Description**: Get both due and overdue bills  
**Access**: Admin, User

---

## ✅ 4. Customer Endpoints

### GET /api/customers
**Description**: Get all customers  
**Access**: Admin, User

### POST /api/customers
**Description**: Add new customer  
**Access**: Admin, User  
**Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890"
}
```

### GET /api/customers/:customerId
**Description**: Get single customer  
**Access**: Admin, User

### PUT /api/customers/:customerId
**Description**: Update customer  
**Access**: Admin only

### DELETE /api/customers/:customerId
**Description**: Delete customer  
**Access**: Admin only

---

## ✅ 5. Admin/User Management Endpoints

### GET /api/admin/users
**Description**: Get all users  
**Access**: Admin

### PUT /api/admin/users/:userId/role
**Description**: Update user role  
**Access**: Admin  
**Body**:
```json
{
  "role": "admin"
}
```

### DELETE /api/admin/users/:userId
**Description**: Delete a user  
**Access**: Admin

---

## Available Locations

The system uses these predefined locations:
- `storeA`
- `storeB`
- `lorry1`
- `lorry2`

---

## Testing Checklist

### ✅ Sales
- [x] GET /api/sales/history - with and without filters
- [x] POST /api/sales/entry - cash payment
- [x] POST /api/sales/entry - credit payment with dueDate
- [x] GET /api/sales/due-bills
- [x] GET /api/sales/overdue-bills

### ✅ Inventory
- [x] GET /api/admin/inventory
- [x] POST /api/admin/inventory - with location
- [x] GET /api/inventory/locations
- [x] GET /api/inventory
- [x] POST /api/inventory/transfer

### ✅ Dashboard
- [x] GET /api/dashboard/sales-data
- [x] GET /api/dashboard/credit-customers
- [x] GET /api/dashboard/due-bills

### ✅ Customers
- [x] GET /api/customers
- [x] POST /api/customers
- [x] GET /api/customers/:id
- [x] PUT /api/customers/:id (admin only)
- [x] DELETE /api/customers/:id (admin only)

### ✅ Admin
- [x] GET /api/admin/users
- [x] PUT /api/admin/users/:userId/role
- [x] DELETE /api/admin/users/:userId

---

## Common Error Responses

**400 Bad Request**: Validation error
```json
{
  "success": false,
  "message": "Error message here"
}
```

**401 Unauthorized**: Missing or invalid token
```json
{
  "success": false,
  "message": "Not authorized to access this route"
}
```

**403 Forbidden**: Insufficient permissions
```json
{
  "success": false,
  "message": "User role \"user\" is not authorized for this action."
}
```

**404 Not Found**: Resource not found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

---

## Notes

1. **Inventory Updates**: When recording a sale, inventory quantities are automatically updated at the specified locations.

2. **Credit Sales**: When `paymentMethod` is 'credit', `dueDate` is required.

3. **Discounts**: Percentage discount is applied first, then amount discount.

4. **Stock Transfers**: When transferring stock, if the item doesn't exist at the destination location, a new entry is created.

5. **Permissions**: 
   - Users can view and create (sales, customers, view inventory)
   - Only admins can modify/delete resources and manage inventory transfers

