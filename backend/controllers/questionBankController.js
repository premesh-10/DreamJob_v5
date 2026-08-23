import QuestionBank, { QUESTION_TYPES } from '../models/QuestionBank.js';

const isOwnerOrAdmin = (question, req) => {
    const isOwner = question.seller.toString() === req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    return isOwner || isAdmin;
};

// @desc    List the logged-in seller's own question bank questions
// @route   GET /api/v1/question-bank/mine
// @access  Private/Seller
export const getMyQuestions = async (req, res, next) => {
    try {
        const { type, difficulty, search, skillTag, companyTag, roleTag } = req.query;
        const query = { seller: req.user.id };

        if (type) query.type = type;
        if (difficulty) query.difficulty = difficulty;
        if (skillTag) query.skillTags = skillTag;
        if (companyTag) query.companyTags = companyTag;
        if (roleTag) query.roleTags = roleTag;
        if (search) query.questionText = { $regex: search, $options: 'i' };

        const questions = await QuestionBank.find(query)
            .populate('companyTags', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: questions.length, data: questions });
    } catch (error) {
        next(error);
    }
};

// @desc    Get a single question (owner/admin only — includes correct answers/hidden cases)
// @route   GET /api/v1/question-bank/:id
// @access  Private/Seller
export const getQuestionById = async (req, res, next) => {
    try {
        const question = await QuestionBank.findById(req.params.id).populate('companyTags', 'name');
        if (!question) return res.status(404).json({ message: 'Question not found' });
        if (!isOwnerOrAdmin(question, req)) return res.status(403).json({ message: 'Not authorized' });

        res.status(200).json({ success: true, data: question });
    } catch (error) {
        next(error);
    }
};

const validateByType = (body) => {
    const { type, options, codingProblem } = body;
    if (!QUESTION_TYPES.includes(type)) return 'Invalid question type';

    const optionBacked = ['MCQ', 'MSQ', 'TrueFalse'];
    if (optionBacked.includes(type)) {
        if (!Array.isArray(options) || options.length < 2) return 'At least 2 options are required';
        const correctCount = options.filter(o => o.isCorrect).length;
        if (type === 'MSQ') {
            if (correctCount < 1) return 'MSQ must have at least 1 correct option';
        } else if (correctCount !== 1) {
            return `${type} must have exactly 1 correct option`;
        }
    }

    if (['Coding', 'Debugging', 'OutputBased'].includes(type)) {
        if (!codingProblem || !Array.isArray(codingProblem.languages) || codingProblem.languages.length === 0) {
            return 'At least one language must be configured for a coding question';
        }
    }

    return null;
};

// @desc    Create a question bank question
// @route   POST /api/v1/question-bank
// @access  Private/Seller
export const createQuestion = async (req, res, next) => {
    try {
        const error = validateByType(req.body);
        if (error) return res.status(400).json({ message: error });

        const {
            type, questionText, image, options, acceptedAnswers, rubric,
            codingProblem, sqlSchema, difficulty, skillTags, companyTags, roleTags,
            marks, negativeMarks, explanation
        } = req.body;

        const question = await QuestionBank.create({
            seller: req.user.id,
            type,
            questionText,
            image: image || '',
            options: options || [],
            acceptedAnswers: acceptedAnswers || [],
            rubric: rubric || '',
            codingProblem: codingProblem || undefined,
            sqlSchema: sqlSchema || '',
            difficulty: difficulty || 'medium',
            skillTags: skillTags || [],
            companyTags: companyTags || [],
            roleTags: roleTags || [],
            marks: Number(marks) || 1,
            negativeMarks: Number(negativeMarks) || 0,
            explanation: explanation || ''
        });

        res.status(201).json({ success: true, data: question });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a question bank question
// @route   PUT /api/v1/question-bank/:id
// @access  Private/Seller
export const updateQuestion = async (req, res, next) => {
    try {
        const question = await QuestionBank.findById(req.params.id);
        if (!question) return res.status(404).json({ message: 'Question not found' });
        if (!isOwnerOrAdmin(question, req)) return res.status(403).json({ message: 'Not authorized' });

        const merged = { type: question.type, options: question.options, codingProblem: question.codingProblem, ...req.body };
        const error = validateByType(merged);
        if (error) return res.status(400).json({ message: error });

        const updates = { ...req.body };
        delete updates.seller;
        delete updates.usageCount;
        delete updates.isApproved; // moderation-only field, not seller-settable

        Object.assign(question, updates);
        // Editing a previously-approved question sends it back for re-review.
        question.isApproved = false;
        await question.save();

        res.status(200).json({ success: true, data: question });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a question bank question
// @route   DELETE /api/v1/question-bank/:id
// @access  Private/Seller
export const deleteQuestion = async (req, res, next) => {
    try {
        const question = await QuestionBank.findById(req.params.id);
        if (!question) return res.status(404).json({ message: 'Question not found' });
        if (!isOwnerOrAdmin(question, req)) return res.status(403).json({ message: 'Not authorized' });

        if (question.usageCount > 0) {
            return res.status(400).json({ message: 'Cannot delete a question that is in use by a published test. Remove it from all tests first.' });
        }

        await question.deleteOne();
        res.status(200).json({ success: true, message: 'Question deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Clone a question (e.g. to tweak a variant without losing the original)
// @route   POST /api/v1/question-bank/:id/clone
// @access  Private/Seller
export const cloneQuestion = async (req, res, next) => {
    try {
        const question = await QuestionBank.findById(req.params.id);
        if (!question) return res.status(404).json({ message: 'Question not found' });
        if (!isOwnerOrAdmin(question, req)) return res.status(403).json({ message: 'Not authorized' });

        const data = question.toObject();
        delete data._id;
        delete data.createdAt;
        delete data.updatedAt;
        data.seller = req.user.id;
        data.usageCount = 0;
        data.isApproved = false;
        data.questionText = `${data.questionText} (copy)`;

        const clone = await QuestionBank.create(data);
        res.status(201).json({ success: true, data: clone });
    } catch (error) {
        next(error);
    }
};

// ── Admin moderation ────────────────────────────────────────────────────────

// @desc    Admin: list questions awaiting moderation (isApproved: false)
// @route   GET /api/v1/admin/question-bank/pending
// @access  Private/Admin
export const adminGetPendingQuestions = async (req, res, next) => {
    try {
        const questions = await QuestionBank.find({ isApproved: false })
            .populate('seller', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: questions.length, data: questions });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: approve a question so it can be used in published tests
// @route   PATCH /api/v1/admin/question-bank/:id/approve
// @access  Private/Admin
export const adminApproveQuestion = async (req, res, next) => {
    try {
        const question = await QuestionBank.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
        if (!question) return res.status(404).json({ message: 'Question not found' });

        res.status(200).json({ success: true, data: question });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: permanently delete a question (e.g. rejected content)
// @route   DELETE /api/v1/admin/question-bank/:id
// @access  Private/Admin
export const adminDeleteQuestion = async (req, res, next) => {
    try {
        const question = await QuestionBank.findById(req.params.id);
        if (!question) return res.status(404).json({ message: 'Question not found' });
        if (question.usageCount > 0) {
            return res.status(400).json({ message: 'Cannot delete a question that is in use by a published test' });
        }

        await question.deleteOne();
        res.status(200).json({ success: true, message: 'Question deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Bulk import questions (JSON array) — sellers commonly migrate from spreadsheets
// @route   POST /api/v1/question-bank/bulk-import
// @access  Private/Seller
export const bulkImportQuestions = async (req, res, next) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'questions must be a non-empty array' });
        }

        const errors = [];
        const toCreate = [];
        questions.forEach((q, idx) => {
            const error = validateByType(q);
            if (error) {
                errors.push({ index: idx, error });
                return;
            }
            toCreate.push({
                seller: req.user.id,
                type: q.type,
                questionText: q.questionText,
                image: q.image || '',
                options: q.options || [],
                acceptedAnswers: q.acceptedAnswers || [],
                rubric: q.rubric || '',
                codingProblem: q.codingProblem || undefined,
                sqlSchema: q.sqlSchema || '',
                difficulty: q.difficulty || 'medium',
                skillTags: q.skillTags || [],
                companyTags: q.companyTags || [],
                roleTags: q.roleTags || [],
                marks: Number(q.marks) || 1,
                negativeMarks: Number(q.negativeMarks) || 0,
                explanation: q.explanation || ''
            });
        });

        const created = toCreate.length > 0 ? await QuestionBank.insertMany(toCreate) : [];

        res.status(201).json({
            success: true,
            createdCount: created.length,
            errorCount: errors.length,
            errors,
            data: created
        });
    } catch (error) {
        next(error);
    }
};
