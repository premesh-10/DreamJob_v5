import PracticeTest from '../models/PracticeTest.js';
import PracticeTestAttempt from '../models/PracticeTestAttempt.js';

// @desc    List completed attempts with pending Subjective answers, for the seller's own tests
// @route   GET /api/v1/grading/pending
// @access  Private/Seller
export const getPendingSubjectiveGrading = async (req, res, next) => {
    try {
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        const testFilter = isAdmin ? {} : { seller: req.user.id };
        const myTests = await PracticeTest.find(testFilter).select('_id title subject');
        const testMap = Object.fromEntries(myTests.map(t => [t._id.toString(), t]));

        const attempts = await PracticeTestAttempt.find({
            practiceTest: { $in: myTests.map(t => t._id) },
            status: 'completed',
            'answers.pendingManualGrading': true
        })
            .populate('user', 'name email')
            .sort({ completedAt: -1 });

        const items = [];
        for (const attempt of attempts) {
            const test = testMap[attempt.practiceTest.toString()];
            for (const ans of attempt.answers) {
                if (!ans.pendingManualGrading) continue;
                items.push({
                    attemptId: attempt._id,
                    questionId: ans.questionId,
                    test: { _id: test?._id, title: test?.title },
                    user: attempt.user,
                    questionText: ans.questionText,
                    subjectiveAnswerText: ans.subjectiveAnswerText,
                    marksAvailable: ans.marksAvailable,
                    completedAt: attempt.completedAt
                });
            }
        }

        res.status(200).json({ success: true, count: items.length, data: items });
    } catch (error) {
        next(error);
    }
};

// @desc    Manually grade one Subjective answer within a completed attempt
// @route   PATCH /api/v1/grading/attempts/:attemptId/questions/:questionId
// @access  Private/Seller
export const gradeSubjectiveAnswer = async (req, res, next) => {
    try {
        const { marksAwarded, feedback } = req.body;
        const attempt = await PracticeTestAttempt.findById(req.params.attemptId);
        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

        const test = await PracticeTest.findById(attempt.practiceTest);
        if (!test) return res.status(404).json({ message: 'Test not found' });

        const isOwner = test.seller.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

        const ans = attempt.answers.find(a => a.questionId.toString() === req.params.questionId);
        if (!ans) return res.status(404).json({ message: 'Answer not found' });
        if (!ans.pendingManualGrading) return res.status(400).json({ message: 'This answer is not pending grading' });

        const awarded = Math.max(0, Math.min(Number(marksAwarded) || 0, ans.marksAvailable));
        const delta = awarded - ans.marksAwarded;
        ans.marksAwarded = awarded;
        ans.isCorrect = awarded > 0;
        ans.pendingManualGrading = false;
        ans.gradingFeedback = feedback || '';

        attempt.score = Math.max(0, attempt.score + delta);
        attempt.percentage = attempt.totalMarks > 0 ? Math.round((attempt.score / attempt.totalMarks) * 100) : 0;
        attempt.passed = attempt.percentage >= test.passingScore;
        await attempt.save();

        res.status(200).json({ success: true, data: attempt });
    } catch (error) {
        next(error);
    }
};
