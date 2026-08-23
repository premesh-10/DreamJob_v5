import cron from 'node-cron';
import JobApplication from '../models/JobApplication.js';
import Notification from '../models/Notification.js';
import { sendMail } from './mailer.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;

async function processInterviewReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + WINDOW_MS);

    const applications = await JobApplication.find({
        stages: {
            $elemMatch: { scheduledAt: { $gte: now, $lte: windowEnd }, reminderSentAt: null }
        }
    }).populate('user', 'name email');

    for (const application of applications) {
        let changed = false;
        for (const stage of application.stages) {
            if (stage.scheduledAt && stage.scheduledAt >= now && stage.scheduledAt <= windowEnd && !stage.reminderSentAt) {
                const stageLabel = stage.stageName === 'Custom' ? (stage.customStageName || 'Interview') : stage.stageName;
                const title = `Upcoming interview: ${application.companyName} – ${stageLabel}`;
                const when = stage.scheduledAt.toLocaleString();

                if (application.user?.email) {
                    await sendMail({
                        to: application.user.email,
                        subject: title,
                        html: `<p>Hi ${application.user.name || ''},</p><p>Your <strong>${stageLabel}</strong> for <strong>${application.jobTitle}</strong> at <strong>${application.companyName}</strong> is scheduled at <strong>${when}</strong>.</p>${stage.meetingLink ? `<p>Meeting link: <a href="${stage.meetingLink}">${stage.meetingLink}</a></p>` : ''}`
                    });
                }

                await Notification.create({
                    title,
                    message: `Scheduled for ${when}${stage.interviewerName ? ` with ${stage.interviewerName}` : ''}.`,
                    targetUser: application.user?._id,
                    targetRole: 'user',
                    type: 'alert'
                });

                stage.reminderSentAt = now;
                changed = true;
            }
        }
        if (changed) await application.save();
    }
}

async function processFollowUpReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + WINDOW_MS);

    const applications = await JobApplication.find({
        'followUp.date': { $gte: now, $lte: windowEnd },
        'followUp.completed': false,
        'followUp.reminderSentAt': null
    }).populate('user', 'name email');

    for (const application of applications) {
        const title = `Recruiter follow-up due: ${application.companyName}`;
        const when = application.followUp.date.toLocaleString();

        if (application.user?.email) {
            await sendMail({
                to: application.user.email,
                subject: title,
                html: `<p>Hi ${application.user.name || ''},</p><p>Your follow-up for <strong>${application.jobTitle}</strong> at <strong>${application.companyName}</strong> is due on <strong>${when}</strong>.</p>${application.followUp.note ? `<p>Note: ${application.followUp.note}</p>` : ''}`
            });
        }

        await Notification.create({
            title,
            message: application.followUp.note || `Follow up with ${application.companyName} by ${when}.`,
            targetUser: application.user?._id,
            targetRole: 'user',
            type: 'alert'
        });

        application.followUp.reminderSentAt = now;
        await application.save();
    }
}

export const startReminderScheduler = () => {
    cron.schedule('*/15 * * * *', async () => {
        try {
            await processInterviewReminders();
            await processFollowUpReminders();
        } catch (error) {
            console.error('Reminder scheduler error:', error.message);
        }
    });
    console.log('Reminder scheduler started (runs every 15 minutes)');
};
