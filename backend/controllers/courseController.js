import mongoose from 'mongoose';
import Course, { syncLegacyCourseFields } from '../models/Course.js';
import Category from '../models/Category.js';
import Seller from '../models/Seller.js';
import Notification from '../models/Notification.js';
import { deleteUploadedFile } from '../middleware/uploadMiddleware.js';
import path from 'path';
import { getVideoDurationSeconds, resolveUploadPath } from '../utils/videoDuration.js';
import { storageProvider } from '../utils/storage.js';
import { storageConfig } from '../config/storage.js';
import { enqueue } from '../utils/jobQueue.js';
import { searchProvider } from '../utils/search.js';
import { getOrSet, invalidatePrefix } from '../utils/cache.js';
import { slugify } from '../utils/slugify.js';
import { logAudit } from '../utils/auditLog.js';

const isAdminRole = (role) => role === 'admin' || role === 'super_admin';

const filterPendingAdd = (courseDoc) => {
    const c = typeof courseDoc.toObject === 'function' ? courseDoc.toObject() : courseDoc;
    if (c.chapters) c.chapters = c.chapters.filter(ch => ch.approvalStatus !== 'pending_add');
    if (c.resources) c.resources = c.resources.filter(r => r.approvalStatus !== 'pending_add');
    return c;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
// Routes through the storage abstraction's getPublicUrl seam instead of
// hand-concatenating "/uploads/..." strings — same output as before
// (storageConfig.uploadsDir defaults to 'uploads'), just behind the
// abstraction so a future CDN-backed implementation only needs to change
// storage.js, not every call site.
const buildFilePath = (file, subfolder) => {
    if (!file) return '';
    return storageProvider.getPublicUrl(`${storageConfig.uploadsDir}/${subfolder}/${file.filename}`);
};

const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Completeness gate for requestPublish — closes the gap where a course with
// zero chapters (or missing basics) could previously be submitted for review.
const getCompletenessIssues = (course) => {
    const issues = [];
    const liveChapters = course.chapters.filter(ch => ch.approvalStatus !== 'pending_delete');
    if (liveChapters.length === 0) issues.push('Course must have at least one chapter');
    if (!course.title?.trim()) issues.push('Title is required');
    if (!course.description?.trim()) issues.push('Description is required');
    if (!course.category?.trim()) issues.push('Category is required');
    if (!course.thumbnailPath && !course.thumbnail) issues.push('Thumbnail is required');
    return issues;
};

// @desc    Get all published courses (with optional search/filter/pagination)
// @route   GET /api/v1/courses
// @access  Public
export const getCourses = async (req, res, next) => {
    try {
        const { search, category, level, page = 1, limit = 12 } = req.query;
        const pageNum = Math.max(1, Number(page) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(limit) || 12));

        const filters = { status: 'published' };
        if (category) filters.category = category;
        if (level) filters.level = level;

        const hasSearch = !!(search && search.trim());

        const run = async () => {
            const { results, total, pages } = await searchProvider.search(Course, {
                query: hasSearch ? search : '',
                filters,
                page: pageNum,
                limit: pageSize,
                populate: { path: 'seller', select: 'name' },
            });
            return {
                count: results.length,
                total,
                page: pageNum,
                pages,
                data: results.map(filterPendingAdd),
            };
        };

        // Only the no-search-text browsing path is cached — it's the highest
        // read-volume path and changes infrequently relative to read rate.
        // Search-text queries have too many distinct combinations to be
        // worth caching with a flat TTL.
        const cacheKey = `courses:list:${pageNum}:${pageSize}:${category || ''}:${level || ''}`;
        const payload = hasSearch ? await run() : await getOrSet(cacheKey, 60 * 1000, run);

        res.status(200).json({ success: true, ...payload });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single course by ID or slug
// @route   GET /api/v1/courses/:idOrSlug
// @access  Public
export const getCourse = async (req, res, next) => {
    try {
        const { idOrSlug } = req.params;
        const populateOpts = [
            { path: 'seller', select: 'name email' },
            { path: 'practiceTests', select: 'title subject isPublished questions timeLimit' },
        ];

        let course = mongoose.Types.ObjectId.isValid(idOrSlug)
            ? await Course.findById(idOrSlug).populate(populateOpts)
            : null;

        if (!course) {
            course = await Course.findOne({ slug: idOrSlug }).populate(populateOpts);
        }

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        res.status(200).json({
            success: true,
            data: filterPendingAdd(course)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new course (Seller only) — supports multipart/form-data
// @route   POST /api/v1/courses
// @access  Private/Seller
export const createCourse = async (req, res, next) => {
    try {
        const body = { ...req.body };
        body.seller = req.user.id;

        // Handle levels/level
        if (typeof body.levels === 'string') {
            try { body.levels = JSON.parse(body.levels); } catch { body.levels = [body.levels]; }
        }
        if (typeof body.whatYoullLearn === 'string') {
            try { body.whatYoullLearn = JSON.parse(body.whatYoullLearn); } catch { body.whatYoullLearn = []; }
        }
        if (typeof body.requirements === 'string') {
            try { body.requirements = JSON.parse(body.requirements); } catch { body.requirements = []; }
        }
        if (typeof body.certificate === 'string') {
            try { body.certificate = JSON.parse(body.certificate); } catch { delete body.certificate; }
        }

        // Handle thumbnail upload
        if (req.file) {
            body.thumbnailPath = buildFilePath(req.file, 'thumbnails');
            body.thumbnail = body.thumbnailPath;
        }

        body.slug = await Course.generateUniqueSlug(body.title);

        const course = await Course.create(body);
        syncLegacyCourseFields(course);
        await course.save();

        await Seller.findOneAndUpdate(
            { user: req.user.id },
            { $inc: { totalCourses: 1 } }
        );

        invalidatePrefix('courses:list:');
        await logAudit({ action: 'course.created', targetType: 'Course', targetId: course._id, req });

        res.status(201).json({
            success: true,
            data: course
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a course (Seller who owns it)
// @route   PUT /api/v1/courses/:id
// @access  Private/Seller
export const updateCourse = async (req, res, next) => {
    try {
        let course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized to edit this course' });
        }

        const body = { ...req.body };

        // Handle levels
        if (typeof body.levels === 'string') {
            try { body.levels = JSON.parse(body.levels); } catch { body.levels = [body.levels]; }
        }
        if (typeof body.whatYoullLearn === 'string') {
            try { body.whatYoullLearn = JSON.parse(body.whatYoullLearn); } catch { body.whatYoullLearn = []; }
        }
        if (typeof body.requirements === 'string') {
            try { body.requirements = JSON.parse(body.requirements); } catch { body.requirements = []; }
        }
        if (typeof body.certificate === 'string') {
            try { body.certificate = JSON.parse(body.certificate); } catch { delete body.certificate; }
        }

        // Handle thumbnail upload — delete old file if replacing
        if (req.file) {
            if (course.thumbnailPath) deleteUploadedFile(course.thumbnailPath);
            body.thumbnailPath = buildFilePath(req.file, 'thumbnails');
            body.thumbnail = body.thumbnailPath;
        }

        // Regenerate the slug only if the title actually changed, so existing
        // links/bookmarks to this course stay stable otherwise.
        if (body.title && body.title !== course.title) {
            body.slug = await Course.generateUniqueSlug(body.title, course._id);
        }

        course = await Course.findByIdAndUpdate(req.params.id, body, {
            new: true,
            runValidators: true
        });

        invalidatePrefix('courses:list:');

        res.status(200).json({ success: true, data: course });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a course (Seller who owns it)
// @route   DELETE /api/v1/courses/:id
// @access  Private/Seller
export const deleteCourse = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized to delete this course' });
        }

        if (course.status === 'published' && !isAdminRole(req.user.role)) {
            if (course.moderation.pending === 'delete') {
                course.moderation.pending = 'none';
                syncLegacyCourseFields(course);
                await course.save();
                return res.status(200).json({ success: true, message: 'Delete request cancelled', approvalStatus: course.approvalStatus, status: course.status });
            } else {
                const reason = req.body.reason || req.query.reason || 'No reason provided';
                course.moderation.pending = 'delete';
                syncLegacyCourseFields(course);
                await course.save();

                await Notification.create({
                    title: 'Course Deletion Request',
                    message: `Seller requested to delete course "${course.title}". Reason: ${reason}`,
                    targetRole: 'admin',
                    type: 'warning',
                    createdBy: req.user.id
                });
                await logAudit({ action: 'course.delete_requested', targetType: 'Course', targetId: course._id, metadata: { reason }, req });

                return res.status(200).json({ success: true, message: 'Delete request sent to admin', approvalStatus: course.approvalStatus, status: course.status });
            }
        }

        // Delete all uploaded files
        if (course.thumbnailPath) deleteUploadedFile(course.thumbnailPath);
        course.chapters.forEach(ch => {
            if (ch.videoPath) deleteUploadedFile(ch.videoPath);
            if (ch.pdfPath) deleteUploadedFile(ch.pdfPath);
        });
        course.resources.forEach(r => {
            if (r.filePath) deleteUploadedFile(r.filePath);
        });

        await course.deleteOne();

        await Seller.findOneAndUpdate(
            { user: req.user.id },
            { $inc: { totalCourses: -1 } }
        );

        invalidatePrefix('courses:list:');
        await logAudit({ action: 'course.deleted', targetType: 'Course', targetId: course._id, req });

        res.status(200).json({ success: true, message: 'Course deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get courses created by the logged-in seller
// @route   GET /api/v1/courses/mine
// @access  Private/Seller
export const getMyCourses = async (req, res, next) => {
    try {
        const courses = await Course.find({ seller: req.user.id })
            .populate('practiceTests', 'title subject isPublished')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: courses.length,
            data: courses
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get courses the user is enrolled in (legacy data source — kept
//          working; courseEnrollmentController.js's getMyEnrollments is the
//          new Enrollment-backed equivalent with richer progress data)
// @route   GET /api/v1/courses/enrolled
// @access  Private
export const getEnrolledCourses = async (req, res, next) => {
    try {
        const courses = await Course.find({ enrolledUsers: req.user.id })
            .populate('seller', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: courses.length,
            data: courses.map(filterPendingAdd)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload / replace course thumbnail
// @route   POST /api/v1/courses/:id/thumbnail
// @access  Private/Seller
export const uploadCourseThumbnail = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        // Delete old thumbnail
        if (course.thumbnailPath) deleteUploadedFile(course.thumbnailPath);

        const thumbnailPath = buildFilePath(req.file, 'thumbnails');
        course.thumbnailPath = thumbnailPath;
        course.thumbnail = thumbnailPath;
        await course.save();

        invalidatePrefix('courses:list:');

        res.status(200).json({
            success: true,
            thumbnailPath,
            message: 'Thumbnail uploaded successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add chapter to course (with optional video upload)
// @route   POST /api/v1/courses/:id/chapters
// @access  Private/Seller
export const addChapter = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized to add chapters to this course' });
        }

        const chapterData = {
            title: req.body.title,
            description: req.body.description || '',
            order: req.body.order || (course.chapters.length + 1),
            isFree: req.body.isFree === 'true' || req.body.isFree === true,
            duration: Number(req.body.duration) || 0,
            videoUrl: req.body.videoUrl || '',
            approvalStatus: course.status === 'published' ? 'pending_add' : 'approved'
        };

        // Handle video file upload — duration is extracted asynchronously via
        // the job queue (utils/jobQueue.js) instead of blocking this request
        // on ffprobe, so large uploads respond immediately.
        if (req.file) {
            chapterData.videoPath = buildFilePath(req.file, 'videos');
            chapterData.videoSize = req.file.size;
            chapterData.videoMimeType = req.file.mimetype;
            chapterData.processingStatus = 'queued';
        }

        course.chapters.push(chapterData);
        await course.save();

        if (req.file) {
            const pushedChapter = course.chapters[course.chapters.length - 1];
            await enqueue('extract-video-duration', {
                courseId: course._id.toString(),
                chapterId: pushedChapter._id.toString(),
                videoPath: pushedChapter.videoPath,
            });
        }

        res.status(200).json({ success: true, data: course });
    } catch (error) {
        next(error);
    }
};


// @desc    Update a chapter
// @route   PUT /api/v1/courses/:id/chapters/:chapterId
// @access  Private/Seller
export const updateChapter = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

        // Update fields
        if (req.body.title) chapter.title = req.body.title;
        if (req.body.description !== undefined) chapter.description = req.body.description;
        if (req.body.isFree !== undefined) chapter.isFree = req.body.isFree === 'true' || req.body.isFree === true;
        if (req.body.videoUrl !== undefined) chapter.videoUrl = req.body.videoUrl;

        // Only update duration from body if NO new video is being uploaded
        // (the async duration job will override it anyway if a file is present)
        if (req.body.duration !== undefined && !req.file) {
            chapter.duration = Number(req.body.duration) || 0;
        }

        // Handle new video upload — re-extract duration asynchronously
        if (req.file) {
            if (chapter.videoPath) deleteUploadedFile(chapter.videoPath);
            chapter.videoPath = buildFilePath(req.file, 'videos');
            chapter.videoSize = req.file.size;
            chapter.videoMimeType = req.file.mimetype;
            chapter.processingStatus = 'queued';
        }

        await course.save();

        if (req.file) {
            await enqueue('extract-video-duration', {
                courseId: course._id.toString(),
                chapterId: chapter._id.toString(),
                videoPath: chapter.videoPath,
            });
        }

        res.status(200).json({ success: true, data: course });
    } catch (error) {
        next(error);
    }
};


// @desc    Delete a chapter
// @route   DELETE /api/v1/courses/:id/chapters/:chapterId
// @access  Private/Seller
export const deleteChapter = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

        // Handle published course deletion requests
        if (course.status === 'published' && !isAdminRole(req.user.role)) {
            if (chapter.approvalStatus === 'pending_add') {
                if (chapter.videoPath) deleteUploadedFile(chapter.videoPath);
                if (chapter.pdfPath) deleteUploadedFile(chapter.pdfPath);
                course.chapters.pull(req.params.chapterId);
                await course.save();
                return res.status(200).json({ success: true, message: 'Draft chapter deleted', data: course });
            } else if (chapter.approvalStatus === 'pending_delete') {
                chapter.approvalStatus = 'approved';
                await course.save();
                return res.status(200).json({ success: true, message: 'Delete request cancelled', data: course });
            } else {
                const reason = req.body.reason || req.query.reason || 'No reason provided';
                chapter.approvalStatus = 'pending_delete';
                await course.save();

                await Notification.create({
                    title: 'Video Deletion Request',
                    message: `Seller requested to delete video "${chapter.title}" from course "${course.title}". Reason: ${reason}`,
                    targetRole: 'admin',
                    type: 'warning',
                    createdBy: req.user.id
                });

                return res.status(200).json({ success: true, message: 'Delete request sent to admin', data: course });
            }
        }

        // Delete associated files
        if (chapter.videoPath) deleteUploadedFile(chapter.videoPath);
        if (chapter.pdfPath) deleteUploadedFile(chapter.pdfPath);

        course.chapters.pull(req.params.chapterId);
        await course.save();

        res.status(200).json({ success: true, message: 'Chapter deleted', data: course });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload PDF for a chapter
// @route   POST /api/v1/courses/:id/chapters/:chapterId/pdf
// @access  Private/Seller
export const uploadChapterPDF = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

        // Delete old PDF
        if (chapter.pdfPath) deleteUploadedFile(chapter.pdfPath);

        chapter.pdfPath = buildFilePath(req.file, 'pdfs');
        chapter.pdfTitle = req.body.pdfTitle || req.file.originalname;
        chapter.pdfSize = req.file.size;
        await course.save();

        res.status(200).json({ success: true, data: course, message: 'Chapter PDF uploaded' });
    } catch (error) {
        next(error);
    }
};

// @desc    Add a resource (PDF/doc) to the course
// @route   POST /api/v1/courses/:id/resources
// @access  Private/Seller
export const addCourseResource = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const resource = {
            title: req.body.title || req.file.originalname,
            filePath: buildFilePath(req.file, 'resources'),
            fileType: path.extname(req.file.originalname).replace('.', '').toLowerCase() || 'pdf',
            fileSize: req.file.size,
            approvalStatus: course.status === 'published' ? 'pending_add' : 'approved'
        };

        course.resources.push(resource);
        await course.save();

        res.status(200).json({ success: true, data: course, message: 'Resource added' });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a course resource
// @route   DELETE /api/v1/courses/:id/resources/:resourceId
// @access  Private/Seller
export const deleteCourseResource = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const resource = course.resources.id(req.params.resourceId);
        if (!resource) return res.status(404).json({ message: 'Resource not found' });

        if (course.status === 'published' && !isAdminRole(req.user.role)) {
            if (resource.approvalStatus === 'pending_add') {
                deleteUploadedFile(resource.filePath);
                course.resources.pull(req.params.resourceId);
                await course.save();
                return res.status(200).json({ success: true, message: 'Draft resource deleted', data: course });
            } else if (resource.approvalStatus === 'pending_delete') {
                resource.approvalStatus = 'approved';
                await course.save();
                return res.status(200).json({ success: true, message: 'Delete request cancelled', data: course });
            } else {
                resource.approvalStatus = 'pending_delete';
                await course.save();
                return res.status(200).json({ success: true, message: 'Delete request sent to admin', data: course });
            }
        }

        deleteUploadedFile(resource.filePath);
        course.resources.pull(req.params.resourceId);
        await course.save();

        res.status(200).json({ success: true, message: 'Resource deleted', data: course });
    } catch (error) {
        next(error);
    }
};

// @desc    Reorder chapters
// @route   PUT /api/v1/courses/:id/chapters/reorder
// @access  Private/Seller
export const reorderChapters = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { order } = req.body; // array of { id, order }
        if (!Array.isArray(order)) return res.status(400).json({ message: 'order must be an array' });

        order.forEach(({ id, order: newOrder }) => {
            const ch = course.chapters.id(id);
            if (ch) ch.order = newOrder;
        });

        course.chapters.sort((a, b) => a.order - b.order);
        await course.save();

        res.status(200).json({ success: true, data: course });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle publish status — kept as a backward-compatible alias.
//          Internally maps the old single-toggle semantics onto the new
//          status/moderation request-and-cancel functions below, so any
//          caller still hitting this old route keeps working unchanged.
// @route   PATCH /api/v1/courses/:id/publish
// @access  Private/Seller
export const toggleCoursePublish = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (isAdminRole(req.user.role)) {
            req.body.status = course.status === 'published' ? 'draft' : 'published';
            return adminSetCourseStatus(req, res, next);
        }

        if (course.status === 'published') {
            if (course.moderation.pending === 'unpublish') return cancelUnpublishRequest(req, res, next);
            return requestUnpublish(req, res, next);
        } else {
            if (course.moderation.pending === 'publish') return cancelPublishRequest(req, res, next);
            return requestPublish(req, res, next);
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Seller requests publish (subject to admin review)
// @route   PATCH /api/v1/courses/:id/publish-request
// @access  Private/Seller
export const requestPublish = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (course.status === 'published') {
            return res.status(400).json({ message: 'Course is already published' });
        }

        const issues = getCompletenessIssues(course);
        if (issues.length > 0) {
            return res.status(400).json({ message: 'Course is not ready to publish', issues });
        }

        course.moderation.pending = 'publish';
        syncLegacyCourseFields(course);
        await course.save();

        await logAudit({ action: 'course.publish_requested', targetType: 'Course', targetId: course._id, req });

        res.status(200).json({
            success: true,
            status: course.status,
            approvalStatus: course.approvalStatus,
            isPublished: course.isPublished,
            moderationPending: course.moderation.pending,
            message: 'Publish request sent to admin',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Seller cancels a pending publish request
// @route   PATCH /api/v1/courses/:id/publish-request/cancel
// @access  Private/Seller
export const cancelPublishRequest = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (course.moderation.pending !== 'publish') {
            return res.status(400).json({ message: 'No pending publish request to cancel' });
        }

        course.moderation.pending = 'none';
        syncLegacyCourseFields(course);
        await course.save();

        res.status(200).json({
            success: true,
            status: course.status,
            approvalStatus: course.approvalStatus,
            isPublished: course.isPublished,
            moderationPending: course.moderation.pending,
            message: 'Publish request cancelled',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Seller requests unpublish (subject to admin review)
// @route   PATCH /api/v1/courses/:id/unpublish-request
// @access  Private/Seller
export const requestUnpublish = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (course.status !== 'published') {
            return res.status(400).json({ message: 'Course is not published' });
        }

        course.moderation.pending = 'unpublish';
        syncLegacyCourseFields(course);
        await course.save();

        await logAudit({ action: 'course.unpublish_requested', targetType: 'Course', targetId: course._id, req });

        res.status(200).json({
            success: true,
            status: course.status,
            approvalStatus: course.approvalStatus,
            isPublished: course.isPublished,
            moderationPending: course.moderation.pending,
            message: 'Unpublish request sent to admin',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Seller cancels a pending unpublish request
// @route   PATCH /api/v1/courses/:id/unpublish-request/cancel
// @access  Private/Seller
export const cancelUnpublishRequest = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (course.moderation.pending !== 'unpublish') {
            return res.status(400).json({ message: 'No pending unpublish request to cancel' });
        }

        course.moderation.pending = 'none';
        syncLegacyCourseFields(course);
        await course.save();

        res.status(200).json({
            success: true,
            status: course.status,
            approvalStatus: course.approvalStatus,
            isPublished: course.isPublished,
            moderationPending: course.moderation.pending,
            message: 'Unpublish request cancelled',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin sets course status directly (no approval workflow)
// @route   PATCH /api/v1/courses/:id/status
// @access  Private/Admin
export const adminSetCourseStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['draft', 'published', 'archived'].includes(status)) {
            return res.status(400).json({ message: 'status must be draft, published, or archived' });
        }

        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const before = { status: course.status, pending: course.moderation.pending };
        course.status = status;
        course.moderation.pending = 'none';
        course.moderation.reviewedBy = req.user.id;
        course.moderation.reviewedAt = new Date();
        syncLegacyCourseFields(course);
        await course.save();

        invalidatePrefix('courses:list:');
        await logAudit({
            action: 'course.status_changed',
            targetType: 'Course',
            targetId: course._id,
            metadata: { before, after: { status: course.status } },
            req,
        });

        res.status(200).json({
            success: true,
            status: course.status,
            approvalStatus: course.approvalStatus,
            isPublished: course.isPublished,
            message: `Course ${status === 'published' ? 'published' : status === 'archived' ? 'archived' : 'unpublished'} successfully`,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Backfill missing video durations — enqueues async jobs instead of
//          blocking the request on ffprobe for every chapter.
// @route   POST /api/v1/courses/backfill-durations
// @access  Private/Seller+Admin
export const backfillChapterDurations = async (req, res, next) => {
    try {
        const query = isAdminRole(req.user.role) ? {} : { seller: req.user.id };
        const courses = await Course.find(query);
        let enqueuedCount = 0;

        for (const course of courses) {
            let courseChanged = false;
            for (const chapter of course.chapters) {
                if (!chapter.videoPath || chapter.duration > 0) continue;
                chapter.processingStatus = 'queued';
                courseChanged = true;
                enqueuedCount++;
                // eslint-disable-next-line no-await-in-loop
                await enqueue('extract-video-duration', {
                    courseId: course._id.toString(),
                    chapterId: chapter._id.toString(),
                    videoPath: chapter.videoPath,
                });
            }
            if (courseChanged) await course.save();
        }

        res.status(200).json({
            success: true,
            message: `Enqueued ${enqueuedCount} chapter duration job${enqueuedCount !== 1 ? 's' : ''}`,
            enqueuedCount
        });
    } catch (error) {
        next(error);
    }
};

// Job handler for 'extract-video-duration' — registered against the job
// queue in server.js. Uses an atomic positional update against the embedded
// chapter so concurrent jobs for different chapters never race on a
// read-modify-write of the whole course document.
export async function extractVideoDurationHandler({ courseId, chapterId, videoPath }) {
    const absolutePath = resolveUploadPath(videoPath);
    const duration = absolutePath ? await getVideoDurationSeconds(absolutePath) : 0;

    const update = duration > 0
        ? { $set: { 'chapters.$.duration': duration, 'chapters.$.processingStatus': 'ready' } }
        : { $set: { 'chapters.$.processingStatus': 'failed' } };

    await Course.findOneAndUpdate({ _id: courseId, 'chapters._id': chapterId }, update);
    return { duration };
}

// @desc    Get related courses (same category, exclude self, limit 4)
// @route   GET /api/v1/courses/:id/related
// @access  Public
export const getRelatedCourses = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id).select('category');
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const related = await Course.find({
            _id: { $ne: course._id },
            status: 'published',
            category: course.category,
        })
            .select('title description thumbnailPath thumbnail price rating totalReviews enrollmentCount category level slug')
            .populate('seller', 'name')
            .limit(4)
            .lean();

        res.status(200).json({ success: true, data: related.map(filterPendingAdd) });
    } catch (error) {
        next(error);
    }
};

// @desc    Requeue video duration extraction for a chapter (retry after failure/stuck)
// @route   POST /api/v1/courses/:id/chapters/:chapterId/reprocess
// @access  Private/Seller
export const reprocessChapter = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        if (course.seller.toString() !== req.user.id && !isAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ message: 'Chapter not found' });
        if (!chapter.videoPath) return res.status(400).json({ message: 'No uploaded video to reprocess' });

        chapter.processingStatus = 'queued';
        await course.save();

        await enqueue('extract-video-duration', {
            courseId: course._id.toString(),
            chapterId: chapter._id.toString(),
            videoPath: chapter.videoPath,
        });

        res.status(200).json({ success: true, message: 'Reprocessing queued' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get active categories (public, cached)
// @route   GET /api/v1/courses/categories
// @access  Public
export const getCategories = async (req, res, next) => {
    try {
        const categories = await getOrSet('categories:active', 5 * 60 * 1000, async () => {
            return Category.find({ isActive: true }).sort({ order: 1 }).lean();
        });
        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a category
// @route   POST /api/v1/admin/categories
// @access  Private/Admin
export const createCategory = async (req, res, next) => {
    try {
        const name = req.body.name?.trim();
        if (!name) return res.status(400).json({ message: 'Category name is required' });

        const exists = await Category.findOne({ name });
        if (exists) return res.status(400).json({ message: 'Category already exists' });

        const category = await Category.create({ name, slug: slugify(name), order: req.body.order || 0 });
        invalidatePrefix('categories:');
        await logAudit({ action: 'category.created', targetType: 'Category', targetId: category._id, metadata: { name }, req });

        res.status(201).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a category
// @route   PATCH /api/v1/admin/categories/:id
// @access  Private/Admin
export const updateCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ message: 'Category not found' });

        if (req.body.name?.trim()) {
            category.name = req.body.name.trim();
            category.slug = slugify(category.name);
        }
        if (req.body.order !== undefined) category.order = req.body.order;
        if (req.body.isActive !== undefined) category.isActive = req.body.isActive;
        await category.save();

        invalidatePrefix('categories:');
        await logAudit({ action: 'category.updated', targetType: 'Category', targetId: category._id, metadata: req.body, req });

        res.status(200).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
};

// @desc    Deactivate a category (soft-delete — categories are never hard-deleted
//          since existing courses may still reference the name)
// @route   PATCH /api/v1/admin/categories/:id/deactivate
// @access  Private/Admin
export const deactivateCategory = async (req, res, next) => {
    try {
        const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!category) return res.status(404).json({ message: 'Category not found' });

        invalidatePrefix('categories:');
        await logAudit({ action: 'category.deactivated', targetType: 'Category', targetId: category._id, req });

        res.status(200).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
};
