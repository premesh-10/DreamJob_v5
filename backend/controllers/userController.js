import User from '../models/User.js';
import { uploadAvatar, deleteUploadedFile } from '../middleware/uploadMiddleware.js';
import multer from 'multer';

// @desc    Update user profile
// @route   PUT /api/v1/users/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (user) {
            user.name = req.body.name || user.name;
            user.mobile = req.body.mobile || user.mobile;
            user.experience = req.body.experience || user.experience;
            user.gender = req.body.gender || user.gender;
            user.qualification = req.body.qualification || user.qualification;
            user.country = req.body.country || user.country;

            // Update password if provided
            if (req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();

            res.status(200).json({
                success: true,
                data: {
                    id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    role: updatedUser.role,
                    mobile: updatedUser.mobile,
                    experience: updatedUser.experience,
                    gender: updatedUser.gender,
                    qualification: updatedUser.qualification,
                    country: updatedUser.country,
                    profilePic: updatedUser.profilePic,
                }
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Upload / change profile picture
// @route   POST /api/v1/users/profile/avatar
// @access  Private
export const uploadProfilePic = (req, res, next) => {
    uploadAvatar(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        try {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ message: 'User not found' });

            // Delete old avatar from disk (only if it was a local upload, not an external URL)
            if (user.profilePic && user.profilePic.startsWith('/uploads/')) {
                deleteUploadedFile(user.profilePic);
            }

            // Save the new path
            user.profilePic = `/uploads/avatars/${req.file.filename}`;
            await user.save();

            res.status(200).json({
                success: true,
                data: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    mobile: user.mobile,
                    experience: user.experience,
                    gender: user.gender,
                    qualification: user.qualification,
                    country: user.country,
                    profilePic: user.profilePic,
                }
            });
        } catch (error) {
            next(error);
        }
    });
};

// @desc    Remove profile picture (revert to initials)
// @route   DELETE /api/v1/users/profile/avatar
// @access  Private
export const removeProfilePic = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.profilePic && user.profilePic.startsWith('/uploads/')) {
            deleteUploadedFile(user.profilePic);
        }
        user.profilePic = '';
        await user.save();

        res.status(200).json({ success: true, data: { profilePic: '' } });
    } catch (error) {
        next(error);
    }
};
