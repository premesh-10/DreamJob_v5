import mongoose from 'mongoose';
import PracticeTest from '../models/PracticeTest.js';
import PracticeTestAttempt from '../models/PracticeTestAttempt.js';
import Course from '../models/Course.js';
import QuestionBank from '../models/QuestionBank.js';
import AuditLog from '../models/AuditLog.js';
import Job from '../models/Job.js';
import { enqueue } from '../utils/jobQueue.js';
import { runJudge0Submission } from '../utils/judge0Client.js';
import { runSqlSubmission } from '../utils/sqlRunner.js';
import { buildImmediateResultPayload, buildAttemptReport } from '../services/assessmentReportService.js';
import { checkAndAwardBadges } from '../services/badgeService.js';
import { issueCertificateIfEligible } from '../services/certificateService.js';
import { awardPoints, POINTS_RULES } from '../utils/gamification.js';

const canManageTest = (test, req) => {
    const isSeller = test.seller.toString() === req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    return isSeller || isAdmin;
};

// Section-mode tests store questions by reference (QuestionBank), so counting/marks
// can't read test.questions directly. For list/display purposes (not scoring), this
// approximates marks using overrideMarks where set, else 1 — actual scoring at attempt
// time resolves real QuestionBank.marks per question.
const getQuestionCountAndMarks = (test) => {
    if (test.sections?.length > 0) {
        const refs = test.sections.flatMap(s => s.questionRefs);
        return {
            questionCount: refs.length,
            totalMarks: refs.reduce((s, r) => s + (r.overrideMarks ?? 1), 0)
        };
    }
    return {
        questionCount: test.questions.length,
        totalMarks: test.questions.reduce((s, q) => s + (q.marks || 1), 0)
    };
};

// ── Seller CRUD ───────────────────────────────────────────────────────────────

// @desc    Get all practice tests for logged-in seller
// @route   GET /api/v1/practice-tests/mine
// @access  Private/Seller
export const getMyPracticeTests = async (req, res, next) => {
    try {
        const tests = await PracticeTest.find({ seller: req.user.id })
            .populate('course', 'title')
            .sort({ createdAt: -1 });

        // Enrich with attempt counts
        const enriched = await Promise.all(tests.map(async (test) => {
            const attemptCount = await PracticeTestAttempt.countDocuments({ practiceTest: test._id });
            return {
                ...test.toObject(),
                attemptCount,
                ...getQuestionCountAndMarks(test)
            };
        }));

        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all published practice tests (public listing)
// @route   GET /api/v1/practice-tests
// @access  Public
export const getPublicPracticeTests = async (req, res, next) => {
    try {
        const { search, subject } = req.query;
        const now = new Date();
        let query = {
            isPublished: true,
            $and: [
                { $or: [{ 'schedule.availableFrom': null }, { 'schedule.availableFrom': { $lte: now } }] },
                { $or: [{ 'schedule.availableUntil': null }, { 'schedule.availableUntil': { $gte: now } }] }
            ]
        };

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }
        if (subject) query.subject = { $regex: subject, $options: 'i' };

        const tests = await PracticeTest.find(query)
            .populate('seller', 'name')
            .populate('course', 'title')
            .select('-questions.options.isCorrect') // Don't expose answers
            .sort({ createdAt: -1 });

        const enriched = tests.map(t => ({
            ...t.toObject(),
            ...getQuestionCountAndMarks(t)
        }));

        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
        next(error);
    }
};

// @desc    Cross-feature recommendations — pure query-time matching against
//          existing PracticeTest fields (company/targetRole/subject/tags), no
//          new model. Used by Company hub pages, Interview Experience detail
//          pages, and mock-interview booking (matched on Interview.domain).
// @route   GET /api/v1/practice-tests/recommendations
// @access  Public
export const getRecommendedPracticeTests = async (req, res, next) => {
    try {
        const { company, role, domain, limit } = req.query;
        const orClauses = [];
        if (company) orClauses.push({ company });
        if (role) orClauses.push({ targetRole: { $regex: role, $options: 'i' } });
        if (domain) {
            orClauses.push({ subject: { $regex: domain, $options: 'i' } });
            orClauses.push({ tags: { $regex: domain, $options: 'i' } });
        }
        if (orClauses.length === 0) return res.status(200).json({ success: true, data: [] });

        const now = new Date();
        const tests = await PracticeTest.find({
            isPublished: true,
            $or: orClauses,
            $and: [
                { $or: [{ 'schedule.availableFrom': null }, { 'schedule.availableFrom': { $lte: now } }] },
                { $or: [{ 'schedule.availableUntil': null }, { 'schedule.availableUntil': { $gte: now } }] }
            ]
        })
            .select('title subject assessmentCategory company targetRole timeLimit passingScore totalAttempts avgScore tags')
            .populate('company', 'name logo')
            .limit(20);

        const roleLower = (role || '').toLowerCase();
        const domainLower = (domain || '').toLowerCase();
        const scored = tests.map(t => {
            let score = 0;
            if (company && t.company?._id?.toString() === company) score += 3;
            if (roleLower && t.targetRole?.toLowerCase().includes(roleLower)) score += 2;
            if (domainLower && (t.subject?.toLowerCase().includes(domainLower) || t.tags?.some(tag => tag.toLowerCase().includes(domainLower)))) score += 1;
            return { ...t.toObject(), _score: score };
        }).sort((a, b) => b._score - a._score).slice(0, Math.min(20, Number(limit) || 6));

        res.status(200).json({ success: true, count: scored.length, data: scored });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single practice test detail (for sellers/admins — includes answer keys)
// @route   GET /api/v1/practice-tests/:id
// @access  Private
export const getPracticeTest = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id)
            .populate('seller', 'name email')
            .populate('course', 'title');

        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const isSeller = test.seller._id.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user.role);

        // Public users only get the test without correct answer markings
        let data = test.toObject();
        if (!isSeller && !isAdmin) {
            if (!test.isPublished) {
                return res.status(404).json({ message: 'Practice test not found' });
            }
            // Strip correct answer flags from options
            data.questions = data.questions.map(q => ({
                ...q,
                options: q.options.map(o => ({ _id: o._id, text: o.text }))
            }));
        }

        // Attempt stats (only if logged in)
        const attemptCount = await PracticeTestAttempt.countDocuments({ practiceTest: test._id });
        const userAttempts = req.user
            ? await PracticeTestAttempt.find({
                practiceTest: test._id,
                user: req.user.id,
                status: 'completed'
            }).sort({ createdAt: -1 }).limit(20)
            : [];

        res.status(200).json({
            success: true,
            data: {
                ...data,
                ...getQuestionCountAndMarks(test),
                totalAttempts: attemptCount,
                myAttempts: userAttempts
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a practice test
// @route   POST /api/v1/practice-tests
// @access  Private/Seller
export const createPracticeTest = async (req, res, next) => {
    try {
        const {
            title, subject, description, courseId, tags,
            timeLimit, hasPerQuestionTimer, maxAttempts, passingScore,
            shuffleQuestions, shuffleOptions, showResultsImmediately,
            assessmentCategory, company, targetRole,
            negativeMarking, security, certificate, pricing, schedule,
            allowResume, allowCalculator
        } = req.body;

        const testData = {
            title,
            subject,
            description: description || '',
            seller: req.user.id,
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
            timeLimit: Number(timeLimit) || 0,
            hasPerQuestionTimer: hasPerQuestionTimer === true || hasPerQuestionTimer === 'true',
            maxAttempts: Number(maxAttempts) || 0,
            passingScore: Number(passingScore) || 60,
            shuffleQuestions: shuffleQuestions === true || shuffleQuestions === 'true',
            shuffleOptions: shuffleOptions === true || shuffleOptions === 'true',
            showResultsImmediately: showResultsImmediately !== false && showResultsImmediately !== 'false'
        };

        if (assessmentCategory) testData.assessmentCategory = assessmentCategory;
        if (company) testData.company = company;
        if (targetRole !== undefined) testData.targetRole = targetRole;
        if (negativeMarking) testData.negativeMarking = negativeMarking;
        if (security) testData.security = security;
        if (certificate) testData.certificate = certificate;
        if (pricing) testData.pricing = pricing;
        if (schedule) testData.schedule = schedule;
        if (allowResume !== undefined) testData.allowResume = allowResume === true || allowResume === 'true';
        if (allowCalculator !== undefined) testData.allowCalculator = allowCalculator === true || allowCalculator === 'true';

        if (courseId) {
            const course = await Course.findById(courseId);
            if (course) {
                testData.course = courseId;
            }
        }

        const test = await PracticeTest.create(testData);

        // If linked to a course, add to course's practiceTests array
        if (testData.course) {
            await Course.findByIdAndUpdate(testData.course, {
                $addToSet: { practiceTests: test._id }
            });
        }

        res.status(201).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    Update practice test metadata
// @route   PUT /api/v1/practice-tests/:id
// @access  Private/Seller
export const updatePracticeTest = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const isSeller = test.seller.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        if (!isSeller && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

        const updates = { ...req.body };
        if (updates.tags && typeof updates.tags === 'string') {
            updates.tags = updates.tags.split(',').map(t => t.trim());
        }
        // Don't let updates overwrite questions/sections through here — those go
        // through their own dedicated endpoints (addQuestion/... and the section CRUD below)
        delete updates.questions;
        delete updates.sections;
        delete updates.seller;

        const updated = await PracticeTest.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a practice test
// @route   DELETE /api/v1/practice-tests/:id
// @access  Private/Seller
export const deletePracticeTest = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const isSeller = test.seller.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        if (!isSeller && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

        // Remove from course if linked
        if (test.course) {
            await Course.findByIdAndUpdate(test.course, {
                $pull: { practiceTests: test._id }
            });
        }

        // Delete all attempts
        await PracticeTestAttempt.deleteMany({ practiceTest: test._id });

        await test.deleteOne();
        res.status(200).json({ success: true, message: 'Practice test deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle publish/unpublish
// @route   PATCH /api/v1/practice-tests/:id/publish
// @access  Private/Seller
export const togglePracticeTestPublish = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const isSeller = test.seller.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        if (!isSeller && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

        const sectionQuestionCount = test.sections.reduce((s, sec) => s + sec.questionRefs.length, 0);
        if (!test.isPublished && test.questions.length === 0 && sectionQuestionCount === 0) {
            return res.status(400).json({ message: 'Cannot publish a test with no questions' });
        }

        test.isPublished = !test.isPublished;
        await test.save();

        res.status(200).json({
            success: true,
            isPublished: test.isPublished,
            message: `Practice test ${test.isPublished ? 'published' : 'unpublished'}`
        });
    } catch (error) {
        next(error);
    }
};

// ── Question Management ───────────────────────────────────────────────────────

// @desc    Add a question to a practice test
// @route   POST /api/v1/practice-tests/:id/questions
// @access  Private/Seller
export const addQuestion = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const isSeller = test.seller.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        if (!isSeller && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

        const { questionText, type, options, timeLimit, explanation, marks } = req.body;

        if (!questionText || !type || !options) {
            return res.status(400).json({ message: 'questionText, type, and options are required' });
        }

        let parsedOptions = options;
        if (typeof options === 'string') {
            try { parsedOptions = JSON.parse(options); } catch { return res.status(400).json({ message: 'Invalid options format' }); }
        }

        if (!Array.isArray(parsedOptions) || parsedOptions.length < 2 || parsedOptions.length > 5) {
            return res.status(400).json({ message: 'Options must be an array of 2-5 items' });
        }

        // Validate correctness
        const correctCount = parsedOptions.filter(o => o.isCorrect).length;
        if (type === 'MCQ' && correctCount !== 1) {
            return res.status(400).json({ message: 'MCQ must have exactly 1 correct option' });
        }
        if (type === 'MSQ' && correctCount < 1) {
            return res.status(400).json({ message: 'MSQ must have at least 1 correct option' });
        }

        const question = {
            questionText,
            type,
            options: parsedOptions,
            timeLimit: Number(timeLimit) || 0,
            explanation: explanation || '',
            marks: Number(marks) || 1,
            order: test.questions.length + 1
        };

        test.questions.push(question);
        await test.save();

        res.status(200).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a question
// @route   PUT /api/v1/practice-tests/:id/questions/:questionId
// @access  Private/Seller
export const updateQuestion = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const isSeller = test.seller.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        if (!isSeller && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

        const question = test.questions.id(req.params.questionId);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        const { questionText, type, options, timeLimit, explanation, marks } = req.body;

        if (questionText) question.questionText = questionText;
        if (type) question.type = type;
        if (timeLimit !== undefined) question.timeLimit = Number(timeLimit) || 0;
        if (explanation !== undefined) question.explanation = explanation;
        if (marks !== undefined) question.marks = Number(marks) || 1;

        if (options) {
            let parsedOptions = options;
            if (typeof options === 'string') {
                try { parsedOptions = JSON.parse(options); } catch { return res.status(400).json({ message: 'Invalid options format' }); }
            }

            const correctCount = parsedOptions.filter(o => o.isCorrect).length;
            const qType = type || question.type;
            if (qType === 'MCQ' && correctCount !== 1) {
                return res.status(400).json({ message: 'MCQ must have exactly 1 correct option' });
            }
            if (qType === 'MSQ' && correctCount < 1) {
                return res.status(400).json({ message: 'MSQ must have at least 1 correct option' });
            }

            question.options = parsedOptions;
        }

        await test.save();
        res.status(200).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a question
// @route   DELETE /api/v1/practice-tests/:id/questions/:questionId
// @access  Private/Seller
export const deleteQuestion = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const isSeller = test.seller.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        if (!isSeller && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

        test.questions.pull(req.params.questionId);
        await test.save();

        res.status(200).json({ success: true, message: 'Question deleted', data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    Reorder questions
// @route   PUT /api/v1/practice-tests/:id/questions/reorder
// @access  Private/Seller
export const reorderQuestions = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const isSeller = test.seller.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        if (!isSeller && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

        const { order } = req.body; // [{ id, order }]
        if (!Array.isArray(order)) return res.status(400).json({ message: 'order must be an array' });

        order.forEach(({ id, order: newOrder }) => {
            const q = test.questions.id(id);
            if (q) q.order = newOrder;
        });

        test.questions.sort((a, b) => a.order - b.order);
        await test.save();

        res.status(200).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// ── Sections (question-bank-backed authoring) ───────────────────────────────────

// @desc    Add a section to a test
// @route   POST /api/v1/practice-tests/:id/sections
// @access  Private/Seller
export const addSection = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });
        if (!canManageTest(test, req)) return res.status(403).json({ message: 'Not authorized' });

        const { name, description, timeLimit, questionSelectionMode, randomCount, randomFromTags } = req.body;
        if (!name) return res.status(400).json({ message: 'Section name is required' });

        test.sections.push({
            name,
            description: description || '',
            order: test.sections.length,
            timeLimit: Number(timeLimit) || 0,
            questionSelectionMode: questionSelectionMode || 'fixed',
            randomCount: Number(randomCount) || 0,
            randomFromTags: randomFromTags || [],
            questionRefs: []
        });
        await test.save();

        res.status(200).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a section's metadata
// @route   PUT /api/v1/practice-tests/:id/sections/:sectionId
// @access  Private/Seller
export const updateSection = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });
        if (!canManageTest(test, req)) return res.status(403).json({ message: 'Not authorized' });

        const section = test.sections.id(req.params.sectionId);
        if (!section) return res.status(404).json({ message: 'Section not found' });

        const { name, description, timeLimit, questionSelectionMode, randomCount, randomFromTags } = req.body;
        if (name !== undefined) section.name = name;
        if (description !== undefined) section.description = description;
        if (timeLimit !== undefined) section.timeLimit = Number(timeLimit) || 0;
        if (questionSelectionMode !== undefined) section.questionSelectionMode = questionSelectionMode;
        if (randomCount !== undefined) section.randomCount = Number(randomCount) || 0;
        if (randomFromTags !== undefined) section.randomFromTags = randomFromTags;

        await test.save();
        res.status(200).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a section (and release usageCount on its referenced questions)
// @route   DELETE /api/v1/practice-tests/:id/sections/:sectionId
// @access  Private/Seller
export const deleteSection = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });
        if (!canManageTest(test, req)) return res.status(403).json({ message: 'Not authorized' });

        const section = test.sections.id(req.params.sectionId);
        if (!section) return res.status(404).json({ message: 'Section not found' });

        const bankIds = section.questionRefs.map(r => r.questionBank);
        test.sections.pull(req.params.sectionId);
        await test.save();

        if (bankIds.length > 0) {
            await QuestionBank.updateMany({ _id: { $in: bankIds } }, { $inc: { usageCount: -1 } });
        }

        res.status(200).json({ success: true, message: 'Section deleted', data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    Reorder sections
// @route   PUT /api/v1/practice-tests/:id/sections/reorder
// @access  Private/Seller
export const reorderSections = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });
        if (!canManageTest(test, req)) return res.status(403).json({ message: 'Not authorized' });

        const { order } = req.body; // [{ id, order }]
        if (!Array.isArray(order)) return res.status(400).json({ message: 'order must be an array' });

        order.forEach(({ id, order: newOrder }) => {
            const s = test.sections.id(id);
            if (s) s.order = newOrder;
        });
        test.sections.sort((a, b) => a.order - b.order);
        await test.save();

        res.status(200).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    Add a question-bank reference to a section
// @route   POST /api/v1/practice-tests/:id/sections/:sectionId/questions
// @access  Private/Seller
export const addQuestionRefToSection = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });
        if (!canManageTest(test, req)) return res.status(403).json({ message: 'Not authorized' });

        const section = test.sections.id(req.params.sectionId);
        if (!section) return res.status(404).json({ message: 'Section not found' });

        const { questionBankId, overrideMarks, overrideNegativeMarks } = req.body;
        const question = await QuestionBank.findById(questionBankId);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        const isOwner = question.seller.toString() === test.seller.toString();
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        if (!isOwner && !isAdmin) return res.status(403).json({ message: 'You can only add your own questions' });

        section.questionRefs.push({
            questionBank: question._id,
            overrideMarks: overrideMarks !== undefined ? Number(overrideMarks) : null,
            overrideNegativeMarks: overrideNegativeMarks !== undefined ? Number(overrideNegativeMarks) : null,
            order: section.questionRefs.length
        });
        await test.save();
        question.usageCount += 1;
        await question.save();

        res.status(200).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    Remove a question-bank reference from a section
// @route   DELETE /api/v1/practice-tests/:id/sections/:sectionId/questions/:refId
// @access  Private/Seller
export const removeQuestionRefFromSection = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });
        if (!canManageTest(test, req)) return res.status(403).json({ message: 'Not authorized' });

        const section = test.sections.id(req.params.sectionId);
        if (!section) return res.status(404).json({ message: 'Section not found' });

        const ref = section.questionRefs.id(req.params.refId);
        if (!ref) return res.status(404).json({ message: 'Question reference not found' });

        const bankId = ref.questionBank;
        section.questionRefs.pull(req.params.refId);
        await test.save();
        await QuestionBank.findByIdAndUpdate(bankId, { $inc: { usageCount: -1 } });

        res.status(200).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    One-click convert a legacy flat-mode test into section mode by wrapping
//          its inline questions[] into newly-created QuestionBank docs inside one
//          synthetic section. Legacy questions[] is left in place (unused) for reference.
// @route   POST /api/v1/practice-tests/:id/convert-to-sections
// @access  Private/Seller
export const convertToSections = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });
        if (!canManageTest(test, req)) return res.status(403).json({ message: 'Not authorized' });

        if (test.sections.length > 0) {
            return res.status(400).json({ message: 'This test already uses sections' });
        }
        if (test.questions.length === 0) {
            return res.status(400).json({ message: 'This test has no legacy questions to convert' });
        }

        const questionRefs = [];
        for (const q of test.questions) {
            const bankDoc = await QuestionBank.create({
                seller: test.seller,
                type: q.type,
                questionText: q.questionText,
                image: q.image || '',
                options: q.options,
                marks: q.marks || 1,
                explanation: q.explanation || '',
                isApproved: true, // was already live as a published inline question
                skillTags: test.tags || []
            });
            questionRefs.push({ questionBank: bankDoc._id, order: q.order || 0 });
        }

        test.sections.push({ name: 'Section 1', order: 0, timeLimit: 0, questionRefs });
        await test.save();

        res.status(200).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// ── User Quiz Flow ─────────────────────────────────────────────────────────────

const OPTION_BACKED_TYPES = ['MCQ', 'MSQ', 'TrueFalse'];
const EXECUTION_TYPES = ['Coding', 'SQL', 'Debugging', 'OutputBased'];

// Strip every answer-bearing field from a QuestionBank doc before it reaches a student.
const stripQuestionForStudent = (q) => {
    const base = {
        _id: q._id,
        questionText: q.questionText,
        type: q.type,
        image: q.image || '',
        explanation: undefined // never sent before submission; added back in results
    };
    if (OPTION_BACKED_TYPES.includes(q.type)) {
        base.options = q.options.map(o => ({ _id: o._id, text: o.text }));
    }
    if (EXECUTION_TYPES.includes(q.type) && q.codingProblem) {
        base.codingProblem = {
            languages: q.codingProblem.languages || [],
            starterCode: q.codingProblem.starterCode || {},
            sampleTestCases: q.codingProblem.sampleTestCases || []
        };
    }
    if (q.type === 'SQL') {
        base.sqlSchema = q.sqlSchema || '';
    }
    delete base.explanation;
    return base;
};

// Resolve one section's question pool at attempt-start time (fixed order, or a
// random sample — either from the section's own questionRefs, or from a wider
// tag-matched pool when randomFromTags is configured).
const resolveSectionQuestions = async (test, section) => {
    if (section.questionSelectionMode === 'random') {
        let pool;
        if (section.randomFromTags?.length > 0) {
            pool = await QuestionBank.find({ seller: test.seller, skillTags: { $in: section.randomFromTags } });
        } else {
            pool = await QuestionBank.find({ _id: { $in: section.questionRefs.map(r => r.questionBank) } });
        }
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, section.randomCount || shuffled.length)
            .map((q, idx) => ({ question: q, marks: q.marks, negativeMarks: q.negativeMarks, order: idx }));
    }

    const questions = await QuestionBank.find({ _id: { $in: section.questionRefs.map(r => r.questionBank) } });
    const qMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));
    return [...section.questionRefs]
        .sort((a, b) => a.order - b.order)
        .map(ref => {
            const q = qMap[ref.questionBank.toString()];
            if (!q) return null;
            return { question: q, marks: ref.overrideMarks ?? q.marks, negativeMarks: ref.overrideNegativeMarks ?? q.negativeMarks, order: ref.order };
        })
        .filter(Boolean);
};

// Rebuild the exact (already-fixed) question set shown at attempt-start, for resume —
// never re-randomizes, since attempt.presentedQuestions is the frozen source of truth.
const buildSectionsPayloadFromPresented = async (test, presentedQuestions) => {
    const questions = await QuestionBank.find({ _id: { $in: presentedQuestions.map(p => p.questionBank) } });
    const qMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));
    const bySection = {};
    for (const p of presentedQuestions) {
        const sId = p.sectionId.toString();
        const q = qMap[p.questionBank.toString()];
        if (!q) continue;
        (bySection[sId] = bySection[sId] || []).push({ ...stripQuestionForStudent(q), marks: p.marks, order: p.order });
    }
    return test.sections
        .filter(s => bySection[s._id.toString()])
        .map(s => ({
            _id: s._id, name: s.name, description: s.description, timeLimit: s.timeLimit,
            questions: bySection[s._id.toString()].sort((a, b) => a.order - b.order)
        }));
};

const testMetaForAttempt = (test) => ({
    _id: test._id,
    title: test.title,
    subject: test.subject,
    timeLimit: test.timeLimit,
    hasPerQuestionTimer: test.hasPerQuestionTimer,
    passingScore: test.passingScore,
    shuffleOptions: test.shuffleOptions,
    showResultsImmediately: test.showResultsImmediately,
    allowResume: test.allowResume,
    allowCalculator: test.allowCalculator,
    negativeMarking: test.negativeMarking,
    security: test.security
});

// Score one submitted answer against its source QuestionBank question.
const scoreAnswer = (question, ans, marks) => {
    if (OPTION_BACKED_TYPES.includes(question.type)) {
        const selectedIds = Array.isArray(ans.selectedOptionIds) ? ans.selectedOptionIds : [];
        const correctOptionIds = question.options.filter(o => o.isCorrect).map(o => o._id.toString());
        let isCorrect = false;
        let marksAwarded = 0;

        if (question.type === 'MSQ') {
            const sortedSelected = [...selectedIds].sort().join(',');
            const sortedCorrect = [...correctOptionIds].sort().join(',');
            isCorrect = sortedSelected === sortedCorrect;
            if (isCorrect) {
                marksAwarded = marks;
            } else if (selectedIds.length > 0) {
                const correctlySelected = selectedIds.filter(id => correctOptionIds.includes(id));
                const incorrectlySelected = selectedIds.filter(id => !correctOptionIds.includes(id));
                if (incorrectlySelected.length === 0) {
                    marksAwarded = (correctlySelected.length / correctOptionIds.length) * marks;
                }
            }
        } else {
            // MCQ / TrueFalse — single correct, must match exactly
            isCorrect = selectedIds.length === 1 && correctOptionIds.includes(selectedIds[0]);
            marksAwarded = isCorrect ? marks : 0;
        }

        return {
            isCorrect, marksAwarded, attempted: selectedIds.length > 0,
            selectedOptions: selectedIds,
            correctOptions: question.options.filter(o => o.isCorrect).map(o => o._id)
        };
    }

    if (question.type === 'FillBlank') {
        const text = (ans.fillBlankAnswerText || '').trim().toLowerCase();
        const attempted = text.length > 0;
        const isCorrect = attempted && (question.acceptedAnswers || []).some(a => a.trim().toLowerCase() === text);
        return { isCorrect, marksAwarded: isCorrect ? marks : 0, attempted, fillBlankAnswerText: ans.fillBlankAnswerText || '' };
    }

    if (question.type === 'Subjective') {
        const attempted = (ans.subjectiveAnswerText || '').trim().length > 0;
        return { isCorrect: false, marksAwarded: 0, attempted, pendingManualGrading: true, subjectiveAnswerText: ans.subjectiveAnswerText || '' };
    }

    // Coding/SQL/Debugging/OutputBased execution-based scoring lands in a later phase
    return { isCorrect: false, marksAwarded: 0, attempted: false };
};

// Negative marking: the test-level toggle is the master switch. When enabled, a
// question's own QuestionBank.negativeMarks overrides the platform default if set.
const computeNegativeMarks = (test, questionNegativeMarks) => {
    if (!test.negativeMarking?.enabled) return 0;
    return questionNegativeMarks > 0 ? questionNegativeMarks : (test.negativeMarking.perWrongAnswer || 0);
};

// Job handler for 'execute-code-submission' — registered against the job queue
// in server.js, same pattern as courseController.js's extractVideoDurationHandler.
// Runs the student's code/query against sample (+ hidden, for mode 'submit')
// test cases via Judge0 or the in-process SQL runner, and for mode 'submit'
// persists the scored result onto the attempt's answers[] immediately (the
// final test submit later just carries this forward — see
// finalizeSectionModeAttempt). Hidden test case input/expected-output is only
// ever read here, in memory, for comparison — never written to the attempt.
export async function executeCodeSubmissionHandler({ attemptId, questionId, language, code, mode }) {
    const question = await QuestionBank.findById(questionId);
    if (!question) throw new Error('Question not found');

    const sampleCases = (question.codingProblem?.sampleTestCases || []).map(c => ({ ...(c.toObject ? c.toObject() : c), isHidden: false }));
    const hiddenCases = mode === 'submit' ? (question.codingProblem?.hiddenTestCases || []).map(c => ({ ...(c.toObject ? c.toObject() : c), isHidden: true })) : [];
    const allCases = [...sampleCases, ...hiddenCases];

    const runResults = question.type === 'SQL'
        ? await runSqlSubmission({ schema: question.sqlSchema, query: code, testCases: allCases })
        : await runJudge0Submission({ language, code, testCases: allCases });

    const passedCount = runResults.filter(r => r.passed).length;
    const totalCount = runResults.length;
    const sampleResult = runResults.find(r => !r.isHidden) || {};

    const responsePayload = {
        sampleResults: runResults.filter(r => !r.isHidden).map(r => ({ passed: r.passed, stdout: r.stdout, stderr: r.stderr })),
        totalCount,
        passedCount
    };

    if (mode === 'submit') {
        const attempt = await PracticeTestAttempt.findById(attemptId);
        if (!attempt) throw new Error('Attempt not found');

        const presented = attempt.presentedQuestions.find(p => p.questionBank.toString() === questionId);
        const marks = presented ? presented.marks : (question.marks || 1);
        const scoringMode = question.codingProblem?.scoringMode || 'proportional';

        let marksAwarded = 0;
        let isCorrect = false;
        if (totalCount > 0) {
            if (scoringMode === 'all_or_nothing') {
                isCorrect = passedCount === totalCount;
                marksAwarded = isCorrect ? marks : 0;
            } else {
                marksAwarded = (passedCount / totalCount) * marks;
                isCorrect = passedCount === totalCount;
            }
        }

        const status = isCorrect ? 'Accepted' : passedCount > 0 ? 'Partially Correct' : (sampleResult.stderr ? 'Runtime Error' : 'Wrong Answer');
        const answerEntry = {
            questionId: question._id,
            questionText: question.questionText,
            type: question.type,
            marksAwarded,
            marksAvailable: marks,
            isCorrect,
            negativeMarksDeducted: 0,
            timeTaken: 0,
            codeSubmission: {
                language: language || '',
                code,
                stdout: sampleResult.stdout || '',
                stderr: sampleResult.stderr || '',
                status,
                executionTimeMs: Math.max(0, ...runResults.map(r => r.executionTimeMs || 0)),
                memoryKb: Math.max(0, ...runResults.map(r => r.memoryKb || 0)),
                testCaseResults: runResults.map(r => ({ passed: r.passed, isHidden: r.isHidden }))
            }
        };

        const existingIdx = attempt.answers.findIndex(a => a.questionId.toString() === questionId);
        if (existingIdx >= 0) attempt.answers[existingIdx] = answerEntry;
        else attempt.answers.push(answerEntry);
        await attempt.save();

        responsePayload.marksAwarded = marksAwarded;
        responsePayload.marksAvailable = marks;
        responsePayload.isCorrect = isCorrect;
        responsePayload.status = status;

        // First time this user has ever fully solved this exact question
        // (any test, any attempt) — award once, not on every resubmission or retake.
        if (isCorrect) {
            const priorSolved = await PracticeTestAttempt.countDocuments({
                user: attempt.user, _id: { $ne: attempt._id },
                answers: { $elemMatch: { questionId: question._id, isCorrect: true } }
            });
            if (priorSolved === 0) {
                await awardPoints(attempt.user, POINTS_RULES.coding_challenge_solved, 'coding_challenge_solved', { refType: 'questionBank', refId: question._id });
            }
        }
    }

    return responsePayload;
}

const updateTestStats = async (test) => {
    const allAttempts = await PracticeTestAttempt.find({ practiceTest: test._id, status: 'completed' });
    test.totalAttempts = allAttempts.length;
    test.avgScore = allAttempts.length > 0
        ? Math.round(allAttempts.reduce((s, a) => s + a.percentage, 0) / allAttempts.length)
        : 0;
    test.passRate = allAttempts.length > 0
        ? Math.round((allAttempts.filter(a => a.passed).length / allAttempts.length) * 100)
        : 0;
    await test.save();
};

// @desc    Start a new attempt (returns test questions/sections without answers)
// @route   POST /api/v1/practice-tests/:id/attempt/start
// @access  Private
export const startAttempt = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test || !test.isPublished) {
            return res.status(404).json({ message: 'Practice test not found' });
        }

        const now = new Date();
        if (test.schedule?.availableFrom && now < test.schedule.availableFrom) {
            return res.status(403).json({ message: `This test opens on ${test.schedule.availableFrom.toLocaleDateString()}` });
        }
        if (test.schedule?.availableUntil && now > test.schedule.availableUntil) {
            return res.status(403).json({ message: 'This test is no longer available' });
        }

        if (test.maxAttempts > 0) {
            const attemptCount = await PracticeTestAttempt.countDocuments({
                practiceTest: test._id, user: req.user.id, status: 'completed'
            });
            if (attemptCount >= test.maxAttempts) {
                return res.status(400).json({ message: `Maximum attempts (${test.maxAttempts}) reached for this test` });
            }
        }

        await PracticeTestAttempt.updateMany(
            { practiceTest: test._id, user: req.user.id, status: 'in_progress' },
            { $set: { status: 'abandoned' } }
        );

        const prevCount = await PracticeTestAttempt.countDocuments({ practiceTest: test._id, user: req.user.id });

        // ── Legacy flat mode (unchanged) ────────────────────────────────────────
        if (test.sections.length === 0) {
            const attempt = await PracticeTestAttempt.create({
                user: req.user.id, practiceTest: test._id, attemptNumber: prevCount + 1,
                startedAt: new Date(),
                totalMarks: test.questions.reduce((s, q) => s + (q.marks || 1), 0),
                status: 'in_progress'
            });

            let questions = test.questions.map(q => ({
                _id: q._id, questionText: q.questionText, type: q.type,
                options: q.options.map(o => ({ _id: o._id, text: o.text })),
                timeLimit: q.timeLimit, marks: q.marks, order: q.order, image: q.image
            }));
            if (test.shuffleQuestions) questions = questions.sort(() => Math.random() - 0.5);

            return res.status(200).json({
                success: true,
                data: { attemptId: attempt._id, test: testMetaForAttempt(test), questions, sections: [], startedAt: attempt.startedAt }
            });
        }

        // ── Section mode ─────────────────────────────────────────────────────────
        const presentedQuestions = [];
        const sectionsPayload = [];
        for (const section of [...test.sections].sort((a, b) => a.order - b.order)) {
            const resolved = await resolveSectionQuestions(test, section);
            const sectionQuestions = resolved.map(r => {
                presentedQuestions.push({ sectionId: section._id, questionBank: r.question._id, marks: r.marks, negativeMarks: r.negativeMarks, order: r.order });
                return { ...stripQuestionForStudent(r.question), marks: r.marks, order: r.order };
            });
            if (test.shuffleQuestions) sectionQuestions.sort(() => Math.random() - 0.5);
            if (test.shuffleOptions) {
                sectionQuestions.forEach(q => { if (q.options) q.options = [...q.options].sort(() => Math.random() - 0.5); });
            }
            sectionsPayload.push({ _id: section._id, name: section.name, description: section.description, timeLimit: section.timeLimit, questions: sectionQuestions });
        }

        const totalMarks = presentedQuestions.reduce((s, p) => s + p.marks, 0);
        const attempt = await PracticeTestAttempt.create({
            user: req.user.id, practiceTest: test._id, attemptNumber: prevCount + 1,
            startedAt: new Date(), totalMarks, presentedQuestions, status: 'in_progress'
        });

        res.status(200).json({
            success: true,
            data: { attemptId: attempt._id, test: testMetaForAttempt(test), questions: [], sections: sectionsPayload, startedAt: attempt.startedAt }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Resume an in-progress attempt after a refresh/close (gated by allowResume on the client)
// @route   GET /api/v1/practice-tests/:id/attempt/:attemptId/resume
// @access  Private
export const resumeAttempt = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const attempt = await PracticeTestAttempt.findOne({
            _id: req.params.attemptId, user: req.user.id, practiceTest: test._id, status: 'in_progress'
        });
        if (!attempt) return res.status(404).json({ message: 'No active attempt to resume' });

        let questions = [];
        let sections = [];
        if (attempt.presentedQuestions.length > 0) {
            sections = await buildSectionsPayloadFromPresented(test, attempt.presentedQuestions);
        } else {
            questions = test.questions.map(q => ({
                _id: q._id, questionText: q.questionText, type: q.type,
                options: q.options.map(o => ({ _id: o._id, text: o.text })),
                timeLimit: q.timeLimit, marks: q.marks, order: q.order, image: q.image
            }));
        }

        res.status(200).json({
            success: true,
            data: {
                attemptId: attempt._id,
                test: testMetaForAttempt(test),
                questions, sections,
                startedAt: attempt.startedAt,
                draftAnswers: attempt.draftAnswers || [],
                bookmarkedQuestionIds: attempt.bookmarkedQuestionIds || [],
                markedForReviewIds: attempt.markedForReviewIds || [],
                codeAnswers: (attempt.answers || [])
                    .filter(a => EXECUTION_TYPES.includes(a.type) && a.codeSubmission)
                    .map(a => ({
                        questionId: a.questionId,
                        marksAwarded: a.marksAwarded,
                        marksAvailable: a.marksAvailable,
                        isCorrect: a.isCorrect,
                        status: a.codeSubmission.status,
                        passedCount: a.codeSubmission.testCaseResults?.filter(t => t.passed).length || 0,
                        totalCount: a.codeSubmission.testCaseResults?.length || 0,
                        codeSubmission: { code: a.codeSubmission.code, language: a.codeSubmission.language }
                    }))
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Autosave in-progress (unscored) answer state, bookmarks, and review marks
// @route   PATCH /api/v1/practice-tests/:id/attempt/:attemptId/autosave
// @access  Private
export const autosaveAttempt = async (req, res, next) => {
    try {
        const attempt = await PracticeTestAttempt.findOne({
            _id: req.params.attemptId, user: req.user.id, practiceTest: req.params.id, status: 'in_progress'
        });
        if (!attempt) return res.status(404).json({ message: 'Active attempt not found' });

        const { answers, bookmarkedQuestionIds, markedForReviewIds } = req.body;
        if (Array.isArray(answers)) attempt.draftAnswers = answers;
        if (Array.isArray(bookmarkedQuestionIds)) attempt.bookmarkedQuestionIds = bookmarkedQuestionIds;
        if (Array.isArray(markedForReviewIds)) attempt.markedForReviewIds = markedForReviewIds;
        attempt.lastAutoSavedAt = new Date();
        await attempt.save();

        res.status(200).json({ success: true, lastAutoSavedAt: attempt.lastAutoSavedAt });
    } catch (error) {
        next(error);
    }
};

// @desc    Submit an attempt
// @route   POST /api/v1/practice-tests/:id/attempt/:attemptId/submit
// @access  Private
// Score+finalize a section-mode attempt against whatever answers are supplied
// (either a real submit payload, or the attempt's last autosaved draft when
// finalization is forced by a security-violation policy). Mutates and saves
// both the attempt and the test's stats; returns the same result DTO shape
// the submit endpoint sends to the client.
const finalizeSectionModeAttempt = async (test, attempt, rawAnswers, timeTaken, sectionTimings) => {
    const questionDocs = await QuestionBank.find({ _id: { $in: attempt.presentedQuestions.map(p => p.questionBank) } });
    const qMap = Object.fromEntries(questionDocs.map(q => [q._id.toString(), q]));

    // Coding/SQL/Debugging/OutputBased questions are scored earlier, during the
    // attempt, via the dedicated code/submit endpoint (execution is too slow/async
    // to run inline here) — capture those pre-computed answers before attempt.answers
    // gets overwritten below, so finalization carries their score forward as-is.
    const existingCodeAnswers = Object.fromEntries(
        (attempt.answers || [])
            .filter(a => EXECUTION_TYPES.includes(a.type))
            .map(a => [a.questionId.toString(), a.toObject ? a.toObject() : a])
    );

    let totalScore = 0;
    let totalNegative = 0;
    const totalMarks = attempt.presentedQuestions.reduce((s, p) => s + p.marks, 0);
    const processedAnswers = [];

    for (const presented of attempt.presentedQuestions) {
        const question = qMap[presented.questionBank.toString()];
        if (!question) continue;

        if (EXECUTION_TYPES.includes(question.type)) {
            const existing = existingCodeAnswers[presented.questionBank.toString()];
            const marksAwarded = existing?.marksAwarded || 0;
            totalScore += marksAwarded;
            processedAnswers.push(existing || {
                questionId: question._id, questionText: question.questionText, type: question.type,
                isCorrect: false, marksAwarded: 0, marksAvailable: presented.marks,
                negativeMarksDeducted: 0, timeTaken: 0
            });
            continue;
        }

        const ans = rawAnswers.find(a => a.questionId === presented.questionBank.toString()) || {};
        const scored = scoreAnswer(question, ans, presented.marks);

        let negativeMarksDeducted = 0;
        if (scored.attempted && !scored.isCorrect && question.type !== 'Subjective') {
            negativeMarksDeducted = computeNegativeMarks(test, presented.negativeMarks);
        }

        totalScore += scored.marksAwarded;
        totalNegative += negativeMarksDeducted;

        processedAnswers.push({
            questionId: question._id,
            questionText: question.questionText,
            type: question.type,
            selectedOptions: (scored.selectedOptions || []).map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch { return id; }
            }),
            correctOptions: scored.correctOptions || [],
            isCorrect: scored.isCorrect,
            timeTaken: Number(ans.timeTaken) || 0,
            marksAwarded: scored.marksAwarded,
            marksAvailable: presented.marks,
            negativeMarksDeducted,
            fillBlankAnswerText: scored.fillBlankAnswerText || '',
            subjectiveAnswerText: scored.subjectiveAnswerText || '',
            pendingManualGrading: !!scored.pendingManualGrading
        });
    }

    const netScore = Math.max(0, totalScore - totalNegative);
    const percentage = totalMarks > 0 ? Math.round((netScore / totalMarks) * 100) : 0;
    const passed = percentage >= test.passingScore;

    attempt.answers = processedAnswers;
    attempt.score = netScore;
    attempt.totalMarks = totalMarks;
    attempt.negativeMarksDeducted = totalNegative;
    attempt.percentage = percentage;
    attempt.passed = passed;
    attempt.completedAt = new Date();
    attempt.timeTaken = Number(timeTaken) || 0;
    attempt.status = 'completed';
    if (Array.isArray(sectionTimings)) attempt.sectionTimings = sectionTimings;
    await attempt.save();
    await updateTestStats(test);

    const resultData = {
        attemptId: attempt._id, score: netScore, totalMarks, percentage, passed,
        passingScore: test.passingScore, timeTaken: attempt.timeTaken,
        negativeMarksDeducted: totalNegative,
        hasPendingManualGrading: processedAnswers.some(a => a.pendingManualGrading)
    };

    resultData.questionResults = buildImmediateResultPayload(test, processedAnswers, qMap);

    return resultData;
};

// Same as above, for legacy flat-mode attempts.
const finalizeLegacyModeAttempt = async (test, attempt, rawAnswers, timeTaken) => {
    let totalScore = 0;
    let totalNegative = 0;
    const totalMarks = test.questions.reduce((s, q) => s + (q.marks || 1), 0);
    const processedAnswers = [];

    for (const ans of rawAnswers) {
        const question = test.questions.id(ans.questionId);
        if (!question) continue;

        const selectedIds = Array.isArray(ans.selectedOptionIds) ? ans.selectedOptionIds : [];
        const correctOptionIds = question.options.filter(o => o.isCorrect).map(o => o._id.toString());

        let isCorrect = false;
        let marksAwarded = 0;

        if (question.type === 'MCQ') {
            isCorrect = selectedIds.length === 1 && correctOptionIds.includes(selectedIds[0]);
            marksAwarded = isCorrect ? question.marks : 0;
        } else if (question.type === 'MSQ') {
            const sortedSelected = [...selectedIds].sort().join(',');
            const sortedCorrect = [...correctOptionIds].sort().join(',');
            isCorrect = sortedSelected === sortedCorrect;

            if (isCorrect) {
                marksAwarded = question.marks;
            } else if (selectedIds.length > 0) {
                const correctlySelected = selectedIds.filter(id => correctOptionIds.includes(id));
                const incorrectlySelected = selectedIds.filter(id => !correctOptionIds.includes(id));
                if (incorrectlySelected.length === 0) {
                    marksAwarded = (correctlySelected.length / correctOptionIds.length) * question.marks;
                }
            }
        }

        let negativeMarksDeducted = 0;
        if (selectedIds.length > 0 && !isCorrect) {
            negativeMarksDeducted = computeNegativeMarks(test, 0);
        }

        totalScore += marksAwarded;
        totalNegative += negativeMarksDeducted;

        processedAnswers.push({
            questionId: question._id,
            questionText: question.questionText,
            type: question.type,
            selectedOptions: selectedIds.map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch { return id; }
            }),
            correctOptions: question.options.filter(o => o.isCorrect).map(o => o._id),
            isCorrect,
            timeTaken: Number(ans.timeTaken) || 0,
            marksAwarded,
            marksAvailable: question.marks,
            negativeMarksDeducted
        });
    }

    const netScore = Math.max(0, totalScore - totalNegative);
    const percentage = totalMarks > 0 ? Math.round((netScore / totalMarks) * 100) : 0;
    const passed = percentage >= test.passingScore;

    attempt.answers = processedAnswers;
    attempt.score = netScore;
    attempt.totalMarks = totalMarks;
    attempt.negativeMarksDeducted = totalNegative;
    attempt.percentage = percentage;
    attempt.passed = passed;
    attempt.completedAt = new Date();
    attempt.timeTaken = Number(timeTaken) || 0;
    attempt.status = 'completed';
    await attempt.save();
    await updateTestStats(test);

    const resultData = {
        attemptId: attempt._id,
        score: netScore,
        totalMarks,
        percentage,
        passed,
        passingScore: test.passingScore,
        timeTaken: attempt.timeTaken,
        negativeMarksDeducted: totalNegative
    };

    const qMap = Object.fromEntries(test.questions.map(q => [q._id.toString(), q]));
    resultData.questionResults = buildImmediateResultPayload(test, processedAnswers, qMap);

    return resultData;
};

// Points/badges/certificates only ever fire on a user's FIRST completion/pass/
// perfect-score for a given test — otherwise unlimited-retake tests would let
// a student farm points by resubmitting the same test repeatedly.
const processPostCompletionAwards = async (test, attempt) => {
    const priorCompleted = await PracticeTestAttempt.countDocuments({
        user: attempt.user, practiceTest: test._id, status: 'completed', _id: { $ne: attempt._id }
    });
    if (priorCompleted === 0) {
        await awardPoints(attempt.user, POINTS_RULES.practice_test_completed, 'practice_test_completed', { refType: 'practiceTest', refId: test._id });
    }

    if (attempt.passed) {
        const priorPassed = await PracticeTestAttempt.countDocuments({
            user: attempt.user, practiceTest: test._id, status: 'completed', passed: true, _id: { $ne: attempt._id }
        });
        if (priorPassed === 0) {
            await awardPoints(attempt.user, POINTS_RULES.practice_test_passed, 'practice_test_passed', { refType: 'practiceTest', refId: test._id });
        }
    }

    if (attempt.percentage === 100) {
        const priorPerfect = await PracticeTestAttempt.countDocuments({
            user: attempt.user, practiceTest: test._id, status: 'completed', percentage: 100, _id: { $ne: attempt._id }
        });
        if (priorPerfect === 0) {
            await awardPoints(attempt.user, POINTS_RULES.practice_test_perfect_score, 'practice_test_perfect_score', { refType: 'practiceTest', refId: test._id });
        }
    }

    const newlyAwardedBadges = await checkAndAwardBadges(attempt.user, { test, attempt });
    const certificate = await issueCertificateIfEligible(test, attempt);

    return {
        newlyAwardedBadges,
        certificateIssued: certificate ? { _id: certificate._id, certificateNumber: certificate.certificateNumber } : null
    };
};

// Single entry point shared by the user-initiated submit endpoint and the
// server-forced auto-submit path triggered by a security-violation policy —
// one code path, one set of side effects (stats update etc), regardless of trigger.
const finalizeAttempt = async (test, attempt, { rawAnswers, timeTaken, sectionTimings }) => {
    const resultData = attempt.presentedQuestions.length > 0
        ? await finalizeSectionModeAttempt(test, attempt, rawAnswers, timeTaken, sectionTimings)
        : await finalizeLegacyModeAttempt(test, attempt, rawAnswers, timeTaken);

    Object.assign(resultData, await processPostCompletionAwards(test, attempt));
    return resultData;
};

// @desc    Submit an attempt
// @route   POST /api/v1/practice-tests/:id/attempt/:attemptId/submit
// @access  Private
export const submitAttempt = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const attempt = await PracticeTestAttempt.findOne({
            _id: req.params.attemptId,
            user: req.user.id,
            practiceTest: test._id,
            status: 'in_progress'
        });

        if (!attempt) return res.status(404).json({ message: 'Active attempt not found' });

        const { answers, timeTaken, sectionTimings } = req.body;
        if (!Array.isArray(answers)) return res.status(400).json({ message: 'answers must be an array' });

        const resultData = await finalizeAttempt(test, attempt, { rawAnswers: answers, timeTaken, sectionTimings });
        res.status(200).json({ success: true, data: resultData });
    } catch (error) {
        next(error);
    }
};

// @desc    Record a security/proctoring violation event (tab switch, fullscreen
//          exit, copy/paste attempt, devtools heuristic, focus loss). Tab-switch
//          counts are enforced server-side — not just client-side — since a
//          client-only check is trivially bypassed by a motivated cheater.
// @route   POST /api/v1/practice-tests/:id/attempt/:attemptId/violation
// @access  Private
export const recordViolation = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const attempt = await PracticeTestAttempt.findOne({
            _id: req.params.attemptId, user: req.user.id, practiceTest: test._id, status: 'in_progress'
        });
        if (!attempt) return res.status(404).json({ message: 'Active attempt not found' });

        const { category, action, copyPasteType, focusLostDurationMs } = req.body;
        const now = new Date();

        switch (category) {
            case 'tab_switch':
                attempt.proctoring.tabSwitchEvents.push({ timestamp: now, action: action === 'switch_back' ? 'switch_back' : 'switch_away' });
                break;
            case 'fullscreen_exit':
                attempt.proctoring.fullscreenExitEvents.push({ timestamp: now });
                break;
            case 'copy_paste':
                attempt.proctoring.copyPasteAttempts.push({ timestamp: now, type: ['copy', 'cut', 'paste', 'rightclick'].includes(copyPasteType) ? copyPasteType : 'copy' });
                break;
            case 'devtools':
                attempt.proctoring.devtoolsHeuristicTriggers.push({ timestamp: now });
                break;
            case 'focus_lost':
                attempt.proctoring.focusLostDurationMs += Number(focusLostDurationMs) || 0;
                break;
            default:
                return res.status(400).json({ message: 'Invalid violation category' });
        }

        const tabSwitchCount = attempt.proctoring.tabSwitchEvents.filter(e => e.action === 'switch_away').length;
        const maxSwitches = test.security?.maxTabSwitches || 0;
        const exceeded = category === 'tab_switch' && action !== 'switch_back' && maxSwitches > 0 && tabSwitchCount > maxSwitches;
        const policy = test.security?.onLimitExceeded || 'warn_only';

        await AuditLog.create({
            actor: req.user.id, action: 'practice_test_violation', targetType: 'PracticeTestAttempt', targetId: attempt._id,
            metadata: { category, action, testId: test._id, tabSwitchCount, exceeded, policy: exceeded ? policy : null }
        });

        if (exceeded && policy === 'terminate') {
            attempt.proctoring.terminatedDueToViolation = true;
            attempt.status = 'abandoned';
            attempt.completedAt = new Date();
            await attempt.save();
            return res.status(200).json({
                success: true, finalized: true,
                violation: { tabSwitchCount, maxSwitches, remaining: 0, policyApplied: 'terminate' }
            });
        }

        if (exceeded && policy === 'auto_submit') {
            attempt.proctoring.autoSubmittedDueToViolation = true;
            await attempt.save();
            const timeTaken = Math.round((Date.now() - attempt.startedAt.getTime()) / 1000);
            const resultData = await finalizeAttempt(test, attempt, { rawAnswers: attempt.draftAnswers || [], timeTaken });
            return res.status(200).json({
                success: true, finalized: true,
                violation: { tabSwitchCount, maxSwitches, remaining: 0, policyApplied: 'auto_submit' },
                data: resultData
            });
        }

        await attempt.save();
        res.status(200).json({
            success: true, finalized: false,
            violation: {
                tabSwitchCount, maxSwitches,
                remaining: maxSwitches > 0 ? Math.max(0, maxSwitches - tabSwitchCount) : null,
                policyApplied: exceeded ? 'warn_only' : null
            }
        });
    } catch (error) {
        next(error);
    }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Polls a queued job for up to budgetMs, returning the job doc as soon as it
// leaves 'queued'/'processing', or whatever its state is once the budget runs
// out (caller treats a still-pending job as "check back later" rather than
// blocking the request thread indefinitely).
const pollJobWithBudget = async (jobId, budgetMs = 8000, intervalMs = 500) => {
    const deadline = Date.now() + budgetMs;
    let job = await Job.findById(jobId);
    while (job && (job.status === 'queued' || job.status === 'processing') && Date.now() < deadline) {
        await sleep(intervalMs);
        job = await Job.findById(jobId);
    }
    return job;
};

// Shared setup for code/run and code/submit: resolves the test+attempt+question,
// confirming the question both belongs to this attempt and is an execution type
// (Coding/SQL/Debugging/OutputBased) before any code is ever run on the server.
const resolveCodeExecutionContext = async (req) => {
    const test = await PracticeTest.findById(req.params.id);
    if (!test) return { error: { status: 404, message: 'Practice test not found' } };

    const attempt = await PracticeTestAttempt.findOne({
        _id: req.params.attemptId, user: req.user.id, practiceTest: test._id, status: 'in_progress'
    });
    if (!attempt) return { error: { status: 404, message: 'Active attempt not found' } };

    const { questionId, language, code } = req.body;
    if (!questionId || typeof code !== 'string') return { error: { status: 400, message: 'questionId and code are required' } };

    const isPresented = attempt.presentedQuestions.some(p => p.questionBank.toString() === questionId);
    if (!isPresented) return { error: { status: 400, message: 'Question is not part of this attempt' } };

    const question = await QuestionBank.findById(questionId);
    if (!question || !EXECUTION_TYPES.includes(question.type)) {
        return { error: { status: 400, message: 'Question is not an executable type' } };
    }

    return { test, attempt, question, language, code };
};

// @desc    Run code against sample test cases only (quick feedback, never
//          contributes to scoring, hidden test cases are never touched).
// @route   POST /api/v1/practice-tests/:id/attempt/:attemptId/code/run
// @access  Private
export const runCode = async (req, res, next) => {
    try {
        const ctx = await resolveCodeExecutionContext(req);
        if (ctx.error) return res.status(ctx.error.status).json({ message: ctx.error.message });

        const job = await enqueue('execute-code-submission', {
            attemptId: ctx.attempt._id.toString(), questionId: ctx.question._id.toString(),
            language: ctx.language, code: ctx.code, mode: 'run'
        });

        const finished = await pollJobWithBudget(job._id);
        if (!finished || finished.status === 'queued' || finished.status === 'processing') {
            return res.status(202).json({ success: true, pending: true, jobId: job._id });
        }
        if (finished.status === 'failed') {
            return res.status(502).json({ success: false, message: finished.error || 'Code execution failed' });
        }
        res.status(200).json({ success: true, pending: false, data: finished.result });
    } catch (error) {
        next(error);
    }
};

// @desc    Submit code against sample+hidden test cases; scores the question
//          and persists the result onto the attempt immediately (carried
//          forward, not re-scored, when the test is finally submitted).
// @route   POST /api/v1/practice-tests/:id/attempt/:attemptId/code/submit
// @access  Private
export const submitCode = async (req, res, next) => {
    try {
        const ctx = await resolveCodeExecutionContext(req);
        if (ctx.error) return res.status(ctx.error.status).json({ message: ctx.error.message });

        const job = await enqueue('execute-code-submission', {
            attemptId: ctx.attempt._id.toString(), questionId: ctx.question._id.toString(),
            language: ctx.language, code: ctx.code, mode: 'submit'
        });

        const finished = await pollJobWithBudget(job._id);
        if (!finished || finished.status === 'queued' || finished.status === 'processing') {
            return res.status(202).json({ success: true, pending: true, jobId: job._id });
        }
        if (finished.status === 'failed') {
            return res.status(502).json({ success: false, message: finished.error || 'Code execution failed' });
        }
        res.status(200).json({ success: true, pending: false, data: finished.result });
    } catch (error) {
        next(error);
    }
};

// @desc    Re-poll a previously enqueued code/run or code/submit job that
//          didn't finish within the original request's poll budget.
// @route   GET /api/v1/practice-tests/:id/attempt/:attemptId/code/status/:jobId
// @access  Private
export const getCodeJobStatus = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.jobId);
        if (!job || job.type !== 'execute-code-submission') return res.status(404).json({ message: 'Job not found' });

        if (job.status === 'queued' || job.status === 'processing') {
            return res.status(200).json({ success: true, pending: true });
        }
        if (job.status === 'failed') {
            return res.status(502).json({ success: false, message: job.error || 'Code execution failed' });
        }
        res.status(200).json({ success: true, pending: false, data: job.result });
    } catch (error) {
        next(error);
    }
};

// @desc    Get a specific attempt result
// @route   GET /api/v1/practice-tests/:id/attempts/:attemptId
// @access  Private
export const getAttemptResult = async (req, res, next) => {
    try {
        const attempt = await PracticeTestAttempt.findOne({
            _id: req.params.attemptId,
            user: req.user.id
        });

        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

        const test = await PracticeTest.findById(attempt.practiceTest);
        if (!test) return res.status(404).json({ message: 'Test not found' });

        const report = await buildAttemptReport(test, attempt);
        res.status(200).json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
};

// @desc    Get my attempts for a test
// @route   GET /api/v1/practice-tests/:id/my-attempts
// @access  Private
// Summary projection shared by both "my attempts" list endpoints below — these
// are list views (score/status/time only), so answers/presentedQuestions/
// draftAnswers (which carry questionText, correctOptions, and the student's
// own submitted code) are deliberately excluded rather than sent and ignored
// by the current frontend; nothing answer-bearing should reach the network
// response unless the dedicated, leak-gated report endpoint is used.
const ATTEMPT_SUMMARY_FIELDS = 'practiceTest attemptNumber score totalMarks percentage passed negativeMarksDeducted timeTaken startedAt completedAt status createdAt';

export const getMyAttempts = async (req, res, next) => {
    try {
        const attempts = await PracticeTestAttempt.find({
            practiceTest: req.params.id,
            user: req.user.id,
            status: 'completed'
        }).select(ATTEMPT_SUMMARY_FIELDS).sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: attempts });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all my attempts across all tests
// @route   GET /api/v1/practice-tests/my-attempts/all
// @access  Private
export const getAllMyAttempts = async (req, res, next) => {
    try {
        const attempts = await PracticeTestAttempt.find({ user: req.user.id, status: 'completed' })
            .select(ATTEMPT_SUMMARY_FIELDS)
            .populate('practiceTest', 'title subject passingScore')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: attempts });
    } catch (error) {
        next(error);
    }
};

// ── Admin Controllers ─────────────────────────────────────────────────────────

// @desc    Admin: Get all practice tests
// @route   GET /api/v1/admin/practice-tests
// @access  Private/Admin
export const adminGetAllPracticeTests = async (req, res, next) => {
    try {
        const tests = await PracticeTest.find()
            .populate('seller', 'name email')
            .populate('course', 'title')
            .populate('company', 'name')
            .sort({ createdAt: -1 });

        const enriched = await Promise.all(tests.map(async (test) => {
            const attemptCount = await PracticeTestAttempt.countDocuments({ practiceTest: test._id });
            return {
                ...test.toObject(),
                attemptCount,
                ...getQuestionCountAndMarks(test)
            };
        }));

        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: Force toggle publish
// @route   PATCH /api/v1/admin/practice-tests/:id/publish
// @access  Private/Admin
export const adminTogglePracticeTestPublish = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        test.isPublished = !test.isPublished;
        await test.save();

        res.status(200).json({
            success: true,
            isPublished: test.isPublished,
            message: `Practice test ${test.isPublished ? 'published' : 'unpublished'} by admin`
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: Delete a practice test
// @route   DELETE /api/v1/admin/practice-tests/:id
// @access  Private/Admin
export const adminDeletePracticeTest = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        if (test.course) {
            await Course.findByIdAndUpdate(test.course, { $pull: { practiceTests: test._id } });
        }

        await PracticeTestAttempt.deleteMany({ practiceTest: test._id });
        await test.deleteOne();

        res.status(200).json({ success: true, message: 'Practice test permanently deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: View attempts for a test
// @route   GET /api/v1/admin/practice-tests/:id/attempts
// @access  Private/Admin
export const adminGetTestAttempts = async (req, res, next) => {
    try {
        const test = await PracticeTest.findById(req.params.id).select('title subject questions passingScore');
        if (!test) return res.status(404).json({ message: 'Practice test not found' });

        const attempts = await PracticeTestAttempt.find({ practiceTest: req.params.id })
            .populate('user', 'name email')
            .sort({ createdAt: -1 });

        // Most missed questions analytics
        const questionMissRate = {};
        test.questions.forEach(q => {
            questionMissRate[q._id.toString()] = { questionText: q.questionText, missed: 0, total: 0 };
        });

        attempts.forEach(attempt => {
            attempt.answers.forEach(ans => {
                const qId = ans.questionId.toString();
                if (questionMissRate[qId]) {
                    questionMissRate[qId].total++;
                    if (!ans.isCorrect) questionMissRate[qId].missed++;
                }
            });
        });

        const missRateArray = Object.values(questionMissRate)
            .filter(q => q.total > 0)
            .map(q => ({ ...q, missRate: Math.round((q.missed / q.total) * 100) }))
            .sort((a, b) => b.missRate - a.missRate);

        res.status(200).json({
            success: true,
            data: {
                test: { _id: test._id, title: test.title, subject: test.subject, passingScore: test.passingScore },
                attempts,
                analytics: {
                    totalAttempts: attempts.length,
                    avgScore: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length) : 0,
                    passRate: attempts.length ? Math.round((attempts.filter(a => a.passed).length / attempts.length) * 100) : 0,
                    mostMissedQuestions: missRateArray.slice(0, 5)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};
