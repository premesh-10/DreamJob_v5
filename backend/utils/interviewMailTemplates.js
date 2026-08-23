import { sendMail } from './mailer.js';
import { buildInterviewIcs } from './icsGenerator.js';
import Notification from '../models/Notification.js';

const FROM_EMAIL = process.env.SMTP_FROM || 'no-reply@dreamjob.app';
const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function icsAttachmentFor(session, domain, recipient, sequence) {
    const ics = buildInterviewIcs({
        uid: `interview-session-${session._id}@dreamjob`,
        start: session.scheduledStart,
        end: session.scheduledEnd,
        title: `Mock Interview — ${domain}`,
        description: 'Join from your DreamJob dashboard once the room opens. The link is visible only to you and the other participant.',
        organizerEmail: FROM_EMAIL,
        organizerName: 'DreamJob',
        attendeeEmail: recipient.email,
        attendeeName: recipient.name,
        sequence,
    });
    return ics ? [{ filename: 'interview.ics', content: ics, contentType: 'text/calendar; method=REQUEST' }] : undefined;
}

async function notifyAndEmail({ recipient, domain, title, message, html, session, sequence, type = 'info' }) {
    const tasks = [
        Notification.create({ title, message, targetUser: recipient._id, targetRole: 'user', type }),
    ];
    if (recipient.email) {
        tasks.push(sendMail({
            to: recipient.email,
            subject: title,
            html,
            attachments: session ? icsAttachmentFor(session, domain, recipient, sequence) : undefined,
        }));
    }
    await Promise.allSettled(tasks);
}

export async function sendBookingConfirmation({ session, domain, candidate, interviewer }) {
    await Promise.allSettled([
        notifyAndEmail({
            recipient: candidate, domain, session,
            title: `Interview confirmed: ${domain}`,
            message: `Your mock interview with ${interviewer.name} is confirmed for ${fmt(session.scheduledStart)}.`,
            html: `<p>Hi ${candidate.name},</p><p>Your mock interview (<strong>${domain}</strong>) with <strong>${interviewer.name}</strong> is confirmed for <strong>${fmt(session.scheduledStart)}</strong>.</p><p>The video room link will appear on your Purchase History page once it's time to join. A calendar invite is attached.</p>`,
            type: 'success',
        }),
        notifyAndEmail({
            recipient: interviewer, domain, session,
            title: `New interview booked: ${domain}`,
            message: `${candidate.name} booked your ${domain} slot for ${fmt(session.scheduledStart)}.`,
            html: `<p>Hi ${interviewer.name},</p><p><strong>${candidate.name}</strong> booked your <strong>${domain}</strong> slot for <strong>${fmt(session.scheduledStart)}</strong>.</p><p>The video room link will appear on your Interview Schedule page once it's time to join. A calendar invite is attached.</p>`,
            type: 'success',
        }),
    ]);
}

export async function sendRescheduleNotice({ session, domain, candidate, interviewer, sequence }) {
    await Promise.allSettled([candidate, interviewer].map(recipient => notifyAndEmail({
        recipient, domain, session, sequence,
        title: `Interview rescheduled: ${domain}`,
        message: `Your interview is now scheduled for ${fmt(session.scheduledStart)}.`,
        html: `<p>Hi ${recipient.name},</p><p>Your mock interview (<strong>${domain}</strong>) has been rescheduled to <strong>${fmt(session.scheduledStart)}</strong> – ${fmt(session.scheduledEnd)}.</p><p>An updated calendar invite is attached.</p>`,
        type: 'info',
    })));
}

export async function sendCancellationNotice({ session, domain, candidate, interviewer, cancelledByName, refundNote }) {
    await Promise.allSettled([candidate, interviewer].map(recipient => notifyAndEmail({
        recipient, domain, session: null,
        title: `Interview cancelled: ${domain}`,
        message: `Your interview scheduled for ${fmt(session.scheduledStart)} was cancelled by ${cancelledByName}.${refundNote ? ` ${refundNote}` : ''}`,
        html: `<p>Hi ${recipient.name},</p><p>Your mock interview (<strong>${domain}</strong>) scheduled for <strong>${fmt(session.scheduledStart)}</strong> was cancelled by <strong>${cancelledByName}</strong>.</p>${refundNote ? `<p>${refundNote}</p>` : ''}`,
        type: 'warning',
    })));
}

export async function sendNoShowNotice({ session, domain, candidate, interviewer, noShowParty, refundNote }) {
    const noShowName = noShowParty === 'candidate' ? candidate.name : interviewer.name;
    await Promise.allSettled([candidate, interviewer].map(recipient => notifyAndEmail({
        recipient, domain, session: null,
        title: `Interview marked as no-show: ${domain}`,
        message: `${noShowName} did not join the interview scheduled for ${fmt(session.scheduledStart)}.${refundNote ? ` ${refundNote}` : ''}`,
        html: `<p>Hi ${recipient.name},</p><p>Your mock interview (<strong>${domain}</strong>) scheduled for <strong>${fmt(session.scheduledStart)}</strong> was marked as a no-show — <strong>${noShowName}</strong> did not join.</p>${refundNote ? `<p>${refundNote}</p>` : ''}<p>If you believe this is incorrect, please raise a dispute from your bookings page.</p>`,
        type: 'warning',
    })));
}

export async function sendReminder({ session, domain, recipient, hoursBefore }) {
    await notifyAndEmail({
        recipient, domain, session: null,
        title: `Reminder: ${domain} interview in ${hoursBefore < 1 ? 'under an hour' : `${hoursBefore}h`}`,
        message: `Your mock interview is scheduled for ${fmt(session.scheduledStart)}.`,
        html: `<p>Hi ${recipient.name},</p><p>This is a reminder that your mock interview (<strong>${domain}</strong>) is scheduled for <strong>${fmt(session.scheduledStart)}</strong>.</p>`,
        type: 'alert',
    });
}

export async function sendDisputeUpdate({ recipient, title, message }) {
    await notifyAndEmail({ recipient, title, message, html: `<p>Hi ${recipient.name},</p><p>${message}</p>`, type: 'alert' });
}

// Sent when a payment succeeded but the slot it was for had already been
// claimed by another payment that completed first (a genuinely concurrent
// double-booking attempt). The candidate is auto-refunded in full — this
// just explains why, instead of leaving them wondering where their booking went.
export async function sendBookingConflictRefundNotice({ candidate, domain, refundNote }) {
    await notifyAndEmail({
        recipient: candidate,
        title: `Interview slot unavailable: ${domain}`,
        message: `The ${domain} slot you paid for was claimed by another booking moments before yours. ${refundNote}`,
        html: `<p>Hi ${candidate.name},</p><p>We're sorry — the <strong>${domain}</strong> slot you just paid for was claimed by another booking at the same moment. This can happen when two people book the same slot at once.</p><p>${refundNote}</p><p>Please pick another available slot to rebook.</p>`,
        type: 'warning',
    });
}
