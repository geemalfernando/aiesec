// server.js (or app.js)
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import database connection function
const connectDB = require('./config/db');

// Import all route files
const adminRoutes = require('./routes/adminRoutes'); // This is the new/updated admin route file
const customerRoutes = require('./routes/customerRoutes'); // NEW: Import customer routes
const salesRoutes = require('./routes/salesRoutes');     // NEW: Import sales routes
const inventoryRoutes = require('./routes/inventoryRoutes'); // NEW: Import inventory routes
const dashboardRoutes = require('./routes/dashboardRoutes'); // NEW: Import dashboard routes
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// --- Middleware ---

// 1. Request Logging (Optional, but useful for development)
// Logs details about each incoming request.
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${req.headers.origin || 'unknown'}`);
  next();
});

// 2. CORS Middleware
// Enables cross-origin requests from your frontend application.
// There is no login, so only the app itself may call this API from a browser.
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));

// 3. Body Parsers
// These built-in Express middlewares parse incoming request bodies.
// Removed the redundant 'body-parser' import and usage.
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// --- Routes ---
// Mount all your API routes.
app.use('/api/admin', adminRoutes);
app.use('/api/customers', customerRoutes); // Mount customer routes
app.use('/api/sales', salesRoutes);     // Mount sales routes
app.use('/api/inventory', inventoryRoutes);     // NEW: Mount inventory routes
app.use('/api/dashboard', dashboardRoutes);     // NEW: Mount dashboard routes
app.use('/api/payments', paymentRoutes);

// --- Database Connection ---
// Establishes connection to your MongoDB database.
connectDB();

// --- Global Error Handling Middleware ---
// This MUST be the last middleware defined.
// It catches any errors passed via next(err) from your routes or other middleware.
app.use((err, req, res, next) => {
  console.error('Global Error Handler Caught:', err.stack); // Log the error stack for debugging

  // Determine status code and message
  const statusCode = err.statusCode || 500; // Use error's status code or default to 500
  const message = err.message || 'Internal Server Error'; // Use error's message or a default

  // Send a consistent JSON error response
  res.status(statusCode).json({
    success: false,
    message: message,
    // Optionally, include stack trace in development mode for debugging
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});


// --- Server Configuration ---
// Get the port from environment variables or default to 5001
const PORT = process.env.PORT || 5001;
// There is no login, so by default only this computer can reach the API.
const HOST = process.env.HOST || '127.0.0.1';

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// --- Graceful Shutdown ---
// Handle unhandled promise rejections to prevent application crashes
process.on('unhandledRejection', (err, promise) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  // Close the server and exit the process with a failure code
  server.close(() => {
    process.exit(1);
  });
});

// Handle unhandled exceptions
process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception Error: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});