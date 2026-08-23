import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

const SUBJECTS = ['All', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Programming', 'Web Development', 'Data Science', 'Machine Learning', 'English', 'Aptitude', 'Reasoning', 'General Knowledge', 'Finance', 'Marketing', 'Other'];

function PracticeTestCard({ test }) {
    const totalMarks = test.questions?.reduce ? test.questions.reduce((s, q) => s + (q.marks || 1), 0) : (test.totalMarks || 0);

    return (
        <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 block">
            {/* Color accent */}
            <div className="h-1.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500" />
            <div className="p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-xs font-bold px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full">{test.subject}</span>
                            {test.course && (
                                <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">{test.course.title}</span>
                            )}
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-violet-700 transition line-clamp-2">{test.title}</h3>
                    </div>
                </div>

                {test.description && (
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{test.description}</p>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                    <div className="text-center bg-slate-50 rounded-xl py-2.5">
                        <p className="font-bold text-slate-800 text-sm sm:text-base">{test.questionCount || 0}</p>
                        <p className="text-xs text-slate-400">Questions</p>
                    </div>
                    <div className="text-center bg-slate-50 rounded-xl py-2.5">
                        <p className="font-bold text-slate-800 text-sm sm:text-base">{totalMarks}</p>
                        <p className="text-xs text-slate-400">Marks</p>
                    </div>
                    <div className="text-center bg-slate-50 rounded-xl py-2.5">
                        <p className="font-bold text-slate-800 text-sm sm:text-base">{test.timeLimit > 0 ? `${test.timeLimit}m` : '∞'}</p>
                        <p className="text-xs text-slate-400">Time</p>
                    </div>
                </div>

                {/* Tags */}
                {test.tags?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mb-4">
                        {test.tags.slice(0, 4).map(tag => (
                            <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Pass: {test.passingScore}%</span>
                        {test.maxAttempts === 0 ? <span>∞ attempts</span> : <span>{test.maxAttempts} attempts</span>}
                    </div>
                    <Link
                        to={`/practice-tests/${test._id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-2.5 rounded-xl transition flex items-center gap-1">
                        View →
                    </Link>
                </div>
            </div>
        </div>
    );
}

function PracticeTests() {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [myAttempts, setMyAttempts] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [testsRes] = await Promise.all([api.get('/practice-tests')]);
                setTests(testsRes.data.data || []);
                try {
                    const attemptsRes = await api.get('/practice-tests/my-attempts/all');
                    setMyAttempts(attemptsRes.data.data || []);
                } catch { /* not logged in */ }
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const filtered = tests.filter(t => {
        const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase()) || (t.tags || []).some(tag => tag.toLowerCase().includes(search.toLowerCase()));
        const matchSubject = selectedSubject === 'All' || t.subject === selectedSubject;
        return matchSearch && matchSubject;
    });

    const myAttemptTestIds = new Set(myAttempts.map(a => a.practiceTest?._id || a.practiceTest));

    return (
        <>
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 text-white p-6 sm:p-8 md:p-12">
                    
                    <div className="relative z-10 max-w-2xl">
                        <h1 className="text-3xl md:text-4xl font-black mb-3">Practice Tests</h1>
                        <p className="text-violet-100 text-lg mb-6">Challenge yourself with curated quizzes. Track your progress and ace every exam.</p>
                        <div className="flex gap-4 flex-wrap text-sm">
                            <div className="bg-white/15 rounded-xl px-4 py-2.5 font-semibold">{tests.length} Tests Available</div>
                            {myAttempts.length > 0 && <div className="bg-white/15 rounded-xl px-4 py-2.5 font-semibold">{myAttempts.length} Attempts Made</div>}
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search tests, subjects, tags..."
                            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-violet-500 bg-white shadow-sm"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 flex-nowrap -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                        {SUBJECTS.slice(0, 8).map(sub => (
                            <button key={sub} onClick={() => setSelectedSubject(sub)}
                                className={`px-4 py-3 rounded-2xl text-sm font-semibold whitespace-nowrap transition border ${selectedSubject === sub ? 'bg-violet-600 text-white border-violet-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                                {sub}
                            </button>
                        ))}
                    </div>
                </div>

                {/* My attempts summary */}
                {myAttempts.length > 0 && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5">
                        <h2 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                            My Recent Attempts
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {myAttempts.slice(0, 3).map(attempt => (
                                <div key={attempt._id} className="bg-white rounded-xl p-3 border border-emerald-100 flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${attempt.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {attempt.percentage}%
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-800 text-sm truncate">{attempt.practiceTest?.title || 'Test'}</p>
                                        <p className="text-xs text-slate-500">{attempt.passed ? 'Passed' : 'Failed'} • {attempt.score}/{attempt.totalMarks}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tests grid */}
                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <span className="text-6xl">📭</span>
                        <p className="text-slate-600 font-semibold mt-4 text-lg">No tests found</p>
                        <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <>
                        <p className="text-slate-500 text-sm">{filtered.length} test{filtered.length !== 1 ? 's' : ''} found</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filtered.map(test => <PracticeTestCard key={test._id} test={test} attempted={myAttemptTestIds.has(test._id)} />)}
                        </div>
                    </>
                )}
            </div>

        </>
    );
}

export default PracticeTests;
