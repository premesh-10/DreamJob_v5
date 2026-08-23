import TestSeries from '../models/TestSeries.js';
import PracticeTest from '../models/PracticeTest.js';

const getQuestionCountAndMarks = (test) => {
    if (test.sections?.length > 0) {
        const refs = test.sections.flatMap(s => s.questionRefs);
        return { questionCount: refs.length, totalMarks: refs.reduce((s, r) => s + (r.overrideMarks ?? 1), 0) };
    }
    return { questionCount: test.questions.length, totalMarks: test.questions.reduce((s, q) => s + (q.marks || 1), 0) };
};

const isOwnerOrAdmin = (series, req) => {
    const isOwner = series.seller.toString() === req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    return isOwner || isAdmin;
};

// Public-safe summary of one bundled test — never exposes questions/answers,
// only what a student needs to decide whether to start it.
const summarizeTest = (test) => ({
    _id: test._id,
    title: test.title,
    subject: test.subject,
    timeLimit: test.timeLimit,
    isPublished: test.isPublished,
    ...getQuestionCountAndMarks(test)
});

// @desc    List the logged-in seller's own test series
// @route   GET /api/v1/test-series/mine
// @access  Private/Seller
export const getMySeries = async (req, res, next) => {
    try {
        const series = await TestSeries.find({ seller: req.user.id })
            .populate('tests.practiceTest', 'title subject timeLimit isPublished questions sections')
            .populate('company', 'name')
            .sort({ createdAt: -1 });

        const enriched = series.map(s => ({
            ...s.toObject(),
            testCount: s.tests.length
        }));

        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
        next(error);
    }
};

// @desc    Get one series (owner/admin — full detail; others — public-safe if published)
// @route   GET /api/v1/test-series/:id
// @access  Public (optionalProtect)
export const getSeriesById = async (req, res, next) => {
    try {
        const series = await TestSeries.findById(req.params.id)
            .populate('tests.practiceTest', 'title subject timeLimit isPublished questions sections')
            .populate('company', 'name')
            .populate('seller', 'name');

        if (!series) return res.status(404).json({ message: 'Test series not found' });

        const isOwner = req.user && series.seller._id.toString() === req.user.id;
        const isAdmin = req.user && ['admin', 'super_admin'].includes(req.user.role);

        if (!isOwner && !isAdmin) {
            if (!series.isPublished) return res.status(404).json({ message: 'Test series not found' });
            const now = new Date();
            if (series.schedule?.availableFrom && now < series.schedule.availableFrom) {
                return res.status(404).json({ message: 'Test series not found' });
            }
            if (series.schedule?.availableUntil && now > series.schedule.availableUntil) {
                return res.status(404).json({ message: 'Test series not found' });
            }
        }

        const data = series.toObject();
        data.tests = [...data.tests]
            .sort((a, b) => a.order - b.order)
            .map(t => ({ _id: t._id, order: t.order, practiceTest: t.practiceTest ? summarizeTest(t.practiceTest) : null }))
            .filter(t => t.practiceTest && (isOwner || isAdmin || t.practiceTest.isPublished));

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all published test series (public listing)
// @route   GET /api/v1/test-series
// @access  Public
export const getPublicSeries = async (req, res, next) => {
    try {
        const { search, subject } = req.query;
        const now = new Date();
        const query = {
            isPublished: true,
            $and: [
                { $or: [{ 'schedule.availableFrom': null }, { 'schedule.availableFrom': { $lte: now } }] },
                { $or: [{ 'schedule.availableUntil': null }, { 'schedule.availableUntil': { $gte: now } }] }
            ]
        };
        if (search) query.$or = [{ title: { $regex: search, $options: 'i' } }, { subject: { $regex: search, $options: 'i' } }];
        if (subject) query.subject = { $regex: subject, $options: 'i' };

        const series = await TestSeries.find(query)
            .populate('seller', 'name')
            .populate('tests.practiceTest', 'title subject timeLimit isPublished questions sections')
            .sort({ createdAt: -1 });

        const enriched = series.map(s => ({ ...s.toObject(), testCount: s.tests.length }));
        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a test series
// @route   POST /api/v1/test-series
// @access  Private/Seller
export const createSeries = async (req, res, next) => {
    try {
        const { title, description, subject, tags, assessmentCategory, company, targetRole, pricing, schedule, certificate } = req.body;
        if (!title) return res.status(400).json({ message: 'Title is required' });

        const series = await TestSeries.create({
            title,
            description: description || '',
            seller: req.user.id,
            subject: subject || '',
            tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
            assessmentCategory: assessmentCategory || 'Topic-wise',
            company: company || null,
            targetRole: targetRole || '',
            pricing: pricing || undefined,
            schedule: schedule || undefined,
            certificate: certificate || undefined
        });

        res.status(201).json({ success: true, data: series });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a test series' metadata
// @route   PUT /api/v1/test-series/:id
// @access  Private/Seller
export const updateSeries = async (req, res, next) => {
    try {
        const series = await TestSeries.findById(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found' });
        if (!isOwnerOrAdmin(series, req)) return res.status(403).json({ message: 'Not authorized' });

        const updates = { ...req.body };
        delete updates.seller;
        delete updates.tests; // managed via dedicated endpoints below

        if (updates.tags && !Array.isArray(updates.tags)) {
            updates.tags = updates.tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        Object.assign(series, updates);
        await series.save();

        res.status(200).json({ success: true, data: series });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a test series (does not delete the underlying practice tests)
// @route   DELETE /api/v1/test-series/:id
// @access  Private/Seller
export const deleteSeries = async (req, res, next) => {
    try {
        const series = await TestSeries.findById(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found' });
        if (!isOwnerOrAdmin(series, req)) return res.status(403).json({ message: 'Not authorized' });

        await series.deleteOne();
        res.status(200).json({ success: true, message: 'Test series deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle publish state
// @route   PATCH /api/v1/test-series/:id/publish
// @access  Private/Seller
export const toggleSeriesPublish = async (req, res, next) => {
    try {
        const series = await TestSeries.findById(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found' });
        if (!isOwnerOrAdmin(series, req)) return res.status(403).json({ message: 'Not authorized' });

        if (!series.isPublished && series.tests.length === 0) {
            return res.status(400).json({ message: 'Add at least one test before publishing' });
        }

        series.isPublished = !series.isPublished;
        await series.save();

        res.status(200).json({ success: true, isPublished: series.isPublished, message: `Test series ${series.isPublished ? 'published' : 'unpublished'}` });
    } catch (error) {
        next(error);
    }
};

// @desc    Add a practice test to the series (must belong to the same seller)
// @route   POST /api/v1/test-series/:id/tests
// @access  Private/Seller
export const addTestToSeries = async (req, res, next) => {
    try {
        const series = await TestSeries.findById(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found' });
        if (!isOwnerOrAdmin(series, req)) return res.status(403).json({ message: 'Not authorized' });

        const { practiceTestId } = req.body;
        const test = await PracticeTest.findById(practiceTestId);
        if (!test) return res.status(404).json({ message: 'Practice test not found' });
        if (test.seller.toString() !== series.seller.toString()) {
            return res.status(403).json({ message: 'You can only add your own practice tests to this series' });
        }
        if (series.tests.some(t => t.practiceTest.toString() === practiceTestId)) {
            return res.status(400).json({ message: 'This test is already in the series' });
        }

        series.tests.push({ practiceTest: practiceTestId, order: series.tests.length });
        await series.save();

        res.status(200).json({ success: true, data: series });
    } catch (error) {
        next(error);
    }
};

// @desc    Remove a practice test from the series
// @route   DELETE /api/v1/test-series/:id/tests/:refId
// @access  Private/Seller
export const removeTestFromSeries = async (req, res, next) => {
    try {
        const series = await TestSeries.findById(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found' });
        if (!isOwnerOrAdmin(series, req)) return res.status(403).json({ message: 'Not authorized' });

        series.tests = series.tests.filter(t => t._id.toString() !== req.params.refId);
        series.tests.forEach((t, idx) => { t.order = idx; });
        await series.save();

        res.status(200).json({ success: true, data: series });
    } catch (error) {
        next(error);
    }
};

// @desc    Reorder tests within the series
// @route   PUT /api/v1/test-series/:id/tests/reorder
// @access  Private/Seller
export const reorderSeriesTests = async (req, res, next) => {
    try {
        const series = await TestSeries.findById(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found' });
        if (!isOwnerOrAdmin(series, req)) return res.status(403).json({ message: 'Not authorized' });

        const { orderedRefIds } = req.body;
        if (!Array.isArray(orderedRefIds)) return res.status(400).json({ message: 'orderedRefIds must be an array' });

        const orderMap = Object.fromEntries(orderedRefIds.map((id, idx) => [id, idx]));
        series.tests.forEach(t => { t.order = orderMap[t._id.toString()] ?? t.order; });
        await series.save();

        res.status(200).json({ success: true, data: series });
    } catch (error) {
        next(error);
    }
};

// ── Admin moderation ────────────────────────────────────────────────────────

// @desc    Admin: list all test series across all sellers
// @route   GET /api/v1/admin/test-series
// @access  Private/Admin
export const adminGetAllSeries = async (req, res, next) => {
    try {
        const series = await TestSeries.find()
            .populate('seller', 'name email')
            .populate('company', 'name')
            .sort({ createdAt: -1 });

        const enriched = series.map(s => ({ ...s.toObject(), testCount: s.tests.length }));
        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: force toggle publish
// @route   PATCH /api/v1/admin/test-series/:id/publish
// @access  Private/Admin
export const adminToggleSeriesPublish = async (req, res, next) => {
    try {
        const series = await TestSeries.findById(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found' });

        series.isPublished = !series.isPublished;
        await series.save();

        res.status(200).json({ success: true, isPublished: series.isPublished, message: `Test series ${series.isPublished ? 'published' : 'unpublished'} by admin` });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: permanently delete a test series
// @route   DELETE /api/v1/admin/test-series/:id
// @access  Private/Admin
export const adminDeleteSeries = async (req, res, next) => {
    try {
        const series = await TestSeries.findById(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found' });

        await series.deleteOne();
        res.status(200).json({ success: true, message: 'Test series permanently deleted' });
    } catch (error) {
        next(error);
    }
};
