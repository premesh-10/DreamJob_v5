import cron from 'node-cron';
import InterviewSession from '../models/InterviewSession.js';
import Interview from '../models/Interview.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import { sendReminder } from './interviewMailTemplates.js';
import { handleRoomFinished } from '../controllers/livekitWebhookController.js';

const ACTIVE_STATUSES = ['not_started', 'in_progress', 'awaiting_feedback'];

// Fallback for when LiveKit's room_finished webhook never arrives (delivery
// outage, webhook misconfiguration, or — in dev — no real LiveKit credentials
// at all). Without this, a session whose scheduled end has long passed stays
// stuck in an active completionStatus forever: no attendance/no-show decision
// is ever made, no refund is issued, and neither party can submit feedback.
// Runs the exact same end-of-room bookkeeping the webhook itself would have.
async function sweepStuckSessions() {
    const settings = await Settings.getSettings();
    const cutoff = new Date(Date.now() - settings.noShowGraceMinutes * 60000);

    const stuck = await InterviewSession.find({
        completionStatus: { $in: ['not_started', 'in_progress'] },
        scheduledEnd: { $lt: cutoff },
    });

    for (const session of stuck) {
        try {
            await handleRoomFinished(session);
            console.warn(`[Interview Cleanup] Auto-finalized stuck session ${session._id} (no room_finished webhook arrived)`);
        } catch (err) {
            console.error(`[Interview Cleanup] Failed to auto-finalize session ${session._id}:`, err.message);
        }
    }
}

// Same node-cron / 15-min-tick pattern as reminderScheduler.js, adapted for
// multiple reminder points per session (Settings.reminderHoursBefore, e.g.
// [24, 1]) using a numeric dedup array instead of a single sentinel flag.
async function processInterviewReminders() {
    const settings = await Settings.getSettings();
    const now = new Date();

    for (const hoursBefore of settings.reminderHoursBefore) {
        const windowStart = new Date(now.getTime() + Math.max(hoursBefore - 0.25, 0) * 3600000);
        const windowEnd = new Date(now.getTime() + hoursBefore * 3600000);

        const sessions = await InterviewSession.find({
            scheduledStart: { $gte: windowStart, $lte: windowEnd },
            completionStatus: { $in: ACTIVE_STATUSES },
            remindersSent: { $ne: hoursBefore },
        });

        for (const session of sessions) {
            try {
                const [candidate, interviewer, interview] = await Promise.all([
                    User.findById(session.candidate).select('name email'),
                    User.findById(session.interviewer).select('name email'),
                    Interview.findById(session.interview).select('domain'),
                ]);
                const domain = interview?.domain || 'Mock Interview';
                if (candidate) await sendReminder({ session, domain, recipient: candidate, hoursBefore });
                if (interviewer) await sendReminder({ session, domain, recipient: interviewer, hoursBefore });

                session.remindersSent.push(hoursBefore);
                await session.save();
            } catch (err) {
                console.error(`[Interview Reminder] Failed for session ${session._id}:`, err.message);
            }
        }
    }
}

export const startInterviewReminderScheduler = () => {
    cron.schedule('*/15 * * * *', async () => {
        try {
            await processInterviewReminders();
        } catch (error) {
            console.error('Interview reminder scheduler error:', error.message);
        }
        try {
            await sweepStuckSessions();
        } catch (error) {
            console.error('Interview stuck-session sweep error:', error.message);
        }
    });
    console.log('Interview reminder scheduler started (runs every 15 minutes)');
};
