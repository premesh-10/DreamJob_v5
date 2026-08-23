/**
 * migrateCourseCatalog.js — one-off, idempotent backfill for the Course
 * Catalog v2 rebuild. Safe to re-run: every step checks whether it has
 * already been done before acting.
 *
 * Usage:
 *   node scripts/migrateCourseCatalog.js              (dry run — no writes)
 *   node scripts/migrateCourseCatalog.js --confirm     (writes for real)
 *
 * There is deliberately no destructive cleanup step — legacy fields
 * (isPublished, approvalStatus, enrolledUsers) are kept in sync, not
 * removed, per the non-destructive ground rule of this rebuild.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Course, { syncLegacyCourseFields } from '../models/Course.js';
import Category from '../models/Category.js';
import Enrollment from '../models/Enrollment.js';
import CourseReview from '../models/CourseReview.js';
import Booking from '../models/Booking.js';
import Feedback from '../models/Feedback.js';
import { slugify } from '../utils/slugify.js';
import { recomputeCourseRating } from '../controllers/courseReviewController.js';

const CONFIRM = process.argv.includes('--confirm');

const HARDCODED_CATEGORIES = [
    'Web Development', 'Mobile Development', 'Data Science', 'Machine Learning',
    'DevOps', 'Cloud Computing', 'Cybersecurity', 'UI/UX Design', 'Business',
    'Marketing', 'Finance', 'Career Development', 'Other',
];

// isPublished + approvalStatus -> { status, pending } — see plan's mapping table.
const STATUS_MAP = {
    'false|draft': { status: 'draft', pending: 'none' },
    'false|pending': { status: 'draft', pending: 'publish' },
    'false|approved': { status: 'draft', pending: 'none' },
    'false|rejected': { status: 'draft', pending: 'none' },
    'false|pending_unpublish': { status: 'draft', pending: 'none' },
    'false|pending_delete': { status: 'draft', pending: 'delete' },
    'true|draft': { status: 'published', pending: 'none' },
    'true|pending': { status: 'published', pending: 'none' },
    'true|approved': { status: 'published', pending: 'none' },
    'true|rejected': { status: 'published', pending: 'none' },
    'true|pending_unpublish': { status: 'published', pending: 'unpublish' },
    'true|pending_delete': { status: 'published', pending: 'delete' },
};

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to: ${mongoose.connection.name} (${CONFIRM ? 'CONFIRM — writes enabled' : 'DRY RUN — no writes'})`);

    const summary = {
        categoriesSeeded: 0,
        slugsBackfilled: 0,
        statusMapped: 0,
        enrollmentsCreated: { purchase: 0, subscription: 0, free: 0, owner: 0, admin_grant: 0 },
        reviewsCopied: 0,
        reviewsSkippedDuplicate: 0,
        ratingsRecomputed: 0,
    };

    // ── Step 2: Seed Category ────────────────────────────────────────────────
    for (let i = 0; i < HARDCODED_CATEGORIES.length; i++) {
        const name = HARDCODED_CATEGORIES[i];
        const exists = await Category.findOne({ name });
        if (exists) continue;
        summary.categoriesSeeded++;
        if (CONFIRM) {
            await Category.create({ name, slug: slugify(name), isActive: true, order: i });
        }
    }

    const courses = await Course.find({});

    // ── Step 3: Backfill slugs ───────────────────────────────────────────────
    for (const course of courses) {
        if (course.slug) continue;
        summary.slugsBackfilled++;
        if (CONFIRM) {
            course.slug = await Course.generateUniqueSlug(course.title, course._id);
        }
    }

    // ── Step 4: Map isPublished+approvalStatus -> status+moderation ─────────
    // Re-run guard: only touch a course if the mapped status/pending differ
    // from what's already there (cheap, and correctly idempotent either way).
    for (const course of courses) {
        const key = `${course.isPublished}|${course.approvalStatus}`;
        const mapped = STATUS_MAP[key] || { status: 'draft', pending: 'none' };
        const alreadyCorrect = course.status === mapped.status && course.moderation?.pending === mapped.pending;
        if (alreadyCorrect) continue;
        summary.statusMapped++;
        if (CONFIRM) {
            course.status = mapped.status;
            course.moderation = course.moderation || {};
            course.moderation.pending = mapped.pending;
            syncLegacyCourseFields(course);
        }
    }

    if (CONFIRM) {
        for (const course of courses) await course.save();
    }

    // ── Step 5: Backfill Enrollment from enrolledUsers ───────────────────────
    for (const course of courses) {
        for (const userId of course.enrolledUsers) {
            const existing = await Enrollment.findOne({ course: course._id, user: userId });
            if (existing) continue;

            let source = 'admin_grant';
            if (String(course.seller) === String(userId)) {
                source = 'owner';
            } else {
                const booking = await Booking.findOne({ user: userId, course: course._id, type: 'course' }).sort({ createdAt: -1 });
                if (booking) {
                    if (booking.paymentStatus === 'free') source = 'free';
                    else if (booking.enrollmentType === 'subscription') source = 'subscription';
                    else source = 'purchase';
                }
            }
            summary.enrollmentsCreated[source]++;
            if (CONFIRM) {
                await Enrollment.create({ course: course._id, user: userId, source, status: 'active' });
            }
        }
    }

    // ── Step 6: Recompute enrollmentCount from Enrollment ────────────────────
    if (CONFIRM) {
        for (const course of courses) {
            const count = await Enrollment.countDocuments({ course: course._id, status: 'active' });
            course.enrollmentCount = count;
            await course.save();
        }
    }

    // ── Step 7: Copy course-type Feedback -> CourseReview ────────────────────
    const courseFeedback = await Feedback.find({ type: 'course' });
    const seenPerCourseUser = new Set();
    for (const fb of courseFeedback) {
        const dupKey = `${fb.targetId}|${fb.user}`;
        const existingReview = await CourseReview.findOne({ course: fb.targetId, user: fb.user });
        if (existingReview || seenPerCourseUser.has(dupKey)) {
            summary.reviewsSkippedDuplicate++;
            continue;
        }
        seenPerCourseUser.add(dupKey);
        summary.reviewsCopied++;
        if (CONFIRM) {
            await CourseReview.create({
                course: fb.targetId,
                user: fb.user,
                rating: fb.rating || 1,
                comment: fb.review,
                isHidden: fb.isHidden,
                reportedBy: fb.reportedBy,
            });
        }
    }

    // ── Step 8: Recompute Course.rating/totalReviews from CourseReview ───────
    // Reuses the same aggregation helper courseReviewController.js uses for
    // every live review create/delete — single source of truth.
    if (CONFIRM) {
        for (const course of courses) {
            const hasReviews = await CourseReview.exists({ course: course._id });
            if (!hasReviews) continue;
            await recomputeCourseRating(course._id);
            summary.ratingsRecomputed++;
        }
    }

    // ── Step 9: Summary ───────────────────────────────────────────────────────
    console.log('\n=== Migration Summary ===');
    console.log(JSON.stringify(summary, null, 2));
    if (summary.enrollmentsCreated.admin_grant > 0) {
        console.log(`\n⚠️  ${summary.enrollmentsCreated.admin_grant} enrollment(s) had no matching Booking and were classified as 'admin_grant' — review manually if that count looks high.`);
    }
    if (!CONFIRM) {
        console.log('\nThis was a DRY RUN — no data was changed. Re-run with --confirm to apply.');
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
