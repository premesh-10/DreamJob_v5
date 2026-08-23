import Badge from '../models/Badge.js';
import UserBadge from '../models/UserBadge.js';
import PracticeTestAttempt from '../models/PracticeTestAttempt.js';
import { awardPoints, POINTS_RULES } from '../utils/gamification.js';

// Streak length in days ending today or yesterday (a streak "survives" one
// day of no activity being checked-on, but breaks once a full day is missed).
async function computeCurrentStreakDays(userId) {
    const attempts = await PracticeTestAttempt.find({ user: userId, status: 'completed' }).select('completedAt').sort({ completedAt: -1 });
    if (attempts.length === 0) return 0;

    const days = [...new Set(attempts.map(a => new Date(a.completedAt).toDateString()))]
        .map(d => new Date(d).getTime())
        .sort((a, b) => b - a);

    const oneDay = 24 * 60 * 60 * 1000;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (today.getTime() - days[0] > oneDay) return 0; // most recent activity older than yesterday — streak broken

    let streak = 1;
    for (let i = 1; i < days.length; i++) {
        if (days[i - 1] - days[i] === oneDay) streak++;
        else break;
    }
    return streak;
}

async function criteriaMatches(badge, userId, test, attempt) {
    const { type, value, category } = badge.criteria;

    if (type === 'score_threshold') {
        if (category && test.subject !== category && test.assessmentCategory !== category) return false;
        return attempt.percentage >= value;
    }

    if (type === 'attempt_count') {
        const count = await PracticeTestAttempt.countDocuments({ user: userId, status: 'completed' });
        return count >= value;
    }

    if (type === 'streak') {
        const streak = await computeCurrentStreakDays(userId);
        return streak >= value;
    }

    if (type === 'category_mastery') {
        return (test.subject === category || test.assessmentCategory === category) && attempt.percentage >= value;
    }

    return false;
}

// Checks every active badge against the just-completed attempt and awards
// any newly-earned ones (UserBadge has a unique user+badge index, so this is
// safe to call on every completion without double-awarding). Returns the
// list of newly awarded badges so the caller can surface them to the student.
export async function checkAndAwardBadges(userId, { test, attempt }) {
    const badges = await Badge.find({ isActive: true });
    if (badges.length === 0) return [];

    const alreadyEarnedIds = new Set(
        (await UserBadge.find({ user: userId, badge: { $in: badges.map(b => b._id) } }).select('badge'))
            .map(ub => ub.badge.toString())
    );

    const newlyAwarded = [];
    for (const badge of badges) {
        if (alreadyEarnedIds.has(badge._id.toString())) continue;
        if (!await criteriaMatches(badge, userId, test, attempt)) continue;

        try {
            await UserBadge.create({ user: userId, badge: badge._id, refType: 'PracticeTestAttempt', refId: attempt._id });
            await awardPoints(userId, POINTS_RULES.badge_earned, 'badge_earned', { refType: 'badge', refId: badge._id, description: `Earned badge: ${badge.name}` });
            newlyAwarded.push({ _id: badge._id, name: badge.name, description: badge.description, iconUrl: badge.iconUrl });
        } catch (err) {
            if (err.code !== 11000) throw err; // ignore races on the unique index, surface anything else
        }
    }

    return newlyAwarded;
}
