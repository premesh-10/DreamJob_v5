import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { lookup as mimeLookup } from 'mime-types';
import connectDB from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure all models are registered with Mongoose
import './models/User.js';
import './models/Seller.js';
import './models/Course.js';
import './models/Interview.js';
import './models/Booking.js';
import './models/Transaction.js';
import './models/Coupon.js';
import './models/Notification.js';
import './models/Feedback.js';
import './models/Webinar.js';
import './models/PracticeTest.js';
import './models/PracticeTestAttempt.js';
import './models/PaymentOrder.js';
import './models/WebhookEvent.js';
import './models/JobApplication.js';
import './models/Company.js';
import './models/InterviewExperience.js';
import './models/Comment.js';
import './models/Like.js';
import './models/Bookmark.js';
import './models/Report.js';
import './models/PointsTransaction.js';
import './models/Reward.js';
import './models/RewardRedemption.js';
import './models/Settings.js';
import './models/InterviewSession.js';
import './models/InterviewFeedback.js';
import './models/Dispute.js';
import './models/AuditLog.js';
import './models/OrderSequence.js';
import './models/Category.js';
import './models/Enrollment.js';
import './models/CourseReview.js';
import './models/Job.js';
import './models/KnowledgeArticle.js';
import './models/KnowledgeComment.js';
import './models/KnowledgeLike.js';
import './models/KnowledgeBookmark.js';
import './models/KnowledgeFollow.js';
import './models/KnowledgeCommentLike.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import sellerRoutes from './routes/sellerRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import userFeatureRoutes from './routes/userFeatureRoutes.js';
import webinarRoutes from './routes/webinarRoutes.js';
import webinarSessionRoutes from './routes/webinarSessionRoutes.js';
import webinarEngagementRoutes from './routes/webinarEngagementRoutes.js';
import webinarHostRoutes from './routes/webinarHostRoutes.js';
import practiceTestRoutes from './routes/practiceTestRoutes.js';
import questionBankRoutes from './routes/questionBankRoutes.js';
import testSeriesRoutes from './routes/testSeriesRoutes.js';
import certificateRoutes from './routes/certificateRoutes.js';
import { streamCertificate } from './controllers/certificateController.js';
import badgeRoutes from './routes/badgeRoutes.js';
import gradingRoutes from './routes/gradingRoutes.js';
import jobApplicationRoutes from './routes/jobApplicationRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import interviewExperienceRoutes from './routes/interviewExperienceRoutes.js';
import rewardRoutes from './routes/rewardRoutes.js';
import interviewSessionRoutes from './routes/interviewSessionRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import livekitRoutes from './routes/livekitRoutes.js';
import disputeRoutes from './routes/disputeRoutes.js';
import recordingStreamRoutes from './routes/recordingStreamRoutes.js';
import courseStreamRoutes from './routes/courseStreamRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import { startReminderScheduler } from './utils/reminderScheduler.js';
import { maintenanceCheck } from './middleware/maintenanceMiddleware.js';
import { startPaymentReconciliation } from './utils/paymentReconciliation.js';
import { startInterviewReminderScheduler } from './utils/interviewReminderScheduler.js';
import { startWebinarReminderScheduler } from './utils/webinarReminderScheduler.js';
import { startSubscriptionReminderScheduler } from './utils/subscriptionReminderScheduler.js';
import { registerHandler, startPoller } from './utils/jobQueue.js';
import { extractVideoDurationHandler } from './controllers/courseController.js';
import { executeCodeSubmissionHandler } from './controllers/practiceTestController.js';

// Connect to MongoDB Atlas
connectDB();
startReminderScheduler();
startPaymentReconciliation();
startInterviewReminderScheduler();
startWebinarReminderScheduler();
startSubscriptionReminderScheduler();

// Course catalog async job queue — async video-duration extraction so large
// chapter uploads don't block the request thread on ffprobe.
registerHandler('extract-video-duration', extractVideoDurationHandler);
registerHandler('execute-code-submission', executeCodeSubmissionHandler);
startPoller();
console.log('Course catalog job poller started');

const app = express();

// Middleware
// Enable raw body capture for Cashfree / LiveKit webhook signature verification
app.use(express.json({
    verify: (req, res, buf) => {
        if (req.originalUrl.startsWith('/api/v1/payments/webhook') || req.originalUrl.startsWith('/api/v1/livekit/webhook')) {
            req.rawBody = buf.toString();
        }
    }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    credentials: true,
}));

// Helmet — allow serving local videos/pdfs
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
);

// ── Serve uploaded files — with proper Range support for videos ──────────────
// Course videos/PDFs/resources are protected content (paid courses) and must
// only be reachable through the token-gated /api/v1/course-stream route — see
// courseStreamRoutes.js + courseEnrollmentController.js's mintCourseStreamToken.
// Thumbnails and all other upload folders (avatars, applications, etc.) stay
// public, served exactly as before.
app.use('/uploads', (req, res, next) => {
    if (/^\/(videos|pdfs|resources)\//.test(req.path)) {
        return res.status(403).json({ message: 'This file is protected. Use the course streaming endpoint.' });
    }

    const filePath = path.join(__dirname, 'uploads', req.path);

    // Security: prevent path traversal
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    if (!fs.existsSync(filePath)) return next();

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const mimeType = mimeLookup(filePath) || 'application/octet-stream';
    const isVideo = mimeType.startsWith('video/');

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Videos: support Range requests for seek / partial content
    if (isVideo) {
        const rangeHeader = req.headers.range;
        if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 10 * 1024 * 1024, fileSize - 1);
            const chunkSize = end - start + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType,
                'Cache-Control': 'no-cache',
            });
            fs.createReadStream(filePath, { start, end }).pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': mimeType,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache',
            });
            fs.createReadStream(filePath).pipe(res);
        }
        return;
    }

    // Non-video files (PDFs, images, etc.) — standard static serving
    return express.static(path.join(__dirname, 'uploads'))(req, res, next);
});



// Maintenance mode — runs before every route, blocks non-admin users when active
app.use(maintenanceCheck);

// Mount routers
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/sellers', sellerRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
// User-facing features: coupon validation, course/interview ratings, feedback, notifications
app.use('/api/v1', userFeatureRoutes);
app.use('/api/v1/webinars', webinarRoutes);
app.use('/api/v1/webinar-sessions', webinarSessionRoutes);
app.use('/api/v1/webinar-sessions', webinarEngagementRoutes);
app.use('/api/v1/webinar-sessions', webinarHostRoutes);
app.use('/api/v1/practice-tests', practiceTestRoutes);
app.use('/api/v1/question-bank', questionBankRoutes);
app.use('/api/v1/test-series', testSeriesRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.get('/api/v1/certificate-stream', streamCertificate);
app.use('/api/v1/badges', badgeRoutes);
app.use('/api/v1/grading', gradingRoutes);
app.use('/api/v1/job-applications', jobApplicationRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/experiences', interviewExperienceRoutes);
app.use('/api/v1/rewards', rewardRoutes);
app.use('/api/v1/interview-sessions', interviewSessionRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/livekit', livekitRoutes);
app.use('/api/v1/disputes', disputeRoutes);
app.use('/api/v1/recording-stream', recordingStreamRoutes);
app.use('/api/v1/course-stream', courseStreamRoutes);
app.use('/api/v1/knowledge', knowledgeRoutes);

// Routes
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
