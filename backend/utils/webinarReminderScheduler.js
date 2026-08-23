import cron from 'node-cron';
import Webinar from '../models/Webinar.js';
import WebinarRegistration from '../models/WebinarRegistration.js';
import User from '../models/User.js';
import { sendReminder } from './webinarMailTemplates.js';
import { getScheduleWindow } from './webinarSchedule.js';

// Same node-cron / 15-min-tick / numeric-dedup-array pattern as interviewReminderScheduler.js,
// but reminder hours are read per-webinar from Webinar.settings.notifications.reminders rather
// than one global Settings value — webinars need per-event reminder windows (e.g. a 1-day
// workshop vs. a 1-hour AMA shouldn't share the same [24, 1] default forever).
async function processWebinarReminders() {
    const now = new Date();

    const webinars = await Webinar.find({ lifecycleStatus: 'published', status: { $ne: 'cancelled' } });

    for (const webinar of webinars) {
        const reminderHours = webinar.settings?.notifications?.reminders || [];
        if (reminderHours.length === 0) continue;

        const { start } = getScheduleWindow(webinar);

        for (const hoursBefore of reminderHours) {
            const windowStart = new Date(now.getTime() + Math.max(hoursBefore - 0.25, 0) * 3600000);
            const windowEnd = new Date(now.getTime() + hoursBefore * 3600000);
            if (start < windowStart || start > windowEnd) continue;

            const registrations = await WebinarRegistration.find({
                webinar: webinar._id,
                status: 'registered',
                remindersSent: { $ne: hoursBefore },
            });

            for (const reg of registrations) {
                try {
                    const user = await User.findById(reg.user).select('name email');
                    if (user) await sendReminder({ webinar, start, recipient: user, hoursBefore });
                    reg.remindersSent.push(hoursBefore);
                    await reg.save();
                } catch (err) {
                    console.error(`[Webinar Reminder] Failed for registration ${reg._id}:`, err.message);
                }
            }
        }
    }
}

export const startWebinarReminderScheduler = () => {
    cron.schedule('*/15 * * * *', async () => {
        try {
            await processWebinarReminders();
        } catch (error) {
            console.error('Webinar reminder scheduler error:', error.message);
        }
    });
    console.log('Webinar reminder scheduler started (runs every 15 minutes)');
};

// Exported for direct invocation in tests/verification — bypasses the cron wrapper.
export { processWebinarReminders };
