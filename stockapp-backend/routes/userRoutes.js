const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Apply protection to all user routes
router.use(protect);

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', async (req, res) => {
  try {
    const { profile } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profile },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get user dashboard data
// @route   GET /api/users/dashboard
// @access  Private
router.get('/dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Here you would typically fetch user-specific data
    const dashboardData = {
      user: {
        username: user.username,
        email: user.email,
        profile: user.profile,
        joinDate: user.createdAt
      },
      stats: {
        // Add user-specific statistics
        loginCount: 0,
        lastLogin: new Date()
      }
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;