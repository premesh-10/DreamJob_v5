/**
 * migrateWebinarRegistrations.js — idempotent backfill that creates a WebinarRegistration row
 * for every entry currently sitting in Webinar.registeredUsers[]/waitlist[]/payments[].
 *
 * Not required for existing functionality to keep working during the dual-write window (Phase 1
 * writes both the new collection and the legacy arrays going forward) — this script only catches
 * up registrations that predate the rebuild.
 *
 * Usage:
 *   node scripts/migrateWebinarRegistrations.js                (dry run — no writes)
 *   node scripts/migrateWebinarRegistrations.js --confirm       (writes for real)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Webinar from '../models/Webinar.js';
import WebinarRegistration from '../models/WebinarRegistration.js';

const CONFIRM = process.argv.includes('--confirm');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to: ${mongoose.connection.name} (${CONFIRM ? 'CONFIRM — writes enabled' : 'DRY RUN — no writes'})`);

    const webinars = await Webinar.find({});
    const summary = { webinarsScanned: webinars.length, registrationsCreated: 0, waitlistCreated: 0, alreadyExisted: 0 };

    for (const webinar of webinars) {
        const paymentByUser = new Map((webinar.payments || []).map(p => [String(p.user), p.amount]));

        for (const userId of webinar.registeredUsers || []) {
            const filter = { webinar: webinar._id, user: userId };
            const exists = await WebinarRegistration.findOne(filter);
            if (exists) { summary.alreadyExisted++; continue; }

            summary.registrationsCreated++;
            if (CONFIRM) {
                await WebinarRegistration.create({
                    ...filter,
                    status: 'registered',
                    payment: { amount: paymentByUser.get(String(userId)) || 0 },
                });
            }
        }

        let position = 1;
        for (const userId of webinar.waitlist || []) {
            const filter = { webinar: webinar._id, user: userId };
            const exists = await WebinarRegistration.findOne(filter);
            if (exists) { summary.alreadyExisted++; position++; continue; }

            summary.waitlistCreated++;
            if (CONFIRM) {
                await WebinarRegistration.create({
                    ...filter,
                    status: 'waitlisted',
                    waitlistPosition: position,
                });
            }
            position++;
        }

        if (CONFIRM) {
            webinar.registrationCount = (webinar.registeredUsers || []).length;
            webinar.waitlistedCount = (webinar.waitlist || []).length;
            await webinar.save();
        }
    }

    console.log('\n=== Migration Summary ===');
    console.log(JSON.stringify(summary, null, 2));
    if (!CONFIRM) {
        console.log('\nThis was a DRY RUN — no data was changed. Re-run with --confirm to apply.');
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
