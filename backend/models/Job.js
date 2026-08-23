import mongoose from 'mongoose';

/**
 * Job — minimal persisted job queue, backing utils/jobQueue.js. Free/local
 * stand-in for a real queue (Redis/BullMQ etc) — swap seam is the
 * jobQueue.js module boundary, not this model.
 */
const jobSchema = new mongoose.Schema({
    type: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
        type: String,
        enum: ['queued', 'processing', 'completed', 'failed'],
        default: 'queued',
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    error: { type: String, default: '' },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    runAfter: { type: Date, default: Date.now },
}, {
    timestamps: true,
});

jobSchema.index({ status: 1, runAfter: 1 });
jobSchema.index({ type: 1, status: 1 });

const Job = mongoose.model('Job', jobSchema);
export default Job;
