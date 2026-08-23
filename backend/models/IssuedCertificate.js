import mongoose from 'mongoose';

// One certificate actually issued to a student (as opposed to CertificateTemplate,
// which is just the reusable HTML template a seller designs). Issued once per
// user+practiceTest (or user+testSeries) — re-passing the same test never issues
// a duplicate, see certificateService.issueCertificateIfEligible.
const issuedCertificateSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    practiceTest: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTest', default: null },
    testSeries: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries', default: null },
    webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', default: null },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTestAttempt', default: null },
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'CertificateTemplate', required: true },
    certificateNumber: { type: String, required: true, unique: true },
    score: { type: Number, default: 0 },
    issuedAt: { type: Date, default: Date.now }
}, { timestamps: true });

issuedCertificateSchema.index({ user: 1, practiceTest: 1 }, { unique: true, partialFilterExpression: { practiceTest: { $type: 'objectId' } } });
issuedCertificateSchema.index({ user: 1, testSeries: 1 }, { unique: true, partialFilterExpression: { testSeries: { $type: 'objectId' } } });
issuedCertificateSchema.index({ user: 1, webinar: 1 }, { unique: true, partialFilterExpression: { webinar: { $type: 'objectId' } } });
issuedCertificateSchema.index({ user: 1, course: 1 }, { unique: true, partialFilterExpression: { course: { $type: 'objectId' } } });

const IssuedCertificate = mongoose.model('IssuedCertificate', issuedCertificateSchema);
export default IssuedCertificate;
