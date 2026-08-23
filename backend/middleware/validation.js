import { validationResult } from 'express-validator';

// Terminal middleware appended to every express-validator chain — collects
// the validation result, responds 400 with a structured errors array on
// failure, otherwise calls next().
export function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: errors.array()[0].msg,
            errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
        });
    }
    next();
}
