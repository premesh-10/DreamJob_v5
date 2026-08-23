import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';

const ROUND_TYPES = ['Online Assessment', 'Technical Round', 'Machine Coding', 'System Design', 'Behavioral', 'HR', 'Final Round', 'Group Discussion', 'Custom'];
const SOURCES = ['LinkedIn', 'Referral', 'Company Website', 'Naukri', 'Indeed', 'Campus', 'Other'];

const emptyRound = () => ({
    roundType: 'Technical Round', customRoundType: '',
    questionsAskedText: '', conceptsDiscussedText: '', preparationTips: '',
    codingProblems: [],
});
const emptyCodingProblem = () => ({ title: '', description: '', link: '', difficulty: 'Medium' });
const emptyResource = () => ({ title: '', url: '', description: '' });

function SubmitExperience() {
    const { user } = useSelector(s => s.auth);
    const navigate = useNavigate();

    const [form, setForm] = useState({
        companyName: '', jobRole: '', experienceLevel: 'Fresher',
        interviewDate: new Date().toISOString().slice(0, 10), interviewMode: 'Online',
        applicationSource: 'Company Website', sourceOther: '', result: 'Selected', overallDifficulty: 3,
        overallExperienceText: '', mistakesToAvoid: '', adviceForFutureCandidates: '',
    });
    const [rounds, setRounds] = useState([emptyRound()]);
    const [resources, setResources] = useState([]);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!user) { navigate('/login'); return null; }

    const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const updateRound = (idx, field, value) => setRounds(rs => rs.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    const addRound = () => setRounds(rs => [...rs, emptyRound()]);
    const removeRound = (idx) => setRounds(rs => rs.filter((_, i) => i !== idx));

    const addCodingProblem = (roundIdx) => setRounds(rs => rs.map((r, i) => i === roundIdx ? { ...r, codingProblems: [...r.codingProblems, emptyCodingProblem()] } : r));
    const updateCodingProblem = (roundIdx, probIdx, field, value) => setRounds(rs => rs.map((r, i) => i !== roundIdx ? r : {
        ...r, codingProblems: r.codingProblems.map((p, pi) => pi === probIdx ? { ...p, [field]: value } : p)
    }));
    const removeCodingProblem = (roundIdx, probIdx) => setRounds(rs => rs.map((r, i) => i !== roundIdx ? r : {
        ...r, codingProblems: r.codingProblems.filter((_, pi) => pi !== probIdx)
    }));

    const addResource = () => setResources(rs => [...rs, emptyResource()]);
    const updateResource = (idx, field, value) => setResources(rs => rs.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    const removeResource = (idx) => setResources(rs => rs.filter((_, i) => i !== idx));

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.companyName.trim() || !form.jobRole.trim() || !form.overallExperienceText.trim()) {
            setError('Please fill in company name, job role, and the overall interview process.');
            return;
        }
        if (!acceptedTerms) {
            setError('You must accept the contributor terms to submit your experience.');
            return;
        }

        const payloadRounds = rounds.map((r, i) => ({
            order: i,
            roundType: r.roundType,
            customRoundType: r.customRoundType,
            questionsAsked: r.questionsAskedText.split('\n').map(s => s.trim()).filter(Boolean),
            conceptsDiscussed: r.conceptsDiscussedText.split('\n').map(s => s.trim()).filter(Boolean),
            preparationTips: r.preparationTips,
            codingProblems: r.codingProblems.filter(p => p.title.trim()),
        }));

        setSubmitting(true);
        try {
            const { data } = await api.post('/experiences', {
                ...form,
                overallDifficulty: Number(form.overallDifficulty),
                rounds: payloadRounds,
                resourcesShared: resources.filter(r => r.title.trim() && r.url.trim()),
                acceptedTerms: true,
            });
            navigate(`/interview-hub/experiences/${data.data._id}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit experience');
        } finally { setSubmitting(false); }
    };

    return (
        <>
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Share Your Interview Experience</h1>
                    <p className="text-slate-500 mt-1">Help future candidates prepare — and earn contribution points for sharing!</p>
                </div>

                <form onSubmit={submit} className="space-y-6">
                    {/* Basic info */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                        <h2 className="font-bold text-slate-900">Basic Details</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium text-slate-700">Company Name *</label>
                                <input value={form.companyName} onChange={update('companyName')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                            <div><label className="text-sm font-medium text-slate-700">Job Role *</label>
                                <input value={form.jobRole} onChange={update('jobRole')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                            <div><label className="text-sm font-medium text-slate-700">Experience Level</label>
                                <select value={form.experienceLevel} onChange={update('experienceLevel')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                    <option>Internship</option><option>Fresher</option><option>Experienced</option>
                                </select></div>
                            <div><label className="text-sm font-medium text-slate-700">Interview Date</label>
                                <input type="date" value={form.interviewDate} onChange={update('interviewDate')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                            <div><label className="text-sm font-medium text-slate-700">Interview Mode</label>
                                <select value={form.interviewMode} onChange={update('interviewMode')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                    <option>Online</option><option>Offline</option>
                                </select></div>
                            <div><label className="text-sm font-medium text-slate-700">Application Source</label>
                                <select value={form.applicationSource} onChange={update('applicationSource')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                                </select></div>
                            {form.applicationSource === 'Other' && (
                                <div className="col-span-2"><label className="text-sm font-medium text-slate-700">Source (specify)</label>
                                    <input value={form.sourceOther} onChange={update('sourceOther')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                            )}
                            <div><label className="text-sm font-medium text-slate-700">Result</label>
                                <select value={form.result} onChange={update('result')} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                    <option>Selected</option><option>Rejected</option><option>Pending</option>
                                </select></div>
                            <div><label className="text-sm font-medium text-slate-700">Overall Difficulty (1=Very Easy, 5=Very Hard)</label>
                                <input type="range" min="1" max="5" value={form.overallDifficulty} onChange={update('overallDifficulty')} className="mt-2 w-full" />
                                <p className="text-xs text-slate-400 text-center">{form.overallDifficulty}/5</p></div>
                        </div>
                    </div>

                    {/* Overview */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h2 className="font-bold text-slate-900 mb-3">Complete Interview Process *</h2>
                        <textarea value={form.overallExperienceText} onChange={update('overallExperienceText')} rows={5} placeholder="Describe the end-to-end process — number of rounds, timeline, overall vibe..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>

                    {/* Rounds */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-slate-900">Interview Rounds</h2>
                            <button type="button" onClick={addRound} className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800">+ Add Round</button>
                        </div>
                        {rounds.map((r, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-700">Round {idx + 1}</h3>
                                    {rounds.length > 1 && <button type="button" onClick={() => removeRound(idx)} className="text-xs text-red-500 hover:text-red-700">Remove</button>}
                                </div>
                                <select value={r.roundType} onChange={e => updateRound(idx, 'roundType', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                    {ROUND_TYPES.map(t => <option key={t}>{t}</option>)}
                                </select>
                                {r.roundType === 'Custom' && (
                                    <input value={r.customRoundType} onChange={e => updateRound(idx, 'customRoundType', e.target.value)} placeholder="Custom round name"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                )}
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Questions Asked (one per line)</label>
                                    <textarea value={r.questionsAskedText} onChange={e => updateRound(idx, 'questionsAskedText', e.target.value)} rows={3}
                                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Concepts Discussed (one per line)</label>
                                    <textarea value={r.conceptsDiscussedText} onChange={e => updateRound(idx, 'conceptsDiscussedText', e.target.value)} rows={2}
                                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-medium text-slate-600">Coding Problems</label>
                                        <button type="button" onClick={() => addCodingProblem(idx)} className="text-xs text-primary-600 font-medium hover:underline">+ Add Problem</button>
                                    </div>
                                    {r.codingProblems.map((p, pi) => (
                                        <div key={pi} className="grid grid-cols-2 gap-2 mb-2 p-2 bg-white rounded-lg border border-slate-100">
                                            <input value={p.title} onChange={e => updateCodingProblem(idx, pi, 'title', e.target.value)} placeholder="Problem title" className="px-2 py-1.5 border border-slate-200 rounded text-xs col-span-2" />
                                            <input value={p.link} onChange={e => updateCodingProblem(idx, pi, 'link', e.target.value)} placeholder="Link (LeetCode etc.)" className="px-2 py-1.5 border border-slate-200 rounded text-xs" />
                                            <select value={p.difficulty} onChange={e => updateCodingProblem(idx, pi, 'difficulty', e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-xs">
                                                <option>Easy</option><option>Medium</option><option>Hard</option>
                                            </select>
                                            <textarea value={p.description} onChange={e => updateCodingProblem(idx, pi, 'description', e.target.value)} placeholder="Brief description" rows={1} className="px-2 py-1.5 border border-slate-200 rounded text-xs col-span-2" />
                                            <button type="button" onClick={() => removeCodingProblem(idx, pi)} className="text-xs text-red-500 col-span-2 text-left">Remove problem</button>
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-slate-600">Preparation Tips for this round</label>
                                    <textarea value={r.preparationTips} onChange={e => updateRound(idx, 'preparationTips', e.target.value)} rows={2}
                                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Resources */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-slate-900">Resources to Share (optional)</h2>
                            <button type="button" onClick={addResource} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200">+ Add Resource</button>
                        </div>
                        {resources.map((r, idx) => (
                            <div key={idx} className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg">
                                <input value={r.title} onChange={e => updateResource(idx, 'title', e.target.value)} placeholder="Title" className="px-2 py-1.5 border border-slate-200 rounded text-xs" />
                                <input value={r.url} onChange={e => updateResource(idx, 'url', e.target.value)} placeholder="URL" className="px-2 py-1.5 border border-slate-200 rounded text-xs" />
                                <input value={r.description} onChange={e => updateResource(idx, 'description', e.target.value)} placeholder="Description (optional)" className="px-2 py-1.5 border border-slate-200 rounded text-xs col-span-2" />
                                <button type="button" onClick={() => removeResource(idx)} className="text-xs text-red-500 col-span-2 text-left">Remove</button>
                            </div>
                        ))}
                    </div>

                    {/* Mistakes & advice */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                        <div><h2 className="font-bold text-slate-900 mb-2">⚠️ Mistakes to Avoid</h2>
                            <textarea value={form.mistakesToAvoid} onChange={update('mistakesToAvoid')} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                        <div><h2 className="font-bold text-slate-900 mb-2">💡 Advice for Future Candidates</h2>
                            <textarea value={form.adviceForFutureCandidates} onChange={update('adviceForFutureCandidates')} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                    </div>

                    {/* Terms */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-1 w-4 h-4" />
                            <span className="text-sm text-slate-600">
                                I confirm that the information shared is accurate to the best of my knowledge, does not contain any confidential or proprietary company information,
                                does not violate any NDA or legal agreement I am bound by, and does not include abusive, misleading, or plagiarized content. I understand my contribution
                                may be removed and my account penalized if this is found to be false.
                            </span>
                        </label>
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <button type="submit" disabled={submitting} className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition disabled:opacity-60">
                        {submitting ? 'Submitting...' : 'Submit Experience (+50 points)'}
                    </button>
                </form>
            </div>

        </>
    );
}

export default SubmitExperience;
