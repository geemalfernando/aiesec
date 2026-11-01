import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
// AuthProvider is correctly set up in src/index.js, so it doesn't need to be imported/used here directly.

// Import Page components that will render the specific UI.
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';      // Renders the Login component
import RegisterPage from './pages/RegisterPage'; // Renders the Register component

// Import ProtectedRoute for route protection.
import ProtectedRoute from './components/ProtectedRoute';

// Import Dashboard components that will be used within ProtectedRoute.
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';

// Import Admin pages
import InventoryPage from './pages/InventoryPage';
import StockTransferPage from './pages/StockTransferPage';
import SalesEntryPage from './pages/SalesEntryPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import CreditBillsPage from './pages/CreditBillsPage';
import ChequeTrackerPage from './pages/ChequeTrackerPage';
import UserManagementPage from './pages/UserManagementPage';

// Import Error/Access pages.
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';

// Import the Navbar component to be displayed on all pages.
import Navbar from './components/Navbar';

function App() {
  return (
    <Router>
      <Navbar /> {/* Navbar shown on all pages */}
      <div className="container mx-auto mt-4 px-4"> {/* Add a container for content */}
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes - Require authentication */}
          {/* General dashboard access for any logged-in user */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            }
          />

          {/* Specific route for user dashboard */}
          <Route
            path="/user/dashboard"
            element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected and Admin-only routes */}
          <Route
            path="/admin" // General admin access route
            element={
              <ProtectedRoute adminOnly={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard" // Specific admin dashboard route
            element={
              <ProtectedRoute adminOnly={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/inventory"
            element={
              <ProtectedRoute adminOnly={true}>
                <InventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/stock-transfer"
            element={
              <ProtectedRoute adminOnly={true}>
                <StockTransferPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sales-entry"
            element={
              <ProtectedRoute adminOnly={true}>
                <SalesEntryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sales-history"
            element={
              <ProtectedRoute adminOnly={true}>
                <SalesHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/credit-bills"
            element={
              <ProtectedRoute adminOnly={true}>
                <CreditBillsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/cheques"
            element={
              <ProtectedRoute adminOnly={true}>
                <ChequeTrackerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute adminOnly={true}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />

          {/* Access Denied Route */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* 404 Not Found Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;