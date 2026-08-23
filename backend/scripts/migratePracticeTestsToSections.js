/**
 * migratePracticeTestsToSections.js — optional, idempotent, per-test backfill that
 * wraps a legacy test's inline questions[] into a single synthetic section's
 * questionRefs, backed by newly-created QuestionBank documents.
 *
 * This is NOT required for legacy tests to keep working — flat-mode tests with
 * sections === [] continue to be served exactly as before by every controller.
 * Run this only for tests a seller/admin wants to opt into the new section-based
 * authoring UI (e.g. to add new question types or section timers to an existing test).
 *
 * Usage:
 *   node scripts/migratePracticeTestsToSections.js                  (dry run — no writes)
 *   node scripts/migratePracticeTestsToSections.js --confirm        (writes for real)
 *   node scripts/migratePracticeTestsToSections.js --confirm --testId=<id>   (single test)
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import PracticeTest from '../models/PracticeTest.js';
import QuestionBank from '../models/QuestionBank.js';

const CONFIRM = process.argv.includes('--confirm');
const testIdArg = process.argv.find(a => a.startsWith('--testId='));
const SINGLE_TEST_ID = testIdArg ? testIdArg.split('=')[1] : null;

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to: ${mongoose.connection.name} (${CONFIRM ? 'CONFIRM — writes enabled' : 'DRY RUN — no writes'})`);

    const filter = { 'sections.0': { $exists: false }, 'questions.0': { $exists: true } };
    if (SINGLE_TEST_ID) filter._id = SINGLE_TEST_ID;
    const tests = await PracticeTest.find(filter);

    const summary = { testsConverted: 0, questionsMigrated: 0, skippedAlreadySectioned: 0 };

    for (const test of tests) {
        // Re-run guard: a test that already has sections is left untouched even if
        // its legacy questions[] is still populated (kept for reference, never read).
        if (test.sections.length > 0) {
            summary.skippedAlreadySectioned++;
            continue;
        }

        const questionRefs = [];
        for (const q of test.questions) {
            summary.questionsMigrated++;
            if (!CONFIRM) continue;

            const bankDoc = await QuestionBank.create({
                seller: test.seller,
                type: q.type,
                questionText: q.questionText,
                image: q.image || '',
                options: q.options,
                marks: q.marks || 1,
                explanation: q.explanation || '',
                isApproved: true, // legacy content was already live/published
                skillTags: test.tags || []
            });
            questionRefs.push({ questionBank: bankDoc._id, order: q.order || 0 });
        }

        summary.testsConverted++;
        if (CONFIRM) {
            test.sections.push({
                name: 'Section 1',
                order: 0,
                timeLimit: 0,
                questionRefs
            });
            await test.save();
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
