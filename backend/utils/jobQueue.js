import Job from '../models/Job.js';

/**
 * jobQueue — minimal in-process, Mongo-backed job queue. Free/local stand-in
 * for a real queue (Redis/BullMQ etc) — a future swap only needs to
 * reimplement enqueue/registerHandler/startPoller behind this same module
 * boundary, no caller changes required.
 *
 * Used today for async video-duration extraction (see server.js's
 * 'extract-video-duration' handler registration) so large uploads don't
 * block the request thread on ffprobe. Registering a new job type needs
 * zero changes to the poller itself — just another registerHandler() call.
 */
const handlers = new Map();
let pollerInterval = null;

export async function enqueue(type, payload) {
    return Job.create({ type, payload });
}

export function registerHandler(type, handlerFn) {
    handlers.set(type, handlerFn);
}

// Atomically claims one queued, due job — mirrors the atomic-claim idiom
// already used for PaymentOrder in utils/fulfillOrder.js.
async function claimNextJob() {
    return Job.findOneAndUpdate(
        { status: 'queued', runAfter: { $lte: new Date() } },
        { $set: { status: 'processing' }, $inc: { attempts: 1 } },
        { returnDocument: 'after', sort: { createdAt: 1 } }
    );
}

async function runOneTick(batchSize) {
    for (let i = 0; i < batchSize; i++) {
        const job = await claimNextJob();
        if (!job) return; // nothing due — stop this tick

        const handler = handlers.get(job.type);
        if (!handler) {
            job.status = 'failed';
            job.error = `No handler registered for job type "${job.type}"`;
            await job.save();
            continue;
        }

        try {
            const result = await handler(job.payload);
            job.status = 'completed';
            job.result = result ?? null;
            await job.save();
        } catch (err) {
            if (job.attempts < job.maxAttempts) {
                job.status = 'queued';
                job.runAfter = new Date(Date.now() + job.attempts * 5000); // linear backoff
                job.error = err.message;
            } else {
                job.status = 'failed';
                job.error = err.message;
            }
            await job.save();
        }
    }
}

// Recover jobs that were claimed ("processing") when the server last crashed
// and never finished — reset them so the retry budget isn't wasted and they
// run again on the next tick.
async function recoverStuckJobs(stuckAfterMinutes = 10) {
    const threshold = new Date(Date.now() - stuckAfterMinutes * 60 * 1000);
    const { modifiedCount } = await Job.updateMany(
        { status: 'processing', updatedAt: { $lt: threshold } },
        { $set: { status: 'queued', runAfter: new Date() } }
    );
    if (modifiedCount > 0) console.log(`[jobQueue] Recovered ${modifiedCount} stuck job(s)`);
}

export function startPoller({ intervalMs = 2000, batchSize = 5 } = {}) {
    if (pollerInterval) return pollerInterval;
    recoverStuckJobs().catch(err => console.error('[jobQueue] stuck job recovery failed:', err.message));
    pollerInterval = setInterval(() => {
        runOneTick(batchSize).catch(err => console.error('[jobQueue] poller tick failed:', err.message));
    }, intervalMs);
    return pollerInterval;
}

export function stopPoller() {
    if (pollerInterval) clearInterval(pollerInterval);
    pollerInterval = null;
}
