import { body } from 'express-validator';
import mongoose from 'mongoose';
import Category from '../models/Category.js';

const categoryValidator = body('category')
    .trim()
    .notEmpty().withMessage('Category is required')
    .bail()
    .custom(async (value) => {
        const exists = await Category.findOne({ name: value, isActive: true });
        if (!exists) throw new Error(`"${value}" is not a valid active category`);
        return true;
    });

export const createCourseValidators = [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be 0 or greater'),
    categoryValidator,
    body('level').optional().isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Invalid level'),
];

export const updateCourseValidators = [
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be 0 or greater'),
    body('category').optional().trim().notEmpty().bail().custom(async (value) => {
        if (!value) return true;
        const exists = await Category.findOne({ name: value, isActive: true });
        if (!exists) throw new Error(`"${value}" is not a valid active category`);
        return true;
    }),
    body('level').optional().isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Invalid level'),
];

export const rateCourseValidators = [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().trim().isLength({ min: 3 }).withMessage('Comment must be at least 3 characters'),
    body('review').optional().trim().isLength({ min: 3 }).withMessage('Review must be at least 3 characters'),
];

export const updateProgressValidators = [
    body('chapterId').custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage('chapterId must be a valid ID'),
];
