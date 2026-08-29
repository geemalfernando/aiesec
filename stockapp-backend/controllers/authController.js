const User = require('../models/User');
const jwt = require('jsonwebtoken');

// @desc Register user
// @route POST /api/auth/register
// @access Public
const register = async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        console.log("📝 Register request for:", username);

        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide username, email, and password'
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email or username'
            });
        }

        // Create user
        const user = await User.create({
            username,
            email,
            password, // User model will hash this automatically
            role: role || 'user'
        });

        console.log("✅ User created successfully:", user.username);
        sendTokenResponse(user, 201, res);

    } catch (error) {
        console.error("❌ Registration Error:", error.message);
        
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map(val => val.message).join(', ');
            return res.status(400).json({
                success: false,
                message: message
            });
        }
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
};

// @desc Login user
// @route POST /api/auth/login
// @access Public
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email and password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email and password'
            });
        }

        console.log('🔐 Login attempt for:', email);

        // Check for user and include password field
        const user = await User.findOne({ email }).select('+password');
        
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);
        
        if (!isMatch) {
            console.log('❌ Password mismatch for:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        console.log("✅ Login successful for:", user.username);
        sendTokenResponse(user, 200, res);

    } catch (error) {
        console.error('❌ Login error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
};

// @desc Get current logged in user
// @route GET /api/auth/me
// @access Private
const getMe = async (req, res) => {
    console.log("🔍 Fetching user data for ID:", req.user.id);
    
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                profile: user.profile,
                isActive: user.isActive,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error("❌ GetMe error:", error.message);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user data'
        });
    }
};

// Utility: Send token in cookie + response
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = user.getSignedJwtToken();
    
    console.log("🔑 Generated Token for", user.username);
    console.log("🔑 FULL TOKEN (for testing):");
    console.log("===================================");
    console.log(token);
    console.log("===================================");
    
    // Decode token for verification (without verifying signature)
    try {
        const decoded = jwt.decode(token);
        console.log("🔍 Decoded Token:", decoded);
        console.log("🕐 Token expires at:", new Date(decoded.exp * 1000));
    } catch (err) {
        console.log("❌ Error decoding token:", err.message);
    }

    // Calculate cookie expiry (convert days to milliseconds)
    let cookieExpiryDays = parseInt(process.env.JWT_COOKIE_EXPIRE, 10);
    if (isNaN(cookieExpiryDays) || cookieExpiryDays <= 0) {
        console.warn('⚠️ JWT_COOKIE_EXPIRE missing or invalid in .env. Defaulting to 7 days.');
        cookieExpiryDays = 7;
    }

    const options = {
        expires: new Date(Date.now() + cookieExpiryDays * 24 * 60 * 60 * 1000),
        httpOnly: true,
        sameSite: 'lax'
    };

    // Set secure flag in production
    if (process.env.NODE_ENV === 'production') {
        options.secure = true;
    }

    // Send response with token
    res
        .status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                profile: user.profile
            }
        });
};

module.exports = { register, login, getMe };