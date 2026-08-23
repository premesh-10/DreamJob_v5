/**
 * subscriptionReminderScheduler.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs once daily. Finds subscribers whose plan expires within the next 3 days
 * and creates an in-app notification (+ email attempt) for each, deduped so the
 * same user never receives two reminders for the same expiry window.
 *
 * Pattern mirrors interviewReminderScheduler.js — same dedup array,
 * same node-cron schedule, same "log errors, never crash the process" guarantee.
 */

import cron from 'node-cron';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendMail } from './mailer.js';

// In-memory dedup: tracks user IDs already reminded in this calendar day.
// Resets automatically at midnight when the server is running (cron resets it
// at each tick since the tick fires once per day). For multi-instance deployments
// a shared Redis TTL would replace this, but node-cron is single-process already.
let remindedToday = new Set();

export async function runSubscriptionReminders() {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    let expiringSoon;
    try {
        // Find users with a non-None plan expiring within the next 3 days
        expiringSoon = await User.find({
            'subscription.plan': { $nin: ['None', null] },
            'subscription.validUntil': { $gt: now, $lte: in3Days },
        }).select('name email subscription');
    } catch (err) {
        console.error('[SubReminder] DB query failed:', err.message);
        return;
    }

    if (!expiringSoon.length) return;

    for (const user of expiringSoon) {
        const uid = user._id.toString();
        if (remindedToday.has(uid)) continue;

        const daysLeft = Math.max(1, Math.ceil((new Date(user.subscription.validUntil) - now) / (1000 * 60 * 60 * 24)));
        const plan = user.subscription.plan;
        const expiryStr = new Date(user.subscription.validUntil).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
        });

        try {
            await Notification.create({
                title: `Your ${plan} Subscription Expires ${daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft} Days`}`,
                message: `Your ${plan} subscription expires on ${expiryStr}. Renew to keep enjoying your ${plan === 'Silver' ? '10%' : plan === 'Ruby' ? '20%' : '30%'} discount on courses and interviews.`,
                targetUser: user._id,
                type: 'warning',
            });

            await sendMail({
                to: user.email,
                subject: `Your DreamJob ${plan} subscription expires ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}`,
                html: `<h2 style="margin-top:0;color:#6366f1">Subscription Expiring Soon</h2>
                    <p>Hi ${user.name},</p>
                    <p>Your <strong>${plan}</strong> subscription expires on <strong>${expiryStr}</strong> (${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining).</p>
                    <p>To continue enjoying your subscription discount on courses and mock interviews, visit the
                      <a href="${process.env.FRONTEND_URL}/pricing" style="color:#6366f1">Pricing page</a> and renew once your current plan ends.</p>
                    <p>Your learning progress, completed lessons, and all data are always preserved regardless of subscription status.</p>`,
            }).catch(err => {
                // Email failure is non-fatal — in-app notification already sent
                console.warn(`[SubReminder] Email failed for ${user.email}:`, err.message);
            });

            remindedToday.add(uid);
            console.log(`[SubReminder] Reminded user ${user.email} — ${plan} expires in ${daysLeft}d`);
        } catch (err) {
            console.error(`[SubReminder] Failed to notify ${user.email}:`, err.message);
        }
    }
}

export function startSubscriptionReminderScheduler() {
    // Run daily at 09:00 AM server time
    cron.schedule('0 9 * * *', async () => {
        remindedToday.clear(); // reset dedup for the new day
        console.log('[SubReminder] Running daily subscription expiry check…');
        await runSubscriptionReminders();
    });
    console.log('[SubReminder] Subscription reminder scheduler started (daily 09:00)');
}
