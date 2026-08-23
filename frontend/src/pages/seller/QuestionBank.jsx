import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from './PracticeTests';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const OPTION_BACKED_TYPES = ['MCQ', 'MSQ', 'TrueFalse'];
const EXECUTION_TYPES = ['Coding', 'SQL', 'Debugging', 'OutputBased'];
const LANGUAGE_TYPED_EXECUTION_TYPES = ['Coding', 'Debugging', 'OutputBased']; // SQL has no language picker
// Must match backend/utils/judge0Client.js's LANGUAGE_IDS keys exactly.
const SUPPORTED_LANGUAGES = ['python3', 'javascript', 'java', 'cpp', 'c', 'csharp', 'go', 'ruby', 'php', 'typescript'];

// ── Test case list editor — shared by sample (visible) and hidden test cases ──────
function TestCaseListEditor({ label, hint, cases, setCases }) {
    const addCase = () => setCases(p => [...p, { input: '', expectedOutput: '', explanation: '' }]);
    const removeCase = (idx) => setCases(p => p.filter((_, i) => i !== idx));
    const updateCase = (idx, field, value) => setCases(p => p.map((c, i) => i === idx ? { ...c, [field]: value } : c));

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-700">{label} <span className="text-slate-400 font-normal text-xs">({hint})</span></label>
                <button type="button" onClick={addCase} className="text-xs text-violet-600 font-semibold hover:text-violet-700">+ Add Case</button>
            </div>
            <div className="space-y-2">
                {cases.map((c, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">Case {idx + 1}</span>
                            <button type="button" onClick={() => removeCase(idx)} className="text-slate-400 hover:text-red-500 text-lg leading-none">×</button>
                        </div>
                        <textarea value={c.input} onChange={e => updateCase(idx, 'input', e.target.value)} rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono outline-none focus:ring-2 focus:ring-violet-400"
                            placeholder="Input / stdin (or setup SQL for this case)" />
                        <textarea value={c.expectedOutput} onChange={e => updateCase(idx, 'expectedOutput', e.target.value)} rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono outline-none focus:ring-2 focus:ring-violet-400"
                            placeholder="Expected output" />
                        <input value={c.explanation} onChange={e => updateCase(idx, 'explanation', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-violet-400"
                            placeholder="Explanation (optional)" />
                    </div>
                ))}
                {cases.length === 0 && <p className="text-xs text-slate-400 italic">No cases yet.</p>}
            </div>
        </div>
    );
}

// ── Coding / SQL / Debugging / OutputBased fields ──────────────────────────────────
function CodingQuestionForm({ type, languages, setLanguages, starterCode, setStarterCode, sqlSchema, setSqlSchema, scoringMode, setScoringMode, sampleTestCases, setSampleTestCases, hiddenTestCases, setHiddenTestCases }) {
    const toggleLanguage = (lang) => setLanguages(p => p.includes(lang) ? p.filter(l => l !== lang) : [...p, lang]);

    return (
        <div className="space-y-5 p-4 rounded-xl border border-violet-200 bg-violet-50/40">
            <p className="text-xs text-violet-700 bg-violet-100 rounded-lg px-3 py-2">
                Code is executed server-side via Judge0{type === 'SQL' ? ' (SQL runs against the schema below using an isolated in-memory database)' : ''}. Hidden test cases are never shown to students or in any report.
            </p>

            {type === 'SQL' ? (
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Schema (DDL + seed data) *</label>
                    <textarea value={sqlSchema} onChange={e => setSqlSchema(e.target.value)} rows={4}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono outline-none focus:ring-2 focus:ring-violet-500"
                        placeholder={'CREATE TABLE users (id INTEGER, name TEXT);\nINSERT INTO users VALUES (1, \'Alice\'), (2, \'Bob\');'} />
                    <p className="text-xs text-slate-400 mt-1">Shown to the student. Expected output format: one row per line, comma-joined column values (e.g. "1,Alice").</p>
                </div>
            ) : (
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Allowed Languages *</label>
                    <div className="flex flex-wrap gap-2">
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <button key={lang} type="button" onClick={() => toggleLanguage(lang)}
                                className={`px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition ${languages.includes(lang) ? 'border-violet-600 bg-violet-100 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
                                {lang}
                            </button>
                        ))}
                    </div>
                    {languages.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {languages.map(lang => (
                                <div key={lang}>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Starter code — {lang}</label>
                                    <textarea value={starterCode[lang] || ''} onChange={e => setStarterCode(p => ({ ...p, [lang]: e.target.value }))} rows={3}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono outline-none focus:ring-2 focus:ring-violet-400" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Scoring Mode</label>
                <select value={scoringMode} onChange={e => setScoringMode(e.target.value)}
                    className="w-full md:w-64 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400">
                    <option value="proportional">Proportional (marks scaled by % test cases passed)</option>
                    <option value="all_or_nothing">All-or-nothing (full marks only if every case passes)</option>
                </select>
            </div>

            <TestCaseListEditor label="Sample Test Cases" hint="visible to students" cases={sampleTestCases} setCases={setSampleTestCases} />
            <TestCaseListEditor label="Hidden Test Cases" hint="never shown to students or in reports — used for scoring" cases={hiddenTestCases} setCases={setHiddenTestCases} />
        </div>
    );
}

// ── Shared common-fields block (difficulty/tags/marks/negative-marks/explanation) ──
function CommonFields({ form, setForm }) {
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(p => ({ ...p, [name]: value }));
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Difficulty</label>
                <select name="difficulty" value={form.difficulty} onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400">
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Skill Tags <span className="text-slate-400 font-normal">(comma-separated)</span></label>
                <input name="skillTags" value={form.skillTags} onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="arrays, recursion" />
            </div>
            <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Marks</label>
                <input type="number" name="marks" value={form.marks} onChange={handleChange} min="0.5" step="0.5"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Negative Marks <span className="text-slate-400 font-normal">(0 = none)</span></label>
                <input type="number" name="negativeMarks" value={form.negativeMarks} onChange={handleChange} min="0" step="0.25"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Explanation <span className="text-slate-400 font-normal">(shown after answering)</span></label>
                <textarea name="explanation" value={form.explanation} onChange={handleChange} rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
            </div>
        </div>
    );
}

// ── Question Form Modal ──────────────────────────────────────────────────────────
function QuestionModal({ question, onClose, onSave }) {
    const isEdit = !!question?._id;
    const [type, setType] = useState(question?.type || 'MCQ');
    const [questionText, setQuestionText] = useState(question?.questionText || '');
    const [options, setOptions] = useState(
        question?.options?.length ? question.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })) :
            [{ text: '', isCorrect: false }, { text: '', isCorrect: false }]
    );
    const [acceptedAnswers, setAcceptedAnswers] = useState((question?.acceptedAnswers || []).join(', '));
    const [rubric, setRubric] = useState(question?.rubric || '');
    const [languages, setLanguages] = useState(question?.codingProblem?.languages || []);
    const [starterCode, setStarterCode] = useState(() => {
        const sc = question?.codingProblem?.starterCode;
        if (!sc) return {};
        return sc instanceof Map ? Object.fromEntries(sc) : { ...sc };
    });
    const [sqlSchema, setSqlSchema] = useState(question?.sqlSchema || '');
    const [scoringMode, setScoringMode] = useState(question?.codingProblem?.scoringMode || 'proportional');
    const [sampleTestCases, setSampleTestCases] = useState(question?.codingProblem?.sampleTestCases || []);
    const [hiddenTestCases, setHiddenTestCases] = useState(question?.codingProblem?.hiddenTestCases || []);
    const [form, setForm] = useState({
        difficulty: question?.difficulty || 'medium',
        skillTags: (question?.skillTags || []).join(', '),
        marks: question?.marks ?? 1,
        negativeMarks: question?.negativeMarks ?? 0,
        explanation: question?.explanation || ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (type === 'TrueFalse' && options.length !== 2) {
            setOptions([{ text: 'True', isCorrect: false }, { text: 'False', isCorrect: false }]);
        }
    }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

    const addOption = () => options.length < 6 && setOptions(p => [...p, { text: '', isCorrect: false }]);
    const removeOption = (idx) => options.length > 2 && setOptions(p => p.filter((_, i) => i !== idx));
    const updateOption = (idx, field, value) => setOptions(p => p.map((o, i) => {
        if (i !== idx) {
            if (field === 'isCorrect' && value && type !== 'MSQ') return { ...o, isCorrect: false };
            return o;
        }
        return { ...o, [field]: value };
    }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!questionText.trim()) return setError('Question text is required');

        const payload = {
            type,
            questionText,
            difficulty: form.difficulty,
            skillTags: form.skillTags.split(',').map(t => t.trim()).filter(Boolean),
            marks: Number(form.marks) || 1,
            negativeMarks: Number(form.negativeMarks) || 0,
            explanation: form.explanation
        };

        if (OPTION_BACKED_TYPES.includes(type)) {
            if (options.some(o => !o.text.trim())) return setError('All options must have text');
            const correctCount = options.filter(o => o.isCorrect).length;
            if (type === 'MSQ' && correctCount < 1) return setError('MSQ must have at least 1 correct option');
            if (type !== 'MSQ' && correctCount !== 1) return setError(`${type} must have exactly 1 correct option`);
            payload.options = options;
        } else if (type === 'FillBlank') {
            const answers = acceptedAnswers.split(',').map(a => a.trim()).filter(Boolean);
            if (answers.length === 0) return setError('At least one accepted answer is required');
            payload.acceptedAnswers = answers;
        } else if (type === 'Subjective') {
            payload.rubric = rubric;
        } else if (EXECUTION_TYPES.includes(type)) {
            if (LANGUAGE_TYPED_EXECUTION_TYPES.includes(type) && languages.length === 0) {
                return setError('At least one language must be selected');
            }
            if (type === 'SQL' && !sqlSchema.trim()) return setError('SQL schema is required');
            if (sampleTestCases.length === 0) return setError('At least one sample test case is required');

            payload.codingProblem = {
                languages: LANGUAGE_TYPED_EXECUTION_TYPES.includes(type) ? languages : [],
                starterCode: LANGUAGE_TYPED_EXECUTION_TYPES.includes(type) ? starterCode : {},
                sampleTestCases,
                hiddenTestCases,
                scoringMode
            };
            if (type === 'SQL') payload.sqlSchema = sqlSchema;
        }

        setLoading(true);
        try {
            if (isEdit) {
                const { data } = await api.put(`/question-bank/${question._id}`, payload);
                onSave(data.data);
            } else {
                const { data } = await api.post('/question-bank', payload);
                onSave(data.data);
            }
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to save question');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-900">{isEdit ? '✏️ Edit Question' : '🆕 Add Question'}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                </div>
                {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Type selector */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {QUESTION_TYPES.map(t => (
                            <button key={t} type="button" onClick={() => setType(t)} disabled={isEdit}
                                className={`py-2 rounded-xl border-2 text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${type === t ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
                                {t}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400">{QUESTION_TYPE_LABELS[type]}{isEdit ? ' — type cannot be changed after creation' : ''}</p>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Question *</label>
                        <textarea value={questionText} onChange={e => setQuestionText(e.target.value)} rows={2}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none resize-none text-sm"
                            placeholder="Enter your question here..." />
                    </div>

                    {OPTION_BACKED_TYPES.includes(type) && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Options * <span className="text-slate-400 font-normal text-xs">({type === 'MSQ' ? 'select 1+ correct' : 'select 1 correct'})</span>
                                </label>
                                {type !== 'TrueFalse' && options.length < 6 && (
                                    <button type="button" onClick={addOption} className="text-xs text-violet-600 font-semibold hover:text-violet-700">+ Add Option</button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {options.map((opt, idx) => (
                                    <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border transition ${opt.isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                                        <button type="button" onClick={() => updateOption(idx, 'isCorrect', !opt.isCorrect)}
                                            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${opt.isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}>
                                            {opt.isCorrect ? <span className="text-xs">✓</span> : null}
                                        </button>
                                        <span className="text-xs font-bold text-slate-500 w-5 flex-shrink-0">{String.fromCharCode(65 + idx)}</span>
                                        <input value={opt.text} onChange={e => updateOption(idx, 'text', e.target.value)} readOnly={type === 'TrueFalse'}
                                            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
                                            placeholder={`Option ${String.fromCharCode(65 + idx)}`} />
                                        {type !== 'TrueFalse' && options.length > 2 && (
                                            <button type="button" onClick={() => removeOption(idx)} className="text-slate-400 hover:text-red-500 flex-shrink-0 text-lg leading-none">×</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {type === 'FillBlank' && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Accepted Answers * <span className="text-slate-400 font-normal text-xs">(comma-separated; case-insensitive match)</span></label>
                            <input value={acceptedAnswers} onChange={e => setAcceptedAnswers(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none text-sm"
                                placeholder="Paris, paris, PARIS" />
                        </div>
                    )}

                    {type === 'Subjective' && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Grading Rubric <span className="text-slate-400 font-normal text-xs">(guideline only — never auto-scored, you grade these manually)</span></label>
                            <textarea value={rubric} onChange={e => setRubric(e.target.value)} rows={3}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none resize-none text-sm"
                                placeholder="What should a full-marks answer include?" />
                        </div>
                    )}

                    {EXECUTION_TYPES.includes(type) && (
                        <CodingQuestionForm
                            type={type}
                            languages={languages} setLanguages={setLanguages}
                            starterCode={starterCode} setStarterCode={setStarterCode}
                            sqlSchema={sqlSchema} setSqlSchema={setSqlSchema}
                            scoringMode={scoringMode} setScoringMode={setScoringMode}
                            sampleTestCases={sampleTestCases} setSampleTestCases={setSampleTestCases}
                            hiddenTestCases={hiddenTestCases} setHiddenTestCases={setHiddenTestCases}
                        />
                    )}

                    <CommonFields form={form} setForm={setForm} />

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-60">
                            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Question'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────────
function QuestionBank() {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalQuestion, setModalQuestion] = useState(undefined);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const params = {};
            if (search) params.search = search;
            if (typeFilter) params.type = typeFilter;
            const { data } = await api.get('/question-bank/mine', { params });
            setQuestions(data.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchQuestions(); }, [search, typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this question? It must not be in use by any test.')) return;
        try { await api.delete(`/question-bank/${id}`); fetchQuestions(); }
        catch (err) { alert(err?.response?.data?.message || 'Failed to delete'); }
    };

    const handleClone = async (id) => {
        try { await api.post(`/question-bank/${id}/clone`); fetchQuestions(); }
        catch { alert('Failed to clone'); }
    };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">Question Bank</h1>
                        <p className="text-slate-500 mt-1">{questions.length} question{questions.length !== 1 ? 's' : ''} — reuse these across multiple tests</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                            className="px-3 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-violet-500 text-sm">
                            <option value="">All types</option>
                            {QUESTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions..."
                            className="px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-violet-500 text-sm w-52" />
                        <button onClick={() => setModalQuestion(null)}
                            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition whitespace-nowrap">
                            + Add Question
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : questions.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <span className="text-6xl">🗂️</span>
                        <p className="text-slate-600 font-semibold mt-4 text-lg">No questions yet</p>
                        <p className="text-slate-400 text-sm mt-1">Build a reusable question bank, then attach questions to any test's sections.</p>
                        <button onClick={() => setModalQuestion(null)} className="mt-4 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700">
                            Add First Question
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {questions.map(q => (
                            <div key={q._id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{q.type}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{q.difficulty}</span>
                                            <span className="text-xs text-slate-400">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                                            {q.usageCount > 0 && <span className="text-xs text-emerald-600 font-medium">Used in {q.usageCount} test{q.usageCount !== 1 ? 's' : ''}</span>}
                                            {!q.isApproved && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending review</span>}
                                        </div>
                                        <p className="text-sm font-medium text-slate-800 leading-snug">{q.questionText}</p>
                                        {q.skillTags?.length > 0 && (
                                            <div className="flex gap-1 mt-1.5 flex-wrap">
                                                {q.skillTags.map(t => <span key={t} className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{t}</span>)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1.5 flex-shrink-0">
                                        <button onClick={() => setModalQuestion(q)} className="text-xs px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100">Edit</button>
                                        <button onClick={() => handleClone(q._id)} className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100">Clone</button>
                                        <button onClick={() => handleDelete(q._id)} className="text-xs px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-500 rounded-lg font-medium hover:bg-red-100">Del</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalQuestion !== undefined && (
                <QuestionModal question={modalQuestion} onClose={() => setModalQuestion(undefined)} onSave={fetchQuestions} />
            )}
        </>
    );
}

export default QuestionBank;
