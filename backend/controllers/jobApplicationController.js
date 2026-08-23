import JobApplication from '../models/JobApplication.js';
import { deleteUploadedFile } from '../middleware/uploadMiddleware.js';

const buildFilePath = (file, subfolder) => {
    if (!file) return '';
    return `/uploads/${subfolder}/${file.filename}`;
};

const DOC_SLOTS = ['resume', 'coverLetter', 'jobDescriptionFile', 'offerLetter'];

// @desc    Get current user's job applications (filterable)
// @route   GET /api/v1/job-applications
// @access  Private
export const getApplications = async (req, res, next) => {
    try {
        const { status, search } = req.query;
        const query = { user: req.user.id };

        if (status) query.status = status;
        if (search) {
            query.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { jobTitle: { $regex: search, $options: 'i' } }
            ];
        }

        const applications = await JobApplication.find(query).sort({ applicationDate: -1 });

        res.status(200).json({
            success: true,
            count: applications.length,
            data: applications
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single job application
// @route   GET /api/v1/job-applications/:id
// @access  Private
export const getApplication = async (req, res, next) => {
    try {
        const application = await JobApplication.findOne({ _id: req.params.id, user: req.user.id });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        res.status(200).json({ success: true, data: application });
    } catch (error) {
        next(error);
    }
};

// @desc    Create job application
// @route   POST /api/v1/job-applications
// @access  Private
export const createApplication = async (req, res, next) => {
    try {
        const body = { ...req.body, user: req.user.id };
        const application = await JobApplication.create(body);
        res.status(201).json({ success: true, data: application });
    } catch (error) {
        next(error);
    }
};

// @desc    Update job application (fields + status transitions)
// @route   PUT /api/v1/job-applications/:id
// @access  Private
export const updateApplication = async (req, res, next) => {
    try {
        const application = await JobApplication.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        res.status(200).json({ success: true, data: application });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete job application (and any uploaded files)
// @route   DELETE /api/v1/job-applications/:id
// @access  Private
export const deleteApplication = async (req, res, next) => {
    try {
        const application = await JobApplication.findOne({ _id: req.params.id, user: req.user.id });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        DOC_SLOTS.forEach(slot => {
            if (application.documents?.[slot]?.path) deleteUploadedFile(application.documents[slot].path);
        });
        (application.documents?.additionalDocuments || []).forEach(doc => deleteUploadedFile(doc.path));

        await application.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

// @desc    Add interview stage
// @route   POST /api/v1/job-applications/:id/stages
// @access  Private
export const addStage = async (req, res, next) => {
    try {
        const application = await JobApplication.findOne({ _id: req.params.id, user: req.user.id });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        application.stages.push(req.body);
        await application.save();
        res.status(201).json({ success: true, data: application });
    } catch (error) {
        next(error);
    }
};

// @desc    Update interview stage
// @route   PUT /api/v1/job-applications/:id/stages/:stageId
// @access  Private
export const updateStage = async (req, res, next) => {
    try {
        const application = await JobApplication.findOne({ _id: req.params.id, user: req.user.id });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        const stage = application.stages.id(req.params.stageId);
        if (!stage) {
            return res.status(404).json({ message: 'Stage not found' });
        }
        Object.assign(stage, req.body);
        // Allow re-triggering the reminder if the schedule changes
        if (req.body.scheduledAt) stage.reminderSentAt = null;
        await application.save();
        res.status(200).json({ success: true, data: application });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete interview stage
// @route   DELETE /api/v1/job-applications/:id/stages/:stageId
// @access  Private
export const deleteStage = async (req, res, next) => {
    try {
        const application = await JobApplication.findOne({ _id: req.params.id, user: req.user.id });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        application.stages.pull(req.params.stageId);
        await application.save();
        res.status(200).json({ success: true, data: application });
    } catch (error) {
        next(error);
    }
};

// @desc    Add a prep note / question asked
// @route   POST /api/v1/job-applications/:id/notes
// @access  Private
export const addPrepNote = async (req, res, next) => {
    try {
        const { note } = req.body;
        if (!note) {
            return res.status(400).json({ message: 'Note text is required' });
        }
        const application = await JobApplication.findOne({ _id: req.params.id, user: req.user.id });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        application.prepNotes.push({ note });
        await application.save();
        res.status(201).json({ success: true, data: application });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload a document (resume/coverLetter/jobDescriptionFile/offerLetter/additional)
// @route   POST /api/v1/job-applications/:id/documents
// @access  Private
export const uploadDocument = async (req, res, next) => {
    try {
        const { docType, label } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const application = await JobApplication.findOne({ _id: req.params.id, user: req.user.id });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        const filePath = buildFilePath(req.file, 'applications');
        const docEntry = { path: filePath, originalName: req.file.originalname, uploadedAt: new Date() };

        if (docType === 'additional') {
            application.documents.additionalDocuments.push({ ...docEntry, label: label || req.file.originalname });
        } else if (DOC_SLOTS.includes(docType)) {
            const existing = application.documents[docType];
            if (existing?.path) deleteUploadedFile(existing.path);
            application.documents[docType] = docEntry;
        } else {
            deleteUploadedFile(filePath);
            return res.status(400).json({ message: 'Invalid docType' });
        }

        await application.save();
        res.status(201).json({ success: true, data: application });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a document
// @route   DELETE /api/v1/job-applications/:id/documents/:docType
// @route   DELETE /api/v1/job-applications/:id/documents/additional/:docId
// @access  Private
export const deleteDocument = async (req, res, next) => {
    try {
        const { docType, docId } = req.params;
        const application = await JobApplication.findOne({ _id: req.params.id, user: req.user.id });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        if (docType === 'additional') {
            const doc = application.documents.additionalDocuments.id(docId);
            if (doc) {
                deleteUploadedFile(doc.path);
                application.documents.additionalDocuments.pull(docId);
            }
        } else if (DOC_SLOTS.includes(docType)) {
            const existing = application.documents[docType];
            if (existing?.path) deleteUploadedFile(existing.path);
            application.documents[docType] = { path: '', originalName: '', uploadedAt: null };
        } else {
            return res.status(400).json({ message: 'Invalid docType' });
        }

        await application.save();
        res.status(200).json({ success: true, data: application });
    } catch (error) {
        next(error);
    }
};

// @desc    Set/update recruiter follow-up reminder
// @route   PUT /api/v1/job-applications/:id/follow-up
// @access  Private
export const setFollowUp = async (req, res, next) => {
    try {
        const { date, note, completed } = req.body;
        const application = await JobApplication.findOne({ _id: req.params.id, user: req.user.id });
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        if (date !== undefined) {
            application.followUp.date = date;
            application.followUp.reminderSentAt = null; // re-arm reminder on reschedule
        }
        if (note !== undefined) application.followUp.note = note;
        if (completed !== undefined) application.followUp.completed = completed;

        await application.save();
        res.status(200).json({ success: true, data: application });
    } catch (error) {
        next(error);
    }
};

// @desc    Get upcoming interview stages and follow-ups (for dashboard widget)
// @route   GET /api/v1/job-applications/upcoming
// @access  Private
export const getUpcoming = async (req, res, next) => {
    try {
        const now = new Date();
        const applications = await JobApplication.find({
            user: req.user.id,
            $or: [
                { 'stages.scheduledAt': { $gte: now } },
                { 'followUp.date': { $gte: now }, 'followUp.completed': false }
            ]
        }).select('companyName jobTitle status stages followUp');

        const upcoming = [];
        applications.forEach(app => {
            app.stages.forEach(stage => {
                if (stage.scheduledAt && stage.scheduledAt >= now) {
                    upcoming.push({
                        applicationId: app._id,
                        companyName: app.companyName,
                        jobTitle: app.jobTitle,
                        type: 'interview',
                        label: stage.stageName === 'Custom' ? stage.customStageName : stage.stageName,
                        date: stage.scheduledAt
                    });
                }
            });
            if (app.followUp?.date && app.followUp.date >= now && !app.followUp.completed) {
                upcoming.push({
                    applicationId: app._id,
                    companyName: app.companyName,
                    jobTitle: app.jobTitle,
                    type: 'follow-up',
                    label: app.followUp.note || 'Recruiter follow-up',
                    date: app.followUp.date
                });
            }
        });

        upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({ success: true, count: upcoming.length, data: upcoming });
    } catch (error) {
        next(error);
    }
};
