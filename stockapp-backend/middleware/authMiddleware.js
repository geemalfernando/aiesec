// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust the path if your User model is located elsewhere

/**
 * @desc    Middleware to protect routes - verifies JWT token
 * @route   Applies to any route that needs authentication
 * @access  Public (but checks for valid token)
 */
exports.protect = async (req, res, next) => {
  let token;

  // Check for token in the Authorization header (e.g., 'Bearer TOKEN_STRING')
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // You can add checks for cookies or other token storage methods here if needed

  // If no token is provided, return an unauthorized response
  if (!token) {
    const error = new Error('Not authorized, no token provided');
    error.statusCode = 401; // Unauthorized
    return next(error);
  }

  try {
    // Verify the token using the JWT secret from environment variables
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user associated with the token payload (assuming token contains user ID)
    // Select('-password') ensures the password is not sent back in the user object
    req.user = await User.findById(decoded.id).select('-password');

    // If the user from the token is not found in the database
    if (!req.user) {
      const error = new Error('User not found or token is invalid');
      error.statusCode = 401;
      return next(error);
    }

    // If token is valid and user is found, proceed to the next middleware/route handler
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    // If token verification fails (e.g., expired, malformed)
    const error = new Error('Not authorized, token is invalid');
    error.statusCode = 401;
    next(error);
  }
};

/**
 * @desc    Middleware to authorize roles - checks if user has allowed roles
 * @route   Applies to routes that require specific user roles
 * @access  Public (but checks user role after authentication)
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Ensure user is authenticated first (req.user should be populated by the 'protect' middleware)
    if (!req.user) {
      const error = new Error('Authentication required to perform this action.');
      error.statusCode = 401;
      return next(error);
    }

    // Check if the authenticated user's role is included in the allowed roles provided to the middleware
    if (!roles.includes(req.user.role)) {
      const error = new Error(`User role "${req.user.role}" is not authorized for this action.`);
      error.statusCode = 403; // Forbidden
      return next(error);
    }

    // If the user has one of the allowed roles, proceed
    next();
  };
};