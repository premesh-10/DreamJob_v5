import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import api from '../../lib/api';

const MONACO_LANGUAGE_MAP = {
    python3: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp', c: 'c',
    csharp: 'csharp', go: 'go', ruby: 'ruby', php: 'php', typescript: 'typescript'
};

// Polls a 202-pending job's status endpoint until it resolves, since Judge0
// execution runs through our own job queue (see backend's pollJobWithBudget) —
// the initial request only waits a few seconds before handing back a jobId.
const pollJobStatus = async (testId, attemptId, jobId, { intervalMs = 1500, maxAttempts = 20 } = {}) => {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        const { data } = await api.get(`/practice-tests/${testId}/attempt/${attemptId}/code/status/${jobId}`);
        if (!data.pending) return data;
    }
    throw new Error('Execution is taking longer than expected. Please try again.');
};

function TestCaseResultRow({ result, index }) {
    return (
        <div className={`rounded-xl border p-3 text-xs ${result.passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-600">Sample Case {index + 1}</span>
                <span className={`font-bold ${result.passed ? 'text-emerald-600' : 'text-red-600'}`}>{result.passed ? '✓ Passed' : '✗ Failed'}</span>
            </div>
            {result.stdout && <p className="font-mono text-slate-500 whitespace-pre-wrap break-all">stdout: {result.stdout}</p>}
            {result.stderr && <p className="font-mono text-red-500 whitespace-pre-wrap break-all">stderr: {result.stderr}</p>}
        </div>
    );
}

// Coding/SQL/Debugging/OutputBased question UI: language picker (skipped for
// SQL), Monaco editor, Run (sample cases only, never scored) and Submit
// (sample+hidden cases, scores the question immediately and is carried
// forward into the final test result). Hidden test case content is never
// requested or rendered here — only pass/fail counts ever reach this component.
function CodeEditor({ testId, attemptId, question, submittedResult, onSubmitted }) {
    const isSql = question.type === 'SQL';
    const languages = question.codingProblem?.languages || [];
    const starterCode = question.codingProblem?.starterCode || {};
    const sampleTestCases = question.codingProblem?.sampleTestCases || [];

    const [language, setLanguage] = useState(languages[0] || '');
    const [code, setCode] = useState(() => (isSql ? '' : (starterCode[languages[0]] || '')));
    const [running, setRunning] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const [actionError, setActionError] = useState('');
    const codeByLanguage = useRef({ ...starterCode });

    useEffect(() => {
        if (submittedResult?.codeSubmission?.code) setCode(submittedResult.codeSubmission.code);
    }, [submittedResult]);

    const handleLanguageChange = (lang) => {
        codeByLanguage.current[language] = code;
        setLanguage(lang);
        setCode(codeByLanguage.current[lang] || starterCode[lang] || '');
    };

    const runCode = async () => {
        setRunning(true);
        setActionError('');
        setRunResult(null);
        try {
            const { data } = await api.post(`/practice-tests/${testId}/attempt/${attemptId}/code/run`, {
                questionId: question._id, language, code
            });
            const resolved = data.pending ? await pollJobStatus(testId, attemptId, data.jobId) : data;
            setRunResult(resolved.data);
        } catch (err) {
            setActionError(err?.response?.data?.message || 'Could not run code. Please try again.');
        } finally {
            setRunning(false);
        }
    };

    const submitCode = async () => {
        if (!window.confirm('Submit this solution? It will be scored against all test cases (including hidden ones) and counted in your final result.')) return;
        setSubmitting(true);
        setActionError('');
        try {
            const { data } = await api.post(`/practice-tests/${testId}/attempt/${attemptId}/code/submit`, {
                questionId: question._id, language, code
            });
            const resolved = data.pending ? await pollJobStatus(testId, attemptId, data.jobId) : data;
            onSubmitted(question._id, { ...resolved.data, codeSubmission: { code, language } });
        } catch (err) {
            setActionError(err?.response?.data?.message || 'Could not submit code. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            {isSql && question.sqlSchema && (
                <div>
                    <p className="text-xs font-bold text-slate-600 mb-1.5">Schema</p>
                    <pre className="bg-slate-900 text-slate-100 rounded-xl p-3 text-xs overflow-x-auto whitespace-pre-wrap">{question.sqlSchema}</pre>
                </div>
            )}

            {!isSql && languages.length > 1 && (
                <div className="flex gap-2">
                    {languages.map(lang => (
                        <button key={lang} onClick={() => handleLanguageChange(lang)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${language === lang ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
                            {lang}
                        </button>
                    ))}
                </div>
            )}

            <div className="rounded-xl border border-slate-200 overflow-hidden">
                <Editor
                    height="320px"
                    language={isSql ? 'sql' : (MONACO_LANGUAGE_MAP[language] || 'plaintext')}
                    value={code}
                    onChange={(value) => setCode(value || '')}
                    theme="vs-dark"
                    options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
                />
            </div>

            {sampleTestCases.length > 0 && (
                <div>
                    <p className="text-xs font-bold text-slate-600 mb-1.5">Sample Test Cases</p>
                    <div className="space-y-2">
                        {sampleTestCases.map((tc, idx) => (
                            <div key={idx} className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono">
                                <p><span className="text-slate-400">Input:</span> {tc.input || <span className="italic text-slate-300">none</span>}</p>
                                <p><span className="text-slate-400">Expected:</span> {tc.expectedOutput}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {actionError && <p className="text-sm text-red-600">{actionError}</p>}

            {runResult && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Sample results ({runResult.passedCount}/{runResult.totalCount} passed) — Run never affects your score.</p>
                    {runResult.sampleResults.map((r, idx) => <TestCaseResultRow key={idx} result={r} index={idx} />)}
                </div>
            )}

            {submittedResult && (
                <div className={`rounded-xl border p-4 ${submittedResult.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <p className="text-sm font-bold text-slate-800">
                        Submitted — {submittedResult.status} — {submittedResult.passedCount}/{submittedResult.totalCount} test cases passed — {submittedResult.marksAwarded}/{submittedResult.marksAvailable} marks
                    </p>
                    <p className="text-xs text-slate-500 mt-1">You can change your code and resubmit any time before finishing the test — the latest submission counts.</p>
                </div>
            )}

            <div className="flex gap-2">
                <button onClick={runCode} disabled={running || submitting}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold disabled:opacity-60">
                    {running ? 'Running...' : '▶ Run (sample cases)'}
                </button>
                <button onClick={submitCode} disabled={running || submitting}
                    className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                    {submitting ? 'Submitting...' : submittedResult ? 'Resubmit' : 'Submit Solution'}
                </button>
            </div>
        </div>
    );
}

export default CodeEditor;
