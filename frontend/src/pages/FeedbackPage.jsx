import { useState } from 'react';
import api from '../lib/api';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

function StarRating({ value, onChange }) {
    const [hover, setHover] = useState(0);
    return (
        <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className={`text-3xl transition-transform hover:scale-125 cursor-pointer ${star <= (hover || value) ? 'text-amber-400' : 'text-slate-200'}`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

const categories = [
    { value: 'general', label: 'General Feedback', desc: 'Share overall experience', iconPath: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z', iconColor: 'text-blue-500', iconBg: 'bg-blue-50' },
    { value: 'content_quality', label: 'Content Quality', desc: 'About courses and materials', iconPath: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25', iconColor: 'text-violet-500', iconBg: 'bg-violet-50' },
    { value: 'ui_ux', label: 'Design & UX', desc: 'Platform usability and design', iconPath: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42', iconColor: 'text-pink-500', iconBg: 'bg-pink-50' },
    { value: 'payment', label: 'Payments', desc: 'Billing and transactions', iconPath: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z', iconColor: 'text-emerald-500', iconBg: 'bg-emerald-50' },
    { value: 'bug', label: 'Bug Report', desc: "Something isn't working", iconPath: 'M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 01.4-2.253M12 8.25a2.25 2.25 0 00-2.248 2.146M12 8.25a2.25 2.25 0 012.248 2.146M8.683 5a6.032 6.032 0 01-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0115.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 00-.575-1.752M4.921 6a24.048 24.048 0 00-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 01-5.223 1.082', iconColor: 'text-red-500', iconBg: 'bg-red-50' },
    { value: 'feature_request', label: 'Feature Request', desc: 'Suggest something new', iconPath: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z', iconColor: 'text-amber-500', iconBg: 'bg-amber-50' },
];

function FeedbackPage() {
    const { user } = useSelector(state => state.auth);
    const navigate = useNavigate();

    const [category, setCategory] = useState('general');
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    if (!user) {
        return (
                    <div className="max-w-lg mx-auto text-center py-20">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg></div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">Login Required</h2>
                    <p className="text-slate-500 mb-6">Please login to submit feedback</p>
                    <button onClick={() => navigate('/login')} className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700">
                        Login
                    </button>
                </div>
    
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!review.trim() || review.trim().length < 5) {
            setError('Please write at least 5 characters of feedback');
            return;
        }
        setSubmitting(true); setError('');
        try {
            await api.post('/feedback', {
                type: 'platform',
                category,
                rating: rating || null,
                review: review.trim()
            });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
        } finally { setSubmitting(false); }
    };

    if (success) {
        return (
                    <div className="max-w-lg mx-auto text-center py-20">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"><svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <h2 className="text-3xl font-black text-slate-900 mb-3">Thank You!</h2>
                    <p className="text-slate-600 text-lg mb-2">Your feedback has been received.</p>
                    <p className="text-slate-400 text-sm mb-8">We review every submission and use it to improve DreamJob for everyone.</p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={() => { setSuccess(false); setReview(''); setRating(0); setCategory('general'); }}
                            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition">
                            Submit More
                        </button>
                        <button onClick={() => navigate('/')}
                            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition">
                            Back to Dashboard
                        </button>
                    </div>
                </div>
    
        );
    }

    return (
        <>
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-primary-500/30"><svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg></div>
                    <h1 className="text-3xl font-black text-slate-900">Share Feedback</h1>
                    <p className="text-slate-500 mt-2">Help us make DreamJob better. Your input matters!</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Category picker */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="font-bold text-slate-900 mb-4">What's your feedback about?</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {categories.map(cat => (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setCategory(cat.value)}
                                    className={`p-3 rounded-xl border-2 text-left transition ${category === cat.value ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                >
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${cat.iconBg}`}>
                                        <svg className={`w-4 h-4 ${cat.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={cat.iconPath} />
                                        </svg>
                                    </div>
                                    <p className={`text-xs font-semibold ${category === cat.value ? 'text-primary-700' : 'text-slate-700'}`}>
                                        {cat.label}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">{cat.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rating */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="font-bold text-slate-900 mb-2">Overall rating <span className="text-slate-400 font-normal text-sm">(optional)</span></h2>
                        <p className="text-slate-500 text-sm mb-4">How would you rate your overall DreamJob experience?</p>
                        <div className="flex items-center gap-4">
                            <StarRating value={rating} onChange={setRating} />
                            {rating > 0 && (
                                <div>
                                    <p className="font-bold text-slate-900">{['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'][rating]}</p>
                                    <button type="button" onClick={() => setRating(0)} className="text-xs text-slate-400 hover:text-red-500">Clear</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Feedback text */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="font-bold text-slate-900 mb-2">Your feedback <span className="text-red-500">*</span></h2>
                        <p className="text-slate-500 text-sm mb-4">Be as detailed as possible — this helps our team understand and act on your feedback.</p>
                        <textarea
                            value={review}
                            onChange={e => setReview(e.target.value)}
                            placeholder={
                                category === 'bug' ? "Describe the bug: what happened, when, and what you expected to happen..." :
                                category === 'feature_request' ? "Describe the feature you'd like to see and how it would help you..." :
                                "Share your experience, suggestions, or anything else on your mind..."
                            }
                            rows={5}
                            required
                            className="input-field text-sm resize-none"
                        />
                        <div className="flex justify-between mt-1">
                            <span className={`text-xs ${review.length < 5 ? 'text-red-400' : 'text-slate-400'}`}>{review.length} chars (min 5)</span>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || review.trim().length < 5}
                        className="w-full flex items-center justify-center gap-2 py-4 text-white font-bold rounded-2xl bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 shadow-primary hover:shadow-glow-violet transition-all duration-200 disabled:opacity-60 text-base"
                    >
                        {submitting ? (
                            <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                                Submit Feedback
                            </>
                        )}
                    </button>
                </form>
            </div>

        </>
    );
}

export default FeedbackPage;
