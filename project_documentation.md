# DreamJob Project Documentation

## 10. Database Design
The database is MongoDB, accessed via Mongoose.

### Entities and Relationships

#### AuditLog
```javascript
actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
action: { type: String, required: true },
targetType: { type: String, default: '' },
targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
ip: { type: String, default: '' },
```

#### Badge
```javascript
name: { type: String, required: true },
description: { type: String, default: '' },
iconUrl: { type: String, default: '' },
criteria: {
type: {
type: String,
enum: ['score_threshold', 'attempt_count', 'streak', 'category_mastery'],
required: true
},
value: { type: Number, default: 0 }, // threshold/count/streak length
category: { type: String, default: '' } // e.g. assessmentCategory or skillTag, for category_mastery
},
createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
isActive: { type: Boolean, default: true }
```

#### Booking
```javascript
user: {
type: mongoose.Schema.Types.ObjectId,
ref: 'User',
required: true
},
// Type of booking — interview or course purchase
type: {
type: String,
enum: ['interview', 'course'],
default: 'interview'
},
// For interview bookings
interview: {
type: mongoose.Schema.Types.ObjectId,
ref: 'Interview'
},
slot: {
type: mongoose.Schema.Types.ObjectId
},
// For course bookings
course: {
type: mongoose.Schema.Types.ObjectId,
ref: 'Course'
},
// The seller who receives the payment
seller: {
type: mongoose.Schema.Types.ObjectId,
ref: 'User'
},
enrollmentType: {
type: String,
enum: ['subscription', 'purchase'],
default: 'purchase'
},
status: {
type: String,
enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
default: 'confirmed'
},
meetingLink: {
type: String
},
// Back-reference to the LiveKit operational record for this booking
// (set once at session-creation time) — avoids an extra query on every
// bookings-list fetch.
session: {
type: mongoose.Schema.Types.ObjectId,
ref: 'InterviewSession',
default: null
},
paymentStatus: {
type: String,
enum: ['pending', 'paid', 'refunded', 'free'],
default: 'paid'
},
amountPaid: {
type: Number,
default: 0
},
rating: {
type: Number,
default: 0
},
// Denormalized copy of PaymentOrder.orderId — set once at fulfilment, immutable.
// Stored here so bookings-list queries never need a join to surface the Order ID.
orderId: {
type: String,
default: null,
index: true,
sparse: true,
},
```

#### Bookmark
```javascript
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
experience: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewExperience', required: true },
```

#### Category
```javascript
name: { type: String, required: true, unique: true, trim: true },
slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
isActive: { type: Boolean, default: true },
order: { type: Number, default: 0 },
```

#### CertificateTemplate
```javascript
owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // seller or admin
name: { type: String, required: true },
templateHtml: { type: String, required: true },
isActive: { type: Boolean, default: true }
```

#### Comment
```javascript
experience: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewExperience', required: true, index: true },
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
text: { type: String, required: true, trim: true },
likesCount: { type: Number, default: 0 },
status: { type: String, enum: ['visible', 'removed'], default: 'visible' },
```

#### Company
```javascript
resourceType: {
type: String,
enum: ['Course', 'PracticeTest', 'Interview', 'Webinar', 'External'],
required: true
},
resourceId: { type: mongoose.Schema.Types.ObjectId, default: null }, // refPath resolved by resourceType
title: { type: String, required: true },
url: { type: String, default: '' }, // only for 'External'
jobRole: { type: String, default: '' }, // optional scoping, e.g. "SDE-1"
addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
addedAt: { type: Date, default: Date.now }
```

#### Coupon
```javascript
code: {
type: String,
required: true,
unique: true,
uppercase: true,
trim: true
},
discountType: {
type: String,
enum: ['flat', 'percent'],
required: true,
default: 'percent'
},
discountValue: {
type: Number,
required: true
},
minOrderAmount: {
type: Number,
default: 0
},
maxUses: {
type: Number,
default: 100
},
usedCount: {
type: Number,
default: 0
},
expiresAt: {
type: Date,
required: true
},
isActive: {
type: Boolean,
default: true
},
applicableTo: {
type: String,
enum: ['all', 'courses', 'interviews', 'subscriptions'],
default: 'all'
},
createdBy: {
type: mongoose.Schema.Types.ObjectId,
ref: 'User'
}
```

#### Course
```javascript
title: { type: String, required: true },
// Legacy URL support (kept for backward compatibility)
videoUrl: { type: String, default: '' },
// New: uploaded file paths (relative to server, e.g. /uploads/videos/...)
videoPath: { type: String, default: '' },
videoSize: { type: Number, default: 0 }, // bytes
videoMimeType: { type: String, default: '' },
// PDF per chapter
pdfPath: { type: String, default: '' },
pdfTitle: { type: String, default: '' },
pdfSize: { type: Number, default: 0 },
duration: { type: Number, default: 0 }, // in seconds
order: { type: Number, required: true },
isFree: { type: Boolean, default: false },
description: { type: String, default: '' },
approvalStatus: { type: String, enum: ['approved', 'pending_add', 'pending_delete'], default: 'approved' },
// Async video-duration extraction (utils/jobQueue.js) — 'ready' by default
// so non-video chapters and pre-existing chapters never show as stuck
// "processing" after this field was introduced.
processingStatus: { type: String, enum: ['queued', 'ready', 'failed'], default: 'ready' }
```

#### CourseReview
```javascript
course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
rating: { type: Number, required: true, min: 1, max: 5 },
comment: { type: String, required: true, trim: true, minlength: 3 },
helpfulVotes: { type: Number, default: 0 },
instructorReply: {
text: { type: String, default: '' },
repliedAt: { type: Date, default: null },
},
isHidden: { type: Boolean, default: false },
reportedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
```

#### Dispute
```javascript
session: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true },
booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
raisedByRole: { type: String, enum: ['candidate', 'interviewer'], required: true },
against: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
category: {
type: String,
enum: ['no_show', 'technical_issue', 'conduct', 'quality', 'billing', 'other'],
required: true,
},
description: { type: String, required: true },
requestedResolution: { type: String, enum: ['refund', 'reschedule', 'warning', 'none'], default: 'refund' },
status: { type: String, enum: ['pending', 'under_review', 'resolved', 'dismissed'], default: 'pending', index: true },
resolution: {
faultDetermination: { type: String, enum: ['interviewer', 'candidate', 'platform', 'none', 'unresolved'], default: 'unresolved' },
refundAmount: { type: Number, default: 0 },
refundIssued: { type: Boolean, default: false },
note: { type: String, default: '' },
resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
resolvedAt: { type: Date, default: null },
},
```

#### Enrollment
```javascript
course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
source: {
type: String,
enum: ['purchase', 'subscription', 'free', 'owner', 'admin_grant'],
required: true,
},
status: { type: String, enum: ['active', 'revoked'], default: 'active' },
progress: {
completedChapters: [{
chapter: { type: mongoose.Schema.Types.ObjectId, required: true },
completedAt: { type: Date, default: Date.now },
}],
lastAccessedChapter: { type: mongoose.Schema.Types.ObjectId, default: null },
lastWatchedPosition: {
chapter: { type: mongoose.Schema.Types.ObjectId, default: null },
positionSeconds: { type: Number, default: 0 },
updatedAt: { type: Date, default: null },
},
percentComplete: { type: Number, default: 0 },
completedAt: { type: Date, default: null },
},
certificateEligible: { type: Boolean, default: false },
```

#### Feedback
```javascript
user: {
type: mongoose.Schema.Types.ObjectId,
ref: 'User',
required: true
},
type: {
type: String,
enum: ['course', 'interview', 'platform'],
required: true
},
targetId: {
type: mongoose.Schema.Types.ObjectId,
default: null
},
rating: {
type: Number,
min: 1,
max: 5,
default: null
},
review: {
type: String,
required: true,
trim: true
},
category: {
type: String,
enum: ['general', 'bug', 'feature_request', 'content_quality', 'ui_ux', 'payment'],
default: 'general'
},
// ── Public visibility controls ─────────────────────────────────────────────
isHidden: {
type: Boolean,
default: false      // admin can hide a review
},
isReported: {
type: Boolean,
default: false
},
reportedBy: [{
type: mongoose.Schema.Types.ObjectId,
ref: 'User'
}],
reportReason: {
type: String,
default: ''
}
// ──────────────────────────────────────────────────────────────────────────
```

#### Interview
```javascript
startTime: {
type: Date,
required: true
},
endTime: {
type: Date,
required: true
},
meetingLink: {
type: String,
default: ''
},
isBooked: {
type: Boolean,
default: false
}
```

#### InterviewExperience
```javascript
order: { type: Number, default: 0 },
roundType: { type: String, enum: ROUND_TYPES, required: true },
customRoundType: { type: String, default: '' },
questionsAsked: [{ type: String }],
codingProblems: [{
title: { type: String, required: true },
description: { type: String, default: '' },
link: { type: String, default: '' },
difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
}],
conceptsDiscussed: [{ type: String }],
preparationTips: { type: String, default: '' },
```

#### InterviewFeedback
```javascript
session: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true },
submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
role: { type: String, enum: ['interviewer', 'candidate'], required: true },
// Interviewer evaluating the candidate
technicalRating: { type: Number, min: 1, max: 5, default: null },
communicationRating: { type: Number, min: 1, max: 5, default: null },
problemSolvingRating: { type: Number, min: 1, max: 5, default: null },
overallRating: { type: Number, min: 1, max: 5, required: true },
recommendation: { type: String, enum: ['strong_yes', 'yes', 'maybe', 'no', 'strong_no', null], default: null },
comments: { type: String, default: '' },
// Candidate evaluating the interviewer / session
issueReported: { type: Boolean, default: false },
issueDescription: { type: String, default: '' },
```

#### InterviewSession
```javascript
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
role: { type: String, enum: ['interviewer', 'candidate', 'admin'] },
joinedAt: { type: Date },
leftAt: { type: Date, default: null },
isLate: { type: Boolean, default: false },
reconnectCount: { type: Number, default: 0 },
```

#### IssuedCertificate
```javascript
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
```

#### Job
```javascript
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
```

#### JobApplication
```javascript
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
```

#### KnowledgeArticle
```javascript
title: { type: String, required: true, trim: true, maxlength: 200 },
slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
excerpt: { type: String, trim: true, maxlength: 600, default: '' },
content: { type: String, required: true, default: '' },
coverImage: { type: String, default: '' },
author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
category: { type: String, trim: true, default: '' },
tags: [{ type: String, trim: true, lowercase: true, maxlength: 50 }],
status: {
type: String,
enum: ['draft', 'pending_review', 'published', 'rejected', 'archived'],
default: 'draft',
index: true,
},
visibility: { type: String, enum: ['public', 'unlisted'], default: 'public' },
isFeatured: { type: Boolean, default: false, index: true },
isEditorsPick: { type: Boolean, default: false },
scheduledPublishAt: { type: Date, default: null },
// Denormalized engagement counters for O(1) sort/list queries
viewCount: { type: Number, default: 0 },
likeCount: { type: Number, default: 0 },
bookmarkCount: { type: Number, default: 0 },
commentCount: { type: Number, default: 0 },
// Pre-computed trending score: views + likes*3 + bookmarks*5 + comments*2
trendScore: { type: Number, default: 0, index: true },
// Content metadata
readingTimeMinutes: { type: Number, default: 1 },
wordCount: { type: Number, default: 0 },
// SEO
seoTitle: { type: String, default: '' },
seoDescription: { type: String, default: '' },
// Rewards/moderation
rewardPointsAwarded: { type: Boolean, default: false },
rejectionReason: { type: String, default: '' },
moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
moderatedAt: { type: Date, default: null },
publishedAt: { type: Date, default: null },
```

#### KnowledgeBookmark
```javascript
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
article: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeArticle', required: true },
```

#### KnowledgeComment
```javascript
article: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeArticle', required: true, index: true },
author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
content: { type: String, required: true, trim: true, maxlength: 2000 },
parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeComment', default: null },
likeCount: { type: Number, default: 0 },
isDeleted: { type: Boolean, default: false },
deletedAt: { type: Date, default: null },
deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
```

#### KnowledgeCommentLike
```javascript
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
comment: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeComment', required: true },
```

#### KnowledgeFollow
```javascript
follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
```

#### KnowledgeLike
```javascript
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
article: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeArticle', required: true },
```

#### Like
```javascript
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
targetType: { type: String, enum: ['experience', 'comment'], required: true },
targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
```

#### Notification
```javascript
title: {
type: String,
required: true
},
message: {
type: String,
required: true
},
targetRole: {
type: String,
enum: ['all', 'user', 'seller', 'admin'],
default: 'all'
},
targetUser: {
type: mongoose.Schema.Types.ObjectId,
ref: 'User'
},
type: {
type: String,
enum: ['info', 'warning', 'success', 'alert'],
default: 'info'
},
isRead: {
type: Boolean,
default: false
},
createdBy: {
type: mongoose.Schema.Types.ObjectId,
ref: 'User'
}
```

#### OrderSequence
```javascript
key: { type: String, required: true, unique: true },
seq: { type: Number, default: 0 },
```

#### PaymentOrder
```javascript
// Cashfree's order_id — must be globally unique
cashfreeOrderId: {
type: String,
required: true,
unique: true,
index: true,
},
// Reference to the user who initiated the payment
user: {
type: mongoose.Schema.Types.ObjectId,
ref: 'User',
required: true,
index: true,
},
// Payment purpose: 'subscription' | 'course' | 'interview' | 'webinar'
type: {
type: String,
enum: ['subscription', 'course', 'interview', 'webinar'],
required: true,
},
// Subscription plan (only for type='subscription')
plan: {
type: String,
enum: ['Silver', 'Ruby', 'Platinum', null],
default: null,
},
// The ID of the product being purchased (course/interview/webinar)
itemId: {
type: mongoose.Schema.Types.ObjectId,
default: null,
},
// Extra metadata for product purchases (e.g. slotId for interviews)
itemMeta: {
type: mongoose.Schema.Types.Mixed,
default: {},
},
// Coupon redeemed against this order, if any — usedCount is only incremented
// once the order is actually fulfilled (see utils/coupon.js#redeemCoupon),
// never at checkout-creation time, since not every session completes.
couponCode: {
type: String,
default: null,
},
// Order amount in INR
amount: {
type: Number,
required: true,
},
// Cashfree's order lifecycle status.
// ACTIVE/PAID/EXPIRED/PENDING/TERMINATED/TERMINATION_REQUESTED mirror real Cashfree
// order_status values; FAILED/CANCELLED/USER_DROPPED are derived from webhook event types
// (Cashfree's payment-level events) for clearer reporting in our own UI.
orderStatus: {
type: String,
enum: ['ACTIVE', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED', 'PENDING', 'TERMINATED', 'TERMINATION_REQUESTED', 'USER_DROPPED'],
default: 'ACTIVE',
},
/**
* processed — the critical idempotency flag.
* Set atomically to `true` the FIRST time we fulfil this order.
* Any subsequent webhook/verify call gets `null` back and bails out.
*/
processed: {
type: Boolean,
default: false,
index: true,
},
processedAt: { type: Date, default: null },
processedBy: {
type: String,
enum: ['webhook', 'verify', null],
default: null,
},
// Linked transaction record (set when fulfilled)
transaction: {
type: mongoose.Schema.Types.ObjectId,
ref: 'Transaction',
default: null,
},
// Refund attempts issued against this order (an order can be partially refunded
// multiple times — e.g. webinar seat cancellation). Status is synced via
// REFUND_STATUS_WEBHOOK since Cashfree processes refunds asynchronously.
refunds: [{
refundId: { type: String, required: true },
cfRefundId: { type: String, default: null },
amount: { type: Number, required: true },
status: {
type: String,
enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'ONHOLD'],
default: 'PENDING',
},
note: { type: String, default: '' },
createdAt: { type: Date, default: Date.now },
}],
// DreamJob-generated sequential Order ID (set once at fulfilment time, immutable).
// Format: PRX{TYPE_CODE}ID{YYYYMMDD}{7-digit-seq}
// e.g. PRXCID202607010000001 (course), PRXMID202607010000002 (interview)
orderId: {
type: String,
unique: true,
sparse: true,
index: true,
},
// Sequential invoice number assigned at the same time as orderId.
// Format: INV-{YYYYMM}-{7-digit-seq}  e.g. INV-202607-0000001
invoiceNumber: {
type: String,
unique: true,
sparse: true,
},
// Cashfree's internal payment transaction ID (cf_payment_id from webhook/API).
// This is the "Transaction ID" surfaced in the UI — distinct from cashfreeOrderId
// which is our own order-level ID sent to Cashfree at checkout creation time.
cfPaymentId: {
type: String,
default: null,
},
```

#### PointsTransaction
```javascript
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
points: { type: Number, required: true }, // can be negative (redemption spend, moderation penalty)
reason: {
type: String,
enum: [
'experience_submitted', 'experience_liked', 'experience_featured', 'experience_removed_penalty',
'comment_posted', 'comment_liked',
'reward_redeemed', 'admin_adjustment',
'practice_test_completed', 'practice_test_passed', 'practice_test_perfect_score',
'coding_challenge_solved', 'badge_earned',
'article_published', 'article_liked', 'article_featured', 'article_editors_pick', 'article_removed_penalty'
],
required: true
},
refType: { type: String, enum: ['experience', 'comment', 'reward', 'practiceTest', 'article', null], default: null },
refId: { type: mongoose.Schema.Types.ObjectId, default: null },
description: { type: String, default: '' },
```

#### PracticeTest
```javascript
text: { type: String, required: true },
isCorrect: { type: Boolean, default: false }
```

#### PracticeTestAttempt
```javascript
passed: { type: Boolean, default: false },
isHidden: { type: Boolean, default: false }
```

#### QuestionBank
```javascript
text: { type: String, required: true },
isCorrect: { type: Boolean, default: false }
```

#### Report
```javascript
reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
targetType: { type: String, enum: ['experience', 'comment', 'Webinar', 'WebinarParticipant', 'KnowledgeArticle', 'KnowledgeComment'], required: true },
targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
// Only set for targetType:'WebinarParticipant' — scopes which webinar/session the reported
// participant (targetId = the reported user's id) was in, since there's no standalone
// WebinarParticipant model to look up otherwise.
webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', default: null },
reason: {
type: String,
enum: [
'Confidential Info', 'NDA Violation', 'Misleading', 'Abusive', 'Plagiarized', 'Spam', 'Other',
// Live-session-appropriate reasons, added for webinar abuse reports (Phase 9 wires these up).
'Harassment', 'Inappropriate Behavior', 'Disruptive Conduct',
],
required: true
},
details: { type: String, default: '' },
status: { type: String, enum: ['pending', 'reviewed', 'actioned', 'dismissed'], default: 'pending', index: true },
reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
reviewedAt: { type: Date, default: null },
resolutionNote: { type: String, default: '' },
```

#### Reward
```javascript
title: { type: String, required: true },
description: { type: String, default: '' },
image: { type: String, default: '' },
pointsCost: { type: Number, required: true, min: 1 },
type: {
type: String,
enum: ['coupon', 'subscription_days', 'platform_perk', 'physical_gift', 'digital_perk'],
required: true
},
// Type-specific fulfillment data, e.g. { discountPercent: 20 } for coupons,
// { days: 7 } for subscription_days, { perkDetails: '...' } for perks/gifts.
metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
stock: { type: Number, default: null }, // null = unlimited
redeemedCount: { type: Number, default: 0 },
isActive: { type: Boolean, default: true },
createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
```

#### RewardRedemption
```javascript
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
reward: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true },
rewardTitleSnapshot: { type: String, required: true }, // preserved even if the reward is later edited/deleted
pointsSpent: { type: Number, required: true },
// coupon/subscription_days are fulfilled instantly by the system; physical_gift/platform_perk
// need an admin to actually act (ship something, grant access manually) before 'fulfilled'.
status: { type: String, enum: ['pending', 'fulfilled', 'rejected'], default: 'pending' },
couponCodeIssued: { type: String, default: null },
fulfillmentNote: { type: String, default: '' },
processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
processedAt: { type: Date, default: null },
```

#### Seller
```javascript
amount: { type: Number, required: true },            // amount seller requested
approvedAmount: { type: Number, default: null },     // amount admin actually pays out (null = full)
refundedToSeller: { type: Boolean, default: true },  // if false, the difference went to admin wallet
status: {
type: String,
enum: ['initiated', 'approval_in_progress', 'completed', 'rejected'],
default: 'initiated'
},
type: {
type: String,
enum: ['withdrawal', 'admin_adjustment'],
default: 'withdrawal'
},
bankDetails: {
accountName: { type: String, default: '' },
accountNumber: { type: String, default: '' },
bankName: { type: String, default: '' },
ifsc: { type: String, default: '' }
},
adminNote: { type: String, default: '' },
requestedAt: { type: Date, default: Date.now },
processedAt: { type: Date }
```

#### Settings
```javascript
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
```

#### TestSeries
```javascript
practiceTest: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTest', required: true },
order: { type: Number, default: 0 }
```

#### Transaction
```javascript
user: {
type: mongoose.Schema.Types.ObjectId,
ref: 'User',
required: true
},
type: {
type: String,
enum: ['credit', 'debit'],
required: true
},
amount: {
type: Number,
required: true
},
description: {
type: String,
required: true
},
status: {
type: String,
enum: ['pending', 'completed', 'failed'],
default: 'completed'
},
// Cashfree order ID — sparse unique index prevents double-crediting at the DB level.
// No `default` here deliberately: a sparse index only skips documents where the field
// is genuinely absent. If Mongoose persisted an explicit `default: null`, every
// non-Cashfree transaction (wallet adjustments, withdrawal payouts) would collide on
// that same null value and the second one would always fail to save.
cashfreeOrderId: {
type: String,
index: true,
unique: true,
sparse: true,
}
```

#### User
```javascript
name: {
type: String,
required: [true, 'Please add a name']
},
email: {
type: String,
required: [true, 'Please add an email'],
unique: true,
match: [
/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3
```

#### UserBadge
```javascript
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
badge: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', required: true },
awardedAt: { type: Date, default: Date.now },
refType: { type: String, default: '' }, // e.g. 'PracticeTestAttempt'
refId: { type: mongoose.Schema.Types.ObjectId, default: null }
```

#### WebhookEvent
```javascript
// Cashfree's unique identifier for this specific webhook delivery
// Stored as the idempotency key — prevents processing the same delivery twice
eventId: {
type: String,
unique: true,
sparse: true,   // some events may not have an ID
index: true,
},
// Cashfree order ID this event is about
cashfreeOrderId: {
type: String,
index: true,
},
// Cashfree event type e.g. PAYMENT_SUCCESS_WEBHOOK, PAYMENT_FAILED_WEBHOOK
eventType: {
type: String,
required: true,
},
// Full raw payload from Cashfree (stored as-is for replay / audit)
payload: {
type: mongoose.Schema.Types.Mixed,
required: true,
},
// Signature verification result
signatureVerified: {
type: Boolean,
default: false,
},
// Whether our business logic ran successfully for this event
processed: {
type: Boolean,
default: false,
},
// Any error that occurred during processing
processingError: {
type: String,
default: null,
},
```

#### Webinar
```javascript
name: { type: String, required: true },
title: { type: String, default: '' },
bio: { type: String, default: '' },
photoUrl: { type: String, default: '' },
isGuest: { type: Boolean, default: false },
linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
```

#### WebinarChatMessage
```javascript
webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
session: { type: mongoose.Schema.Types.ObjectId, ref: 'WebinarSession', required: true },
sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
senderRole: { type: String, enum: ['host', 'co-host', 'moderator', 'speaker', 'attendee', 'platform_admin'], required: true },
text: { type: String, required: true, maxlength: 2000 },
scope: { type: String, enum: ['public', 'private'], default: 'public' },
recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
isDeleted: { type: Boolean, default: false },
deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
```

#### WebinarFeedback
```javascript
webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
session: { type: mongoose.Schema.Types.ObjectId, ref: 'WebinarSession', required: true },
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
rating: { type: Number, required: true, min: 1, max: 5 },
comments: { type: String, default: '' },
submittedAt: { type: Date, default: Date.now },
```

#### WebinarPoll
```javascript
text: { type: String, required: true },
votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
```

#### WebinarQuestion
```javascript
webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
session: { type: mongoose.Schema.Types.ObjectId, ref: 'WebinarSession', required: true },
askedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
text: { type: String, required: true, maxlength: 1000 },
isAnonymous: { type: Boolean, default: false },
status: { type: String, enum: ['pending', 'answered', 'dismissed'], default: 'pending' },
upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
// Kept in sync on each vote (rather than recomputed via $size on every sort) for fast
// "most-upvoted first" queue ordering in the host's Q&A panel.
upvoteCount: { type: Number, default: 0 },
answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
answerText: { type: String, default: '' },
answeredAt: { type: Date, default: null },
```

#### WebinarReaction
```javascript
webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
session: { type: mongoose.Schema.Types.ObjectId, ref: 'WebinarSession', required: true },
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
emoji: { type: String, required: true },
createdAt: { type: Date, default: Date.now },
```

#### WebinarRegistration
```javascript
webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
status: {
type: String,
enum: ['registered', 'waitlisted', 'cancelled', 'attended', 'no_show'],
default: 'registered',
},
registeredAt: { type: Date, default: Date.now },
waitlistPosition: { type: Number, default: null },
payment: {
amount: { type: Number, default: 0 },
transactionRef: { type: String, default: null },
},
approvalStatus: {
type: String,
enum: ['auto_approved', 'pending', 'approved', 'rejected'],
default: 'auto_approved',
},
attendance: {
joinedAt: { type: Date, default: null },
leftAt: { type: Date, default: null },
durationSeconds: { type: Number, default: 0 },
attended: { type: Boolean, default: false },
},
// Dedup flags for the reminder cron — which reminder-hour windows have already fired.
remindersSent: { type: [Number], default: [] },
calendarUid: { type: String, default: null },
certificateIssued: { type: Boolean, default: false },
feedbackSubmitted: { type: Boolean, default: false },
guidelinesAcceptedAt: { type: Date, default: null },
```

#### WebinarSession
```javascript
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
identity: { type: String, required: true },
role: { type: String, enum: ['host', 'co-host', 'moderator', 'speaker', 'attendee'], required: true },
joinedAt: { type: Date, default: Date.now },
leftAt: { type: Date, default: null },
isMuted: { type: Boolean, default: false },
camDisabled: { type: Boolean, default: false },
handRaised: { type: Boolean, default: false },
handRaisedAt: { type: Date, default: null },
connectionState: { type: String, enum: ['connected', 'disconnected'], default: 'connected' },
reconnectCount: { type: Number, default: 0 },
```


## 11. APIs

### adminRoutes
- `router.get('/analytics', getAnalytics);`
- `router.get('/users', getUsers);`
- `router.get('/sellers', getAdminSellers);`
- `router.get('/verifications', getAdminVerificationRequests);`
- `router.get('/courses', getAdminCourses);`
- `router.delete('/courses/:id', adminDeleteCourse);`
- `router.delete('/courses/:id/chapters/:chapterId', adminDeleteChapter);`
- `router.get('/courses/:id', getAdminCourses);`
- `router.get('/categories', getAdminCategories);`
- `router.post('/categories', authorize('admin', 'super_admin'), createCategoryAdmin);`
- `router.put('/categories/:id', authorize('admin', 'super_admin'), updateCategoryAdmin);`
- `router.delete('/categories/:id', authorize('admin', 'super_admin'), deactivateCategoryAdmin);`
- `router.get('/interviews', getAdminInterviews);`
- `router.get('/payments', getAdminPayments);`
- `router.get('/bookings', getAdminBookings);`
- `router.get('/disputes', getAdminDisputes);`
- `router.get('/recordings', getAdminRecordings);`
- `router.get('/recordings/:sessionId/stream-token', getRecordingStreamToken);`
- `router.get('/interview-sessions', getAdminAttendanceLogs);`
- `router.get('/audit-logs', getAdminAuditLogs);`
- `router.get('/wallet', getAdminWallet);`
- `router.get('/subscriptions', getAdminSubscriptions);`
- `router.delete('/subscriptions/:userId', revokeUserSubscription);`
- `router.get('/coupons', getAdminCoupons);`
- `router.post('/coupons', createCoupon);`
- `router.delete('/coupons/:id', deleteCoupon);`
- `router.get('/feedback', getAdminFeedback);`
- `router.get('/notifications', getAdminNotifications);`
- `router.post('/notifications', sendNotification);`
- `router.delete('/notifications/:id', deleteNotification);`
- `router.get('/reports', getAdminReports);`
- `router.get('/security', getSecurityLogs);`
- `router.get('/settings', getAdminSettings);`
- `router.put('/settings', authorize('admin', 'super_admin'), updateAdminSettings);`
- `router.get('/site-settings', getSiteSettings);`
- `router.put('/site-settings', authorize('admin', 'super_admin'), updateSiteSettings);`
- `router.get('/reviews', getAdminReviews);`
- `router.delete('/reviews/:id', deleteAdminReview);`
- `router.get('/webinars', adminGetAllWebinars);`
- `router.get('/webinars/analytics', getAdminPlatformWebinarAnalytics);`
- `router.get('/webinars/reports', getAdminWebinarReports);`
- `router.get('/webinars/:id/analytics', getSellerWebinarAnalytics);`
- `router.put('/webinars/:id', adminUpdateWebinar);`
- `router.delete('/webinars/:id', adminDeleteWebinar);`
- `router.get('/practice-tests', adminGetAllPracticeTests);`
- `router.delete('/practice-tests/:id', adminDeletePracticeTest);`
- `router.get('/practice-tests/:id/attempts', adminGetTestAttempts);`
- `router.get('/question-bank/pending', adminGetPendingQuestions);`
- `router.delete('/question-bank/:id', adminDeleteQuestion);`
- `router.get('/test-series', adminGetAllSeries);`
- `router.delete('/test-series/:id', adminDeleteSeries);`
- `router.get('/badges', adminGetAllBadges);`
- `router.post('/badges', adminCreateBadge);`
- `router.put('/badges/:id', adminUpdateBadge);`
- `router.delete('/badges/:id', adminDeleteBadge);`

### authRoutes
- `router.post('/register', register);`
- `router.post('/login', login);`
- `router.get('/me', protect, getMe);`
- `router.get('/logout', logout);`
- `router.post('/refresh', refreshToken);`

### badgeRoutes
- `router.get('/', getAllActiveBadges);`
- `router.get('/mine', protect, getMyBadges);`

### certificateRoutes
- `router.get('/mine', protect, getMyCertificates);`
- `router.get('/:id/token', protect, mintCertificateToken);`

### companyRoutes
- `router.get('/', getCompanies);`
- `router.get('/trending', getTrendingCompanies);`
- `router.get('/:slug', getCompany);`
- `router.post('/', protect, authorize(...adminRoles), handleCompanyLogoUpload, adminCreateCompany);`
- `router.put('/:id', protect, authorize(...adminRoles), handleCompanyLogoUpload, adminUpdateCompany);`
- `router.delete('/:id', protect, authorize(...adminRoles), adminDeleteCompany);`
- `router.post('/:id/resources', protect, authorize(...adminRoles), adminLinkResource);`
- `router.delete('/:id/resources/:resourceId', protect, authorize(...adminRoles), adminUnlinkResource);`

### courseRoutes
- `router.get('/', getCourses);`
- `router.get('/categories', getCategories);`
- `router.get('/mine', protect, getMyCourses);`
- `router.get('/enrolled', protect, getEnrolledCourses);`
- `router.get('/my-enrollments', protect, getMyEnrollments);`
- `router.get('/wishlist', protect, getWishlist);`
- `router.post('/categories', protect, authorize('admin', 'super_admin'), createCategory);`
- `router.put('/categories/:id', protect, authorize('admin', 'super_admin'), updateCategory);`
- `router.delete('/categories/:id', protect, authorize('admin', 'super_admin'), deactivateCategory);`
- `router.post(`
- `router.put(`
- `router.delete('/:id', protect, authorize('seller', 'admin', 'super_admin'), deleteCourse);`
- `router.post(`
- `router.post(`
- `router.put(`
- `router.put(`
- `router.delete(`
- `router.post(`
- `router.post(`
- `router.post(`
- `router.delete(`
- `router.post('/:id/publish-request', protect, authorize('seller', 'admin', 'super_admin'), requestPublish);`
- `router.post('/:id/publish-request/cancel', protect, authorize('seller', 'admin', 'super_admin'), cancelPublishRequest);`
- `router.post('/:id/unpublish-request', protect, authorize('seller', 'admin', 'super_admin'), requestUnpublish);`
- `router.post('/:id/unpublish-request/cancel', protect, authorize('seller', 'admin', 'super_admin'), cancelUnpublishRequest);`
- `router.post('/:id/enroll', protect, enrollRateLimiter, enrollCourse);`
- `router.get('/:id/access', protect, checkCourseAccess);`
- `router.get('/:id/stream-token', protect, mintCourseStreamToken);`
- `router.get('/:id/progress', protect, getProgress);`
- `router.put('/:id/progress/position', protect, saveVideoPosition);`
- `router.get('/:id/related', getRelatedCourses);`
- `router.post('/:id/wishlist', protect, addToWishlist);`
- `router.delete('/:id/wishlist', protect, removeFromWishlist);`
- `router.get('/:id/reviews', getCourseReviews);`
- `router.post('/:id/reviews', protect, reviewRateLimiter, rateCourseValidators, handleValidationErrors, rateCourse);`
- `router.delete('/:id/reviews/:reviewId', protect, deleteReview);`
- `router.post('/:id/reviews/:reviewId/reply', protect, authorize('seller', 'admin', 'super_admin'), replyToReview);`
- `router.post('/:id/reviews/:reviewId/report', protect, reportReview);`
- `router.post('/:id/rate', protect, reviewRateLimiter, rateCourseValidators, handleValidationErrors, rateCourse);`
- `router.post(`
- `router.get('/:idOrSlug', getCourse);`

### courseStreamRoutes
- `router.get('/', (req, res) => {`

### disputeRoutes
- `router.get('/mine', protect, getMyDisputes);`
- `router.post('/', protect, createDispute);`

### gradingRoutes
- `router.get('/pending', getPendingSubjectiveGrading);`

### interviewExperienceRoutes
- `router.get('/leaderboard', getLeaderboard);`
- `router.get('/top-questions', getTopQuestions);`
- `router.get('/me/bookmarks', protect, getMyBookmarks);`
- `router.get('/me/gamification', protect, getMyGamificationProfile);`
- `router.get('/admin/reports', protect, authorize(...adminRoles), adminGetReports);`
- `router.put('/admin/reports/:id', protect, authorize(...adminRoles), adminResolveReport);`
- `router.delete('/comments/:commentId', protect, deleteComment);`
- `router.post('/comments/:commentId/like', protect, toggleLikeComment);`
- `router.post('/report', protect, reportContent);`
- `router.get('/', getExperiences);`
- `router.post('/', protect, createExperience);`
- `router.get('/:id', optionalProtect, getExperience);`
- `router.put('/:id', protect, updateExperience);`
- `router.delete('/:id', protect, deleteExperience);`
- `router.put('/:id/feature', protect, authorize(...adminRoles), toggleFeatureExperience);`
- `router.post('/:id/like', protect, toggleLikeExperience);`
- `router.post('/:id/bookmark', protect, toggleBookmark);`
- `router.get('/:id/comments', getComments);`
- `router.post('/:id/comments', protect, addComment);`

### interviewRoutes
- `router.get('/', getInterviews);`
- `router.get('/mine', protect, getMyInterviewProfile);`
- `router.post('/', protect, authorize('seller', 'admin', 'super_admin'), createOrUpdateInterviewProfile);`
- `router.post('/slots', protect, authorize('seller', 'admin', 'super_admin'), addSlot);`
- `router.delete('/slots/:slotId', protect, authorize('seller', 'admin', 'super_admin'), deleteSlot);`
- `router.get('/bookings/me', protect, getMyBookings);            // user's own bookings`
- `router.get('/bookings/seller', protect, authorize('seller', 'admin', 'super_admin'), getSellerBookings);    // seller's incoming bookings`
- `router.post('/:id/book', protect, bookSlotRateLimit, bookSlot);`
- `router.post('/:id/rate', protect, rateInterview);`

### interviewSessionRoutes
- `router.get('/booking/:bookingId', protect, getSessionForBooking);`
- `router.get('/:sessionId', protect, getSessionById);`
- `router.post('/:sessionId/token', protect, joinTokenRateLimit, getJoinToken);`
- `router.post('/:sessionId/end', protect, endSession);`
- `router.post('/:sessionId/consent', protect, giveConsent);`
- `router.get('/:sessionId/recording', protect, getRecordingStream);`
- `router.post('/:sessionId/feedback', protect, submitFeedback);`

### jobApplicationRoutes
- `router.get('/upcoming', getUpcoming);`
- `router.get('/', getApplications);`
- `router.post('/', createApplication);`
- `router.get('/:id', getApplication);`
- `router.put('/:id', updateApplication);`
- `router.delete('/:id', deleteApplication);`
- `router.post('/:id/stages', addStage);`
- `router.put('/:id/stages/:stageId', updateStage);`
- `router.delete('/:id/stages/:stageId', deleteStage);`
- `router.post('/:id/notes', addPrepNote);`
- `router.post('/:id/documents', handleApplicationDocUpload, uploadDocument);`
- `router.delete('/:id/documents/additional/:docId', deleteDocument);`
- `router.delete('/:id/documents/:docType', deleteDocument);`
- `router.put('/:id/follow-up', setFollowUp);`

### knowledgeRoutes
- `router.get('/', optionalProtect, listArticles);`
- `router.get('/search', optionalProtect, searchArticles);`
- `router.get('/categories', getKnowledgeCategories);`
- `router.get('/tags', getPopularTags);`
- `router.get('/authors/:userId', optionalProtect, getAuthorArticles);`
- `router.get('/article/:slug', optionalProtect, getArticleBySlug);`
- `router.get('/my-articles', protect, getMyArticles);`
- `router.get('/my-bookmarks', protect, getMyBookmarks);`
- `router.post('/', protect, createArticle);`
- `router.put('/:id', protect, updateArticle);`
- `router.post('/:id/submit', protect, submitArticle);`
- `router.delete('/:id', protect, deleteArticle);`
- `router.post('/upload/cover', protect, handleKnowledgeCoverUpload, uploadCoverImage);`
- `router.post('/authors/:userId/follow', protect, toggleFollowAuthor);`
- `router.post('/:id/view', optionalProtect, recordView);`
- `router.post('/:id/like', protect, toggleLike);`
- `router.post('/:id/bookmark', protect, toggleBookmark);`
- `router.get('/:id/comments', optionalProtect, listComments);`
- `router.post('/:id/comments', protect, addComment);`
- `router.put('/:id/comments/:cid', protect, editComment);`
- `router.delete('/:id/comments/:cid', protect, deleteComment);`
- `router.post('/:id/comments/:cid/like', protect, toggleCommentLike);`
- `router.get('/admin/articles', protect, authorize(...ADMIN_ROLES), adminListArticles);`
- `router.get('/admin/stats', protect, authorize(...ADMIN_ROLES), adminGetStats);`
- `router.post('/admin/:id/approve', protect, authorize(...ADMIN_ROLES), adminApproveArticle);`
- `router.post('/admin/:id/reject', protect, authorize(...ADMIN_ROLES), adminRejectArticle);`
- `router.post('/admin/:id/feature', protect, authorize(...ADMIN_ROLES), adminToggleFeatured);`
- `router.post('/admin/:id/editors-pick', protect, authorize(...ADMIN_ROLES), adminToggleEditorsPick);`
- `router.delete('/admin/:id', protect, authorize(...ADMIN_ROLES), adminDeleteArticle);`

### livekitRoutes
- `router.post('/webhook', handleLiveKitWebhook);`

### paymentRoutes
- `router.post('/create-checkout-session', protect, checkoutRateLimit, createCheckoutSession);`
- `router.post('/webhook', webhook);`
- `router.get('/verify/:orderId', protect, verifyRateLimit, verifyPayment);`
- `router.get('/orders', protect, getMyOrders);`
- `router.get('/orders/:orderId', protect, getOrderDetails);`
- `router.get('/invoice/:orderId', protect, downloadInvoice);`
- `router.get('/subscription/status', protect, getSubscriptionStatus);`
- `router.post('/subscription/cancel', protect, cancelSubscription);`

### practiceTestRoutes
- `router.get('/', getPublicPracticeTests);`
- `router.get('/my-attempts/all', protect, getAllMyAttempts);`
- `router.get('/recommendations', getRecommendedPracticeTests);`
- `router.get('/mine', protect, authorize('seller', 'admin', 'super_admin'), getMyPracticeTests);`
- `router.post('/', protect, authorize('seller', 'admin', 'super_admin'), createPracticeTest);`
- `router.get('/:id', optionalProtect, getPracticeTest);`
- `router.put('/:id', protect, authorize('seller', 'admin', 'super_admin'), updatePracticeTest);`
- `router.delete('/:id', protect, authorize('seller', 'admin', 'super_admin'), deletePracticeTest);`
- `router.post('/:id/questions', protect, authorize('seller', 'admin', 'super_admin'), addQuestion);`
- `router.put('/:id/questions/reorder', protect, authorize('seller', 'admin', 'super_admin'), reorderQuestions);`
- `router.put('/:id/questions/:questionId', protect, authorize('seller', 'admin', 'super_admin'), updateQuestion);`
- `router.delete('/:id/questions/:questionId', protect, authorize('seller', 'admin', 'super_admin'), deleteQuestion);`
- `router.post('/:id/convert-to-sections', protect, authorize('seller', 'admin', 'super_admin'), convertToSections);`
- `router.post('/:id/sections', protect, authorize('seller', 'admin', 'super_admin'), addSection);`
- `router.put('/:id/sections/reorder', protect, authorize('seller', 'admin', 'super_admin'), reorderSections);`
- `router.put('/:id/sections/:sectionId', protect, authorize('seller', 'admin', 'super_admin'), updateSection);`
- `router.delete('/:id/sections/:sectionId', protect, authorize('seller', 'admin', 'super_admin'), deleteSection);`
- `router.post('/:id/sections/:sectionId/questions', protect, authorize('seller', 'admin', 'super_admin'), addQuestionRefToSection);`
- `router.delete('/:id/sections/:sectionId/questions/:refId', protect, authorize('seller', 'admin', 'super_admin'), removeQuestionRefFromSection);`
- `router.post('/:id/attempt/start', protect, startAttempt);`
- `router.get('/:id/attempt/:attemptId/resume', protect, resumeAttempt);`
- `router.post('/:id/attempt/:attemptId/submit', protect, submitAttempt);`
- `router.post('/:id/attempt/:attemptId/violation', protect, recordViolation);`
- `router.post('/:id/attempt/:attemptId/code/run', protect, runCode);`
- `router.post('/:id/attempt/:attemptId/code/submit', protect, submitCode);`
- `router.get('/:id/attempt/:attemptId/code/status/:jobId', protect, getCodeJobStatus);`
- `router.get('/:id/attempts/:attemptId', protect, getAttemptResult);`
- `router.get('/:id/my-attempts', protect, getMyAttempts);`

### questionBankRoutes
- `router.get('/mine', getMyQuestions);`
- `router.post('/bulk-import', bulkImportQuestions);`
- `router.post('/', createQuestion);`
- `router.get('/:id', getQuestionById);`
- `router.put('/:id', updateQuestion);`
- `router.delete('/:id', deleteQuestion);`
- `router.post('/:id/clone', cloneQuestion);`

### recordingStreamRoutes
- `router.get('/:sessionId', async (req, res) => {`

### rewardRoutes
- `router.get('/', getRewards);`
- `router.get('/me/redemptions', protect, getMyRedemptions);`
- `router.post('/:id/redeem', protect, redeemReward);`
- `router.get('/admin/redemptions', protect, authorize(...adminRoles), adminGetRedemptions);`
- `router.put('/admin/redemptions/:id', protect, authorize(...adminRoles), adminProcessRedemption);`
- `router.post('/', protect, authorize(...adminRoles), handleCompanyLogoUpload, adminCreateReward);`
- `router.put('/:id', protect, authorize(...adminRoles), handleCompanyLogoUpload, adminUpdateReward);`
- `router.delete('/:id', protect, authorize(...adminRoles), adminDeleteReward);`

### sellerRoutes
- `router.get('/me', protect, getMySellerProfile);`
- `router.put('/me', protect, authorize('seller', 'admin', 'super_admin'), updateMySellerProfile);`
- `router.get('/me/stats', protect, getMySellerStats);`
- `router.get('/me/course-earnings', protect, getSellerCourseEarnings);`
- `router.post('/me/withdraw', protect, authorize('seller', 'admin', 'super_admin'), requestWithdrawal);`
- `router.post('/me/verification', protect, authorize('seller', 'admin', 'super_admin'), handleVerificationDocUpload, submitVerificationDoc);`
- `router.post('/apply', protect, applySeller);`
- `router.get('/my-status', protect, getMyApplicationStatus);`
- `router.get('/', protect, authorize('admin', 'super_admin', 'moderator'), getSellers);`
- `router.get('/withdrawals', protect, authorize('admin', 'super_admin', 'finance_admin'), getWithdrawalRequests);`
- `router.put('/:id/status', protect, authorize('admin', 'super_admin'), updateSellerStatus);`
- `router.put('/:sellerId/withdrawals/:withdrawalId', protect, authorize('admin', 'super_admin', 'finance_admin'), processWithdrawal);`
- `router.post('/:id/wallet-adjust', protect, authorize('admin', 'super_admin'), adjustSellerWallet);`

### settingsRoutes
- `router.get('/public', getPublicSettings);`

### testSeriesRoutes
- `router.get('/', getPublicSeries);`
- `router.get('/mine', protect, authorize('seller', 'admin', 'super_admin'), getMySeries);`
- `router.get('/:id', optionalProtect, getSeriesById);`
- `router.post('/', protect, authorize('seller', 'admin', 'super_admin'), createSeries);`
- `router.put('/:id', protect, authorize('seller', 'admin', 'super_admin'), updateSeries);`
- `router.delete('/:id', protect, authorize('seller', 'admin', 'super_admin'), deleteSeries);`
- `router.post('/:id/tests', protect, authorize('seller', 'admin', 'super_admin'), addTestToSeries);`
- `router.delete('/:id/tests/:refId', protect, authorize('seller', 'admin', 'super_admin'), removeTestFromSeries);`
- `router.put('/:id/tests/reorder', protect, authorize('seller', 'admin', 'super_admin'), reorderSeriesTests);`

### userFeatureRoutes
- `router.post('/coupons/validate', protect, validateCoupon);`
- `router.delete('/feedback/:id', protect, deleteReview);          // Own or admin`
- `router.post('/feedback/:id/report', protect, reportReview);     // Any logged-in user`
- `router.post('/feedback', protect, submitFeedback);`
- `router.get('/notifications/me', protect, getMyNotifications);`
- `router.get('/notifications/unread', protect, getUnreadNotificationCount);`
- `router.delete('/notifications', protect, clearAllNotifications);`
- `router.delete('/notifications/:id', protect, dismissNotification);`

### userRoutes
- `router.put('/profile', protect, updateProfile);`
- `router.post('/profile/avatar', protect, uploadProfilePic);`
- `router.delete('/profile/avatar', protect, removeProfilePic);`

### webinarEngagementRoutes
- `router.post('/:sessionId/chat', protect, engagementRateLimit, postChatMessage);`
- `router.get('/:sessionId/chat', protect, getChatHistory);`
- `router.get('/:sessionId/questions', protect, getQuestions);`
- `router.post('/:sessionId/questions', protect, engagementRateLimit, askQuestion);`
- `router.post('/:sessionId/questions/:questionId/upvote', protect, engagementRateLimit, upvoteQuestion);`
- `router.get('/:sessionId/polls', protect, getPolls);`
- `router.post('/:sessionId/polls', protect, createPoll);`
- `router.post('/:sessionId/polls/:pollId/vote', protect, engagementRateLimit, votePoll);`
- `router.post('/:sessionId/reactions', protect, engagementRateLimit, sendReaction);`
- `router.post('/:sessionId/feedback', protect, submitFeedback);`

### webinarHostRoutes
- `router.post('/:sessionId/host/start', requireHostTier(HOST_TIER), startWebinar);`
- `router.post('/:sessionId/host/end', requireHostTier(HOST_TIER), endWebinar);`
- `router.post('/:sessionId/host/lock', requireHostTier(HOST_TIER), lockRoom);`
- `router.post('/:sessionId/host/unlock', requireHostTier(HOST_TIER), unlockRoom);`
- `router.get('/:sessionId/host/waiting-room', requireHostTier(MODERATION_TIER), listWaitingRoom);`
- `router.post('/:sessionId/host/waiting-room/admit', requireHostTier(MODERATION_TIER), admitParticipant);`
- `router.post('/:sessionId/host/waiting-room/deny', requireHostTier(MODERATION_TIER), denyParticipant);`
- `router.post('/:sessionId/host/remove', requireHostTier(MODERATION_TIER), removeParticipant);`
- `router.post('/:sessionId/host/mute', requireHostTier(MODERATION_TIER), muteParticipant);`
- `router.post('/:sessionId/host/unmute', requireHostTier(MODERATION_TIER), unmuteParticipant);`
- `router.post('/:sessionId/host/mute-all', requireHostTier(HOST_TIER), muteAll);`
- `router.post('/:sessionId/host/camera', requireHostTier(MODERATION_TIER), disableParticipantCam);`
- `router.post('/:sessionId/host/co-host', requireHostTier(HOST_TIER), assignCoHost);`
- `router.delete('/:sessionId/host/co-host', requireHostTier(HOST_TIER), removeCoHost);`
- `router.post('/:sessionId/host/moderator', requireHostTier(HOST_TIER), assignModerator);`
- `router.delete('/:sessionId/host/moderator', requireHostTier(HOST_TIER), removeModerator);`
- `router.post('/:sessionId/host/speaker', requireHostTier(HOST_TIER), promoteToSpeaker);`
- `router.delete('/:sessionId/host/speaker', requireHostTier(HOST_TIER), demoteFromSpeaker);`
- `router.post('/:sessionId/host/spotlight', requireHostTier(MODERATION_TIER), spotlightParticipant);`
- `router.post('/:sessionId/host/screen-share-permission', requireHostTier(HOST_TIER), setScreenSharePermission);`
- `router.get('/:sessionId/host/roster', requireHostTier(MODERATION_TIER), getRosterSearch);`
- `router.get('/:sessionId/host/stats', requireHostTier(MODERATION_TIER), getLiveStats);`

### webinarRoutes
- `router.get('/', optionalProtect, getWebinars);`
- `router.get('/:id', optionalProtect, getWebinar);`
- `router.get('/my-registrations', protect, getMyRegistrations);`
- `router.post('/:id/register', protect, registerForWebinar);`
- `router.delete('/:id/register', protect, unregisterFromWebinar);`
- `router.get('/seller/mine', protect, authorize(...sellerRoles), getMyWebinars);`
- `router.get('/:id/attendees', protect, authorize(...sellerRoles), getAttendees);`
- `router.post('/', protect, authorize(...sellerRoles), createWebinar);`
- `router.post('/:id/duplicate', protect, authorize(...sellerRoles), duplicateWebinar);`
- `router.put('/:id', protect, authorize(...sellerRoles), updateWebinar);`
- `router.delete('/:id', protect, authorize(...sellerRoles), deleteWebinar);`
- `router.post('/:id/resources', protect, authorize(...sellerRoles), handleWebinarResourceUpload, addResource);`
- `router.delete('/:id/resources/:resourceId', protect, authorize(...sellerRoles), removeResource);`
- `router.get('/:webinarId/feedback-summary', protect, authorize(...sellerRoles), getWebinarFeedbackSummary);`
- `router.get('/:id/analytics', protect, authorize(...sellerRoles), getSellerWebinarAnalytics);`

### webinarSessionRoutes
- `router.get('/webinar/:webinarId', protect, getSessionForWebinar);`
- `router.post('/:sessionId/admission', protect, joinTokenRateLimit, requestAdmission);`
- `router.post('/:sessionId/token', protect, joinTokenRateLimit, requestJoinToken);`

