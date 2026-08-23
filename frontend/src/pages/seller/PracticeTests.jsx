import { useState, useEffect } from 'react';
import api from '../../lib/api';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Programming', 'Web Development', 'Data Science', 'Machine Learning', 'English', 'Aptitude', 'Reasoning', 'Logical Reasoning', 'Verbal Ability', 'Case Study', 'General Knowledge', 'Finance', 'Marketing', 'Other'];

export const QUESTION_TYPES = ['MCQ', 'MSQ', 'TrueFalse', 'FillBlank', 'Subjective', 'Coding', 'SQL', 'Debugging', 'OutputBased'];
export const QUESTION_TYPE_LABELS = {
    MCQ: 'MCQ (Single Correct)',
    MSQ: 'MSQ (Multiple Correct)',
    TrueFalse: 'True / False',
    FillBlank: 'Fill in the Blank',
    Subjective: 'Subjective',
    Coding: 'Coding (Judge0 execution)',
    SQL: 'SQL (query against a seeded schema)',
    Debugging: 'Debugging (fix the code, Judge0 execution)',
    OutputBased: 'Output-Based (predict the output, Judge0 execution)'
};

export const ASSESSMENT_CATEGORIES = ['Topic-wise', 'Company-wise', 'Role-wise', 'Skill-wise', 'Difficulty-wise', 'Full-length Mock', 'Company-Specific Pattern'];

// ── Test Settings Modal ────────────────────────────────────────────────────────
function TestModal({ test, onClose, onSave, courses, companies }) {
    const [form, setForm] = useState({
        title: test?.title || '',
        subject: test?.subject || '',
        description: test?.description || '',
        courseId: test?.course?._id || test?.course || '',
        tags: (test?.tags || []).join(', '),
        timeLimit: test?.timeLimit ?? 0,
        hasPerQuestionTimer: test?.hasPerQuestionTimer ?? false,
        maxAttempts: test?.maxAttempts ?? 0,
        passingScore: test?.passingScore ?? 60,
        shuffleQuestions: test?.shuffleQuestions ?? false,
        shuffleOptions: test?.shuffleOptions ?? false,
        showResultsImmediately: test?.showResultsImmediately ?? true,
        assessmentCategory: test?.assessmentCategory || 'Topic-wise',
        companyId: test?.company?._id || test?.company || '',
        targetRole: test?.targetRole || '',
        negativeMarkingEnabled: test?.negativeMarking?.enabled ?? false,
        negativeMarkingPerWrong: test?.negativeMarking?.perWrongAnswer ?? 0,
        isFree: test?.pricing?.isFree ?? true,
        price: test?.pricing?.price ?? 0,
        availableFrom: test?.schedule?.availableFrom ? test.schedule.availableFrom.slice(0, 10) : '',
        availableUntil: test?.schedule?.availableUntil ? test.schedule.availableUntil.slice(0, 10) : '',
        allowResume: test?.allowResume ?? true,
        allowCalculator: test?.allowCalculator ?? false,
        allowTabSwitch: test?.security?.allowTabSwitch ?? true,
        maxTabSwitches: test?.security?.maxTabSwitches ?? 0,
        onLimitExceeded: test?.security?.onLimitExceeded || 'warn_only',
        requireFullscreen: test?.security?.requireFullscreen ?? false,
        disableCopyPaste: test?.security?.disableCopyPaste ?? false,
        disableRightClick: test?.security?.disableRightClick ?? false,
        disableTextSelection: test?.security?.disableTextSelection ?? false,
        proctoringEnabled: test?.security?.proctoringEnabled ?? false,
        proctoringDisclosureText: test?.security?.proctoringDisclosureText || '',
        revealAnswersInReport: test?.security?.revealAnswersInReport ?? false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isEdit = !!test?._id;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };

    const buildPayload = () => ({
        ...form,
        company: form.companyId || null,
        negativeMarking: { enabled: form.negativeMarkingEnabled, perWrongAnswer: Number(form.negativeMarkingPerWrong) || 0 },
        pricing: { isFree: form.isFree, price: form.isFree ? 0 : Number(form.price) || 0 },
        schedule: { availableFrom: form.availableFrom || null, availableUntil: form.availableUntil || null },
        security: {
            allowTabSwitch: form.allowTabSwitch,
            maxTabSwitches: Number(form.maxTabSwitches) || 0,
            onLimitExceeded: form.onLimitExceeded,
            requireFullscreen: form.requireFullscreen,
            disableCopyPaste: form.disableCopyPaste,
            disableRightClick: form.disableRightClick,
            disableTextSelection: form.disableTextSelection,
            proctoringEnabled: form.proctoringEnabled,
            proctoringDisclosureText: form.proctoringDisclosureText,
            revealAnswersInReport: form.revealAnswersInReport
        }
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            let savedTest;
            const payload = buildPayload();
            if (isEdit) {
                const { data } = await api.put(`/practice-tests/${test._id}`, payload);
                savedTest = data.data;
            } else {
                const { data } = await api.post('/practice-tests', payload);
                savedTest = data.data;
            }
            onSave(savedTest); onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to save');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-900">{isEdit ? '✏️ Edit Practice Test' : '🆕 Create Practice Test'}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                </div>
                {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Test Title *</label>
                            <input name="title" value={form.title} onChange={handleChange} required
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none"
                                placeholder="e.g. Python Fundamentals Quiz" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subject *</label>
                            <select name="subject" value={form.subject} onChange={handleChange} required
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none">
                                <option value="">Select subject</option>
                                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Link to Course <span className="text-slate-400 font-normal">(optional)</span></label>
                            <select name="courseId" value={form.courseId} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none">
                                <option value="">Standalone (no course)</option>
                                {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                            <textarea name="description" value={form.description} onChange={handleChange} rows={2}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                                placeholder="What is this test about?" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tags <span className="text-slate-400 font-normal">(comma-separated)</span></label>
                            <input name="tags" value={form.tags} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none"
                                placeholder="python, beginner, loops" />
                        </div>
                    </div>

                    {/* Classification */}
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 space-y-4">
                        <h3 className="font-semibold text-indigo-900 text-sm">🏷️ Assessment Classification</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
                                <select name="assessmentCategory" value={form.assessmentCategory} onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none">
                                    {ASSESSMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company <span className="text-slate-400 font-normal">(optional)</span></label>
                                <select name="companyId" value={form.companyId} onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none">
                                    <option value="">None</option>
                                    {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Role <span className="text-slate-400 font-normal">(optional)</span></label>
                                <input name="targetRole" value={form.targetRole} onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. SDE-1" />
                            </div>
                        </div>
                    </div>

                    {/* Timer Settings */}
                    <div className="bg-violet-50 rounded-xl p-4 border border-violet-100 space-y-4">
                        <h3 className="font-semibold text-violet-900 text-sm">⏱️ Timer Settings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Overall Time Limit <span className="text-slate-400 font-normal">(minutes, 0 = no limit)</span></label>
                                <input type="number" name="timeLimit" value={form.timeLimit} onChange={handleChange} min="0"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none"
                                    placeholder="0 = unlimited" />
                            </div>
                            <div className="flex items-center gap-3 pt-6">
                                <input type="checkbox" id="hasPerQ" name="hasPerQuestionTimer" checked={form.hasPerQuestionTimer} onChange={handleChange} className="w-4 h-4 accent-violet-600" />
                                <label htmlFor="hasPerQ" className="text-sm font-medium text-slate-700">Enable per-question timers</label>
                            </div>
                        </div>
                    </div>

                    {/* Attempt & Scoring */}
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 space-y-4">
                        <h3 className="font-semibold text-emerald-900 text-sm">🎯 Attempts & Scoring</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Max Attempts <span className="text-slate-400 font-normal">(0 = unlimited)</span></label>
                                <input type="number" name="maxAttempts" value={form.maxAttempts} onChange={handleChange} min="0"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Passing Score (%)</label>
                                <input type="number" name="passingScore" value={form.passingScore} onChange={handleChange} min="0" max="100"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-5">
                            {[
                                ['shuffleQuestions', 'Shuffle Questions'],
                                ['shuffleOptions', 'Shuffle Options'],
                                ['showResultsImmediately', 'Show Results Immediately'],
                                ['allowResume', 'Allow Resume on Refresh'],
                                ['allowCalculator', 'Allow On-Screen Calculator'],
                            ].map(([name, label]) => (
                                <label key={name} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name={name} checked={form[name]} onChange={handleChange} className="w-4 h-4 accent-emerald-600" />
                                    <span className="text-sm font-medium text-slate-700">{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Negative Marking */}
                    <div className="bg-rose-50 rounded-xl p-4 border border-rose-100 space-y-4">
                        <h3 className="font-semibold text-rose-900 text-sm">➖ Negative Marking</h3>
                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="negEnabled" name="negativeMarkingEnabled" checked={form.negativeMarkingEnabled} onChange={handleChange} className="w-4 h-4 accent-rose-600" />
                            <label htmlFor="negEnabled" className="text-sm font-medium text-slate-700">Deduct marks for wrong answers</label>
                        </div>
                        {form.negativeMarkingEnabled && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Marks deducted per wrong answer</label>
                                <input type="number" name="negativeMarkingPerWrong" value={form.negativeMarkingPerWrong} onChange={handleChange} min="0" step="0.25"
                                    className="w-full md:w-1/2 px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 outline-none" />
                            </div>
                        )}
                    </div>

                    {/* Pricing & Schedule */}
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 space-y-4">
                        <h3 className="font-semibold text-amber-900 text-sm">💰 Pricing &amp; Schedule</h3>
                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="isFree" name="isFree" checked={form.isFree} onChange={handleChange} className="w-4 h-4 accent-amber-600" />
                            <label htmlFor="isFree" className="text-sm font-medium text-slate-700">Free for all students</label>
                        </div>
                        {!form.isFree && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Price (₹)</label>
                                <input type="number" name="price" value={form.price} onChange={handleChange} min="0"
                                    className="w-full md:w-1/2 px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none" />
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Available From <span className="text-slate-400 font-normal">(optional)</span></label>
                                <input type="date" name="availableFrom" value={form.availableFrom} onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Available Until <span className="text-slate-400 font-normal">(optional)</span></label>
                                <input type="date" name="availableUntil" value={form.availableUntil} onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Security & Proctoring */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
                        <h3 className="font-semibold text-slate-900 text-sm">🔒 Security &amp; Proctoring</h3>

                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="allowTabSwitch" name="allowTabSwitch" checked={form.allowTabSwitch} onChange={handleChange} className="w-4 h-4 accent-slate-600" />
                            <label htmlFor="allowTabSwitch" className="text-sm font-medium text-slate-700">Allow tab switching</label>
                        </div>
                        {!form.allowTabSwitch && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Max tab switches allowed <span className="text-slate-400 font-normal">(0 = none allowed)</span></label>
                                    <input type="number" name="maxTabSwitches" value={form.maxTabSwitches} onChange={handleChange} min="0"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">When limit exceeded</label>
                                    <select name="onLimitExceeded" value={form.onLimitExceeded} onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-500 outline-none">
                                        <option value="warn_only">Warn only</option>
                                        <option value="auto_submit">Auto-submit the test</option>
                                        <option value="terminate">Terminate the attempt</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <input type="checkbox" id="requireFullscreen" name="requireFullscreen" checked={form.requireFullscreen} onChange={handleChange} className="w-4 h-4 accent-slate-600" />
                            <label htmlFor="requireFullscreen" className="text-sm font-medium text-slate-700">Require fullscreen mode</label>
                        </div>

                        <div className="flex flex-wrap gap-5">
                            {[
                                ['disableCopyPaste', 'Restrict copy / cut / paste'],
                                ['disableRightClick', 'Disable right-click'],
                                ['disableTextSelection', 'Disable text selection'],
                            ].map(([name, label]) => (
                                <label key={name} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name={name} checked={form[name]} onChange={handleChange} className="w-4 h-4 accent-slate-600" />
                                    <span className="text-sm font-medium text-slate-700">{label}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 -mt-2">
                            These restrict in-browser actions only (real, enforceable DOM events). They cannot block OS-level screenshots, external screen recording, or devtools opened in ways that bypass keyboard shortcuts — no platform can guarantee that from a web page.
                        </p>

                        <div className="border-t border-slate-200 pt-3 space-y-3">
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="proctoringEnabled" name="proctoringEnabled" checked={form.proctoringEnabled} onChange={handleChange} className="w-4 h-4 accent-slate-600" />
                                <label htmlFor="proctoringEnabled" className="text-sm font-medium text-slate-700">Enable Proctoring Mode</label>
                            </div>
                            <p className="text-xs text-slate-500">
                                Logs browser focus loss, fullscreen exits, and a best-effort devtools heuristic (window-size based — not reliable for undocked devtools or all browsers). This is monitoring and logging only, disclosed to students before they start — it is not a guarantee that cheating is prevented or detected in every case.
                            </p>
                            {form.proctoringEnabled && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Disclosure text shown to students <span className="text-slate-400 font-normal">(optional, shown before they start)</span></label>
                                    <textarea name="proctoringDisclosureText" value={form.proctoringDisclosureText} onChange={handleChange} rows={2}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-500 outline-none resize-none"
                                        placeholder="e.g. This test logs tab-switch and fullscreen activity for academic integrity purposes." />
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-200 pt-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="revealAnswersInReport" checked={form.revealAnswersInReport} onChange={handleChange} className="w-4 h-4 accent-slate-600" />
                                <span className="text-sm font-medium text-slate-700">Reveal questions &amp; correct answers in downloadable reports</span>
                            </label>
                            <p className="text-xs text-slate-500 mt-1">Off by default — reports show scores and analysis only, never the actual questions or answers, unless you turn this on.</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-60">
                            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Test'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Question Builder ───────────────────────────────────────────────────────────
function QuestionForm({ onSave, onCancel, initial }) {
    const MAX_OPTIONS = 5;
    const [qType, setQType] = useState(initial?.type || 'MCQ');
    const [questionText, setQuestionText] = useState(initial?.questionText || '');
    const [options, setOptions] = useState(
        initial?.options?.length ? initial.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })) :
        [{ text: '', isCorrect: false }, { text: '', isCorrect: false }]
    );
    const [timeLimit, setTimeLimit] = useState(initial?.timeLimit ?? 0);
    const [marks, setMarks] = useState(initial?.marks ?? 1);
    const [explanation, setExplanation] = useState(initial?.explanation || '');
    const [error, setError] = useState('');

    const addOption = () => {
        if (options.length >= MAX_OPTIONS) return;
        setOptions(p => [...p, { text: '', isCorrect: false }]);
    };

    const removeOption = (idx) => {
        if (options.length <= 2) return;
        setOptions(p => p.filter((_, i) => i !== idx));
    };

    const updateOption = (idx, field, value) => {
        setOptions(p => p.map((o, i) => {
            if (i !== idx) {
                // For MCQ, deselect others when selecting this one
                if (field === 'isCorrect' && value && qType === 'MCQ') return { ...o, isCorrect: false };
                return o;
            }
            return { ...o, [field]: value };
        }));
    };

    const handleSave = () => {
        setError('');
        if (!questionText.trim()) return setError('Question text is required');
        if (options.some(o => !o.text.trim())) return setError('All options must have text');
        const correctCount = options.filter(o => o.isCorrect).length;
        if (qType === 'MCQ' && correctCount !== 1) return setError('MCQ must have exactly 1 correct option');
        if (qType === 'MSQ' && correctCount < 2) return setError('MSQ must have at least 2 correct options');

        onSave({ questionText, type: qType, options, timeLimit: Number(timeLimit), marks: Number(marks), explanation });
    };

    return (
        <div className="bg-white border-2 border-violet-200 rounded-2xl p-5 space-y-4 shadow-sm">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

            {/* Type selector */}
            <div className="flex gap-3">
                {['MCQ', 'MSQ'].map(type => (
                    <button key={type} type="button" onClick={() => setQType(type)}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition ${qType === type ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
                        {type === 'MCQ' ? '🔘 MCQ' : '☑️ MSQ'}
                        <span className="ml-1 text-xs font-normal opacity-70">{type === 'MCQ' ? '(single answer)' : '(multi-select)'}</span>
                    </button>
                ))}
            </div>

            {/* Question text */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Question *</label>
                <textarea value={questionText} onChange={e => setQuestionText(e.target.value)} rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none resize-none text-sm"
                    placeholder="Enter your question here..." />
            </div>

            {/* Options */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-700">
                        Options * <span className="text-slate-400 font-normal text-xs">({qType === 'MCQ' ? 'Select 1 correct' : 'Select 2+ correct'})</span>
                    </label>
                    {options.length < MAX_OPTIONS && (
                        <button type="button" onClick={addOption}
                            className="text-xs text-violet-600 font-semibold hover:text-violet-700 flex items-center gap-1">
                            + Add Option
                        </button>
                    )}
                </div>
                <div className="space-y-2">
                    {options.map((opt, idx) => (
                        <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border transition ${opt.isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                            {/* Correct toggle */}
                            <button type="button"
                                onClick={() => updateOption(idx, 'isCorrect', !opt.isCorrect)}
                                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${opt.isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}>
                                {opt.isCorrect ? <span className="text-xs">✓</span> : null}
                            </button>
                            <span className="text-xs font-bold text-slate-500 w-5 flex-shrink-0">{String.fromCharCode(65 + idx)}</span>
                            <input value={opt.text} onChange={e => updateOption(idx, 'text', e.target.value)}
                                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
                                placeholder={`Option ${String.fromCharCode(65 + idx)}`} />
                            {options.length > 2 && (
                                <button type="button" onClick={() => removeOption(idx)}
                                    className="text-slate-400 hover:text-red-500 flex-shrink-0 text-lg leading-none">×</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Settings row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Per-Q Timer (sec, 0=none)</label>
                    <input type="number" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} min="0"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Marks</label>
                    <input type="number" value={marks} onChange={e => setMarks(e.target.value)} min="0.5" step="0.5"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div></div>
            </div>

            {/* Explanation */}
            <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Explanation <span className="text-slate-400 font-normal">(shown after answering)</span></label>
                <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                    placeholder="Explain why this answer is correct..." />
            </div>

            <div className="flex gap-2 pt-1">
                <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200">Cancel</button>
                <button type="button" onClick={handleSave} className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:shadow-md transition">
                    Save Question
                </button>
            </div>
        </div>
    );
}

// ── Question Picker (search the seller's Question Bank, click to attach) ───────
function QuestionPickerModal({ questions, onPick, onClose }) {
    const [search, setSearch] = useState('');
    const filtered = questions.filter(q => q.questionText.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Add Question from Bank</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                </div>
                <div className="p-4 border-b border-slate-100">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your question bank..."
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filtered.length === 0 && (
                        <p className="text-center text-slate-400 text-sm py-8">
                            {questions.length === 0 ? 'Your question bank is empty — add questions from the Question Bank page first.' : 'No matching questions'}
                        </p>
                    )}
                    {filtered.map(q => (
                        <div key={q._id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-violet-300 transition">
                            <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 mr-2">{q.type}</span>
                                <span className="text-sm text-slate-700">{q.questionText}</span>
                            </div>
                            <button onClick={() => onPick(q._id)}
                                className="flex-shrink-0 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-700">
                                Add
                            </button>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-100">
                    <button onClick={onClose} className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200">Done</button>
                </div>
            </div>
        </div>
    );
}

// ── Sections Manager (question-bank-backed authoring) ──────────────────────────
function SectionsManager({ test, questionBank, onUpdate }) {
    const [addingSection, setAddingSection] = useState(false);
    const [newSectionName, setNewSectionName] = useState('');
    const [newSectionTime, setNewSectionTime] = useState(0);
    const [pickerSectionId, setPickerSectionId] = useState(null);

    const qMap = Object.fromEntries(questionBank.map(q => [q._id, q]));

    const handleAddSection = async () => {
        if (!newSectionName.trim()) return;
        await api.post(`/practice-tests/${test._id}/sections`, { name: newSectionName, timeLimit: Number(newSectionTime) || 0 });
        setNewSectionName(''); setNewSectionTime(0); setAddingSection(false);
        onUpdate();
    };

    const handleDeleteSection = async (sectionId) => {
        if (!window.confirm('Delete this section and all its question references?')) return;
        await api.delete(`/practice-tests/${test._id}/sections/${sectionId}`);
        onUpdate();
    };

    const handleAddQuestionRef = async (sectionId, questionBankId) => {
        await api.post(`/practice-tests/${test._id}/sections/${sectionId}/questions`, { questionBankId });
        onUpdate();
    };

    const handleRemoveQuestionRef = async (sectionId, refId) => {
        await api.delete(`/practice-tests/${test._id}/sections/${sectionId}/questions/${refId}`);
        onUpdate();
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-slate-800">Sections</h3>
                <button onClick={() => setAddingSection(true)} className="text-sm text-violet-600 font-semibold hover:text-violet-700">+ Add Section</button>
            </div>

            {addingSection && (
                <div className="bg-white border-2 border-violet-200 rounded-xl p-4 space-y-3">
                    <input value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Section name (e.g. Quantitative Aptitude)"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
                    <input type="number" value={newSectionTime} onChange={e => setNewSectionTime(e.target.value)} min="0" placeholder="Section time limit (minutes, 0 = none)"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
                    <div className="flex gap-2">
                        <button onClick={() => setAddingSection(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200">Cancel</button>
                        <button onClick={handleAddSection} className="flex-1 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">Add Section</button>
                    </div>
                </div>
            )}

            {test.sections.length === 0 && !addingSection && (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-4xl mb-2">🗂️</p>
                    <p className="text-slate-600 font-semibold">No sections yet</p>
                    <p className="text-slate-400 text-sm mt-1">Add a section, then attach questions from your Question Bank.</p>
                </div>
            )}

            {test.sections.map(section => (
                <div key={section._id} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{section.name}</p>
                            <p className="text-xs text-slate-400">
                                {section.timeLimit > 0 ? `${section.timeLimit} min` : 'No section timer'} • {section.questionRefs.length} question{section.questionRefs.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => setPickerSectionId(section._id)}
                                className="text-xs px-2.5 py-1.5 bg-violet-50 border border-violet-200 text-violet-600 rounded-lg font-medium hover:bg-violet-100">
                                + Add Question
                            </button>
                            <button onClick={() => handleDeleteSection(section._id)}
                                className="text-xs px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-500 rounded-lg font-medium hover:bg-red-100">
                                Delete
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        {section.questionRefs.map(ref => {
                            const q = qMap[ref.questionBank];
                            return (
                                <div key={ref._id} className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                                    <div className="flex-1 min-w-0 truncate">
                                        <span className="font-bold text-blue-700 mr-1.5">{q?.type || '?'}</span>
                                        <span className="text-slate-700">{q?.questionText || '(question not found)'}</span>
                                    </div>
                                    <button onClick={() => handleRemoveQuestionRef(section._id, ref._id)} className="text-slate-400 hover:text-red-500 flex-shrink-0 text-base leading-none">×</button>
                                </div>
                            );
                        })}
                        {section.questionRefs.length === 0 && <p className="text-xs text-slate-400 italic px-1">No questions added yet</p>}
                    </div>
                </div>
            ))}

            {pickerSectionId && (
                <QuestionPickerModal
                    questions={questionBank}
                    onPick={(qId) => handleAddQuestionRef(pickerSectionId, qId)}
                    onClose={() => setPickerSectionId(null)}
                />
            )}
        </div>
    );
}

// ── Test Detail Drawer ─────────────────────────────────────────────────────────
function TestDrawer({ test: initialTest, onClose, onUpdate }) {
    const [test, setTest] = useState(initialTest);
    const [addingQ, setAddingQ] = useState(false);
    const [editingQ, setEditingQ] = useState(null);
    const [publishing, setPublishing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [questionBank, setQuestionBank] = useState([]);

    const fetchTest = async () => {
        const { data } = await api.get(`/practice-tests/${test._id}`);
        setTest(data.data);
        onUpdate();
    };

    useEffect(() => {
        api.get('/question-bank/mine').then(({ data }) => setQuestionBank(data.data || [])).catch(() => {});
    }, []);

    const handleSwitchToSections = async () => {
        try {
            if (test.questions?.length > 0) {
                await api.post(`/practice-tests/${test._id}/convert-to-sections`);
            } else {
                await api.post(`/practice-tests/${test._id}/sections`, { name: 'Section 1' });
            }
            await fetchTest();
        } catch (err) { alert(err?.response?.data?.message || 'Failed to switch to sections'); }
    };

    const handleSaveQuestion = async (qData) => {
        setLoading(true);
        try {
            await api.post(`/practice-tests/${test._id}/questions`, qData);
            setAddingQ(false);
            await fetchTest();
        } catch (err) { alert(err?.response?.data?.message || 'Failed to save question'); }
        finally { setLoading(false); }
    };

    const handleUpdateQuestion = async (qId, qData) => {
        try {
            await api.put(`/practice-tests/${test._id}/questions/${qId}`, qData);
            setEditingQ(null);
            await fetchTest();
        } catch (err) { alert(err?.response?.data?.message || 'Failed to update question'); }
    };

    const handleDeleteQuestion = async (qId) => {
        if (!window.confirm('Delete this question?')) return;
        try {
            await api.delete(`/practice-tests/${test._id}/questions/${qId}`);
            await fetchTest();
        } catch { alert('Failed to delete question'); }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            const { data } = await api.patch(`/practice-tests/${test._id}/publish`);
            setTest(p => ({ ...p, isPublished: data.isPublished }));
            onUpdate();
        } catch (err) { alert(err?.response?.data?.message || 'Failed'); }
        finally { setPublishing(false); }
    };

    const isSectionMode = test.sections?.length > 0;
    const sectionQuestionCount = test.sections?.reduce((s, sec) => s + sec.questionRefs.length, 0) || 0;
    const totalMarks = test.questions?.reduce((s, q) => s + (q.marks || 1), 0) || 0;

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-2xl bg-white h-screen overflow-y-auto shadow-2xl flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex-shrink-0 bg-gradient-to-r from-violet-50 to-indigo-50">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${test.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {test.isPublished ? '✓ Published' : '📝 Draft'}
                                </span>
                                <span className="text-xs bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full font-medium">{test.subject}</span>
                            </div>
                            <h2 className="font-bold text-slate-900 text-lg">{test.title}</h2>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span>⏱️ {test.timeLimit > 0 ? `${test.timeLimit} min` : 'No time limit'}</span>
                                <span>🎯 Pass: {test.passingScore}%</span>
                                <span>🔁 {test.maxAttempts > 0 ? `${test.maxAttempts} attempts max` : 'Unlimited attempts'}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button onClick={handlePublish} disabled={publishing}
                                className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${test.isPublished ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                                {publishing ? '...' : test.isPublished ? 'Unpublish' : '🚀 Publish'}
                            </button>
                            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/70 text-slate-500">✕</button>
                        </div>
                    </div>
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-4 gap-px bg-slate-100 border-b border-slate-200 flex-shrink-0">
                    {[
                        { label: 'Questions', value: isSectionMode ? sectionQuestionCount : (test.questions?.length || 0) },
                        { label: 'Total Marks', value: totalMarks },
                        { label: 'Attempts', value: test.totalAttempts || 0 },
                        { label: 'Pass Rate', value: `${test.passRate || 0}%` },
                    ].map(s => (
                        <div key={s.label} className="bg-white px-3 py-3 text-center">
                            <p className="text-xl font-black text-violet-700">{s.value}</p>
                            <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Content: Sections (new) or legacy flat questions */}
                <div className="flex-1 p-5 overflow-y-auto space-y-3">
                    {!isSectionMode && (
                        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <p className="text-sm font-semibold text-violet-900">🆕 New: Sections &amp; Question Bank builder</p>
                                <p className="text-xs text-violet-700 mt-0.5">
                                    {test.questions?.length > 0
                                        ? 'Convert this test to reuse questions from your Question Bank, add section timers, and unlock new question types.'
                                        : 'Build this test using reusable Question Bank questions, organized into timed sections.'}
                                </p>
                            </div>
                            <button onClick={handleSwitchToSections}
                                className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 flex-shrink-0">
                                {test.questions?.length > 0 ? 'Convert to Sections' : 'Use Sections'}
                            </button>
                        </div>
                    )}

                    {isSectionMode ? (
                        <SectionsManager test={test} questionBank={questionBank} onUpdate={fetchTest} />
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-slate-800">Questions <span className="text-slate-400 font-normal text-xs">(legacy format)</span></h3>
                                <button onClick={() => setAddingQ(true)}
                                    className="text-sm text-violet-600 font-semibold hover:text-violet-700 flex items-center gap-1">
                                    + Add Question
                                </button>
                            </div>

                            {addingQ && (
                                <QuestionForm onSave={handleSaveQuestion} onCancel={() => setAddingQ(false)} />
                            )}

                            {test.questions?.length === 0 && !addingQ && (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <p className="text-4xl mb-2">📝</p>
                                    <p className="text-slate-600 font-semibold">No questions yet</p>
                                    <p className="text-slate-400 text-sm mt-1">Start building your quiz, or use the Sections builder above!</p>
                                    <button onClick={() => setAddingQ(true)}
                                        className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
                                        Add First Question
                                    </button>
                                </div>
                            )}

                            {test.questions?.map((q, idx) => (
                                <div key={q._id}>
                                    {editingQ === q._id ? (
                                        <QuestionForm
                                            initial={q}
                                            onSave={(data) => handleUpdateQuestion(q._id, data)}
                                            onCancel={() => setEditingQ(null)}
                                        />
                                    ) : (
                                        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center text-violet-700 font-bold text-xs flex-shrink-0">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${q.type === 'MCQ' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                                {q.type}
                                                            </span>
                                                            <span className="text-xs text-slate-400">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                                                            {q.timeLimit > 0 && <span className="text-xs text-slate-400">⏱️ {q.timeLimit}s</span>}
                                                        </div>
                                                        <p className="text-sm font-medium text-slate-800 leading-snug">{q.questionText}</p>
                                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                            {q.options?.map((opt, oi) => (
                                                                <div key={oi} className={`text-xs px-2.5 py-1.5 rounded-lg ${opt.isCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold' : 'bg-slate-50 text-slate-600'}`}>
                                                                    {String.fromCharCode(65 + oi)}. {opt.text}
                                                                    {opt.isCorrect && ' ✓'}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {q.explanation && (
                                                            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2 border border-amber-100">
                                                                💡 {q.explanation}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1.5 flex-shrink-0">
                                                    <button onClick={() => setEditingQ(q._id)}
                                                        className="text-xs px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100">
                                                        Edit
                                                    </button>
                                                    <button onClick={() => handleDeleteQuestion(q._id)}
                                                        className="text-xs px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-500 rounded-lg font-medium hover:bg-red-100">
                                                        Del
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function SellerPracticeTests() {
    const [tests, setTests] = useState([]);
    const [courses, setCourses] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalTest, setModalTest] = useState(undefined);
    const [drawerTest, setDrawerTest] = useState(null);
    const [search, setSearch] = useState('');

    const fetchTests = async () => {
        setLoading(true);
        try {
            const [testsRes, coursesRes, companiesRes] = await Promise.all([
                api.get('/practice-tests/mine'),
                api.get('/courses/mine'),
                api.get('/companies')
            ]);
            setTests(testsRes.data.data || []);
            setCourses(coursesRes.data.data || []);
            setCompanies(companiesRes.data.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTests(); }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this practice test? All attempt data will be lost.')) return;
        try { await api.delete(`/practice-tests/${id}`); fetchTests(); }
        catch { alert('Failed to delete'); }
    };

    const filtered = tests.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.subject.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">Practice Tests</h1>
                        <p className="text-slate-500 mt-1">{tests.length} test{tests.length !== 1 ? 's' : ''} created</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search tests..."
                            className="px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-violet-500 text-sm w-full sm:w-52"
                        />
                        <button onClick={() => setModalTest(null)}
                            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition whitespace-nowrap">
                            + Create Test
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <span className="text-6xl">📝</span>
                        <p className="text-slate-600 font-semibold mt-4 text-lg">{search ? 'No tests match your search' : 'No practice tests yet'}</p>
                        {!search && <p className="text-slate-400 text-sm mt-1">Create quizzes to test your students' knowledge!</p>}
                        {!search && (
                            <button onClick={() => setModalTest(null)} className="mt-4 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700">
                                Create First Test
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filtered.map(test => (
                            <div key={test._id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition group cursor-pointer"
                                onClick={() => setDrawerTest(test)}>
                                {/* Color bar */}
                                <div className="h-1.5 bg-gradient-to-r from-violet-500 to-indigo-500" />
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${test.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {test.isPublished ? '✓ Published' : 'Draft'}
                                                </span>
                                                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{test.subject}</span>
                                            </div>
                                            <h3 className="font-bold text-slate-900 line-clamp-2 group-hover:text-violet-700 transition">{test.title}</h3>
                                        </div>
                                    </div>

                                    {test.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{test.description}</p>}

                                    {/* Stats */}
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <div className="bg-violet-50 rounded-xl p-2.5 text-center">
                                            <p className="font-bold text-violet-700">{test.questionCount || test.questions?.length || 0}</p>
                                            <p className="text-xs text-slate-500">Questions</p>
                                        </div>
                                        <div className="bg-indigo-50 rounded-xl p-2.5 text-center">
                                            <p className="font-bold text-indigo-700">{test.totalMarks || 0}</p>
                                            <p className="text-xs text-slate-500">Total Marks</p>
                                        </div>
                                        <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                                            <p className="font-bold text-emerald-700">{test.totalAttempts || 0}</p>
                                            <p className="text-xs text-slate-500">Attempts</p>
                                        </div>
                                        <div className="bg-amber-50 rounded-xl p-2.5 text-center">
                                            <p className="font-bold text-amber-700">{test.passRate || 0}%</p>
                                            <p className="text-xs text-slate-500">Pass Rate</p>
                                        </div>
                                    </div>

                                    {/* Settings chips */}
                                    <div className="flex items-center gap-1.5 flex-wrap mb-4">
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                            ⏱️ {test.timeLimit > 0 ? `${test.timeLimit}min` : 'No limit'}
                                        </span>
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                            🎯 Pass: {test.passingScore}%
                                        </span>
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                            🔁 {test.maxAttempts > 0 ? `${test.maxAttempts} tries` : '∞ tries'}
                                        </span>
                                    </div>

                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => setDrawerTest(test)}
                                            className="flex-1 py-2 bg-violet-50 text-violet-700 rounded-lg text-sm font-semibold hover:bg-violet-100 transition">
                                            Manage
                                        </button>
                                        <button onClick={() => setModalTest(test)}
                                            className="px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 transition">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(test._id)}
                                            className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalTest !== undefined && (
                <TestModal test={modalTest} onClose={() => setModalTest(undefined)} onSave={(savedTest) => {
                    fetchTests();
                    if (!modalTest && savedTest) {
                        setDrawerTest(savedTest); // Auto-open content manager
                    }
                }} courses={courses} companies={companies} />
            )}
            {drawerTest && (
                <TestDrawer test={drawerTest} onClose={() => setDrawerTest(null)} onUpdate={fetchTests} />
            )}

        </>
    );
}

export default SellerPracticeTests;
