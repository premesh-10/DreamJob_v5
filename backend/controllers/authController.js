import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { getSiteSettings } from '../utils/siteSettingsCache.js';

const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken();

    user.save({ validateBeforeSave: false });

    const options = {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };

    res.status(statusCode).cookie('token', token, options).json({
        success: true,
        token,
        refreshToken,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            mobile: user.mobile,
            subscription: user.subscription,
            profilePic: user.profilePic
        }
    });
};

export const register = async (req, res, next) => {
    try {
        const site = await getSiteSettings();
        if (site.allowUserRegistrations === false) {
            return res.status(403).json({ success: false, message: 'New user registrations are currently disabled. Please check back later.' });
        }

        const { name, email, mobile, experience, gender, qualification, country, password, role } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            mobile,
            experience,
            gender,
            qualification,
            country,
            password,
            role
        });

        sendTokenResponse(user, 201, res);
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide an email and password' });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // ── Block check: must come AFTER password validation to prevent user enumeration
        if (user.isBlocked) {
            return res.status(403).json({
                message: 'Your account has been suspended. Please contact support@dreamjob.com for assistance.'
            });
        }

        sendTokenResponse(user, 200, res);
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

export const logout = async (req, res, next) => {
    try {
        res.cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true
        });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

export const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ message: 'Please provide a refresh token' });
        }

        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            const user = await User.findById(decoded.id);

            if (!user || user.refreshToken !== refreshToken) {
                return res.status(401).json({ message: 'Invalid refresh token' });
            }

            // Block check on token refresh too
            if (user.isBlocked) {
                return res.status(403).json({
                    message: 'Your account has been suspended. Please contact support.'
                });
            }

            sendTokenResponse(user, 200, res);
        } catch (error) {
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }
    } catch (error) {
        next(error);
    }
};
