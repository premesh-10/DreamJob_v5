import User from '../models/User.js';
import PointsTransaction from '../models/PointsTransaction.js';

// ── Points awarded for community activity ──────────────────────────────────────
export const POINTS_RULES = {
    experience_submitted: 50,
    experience_liked: 5,          // awarded to the experience author per like received
    experience_featured: 100,     // bonus when an admin features an experience
    experience_removed_penalty: -20, // deterrent when a report leads to content removal
    comment_posted: 5,
    comment_liked: 2,             // awarded to the comment author per like received

    // ── Practice Tests / coding challenges ─────────────────────────────────
    practice_test_completed: 10,  // first completion of a given test only — see practiceTestController's finalizeAttempt
    practice_test_passed: 20,     // first passing attempt on a given test
    practice_test_perfect_score: 50, // first 100% attempt on a given test
    coding_challenge_solved: 15,  // first all-tests-passed code/submit on a given question
    badge_earned: 25,

    // ── Knowledge Hub articles ──────────────────────────────────────────
    article_published: 75,           // awarded once when an article is approved and published
    article_liked: 3,                // awarded to the article author per like received
    article_featured: 150,           // bonus when an admin features an article
    article_editors_pick: 200,       // bonus when admin marks as editor's pick
    article_removed_penalty: -30,    // deterrent when content is removed after moderation review
};

// ── Level progression thresholds (cumulative contributionPoints) ──────────────
export const LEVELS = [
    { name: 'Explorer', minPoints: 0 },
    { name: 'Trailblazer', minPoints: 100 },
    { name: 'Achiever', minPoints: 300 },
    { name: 'Expert', minPoints: 700 },
    { name: 'Master', minPoints: 1500 },
    { name: 'Legend', minPoints: 3000 },
    { name: 'Guru', minPoints: 6000 },
];

export function getLevelForPoints(points) {
    let current = LEVELS[0];
    for (const level of LEVELS) {
        if (points >= level.minPoints) current = level;
        else break;
    }
    return current.name;
}

export function getLevelProgress(points) {
    const idx = LEVELS.findIndex(l => l.name === getLevelForPoints(points));
    const current = LEVELS[idx];
    const next = LEVELS[idx + 1] || null;
    return {
        level: current.name,
        points,
        nextLevel: next?.name || null,
        pointsToNextLevel: next ? Math.max(0, next.minPoints - points) : 0,
        progressPercent: next
            ? Math.min(100, Math.round(((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100))
            : 100,
    };
}

/**
 * awardPoints — the single entry point for crediting/debiting a user's contribution
 * points. Always logs a PointsTransaction (audit trail) and keeps User.hubLevel in
 * sync so the level badge never drifts from the underlying point total.
 *
 * @param {string} userId
 * @param {number} points          positive to award, negative to deduct/penalize
 * @param {string} reason          one of the PointsTransaction.reason enum values
 * @param {object} [opts]
 * @param {string} [opts.refType]
 * @param {string} [opts.refId]
 * @param {string} [opts.description]
 */
export async function awardPoints(userId, points, reason, opts = {}) {
    if (!points) return null;

    const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { contributionPoints: points } },
        { new: true }
    );
    if (!user) return null;

    // Never let penalties/redemptions drag the displayed total below zero.
    if (user.contributionPoints < 0) {
        user.contributionPoints = 0;
    }
    user.hubLevel = getLevelForPoints(user.contributionPoints);
    await user.save();

    await PointsTransaction.create({
        user: userId,
        points,
        reason,
        refType: opts.refType || null,
        refId: opts.refId || null,
        description: opts.description || '',
    });

    return user;
}
