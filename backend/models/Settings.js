import mongoose from 'mongoose';

// Singleton collection — exactly one document, created lazily on first read.
const settingsSchema = new mongoose.Schema({
    // Mock Interview operational toggles
    interviewJoinWindowMinutesBefore: { type: Number, default: 15 },
    interviewJoinWindowMinutesAfterEnd: { type: Number, default: 0 },
    lateJoinThresholdMinutes: { type: Number, default: 10 },
    noShowGraceMinutes: { type: Number, default: 15 },
    recordingEnabled: { type: Boolean, default: true },
    recordingRequiresConsent: { type: Boolean, default: true },
    candidateCanViewOwnRecording: { type: Boolean, default: true },
    reminderHoursBefore: { type: [Number], default: [24, 1] },
    cancellationFullRefundHoursBefore: { type: Number, default: 24 },
    cancellationPartialRefundPercent: { type: Number, default: 50 },

    // Webinar platform-wide defaults
    webinar: {
        moderationRequiresApproval: { type: Boolean, default: false },
    },

    // Site / System settings — website-wide controls exposed on the System → Settings admin page
    site: {
        // General identity
        siteName:       { type: String, default: 'DreamJob' },
        tagline:        { type: String, default: 'Land your dream job with confidence' },
        supportEmail:   { type: String, default: '' },
        contactPhone:   { type: String, default: '' },

        // Feature flags — master switches for platform modules
        coursesEnabled:         { type: Boolean, default: true },
        practiceTestsEnabled:   { type: Boolean, default: true },
        mockInterviewsEnabled:  { type: Boolean, default: true },
        webinarsEnabled:        { type: Boolean, default: true },
        hubEnabled:             { type: Boolean, default: true },
        subscriptionsEnabled:   { type: Boolean, default: true },

        // Registration & access
        allowUserRegistrations:   { type: Boolean, default: true },
        allowSellerRegistrations: { type: Boolean, default: true },
        allowGoogleLogin:         { type: Boolean, default: true },
        requireEmailVerification: { type: Boolean, default: false },

        // Content moderation
        autoApproveCourses:      { type: Boolean, default: false },
        autoApproveWebinars:     { type: Boolean, default: true },
        autoApproveExperiences:  { type: Boolean, default: true },
        allowAnonymousReviews:   { type: Boolean, default: false },

        // Payments
        paymentMode:                { type: String, enum: ['test', 'live'], default: 'live' },
        defaultCurrency:            { type: String, default: 'INR' },
        platformCommissionPercent:  { type: Number, default: 20 },

        // Notifications
        emailNotificationsEnabled: { type: Boolean, default: true },
        smsNotificationsEnabled:   { type: Boolean, default: false },

        // Social links
        twitterUrl:   { type: String, default: '' },
        linkedinUrl:  { type: String, default: '' },
        instagramUrl: { type: String, default: '' },
        youtubeUrl:   { type: String, default: '' },

        // Legal
        termsUrl:   { type: String, default: '' },
        privacyUrl: { type: String, default: '' },

        // Maintenance
        maintenanceMode:    { type: Boolean, default: false },
        maintenanceMessage: { type: String, default: "We're currently performing scheduled maintenance. We'll be back shortly." },
    },
}, {
    timestamps: true
});

settingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) settings = await this.create({});
    return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
