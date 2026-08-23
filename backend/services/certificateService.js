import crypto from 'crypto';
import IssuedCertificate from '../models/IssuedCertificate.js';
import CertificateTemplate from '../models/CertificateTemplate.js';
import User from '../models/User.js';

const generateCertificateNumber = () => `DJ-CERT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

// Issues a certificate for a just-completed PracticeTest attempt if the test
// is configured for it and the attempt qualifies. Idempotent per
// user+practiceTest (the model's unique index makes a duplicate issue a no-op
// that returns the existing certificate instead of erroring).
export async function issueCertificateIfEligible(test, attempt) {
    if (!test.certificate?.enabled || !test.certificate?.templateId) return null;
    if (!attempt.passed) return null;
    if (attempt.percentage < (test.certificate.minScoreForCertificate || 0)) return null;

    const existing = await IssuedCertificate.findOne({ user: attempt.user, practiceTest: test._id });
    if (existing) return existing;

    try {
        return await IssuedCertificate.create({
            user: attempt.user,
            practiceTest: test._id,
            attempt: attempt._id,
            template: test.certificate.templateId,
            certificateNumber: generateCertificateNumber(),
            score: attempt.percentage
        });
    } catch (err) {
        if (err.code === 11000) return IssuedCertificate.findOne({ user: attempt.user, practiceTest: test._id });
        throw err;
    }
}

// Issues a certificate for a webinar registration if the webinar is configured
// for it and the attendee met the minimum attendance duration. Idempotent per
// user+webinar via the unique index above.
export async function issueWebinarCertificateIfEligible(webinar, registration) {
    if (!webinar.settings?.certificates?.enabled || !webinar.settings?.certificates?.templateId) return null;
    const requiredSeconds = (webinar.settings.certificates.minAttendanceMinutesRequired || 0) * 60;
    if ((registration.attendance?.durationSeconds || 0) < requiredSeconds) return null;

    const existing = await IssuedCertificate.findOne({ user: registration.user, webinar: webinar._id });
    if (existing) return existing;

    try {
        return await IssuedCertificate.create({
            user: registration.user,
            webinar: webinar._id,
            template: webinar.settings.certificates.templateId,
            certificateNumber: generateCertificateNumber(),
        });
    } catch (err) {
        if (err.code === 11000) return IssuedCertificate.findOne({ user: registration.user, webinar: webinar._id });
        throw err;
    }
}

// Issues a course completion certificate when all chapters are done and the
// course has certificate issuance enabled. Falls back to the first available
// template if no specific one is configured. Idempotent via the unique index.
export async function issueCourseCompletionCertificate(course, enrollment) {
    if (!course.certificate?.enabled) return null;

    let templateId = course.certificate?.templateId;
    if (!templateId) {
        const fallback = await CertificateTemplate.findOne({}).select('_id').lean();
        if (!fallback) return null;
        templateId = fallback._id;
    }

    const existing = await IssuedCertificate.findOne({ user: enrollment.user, course: course._id });
    if (existing) return existing;

    try {
        return await IssuedCertificate.create({
            user: enrollment.user,
            course: course._id,
            template: templateId,
            certificateNumber: generateCertificateNumber(),
            score: enrollment.progress?.percentComplete || 100,
        });
    } catch (err) {
        if (err.code === 11000) return IssuedCertificate.findOne({ user: enrollment.user, course: course._id });
        throw err;
    }
}

// Substitutes the small fixed set of placeholders a CertificateTemplate
// supports — no general templating engine, so there's no injection surface
// beyond the values we control here (user name, test title, score, date).
export async function renderCertificateHtml(issuedCertificate) {
    const [template, user] = await Promise.all([
        CertificateTemplate.findById(issuedCertificate.template),
        User.findById(issuedCertificate.user).select('name')
    ]);
    if (!template) throw new Error('Certificate template not found');

    let testTitle = '';
    if (issuedCertificate.practiceTest) {
        const { default: PracticeTest } = await import('../models/PracticeTest.js');
        const test = await PracticeTest.findById(issuedCertificate.practiceTest).select('title');
        testTitle = test?.title || '';
    } else if (issuedCertificate.testSeries) {
        const { default: TestSeries } = await import('../models/TestSeries.js');
        const series = await TestSeries.findById(issuedCertificate.testSeries).select('title');
        testTitle = series?.title || '';
    } else if (issuedCertificate.webinar) {
        const { default: Webinar } = await import('../models/Webinar.js');
        const webinar = await Webinar.findById(issuedCertificate.webinar).select('name');
        testTitle = webinar?.name || '';
    } else if (issuedCertificate.course) {
        const { default: Course } = await import('../models/Course.js');
        const c = await Course.findById(issuedCertificate.course).select('title');
        testTitle = c?.title || '';
    }

    return template.templateHtml
        .replaceAll('{{userName}}', user?.name || 'Student')
        .replaceAll('{{testTitle}}', testTitle)
        .replaceAll('{{score}}', String(Math.round(issuedCertificate.score)))
        .replaceAll('{{date}}', new Date(issuedCertificate.issuedAt).toLocaleDateString())
        .replaceAll('{{certificateNumber}}', issuedCertificate.certificateNumber);
}
