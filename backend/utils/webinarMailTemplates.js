import { sendMail } from './mailer.js';
import { buildWebinarIcs } from './icsGenerator.js';
import Notification from '../models/Notification.js';

const FROM_EMAIL = process.env.SMTP_FROM || 'no-reply@dreamjob.app';
const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function icsAttachmentFor(webinar, start, end, recipient, calendarUid, sequence) {
    const ics = buildWebinarIcs({
        uid: calendarUid,
        start, end,
        title: `Webinar — ${webinar.name}`,
        description: webinar.description || 'Join from your DreamJob dashboard once the room opens.',
        organizerEmail: FROM_EMAIL,
        organizerName: 'DreamJob',
        attendeeEmail: recipient.email,
        attendeeName: recipient.name,
        sequence,
    });
    return ics ? [{ filename: 'webinar.ics', content: ics, contentType: 'text/calendar; method=REQUEST' }] : undefined;
}

async function notifyAndEmail({ recipient, title, message, html, type = 'info', attachments }) {
    const tasks = [
        Notification.create({ title, message, targetUser: recipient._id, targetRole: 'user', type }),
    ];
    if (recipient.email) {
        tasks.push(sendMail({ to: recipient.email, subject: title, html, attachments }));
    }
    await Promise.allSettled(tasks);
}

// settings is the per-webinar Webinar.settings.notifications sub-document — every call site
// checks it before invoking these so a disabled toggle never even reaches here, but the
// individual senders stay unconditional for callers (e.g. the reminder scheduler) that already
// pre-filtered by settings themselves.
export async function sendRegistrationConfirmation({ webinar, start, end, recipient, calendarUid, settings = {} }) {
    const attachments = settings.calendarInvite !== false ? icsAttachmentFor(webinar, start, end, recipient, calendarUid, 0) : undefined;
    await notifyAndEmail({
        recipient,
        title: `Registration confirmed: ${webinar.name}`,
        message: `You're registered for "${webinar.name}" on ${fmt(start)}.`,
        html: `<p>Hi ${recipient.name},</p><p>You're registered for <strong>${webinar.name}</strong>, scheduled for <strong>${fmt(start)}</strong>.</p><p>Your secure join link will appear on your Webinars page once it's time to join.</p>`,
        type: 'success',
        attachments,
    });
}

export async function sendWaitlistNotice({ webinar, start, recipient, waitlistPosition }) {
    await notifyAndEmail({
        recipient,
        title: `Waitlisted: ${webinar.name}`,
        message: `No seats were available for "${webinar.name}" (${fmt(start)}) — you're #${waitlistPosition} on the waitlist.`,
        html: `<p>Hi ${recipient.name},</p><p>"${webinar.name}" is full, so we've added you to the waitlist at position <strong>#${waitlistPosition}</strong>. We'll email you the moment a seat opens up.</p>`,
        type: 'info',
    });
}

export async function sendWaitlistPromotion({ webinar, start, end, recipient, calendarUid, settings = {} }) {
    const attachments = settings.calendarInvite !== false ? icsAttachmentFor(webinar, start, end, recipient, calendarUid, 0) : undefined;
    await notifyAndEmail({
        recipient,
        title: `A seat opened up: ${webinar.name}`,
        message: `You've been moved from the waitlist to registered for "${webinar.name}" on ${fmt(start)}.`,
        html: `<p>Hi ${recipient.name},</p><p>Good news — a seat opened up and you're now <strong>registered</strong> for <strong>${webinar.name}</strong> on <strong>${fmt(start)}</strong>.</p>`,
        type: 'success',
        attachments,
    });
}

export async function sendCancellationNotice({ webinar, start, recipient, reason, refundNote }) {
    await notifyAndEmail({
        recipient,
        title: `Webinar cancelled: ${webinar.name}`,
        message: `"${webinar.name}" (was scheduled for ${fmt(start)}) has been cancelled.${reason ? ` Reason: ${reason}.` : ''}${refundNote ? ` ${refundNote}` : ''}`,
        html: `<p>Hi ${recipient.name},</p><p><strong>${webinar.name}</strong>, scheduled for <strong>${fmt(start)}</strong>, has been cancelled.</p>${reason ? `<p>Reason: ${reason}</p>` : ''}${refundNote ? `<p>${refundNote}</p>` : ''}`,
        type: 'warning',
    });
}

export async function sendReminder({ webinar, start, recipient, hoursBefore }) {
    await notifyAndEmail({
        recipient,
        title: `Reminder: ${webinar.name} in ${hoursBefore < 1 ? 'under an hour' : `${hoursBefore}h`}`,
        message: `"${webinar.name}" starts at ${fmt(start)}.`,
        html: `<p>Hi ${recipient.name},</p><p>This is a reminder that <strong>${webinar.name}</strong> starts at <strong>${fmt(start)}</strong>.</p>`,
        type: 'alert',
    });
}
