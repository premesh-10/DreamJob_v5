import mongoose from 'mongoose';

export const interviewStageSchema = new mongoose.Schema({
    stageName: {
        type: String,
        enum: [
            'Online Assessment', 'Technical Round 1', 'Technical Round 2',
            'Machine Coding', 'System Design', 'Behavioral Round',
            'HR Round', 'Final Round', 'Custom'
        ],
        required: true
    },
    customStageName: { type: String, default: '' },
    scheduledAt: { type: Date },
    interviewerName: { type: String, default: '' },
    mode: {
        type: String,
        enum: ['Phone', 'Video Call', 'Onsite', 'Online Assessment Platform'],
        default: 'Video Call'
    },
    meetingLink: { type: String, default: '' },
    status: {
        type: String,
        enum: ['Pending', 'Cleared', 'Rejected', 'Rescheduled'],
        default: 'Pending'
    },
    notes: { type: String, default: '' },
    reminderSentAt: { type: Date, default: null }
}, { timestamps: true });

const documentSlotSchema = new mongoose.Schema({
    path: { type: String, default: '' },
    originalName: { type: String, default: '' },
    uploadedAt: { type: Date, default: null }
}, { _id: false });

const additionalDocumentSchema = new mongoose.Schema({
    label: { type: String, required: true },
    path: { type: String, required: true },
    originalName: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now }
});

const prepNoteSchema = new mongoose.Schema({
    note: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const jobApplicationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    companyName: { type: String, required: true },
    jobTitle: { type: String, required: true },
    applicationDate: { type: Date, required: true },
    applicationSource: {
        type: String,
        enum: ['LinkedIn', 'Referral', 'Company Website', 'Naukri', 'Indeed', 'Other'],
        default: 'Company Website'
    },
    sourceOther: { type: String, default: '' },

    recruiter: {
        name: { type: String, default: '' },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        linkedIn: { type: String, default: '' }
    },

    jobLocation: { type: String, default: '' },
    workMode: { type: String, enum: ['Onsite', 'Remote', 'Hybrid'], default: 'Onsite' },
    salaryRange: {
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        currency: { type: String, default: 'INR' }
    },
    jobDescriptionText: { type: String, default: '' },
    applicationLink: { type: String, default: '' },

    status: {
        type: String,
        enum: ['Applied', 'Shortlisted', 'Interviewing', 'Offer Received', 'Accepted', 'Rejected', 'Withdrawn', 'Ghosted'],
        default: 'Applied'
    },

    stages: [interviewStageSchema],

    documents: {
        resume: { type: documentSlotSchema, default: () => ({}) },
        coverLetter: { type: documentSlotSchema, default: () => ({}) },
        jobDescriptionFile: { type: documentSlotSchema, default: () => ({}) },
        offerLetter: { type: documentSlotSchema, default: () => ({}) },
        additionalDocuments: [additionalDocumentSchema]
    },

    prepNotes: [prepNoteSchema],

    followUp: {
        date: { type: Date, default: null },
        note: { type: String, default: '' },
        completed: { type: Boolean, default: false },
        reminderSentAt: { type: Date, default: null }
    },

    offer: {
        ctc: { type: String, default: '' },
        joiningDate: { type: Date, default: null },
        compensationNotes: { type: String, default: '' }
    }
}, { timestamps: true });

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);
export default JobApplication;
