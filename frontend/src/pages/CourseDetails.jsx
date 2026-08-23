import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { load } from '@cashfreepayments/cashfree-js';
import api from '../lib/api';
import { useSelector } from 'react-redux';
import SecurePdfViewer from '../components/SecurePdfViewer';
import { applySubscriptionDiscount, getSubscriptionDiscountPercent } from '../lib/subscription';
import { mintStreamUrl } from '../lib/courseStream';

const formatDuration = (seconds) => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s > 0 ? `${s}s` : ''}`.trim();
    return `${s}s`;
};

// ── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ value = 0, onChange, readonly = false, size = 'md' }) {
    const [hover, setHover] = useState(0);
    const sz = size === 'sm' ? 'text-base' : 'text-2xl';
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
                <button key={star} type="button" disabled={readonly}
                    onClick={() => !readonly && onChange?.(star)}
                    onMouseEnter={() => !readonly && setHover(star)}
                    onMouseLeave={() => !readonly && setHover(0)}
                    className={`${sz} transition-transform ${!readonly ? 'hover:scale-125 cursor-pointer' : 'cursor-default'} ${star <= (hover || value) ? 'text-amber-400' : 'text-slate-200'}`}>
                    ★
                </button>
            ))}
        </div>
    );
}

// ── Coupon Input ─────────────────────────────────────────────────────────────
function CouponInput({ price, onDiscount }) {
    const [code, setCode] = useState('');
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const apply = async () => {
        if (!code.trim()) return;
        setChecking(true); setError(''); setResult(null);
        try {
            const { data } = await api.post('/coupons/validate', { code: code.trim(), orderAmount: price, applicableTo: 'courses' });
            setResult(data.data); onDiscount(data.data);
        } catch (err) { setError(err.response?.data?.message || 'Invalid coupon'); onDiscount(null); }
        finally { setChecking(false); }
    };

    const remove = () => { setCode(''); setResult(null); setError(''); onDiscount(null); };

    return (
        <div className="mt-4">
            {result ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div><p className="text-emerald-700 font-bold text-sm">{result.code} applied!</p><p className="text-emerald-600 text-xs">Saved ₹{result.discount}</p></div>
                    </div>
                    <button onClick={remove} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && apply()}
                        placeholder="COUPON CODE" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none uppercase" />
                    <button onClick={apply} disabled={checking} className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60 hover:bg-slate-900 transition">
                        {checking ? '...' : 'Apply'}
                    </button>
                </div>
            )}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
}

// ── Rate Modal ───────────────────────────────────────────────────────────────
function RateModal({ courseId, onClose, onSubmitted }) {
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        if (rating === 0) { setError('Please select a star rating'); return; }
        if (review.trim().length < 3) { setError('Please write at least 3 characters'); return; }
        setSubmitting(true); setError('');
        try {
            const { data } = await api.post(`/courses/${courseId}/reviews`, { rating, comment: review.trim() });
            onSubmitted(data.data);
            onClose();
        } catch (err) { setError(err.response?.data?.message || 'Failed to submit'); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-bold text-slate-900">Rate this Course</h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex justify-center mb-2"><StarRating value={rating} onChange={setRating} /></div>
                <p className="text-center text-sm text-slate-500 mb-4">{rating === 0 ? 'Select a rating' : ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'][rating]}</p>
                <textarea value={review} onChange={e => setReview(e.target.value)} placeholder="Share your experience with other students..."
                    rows={4} className="input-field text-sm resize-none" />
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                <div className="flex gap-3 mt-4">
                    <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
                    <button onClick={submit} disabled={submitting} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 disabled:opacity-60 transition-all duration-200 shadow-primary">
                        {submitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Report Modal ─────────────────────────────────────────────────────────────
function ReportModal({ courseId, reviewId, onClose, onReported }) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        setSubmitting(true);
        try {
            await api.post(`/courses/${courseId}/reviews/${reviewId}/report`, { reason });
            onReported(); onClose();
        } catch (err) { alert(err.response?.data?.message || 'Failed to report'); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="font-bold text-slate-900 mb-3">Report Review</h3>
                <p className="text-sm text-slate-500 mb-4">Why are you reporting this review? Our team will investigate.</p>
                <select value={reason} onChange={e => setReason(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm mb-4 focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="">Select reason...</option>
                    <option value="spam">Spam or fake review</option>
                    <option value="offensive">Offensive content</option>
                    <option value="misleading">Misleading information</option>
                    <option value="other">Other</option>
                </select>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm">Cancel</button>
                    <button onClick={submit} disabled={submitting || !reason}
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-red-700">
                        {submitting ? 'Reporting...' : 'Report'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Reviews Section ──────────────────────────────────────────────────────────
function ReviewsSection({ courseId, isEnrolled, user, onReviewUpdated }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showRateModal, setShowRateModal] = useState(false);
    const [reportingId, setReportingId] = useState(null);
    const [myReview, setMyReview] = useState(null);

    const loadReviews = useCallback(async () => {
        try {
            const { data } = await api.get(`/courses/${courseId}/reviews`);
            const all = data.data || [];
            setReviews(all);
            setMyReview(user ? all.find(r => r.user?._id === user.id || r.user?._id === user._id) : null);
        } catch { } finally { setLoading(false); }
    }, [courseId, user]);

    useEffect(() => { loadReviews(); }, [loadReviews]);

    const handleDelete = async (id) => {
        if (!window.confirm('Delete your review?')) return;
        try {
            await api.delete(`/courses/${courseId}/reviews/${id}`);
            loadReviews();
            if (onReviewUpdated) onReviewUpdated();
        } catch (err) { alert(err.response?.data?.message || 'Failed to delete'); }
    };

    const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;

    return (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Student Reviews</h2>
                    {reviews.length > 0 && (
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-4xl font-black text-slate-900">{avgRating.toFixed(1)}</span>
                            <div>
                                <StarRating value={Math.round(avgRating)} readonly size="md" />
                                <p className="text-slate-500 text-sm mt-0.5">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    )}
                </div>
                {isEnrolled && !myReview && (
                    <button onClick={() => setShowRateModal(true)}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-semibold text-sm hover:bg-amber-100 transition">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" /></svg>
                        Write a Review
                    </button>
                )}
            </div>

            {loading ? (
                <div className="py-8 text-center"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : reviews.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-500 text-sm">No reviews yet.{isEnrolled ? ' Be the first to review!' : ''}</p>
                </div>
            ) : (
                <div className="space-y-5">
                    {reviews.map(r => {
                        const isOwn = user && (r.user?._id === user.id || r.user?._id === user._id);
                        return (
                            <div key={r._id} className={`p-5 rounded-xl border ${isOwn ? 'border-primary-200 bg-primary-50/30' : 'border-slate-100 bg-slate-50'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                            {r.user?.name?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-slate-800 text-sm">{r.user?.name}</span>
                                                {isOwn && <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 text-xs font-bold rounded">You</span>}
                                                <span className="text-slate-400 text-xs">{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                            <div className="mt-1"><StarRating value={r.rating || 0} readonly size="sm" /></div>
                                            <p className="text-slate-700 text-sm mt-2 leading-relaxed">{r.comment || r.review}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {isOwn && (
                                            <button onClick={() => handleDelete(r._id)}
                                                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete your review">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                            </button>
                                        )}
                                        {!isOwn && user && (
                                            <button onClick={() => setReportingId(r._id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition" title="Report this review">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showRateModal && (
                <RateModal courseId={courseId} onClose={() => setShowRateModal(false)}
                    onSubmitted={() => { loadReviews(); if (onReviewUpdated) onReviewUpdated(); }} />
            )}
            {reportingId && (
                <ReportModal courseId={courseId} reviewId={reportingId} onClose={() => setReportingId(null)}
                    onReported={() => alert('Thank you for reporting. Our team will review it.')} />
            )}
        </div>
    );
}

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
const getFileUrl = (path) => path ? (path.startsWith('http') ? path : `${API_BASE}${path}`) : '';

// ── Video Player ─────────────────────────────────────────────────────────────
// Note on content protection: there is no web API that can detect or block
// OS-level screen capture (PrintScreen often never fires a JS event at all,
// and external recorders like OBS or a phone camera never touch window
// focus) — an earlier version of this component pretended otherwise with a
// fake "Screenshots Disabled" blackout. What's real and actually deters
// leaks: (1) the video is only reachable via a short-lived per-user signed
// stream URL (see lib/courseStream.js + backend's courseStreamToken.js), so
// a leaked link is single-chapter, single-user, and time-boxed; (2) a
// per-user watermark burned into the DOM overlay, so any recording carries
// traceable evidence; (3) pausing playback when the tab isn't visible.
function VideoPlayer({ chapter, courseId, user, onChapterComplete, onPositionUpdate, serverPosition }) {
    const videoRef = useRef(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [streamUrl, setStreamUrl] = useState('');
    const [mintError, setMintError] = useState(false);
    const [watermarkTime, setWatermarkTime] = useState(() => new Date());
    const storageKey = `video_progress_${chapter?._id}`;
    const positionSaveTimer = useRef(null);

    // Mint a fresh signed stream URL whenever the chapter changes — only for
    // uploaded-file chapters (chapter.videoPath); external YouTube/Vimeo URLs
    // need no token since we don't serve those files ourselves.
    useEffect(() => {
        setStreamUrl('');
        setMintError(false);
        if (!chapter?.videoPath) return;
        let active = true;
        mintStreamUrl(api, courseId, 'chapter-video', chapter._id)
            .then(url => { if (active) setStreamUrl(url); })
            .catch(() => { if (active) setMintError(true); });
        return () => { active = false; };
    }, [chapter?._id, chapter?.videoPath, courseId]);

    const videoUrl = chapter?.videoPath ? streamUrl : (chapter?.videoUrl || '');

    // Refresh the watermark's timestamp periodically so a recording carries
    // shifting evidence throughout, not just a single static frame.
    useEffect(() => {
        const interval = setInterval(() => setWatermarkTime(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    // Pause playback when the tab isn't visible — a real, honest behavior
    // (unlike the old blur/focus "blackout", which also misfired on
    // innocent alt-tabbing and didn't prevent anything anyway).
    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden && videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    // Reset on chapter change
    useEffect(() => {
        setError(false);
        setLoading(true);
        setPlaybackRate(1);
        if (videoRef.current) {
            videoRef.current.playbackRate = 1;
        }
    }, [chapter?._id]);

    const handleTimeUpdate = () => {
        if (!videoRef.current || !chapter?._id) return;
        const currentTime = videoRef.current.currentTime;
        if (currentTime <= 5) return;
        localStorage.setItem(storageKey, currentTime.toString());
        // Debounce server-side save: flush at most every 30 seconds
        if (onPositionUpdate) {
            clearTimeout(positionSaveTimer.current);
            positionSaveTimer.current = setTimeout(() => {
                onPositionUpdate(chapter._id, Math.floor(currentTime));
            }, 30000);
        }
    };

    const handleLoadedMetadata = () => {
        if (!videoRef.current || !chapter?._id) return;
        // Prefer localStorage (instant, device-local) and fall back to server position
        const localTime = localStorage.getItem(storageKey);
        const restoreTo = localTime
            ? parseFloat(localTime)
            : (serverPosition?.chapter?.toString() === chapter._id && serverPosition?.positionSeconds > 5
                ? serverPosition.positionSeconds
                : 0);
        if (restoreTo > 5) {
            videoRef.current.currentTime = restoreTo;
        }
    };
    const handleSpeedChange = (e) => {
        const speed = parseFloat(e.target.value);
        setPlaybackRate(speed);
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
    };

    if (chapter?.videoPath && !streamUrl && !mintError) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Preparing secure stream…</p>
                </div>
            </div>
        );
    }

    if (mintError) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                <div className="text-center px-6">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                    </div>
                    <p className="font-semibold">Could not start a secure stream</p>
                    <p className="text-slate-400 text-sm mt-1">Refresh the page, or make sure you still have access to this course.</p>
                </div>
            </div>
        );
    }

    if (!videoUrl) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                <div className="text-center">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
                    </div>
                    <p className="text-slate-300 font-medium">{chapter?.title}</p>
                    <p className="text-slate-500 text-sm mt-1">No video available for this chapter</p>
                </div>
            </div>
        );
    }

    // If it's a YouTube / external URL, use iframe
    const isExternal = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') || videoUrl.includes('vimeo.com');

    if (isExternal) {
        let embedUrl = videoUrl;
        if (videoUrl.includes('youtube.com/watch?v=')) {
            embedUrl = videoUrl.replace('watch?v=', 'embed/');
        } else if (videoUrl.includes('youtu.be/')) {
            embedUrl = videoUrl.replace('youtu.be/', 'www.youtube.com/embed/');
        } else if (videoUrl.includes('vimeo.com/')) {
            const id = videoUrl.split('vimeo.com/')[1]?.split('?')[0];
            embedUrl = `https://player.vimeo.com/video/${id}`;
        }
        return (
            <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={chapter?.title}
            />
        );
    }

    // Native HTML5 video player for uploaded files
    return (
        <div 
            className="relative w-full h-full bg-black group protected-content"
            onContextMenu={(e) => e.preventDefault()}
        >
            {user && (
                <div className="absolute top-3 left-3 z-30 pointer-events-none select-none">
                    <div className="bg-black/30 text-white/70 text-[10px] sm:text-xs font-mono px-2 py-1 rounded backdrop-blur-sm">
                        {user.name} • {user.email} • {watermarkTime.toLocaleString()}
                    </div>
                </div>
            )}

            {loading && !error && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60 pointer-events-none">
                    <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900 text-white text-center p-6">
                    <div>
                        <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                        </div>
                        <p className="font-semibold">Could not load video</p>
                        <p className="text-slate-400 text-sm mt-1">The file may be missing or unsupported</p>
                    </div>
                </div>
            )}
            <video
                ref={videoRef}
                key={videoUrl}  // re-mount when source changes
                className="w-full h-full"
                controls
                preload="metadata"
                controlsList="nodownload"
                crossOrigin="anonymous"
                onCanPlay={() => setLoading(false)}
                onError={() => { setLoading(false); setError(true); }}
                onWaiting={() => setLoading(true)}
                onPlaying={() => setLoading(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => onChapterComplete && chapter?._id && onChapterComplete(chapter._id)}
            >
                <source src={videoUrl} type={chapter?.videoMimeType || 'video/mp4'} />
                <source src={videoUrl} type="video/webm" />
                <source src={videoUrl} type="video/ogg" />
                Your browser does not support the video tag.
            </video>

            {/* Custom Speed Control */}
            <div className="absolute top-4 right-4 z-20 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                <select
                    value={playbackRate}
                    onChange={handleSpeedChange}
                    className="bg-black/70 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-white/20 outline-none cursor-pointer backdrop-blur-md hover:bg-black/90 transition"
                    title="Playback Speed"
                >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x Normal</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={1.75}>1.75x</option>
                    <option value={2}>2x</option>
                </select>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function CourseDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);

    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [activeChapter, setActiveChapter] = useState(null);
    const [couponData, setCouponData] = useState(null);
    const [activeTab, setActiveTab] = useState('chapters');
    const [viewingPdfUrl, setViewingPdfUrl] = useState(null);
    const [accessInfo, setAccessInfo] = useState({ hasAccess: false, method: null, validUntil: null });
    const [cashfree, setCashfree] = useState(null);
    const [relatedCourses, setRelatedCourses] = useState([]);
    const [completedChapters, setCompletedChapters] = useState(new Set());
    const [serverPosition, setServerPosition] = useState(null);
    const pendingOrderRef = useRef(null);

    // Mints a short-lived stream token for a chapter PDF or course resource,
    // then opens it in the SecurePdfViewer.
    const openSecurePdf = async (type, itemId) => {
        try {
            const url = await mintStreamUrl(api, id, type, itemId);
            setViewingPdfUrl(url);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to load secure document');
        }
    };

    // Load Cashfree SDK once on mount
    useEffect(() => {
        load({ mode: import.meta.env.VITE_CASHFREE_ENVIRONMENT === 'PRODUCTION' ? 'production' : 'sandbox' })
            .then(cf => setCashfree(cf))
            .catch(err => console.error('[Cashfree] SDK load failed:', err));
    }, []);

    const fetchCourse = async () => {
        try {
            const { data } = await api.get(`/courses/${id}`);
            setCourse(data.data);
            setActiveChapter(prev => {
                if (prev) {
                    const updatedChapter = data.data.chapters?.find(c => c._id === prev._id);
                    return updatedChapter || data.data.chapters?.[0] || null;
                }
                return data.data.chapters?.[0] || null;
            });
        } catch { } finally { setLoading(false); }
    };

    const fetchAccess = async () => {
        if (!user) return;
        try {
            const { data } = await api.get(`/courses/${id}/access`);
            setAccessInfo({ hasAccess: data.hasAccess, method: data.method, validUntil: data.validUntil });
        } catch { }
    };

    useEffect(() => {
        fetchCourse();
        fetchAccess();
        // Fetch related courses and the user's current progress in parallel
        api.get(`/courses/${id}/related`).then(r => setRelatedCourses(r.data.data || [])).catch(() => {});
        if (user) {
            api.get(`/courses/${id}/progress`).then(r => {
                const prog = r.data.data || {};
                setCompletedChapters(new Set((prog.completedChapters || []).map(c => c.chapter)));
                if (prog.lastWatchedPosition?.chapter) setServerPosition(prog.lastWatchedPosition);
            }).catch(() => {});
        }
    }, [id, user]);

    const handlePositionUpdate = useCallback(async (chapterId, positionSeconds) => {
        if (!accessInfo.hasAccess) return;
        api.put(`/courses/${id}/progress/position`, { chapterId, positionSeconds }).catch(() => {});
    }, [id, accessInfo.hasAccess]);

    const handleChapterComplete = useCallback(async (chapterId) => {
        if (!accessInfo.hasAccess) return;
        if (completedChapters.has(chapterId)) return; // already marked
        try {
            const { data } = await api.patch(`/courses/${id}/progress`, { chapterId });
            setCompletedChapters(prev => new Set([...prev, chapterId]));
            if (data.data?.percentComplete >= 100) {
                // Show a brief completion toast
                setTimeout(() => alert('🎉 Course complete! Certificate may be available in Reports → Achievements.'), 300);
            }
        } catch {}
    }, [id, accessInfo.hasAccess, completedChapters]);

    const handleEnrollClick = () => {
        if (!user) { navigate('/login'); return; }
        if (course.price > 0) {
            handlePaidEnroll();
        } else {
            handleEnroll();
        }
    };

    // Free enrollment — direct API call
    const handleEnroll = async () => {
        if (!user) { navigate('/login'); return; }
        setEnrolling(true);
        try {
            await api.post(`/courses/${id}/enroll`, {});
            await fetchCourse();
            await fetchAccess();
        } catch (err) { alert(err.response?.data?.message || 'Failed to enroll'); }
        finally { setEnrolling(false); }
    };

    // Paid purchase — via Cashfree
    const handlePaidEnroll = async () => {
        if (!user) { navigate('/login'); return; }
        setEnrolling(true);
        try {
            // Load SDK on-demand if not already loaded
            let cf = cashfree;
            if (!cf) {
                cf = await load({ mode: import.meta.env.VITE_CASHFREE_ENVIRONMENT === 'PRODUCTION' ? 'production' : 'sandbox' });
                setCashfree(cf);
            }

            const { data } = await api.post('/payments/create-checkout-session', {
                type: 'course',
                itemId: course._id,
                couponCode: couponData?.code || null,
            });
            cf.checkout({
                paymentSessionId: data.paymentSessionId,
                redirectTarget: '_self',
            });
        } catch (err) {
            const existingOrderId = err.response?.data?.existingOrderId;
            if (existingOrderId) {
                navigate(`/payment-status?order_id=${existingOrderId}&type=course&itemId=${course._id}`);
                return;
            }
            alert('Failed to initiate payment: ' + (err.response?.data?.message || err.message));
            setEnrolling(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading course details...</div>;
    if (!course) return <div className="p-8 text-center text-slate-500">Course not found</div>;

    const isEnrolled = accessInfo.hasAccess;
    const discountPercent = getSubscriptionDiscountPercent(user);
    const subDiscountedPrice = applySubscriptionDiscount(course.price, user);
    const finalPrice = couponData ? couponData.finalAmount : subDiscountedPrice;
    const levels = course.levels?.length > 0 ? course.levels : [course.level].filter(Boolean);
    const sortedChapters = [...(course.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const totalDurationSecs = sortedChapters.reduce((s, ch) => s + (ch.duration || 0), 0);
    const hasResources = (course.resources || []).length > 0;
    const hasPracticeTests = (course.practiceTests || []).length > 0;

    // Chapters with free preview available even without enrollment
    const canWatchChapter = (chapter) => isEnrolled || chapter.isFree;

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-8 pb-20 lg:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Video + Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* ── Video Player ── */}
                        <div className="bg-black rounded-2xl overflow-hidden aspect-video relative shadow-lg">
                            {activeChapter && canWatchChapter(activeChapter) ? (
                                <VideoPlayer
                                    chapter={activeChapter}
                                    courseId={course._id}
                                    user={user}
                                    onChapterComplete={isEnrolled ? handleChapterComplete : undefined}
                                    onPositionUpdate={isEnrolled ? handlePositionUpdate : undefined}
                                    serverPosition={serverPosition}
                                />
                            ) : activeChapter ? (
                                /* Locked video */
                                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                                    <div className="text-center px-6">
                                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">Enroll to Watch</h3>
                                        <p className="text-slate-400 text-sm mb-4">"{activeChapter.title}" is locked. Enroll to get full access.</p>
                                        <button onClick={handleEnrollClick} disabled={enrolling}
                                            className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-60">
                                            {enrolling ? 'Enrolling...' : course.price > 0 ? `Enroll for ₹${finalPrice}` : 'Enroll Free'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* No chapters */
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                                    <div className="text-center">
                                        <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" /></svg>
                                        </div>
                                        <p className="text-slate-300 font-medium">No chapters yet</p>
                                        <p className="text-slate-500 text-sm mt-1">Content coming soon!</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {activeChapter && isEnrolled && (
                            <p className="text-xs text-slate-400 flex items-center gap-1.5 -mt-2">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                                This video is watermarked to your account and access is time-limited — please don't share or re-record it.
                            </p>
                        )}

                        {/* Now playing bar */}
                        {activeChapter && isEnrolled && (
                            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse flex-shrink-0" />
                                <span className="text-sm font-semibold text-indigo-800">Now Playing:</span>
                                <span className="text-sm text-indigo-700 truncate">{activeChapter.title}</span>
                                {activeChapter.duration > 0 && (
                                    <span className="ml-auto text-xs text-indigo-500 flex-shrink-0">{formatDuration(activeChapter.duration)}</span>
                                )}
                                {activeChapter.pdfPath && (
                                    <button
                                        onClick={() => openSecurePdf('chapter-pdf', activeChapter._id)}
                                        className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                        PDF
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Course Info */}
                        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="text-primary-600 text-sm font-bold uppercase tracking-wider">{course.category}</span>
                                {levels.map(l => (
                                    <span key={l} className={`px-2 py-0.5 rounded-full text-xs font-bold ${l === 'Beginner' ? 'bg-green-100 text-green-700' : l === 'Intermediate' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{l}</span>
                                ))}
                            </div>

                            <h1 className="text-3xl font-bold text-slate-900 mb-3">{course.title}</h1>

                            <div className="flex items-center gap-2 mb-4">
                                <StarRating value={Math.round(course.rating || 0)} readonly size="sm" />
                                <span className="text-slate-700 font-semibold text-sm">{(course.rating || 0).toFixed(1)}</span>
                                <span className="text-slate-400 text-sm">({course.totalReviews || 0} reviews)</span>
                                {totalDurationSecs > 0 && (
                                    <span className="ml-2 text-slate-400 text-sm">• {formatDuration(totalDurationSecs)} total</span>
                                )}
                            </div>

                            <p className="text-slate-600 leading-relaxed mb-6 whitespace-pre-wrap">{course.description}</p>

                            {course.whatYoullLearn?.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="font-bold text-slate-800 mb-3">What You'll Learn</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {course.whatYoullLearn.map((item, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                                <span className="text-emerald-500 font-bold flex-shrink-0 mt-0.5">✓</span>
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600">
                                    {course.seller?.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Instructor</p>
                                    <p className="font-medium text-slate-900">{course.seller?.name || 'Unknown'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Enroll + Chapters/Resources/Tests */}
                    <div className="space-y-6">
                        {/* Enroll card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-6">
                            {isEnrolled ? (
                                <div className="text-center">
                                    <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <p className="font-bold text-emerald-700 text-lg">You're Enrolled!</p>
                                    <p className="text-slate-500 text-sm mt-1">
                                        {accessInfo.method === 'subscription' && accessInfo.validUntil
                                            ? `Course valid till: ${new Date(accessInfo.validUntil).toLocaleDateString()}`
                                            : 'Life long access'}
                                    </p>
                                    
                                    {accessInfo.method === 'subscription' && course.price > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-xs text-slate-500 mb-2">Want to keep this course forever?</p>
                                            <button onClick={() => handlePaidEnroll()} disabled={enrolling}
                                                className="w-full bg-slate-900 hover:bg-black text-white font-semibold py-2 px-4 rounded-xl transition text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                                                <span>Upgrade to Lifetime Access</span>
                                                <span className="font-normal text-slate-300">| ₹{finalPrice}</span>
                                            </button>
                                        </div>
                                    )}

                                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-slate-50 rounded-xl p-2">
                                            <p className="font-bold text-slate-800">{sortedChapters.length}</p>
                                            <p className="text-xs text-slate-400">Chapters</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-2">
                                            <p className="font-bold text-slate-800">{course.resources?.length || 0}</p>
                                            <p className="text-xs text-slate-400">Resources</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-2">
                                            <p className="font-bold text-slate-800">{course.practiceTests?.length || 0}</p>
                                            <p className="text-xs text-slate-400">Quizzes</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="text-center mb-4">
                                        {course.price > 0 && finalPrice < course.price ? (
                                            <div>
                                                <span className="text-2xl font-bold text-slate-400 line-through mr-2">₹{course.price}</span>
                                                <span className="text-4xl font-bold text-emerald-600">₹{finalPrice}</span>
                                                {discountPercent > 0 && <p className="text-xs text-emerald-600 font-medium mt-1">{discountPercent}% subscriber discount{couponData ? ' + ' : ''}{couponData ? `${couponData.code} coupon` : ''} applied</p>}
                                                {discountPercent === 0 && couponData && <p className="text-xs text-emerald-600 font-medium mt-1">{couponData.code} coupon applied</p>}
                                            </div>
                                        ) : (
                                            <h3 className="text-4xl font-bold text-slate-900">{course.price > 0 ? `₹${course.price}` : 'Free'}</h3>
                                        )}
                                        <p className="text-slate-500 text-sm mt-1">Full lifetime access</p>
                                    </div>
                                    {course.price > 0 && <CouponInput price={subDiscountedPrice} onDiscount={setCouponData} />}
                                    <button onClick={handleEnrollClick} disabled={enrolling}
                                        className="w-full mt-4 flex justify-center items-center gap-2 py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 shadow-primary hover:shadow-glow-violet transition-all duration-200 disabled:opacity-70">
                                        {enrolling ? (
                                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enrolling...</>
                                        ) : course.price > 0 ? `Enroll for ₹${finalPrice}` : 'Enroll Free'}
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Tab selector for right panel */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Tabs */}
                            <div className="flex border-b border-slate-200">
                                <button onClick={() => setActiveTab('chapters')}
                                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition inline-flex items-center justify-center gap-1.5 ${activeTab === 'chapters' ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
                                    Chapters
                                </button>
                                {hasResources && (
                                    <button onClick={() => setActiveTab('resources')}
                                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition inline-flex items-center justify-center gap-1.5 ${activeTab === 'resources' ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                                        Files
                                    </button>
                                )}
                                {hasPracticeTests && (
                                    <button onClick={() => setActiveTab('tests')}
                                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition inline-flex items-center justify-center gap-1.5 ${activeTab === 'tests' ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
                                        Quizzes
                                    </button>
                                )}
                            </div>

                            {/* Chapters tab */}
                            {activeTab === 'chapters' && (
                                <div className="divide-y divide-slate-100 sm:max-h-[520px] sm:overflow-y-auto">
                                    {sortedChapters.length > 0 ? (
                                        sortedChapters.map((chapter, index) => {
                                            const canWatch = canWatchChapter(chapter);
                                            const isActive = activeChapter?._id === chapter._id;
                                            return (
                                                <button key={chapter._id}
                                                    onClick={() => canWatch && setActiveChapter(chapter)}
                                                    className={`w-full text-left p-4 transition flex items-start gap-3 ${isActive ? 'bg-primary-50 border-l-4 border-primary-500' : 'border-l-4 border-transparent hover:bg-slate-50'} ${!canWatch ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                    <div className="mt-0.5 flex-shrink-0">
                                                        {isActive ? (
                                                            <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                                                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                                            </div>
                                                        ) : completedChapters.has(chapter._id) ? (
                                                            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                            </div>
                                                        ) : canWatch ? (
                                                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                            <p className={`font-medium text-sm ${isActive ? 'text-primary-700' : 'text-slate-700'}`}>
                                                                {index + 1}. {chapter.title}
                                                            </p>
                                                            {chapter.isFree && !isEnrolled && (
                                                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">FREE</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {chapter.duration > 0 && (
                                                                <span className="text-xs text-slate-400">{formatDuration(chapter.duration)}</span>
                                                            )}
                                                            {chapter.pdfPath && isEnrolled && (
                                                                <button onClick={(e) => { e.stopPropagation(); openSecurePdf('chapter-pdf', chapter._id); }}
                                                                    className="text-xs text-red-500 hover:underline flex items-center gap-0.5">
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                                                    PDF
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="p-6 text-center text-sm text-slate-500">No chapters uploaded yet.</div>
                                    )}

                                    {/* Summary row */}
                                    {sortedChapters.length > 0 && (
                                        <div className="px-4 py-3 bg-slate-50 text-xs text-slate-500 flex items-center gap-3">
                                            <span>{sortedChapters.length} chapters</span>
                                            {totalDurationSecs > 0 && <span>• {formatDuration(totalDurationSecs)} total</span>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Resources tab */}
                            {activeTab === 'resources' && (
                                <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                                    {course.resources?.map(r => (
                                        <div key={r._id} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition">
                                            <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center text-red-500 flex-shrink-0">
                                                {r.fileType === 'pdf' ? (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                                ) : r.fileType === 'ppt' || r.fileType === 'pptx' ? (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                                                <p className="text-xs text-slate-400">{r.fileType?.toUpperCase()}</p>
                                            </div>
                                            {isEnrolled ? (
                                                <button onClick={() => openSecurePdf('resource', r._id)}
                                                    className="text-xs px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 flex-shrink-0">
                                                    View Securely
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400 flex-shrink-0 flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                                                    Enroll
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Practice Tests tab */}
                            {activeTab === 'tests' && (
                                <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                                    {course.practiceTests?.map(test => (
                                        <div key={test._id || test} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition">
                                            <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center text-violet-500 flex-shrink-0">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">
                                                    {test.title || 'Practice Test'}
                                                </p>
                                                {test.subject && <p className="text-xs text-slate-400">{test.subject}</p>}
                                            </div>
                                            {isEnrolled && test._id ? (
                                                <a href={`/practice-tests/${test._id}/quiz`}
                                                    className="text-xs px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg font-medium hover:bg-violet-100 flex-shrink-0">
                                                    Start
                                                </a>
                                            ) : (
                                                <span className="text-xs text-slate-400 flex-shrink-0 flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                                                    Enroll
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Reviews Section — full width below */}
                <ReviewsSection courseId={id} isEnrolled={isEnrolled} user={user} onReviewUpdated={fetchCourse} />

                {/* Related Courses */}
                {relatedCourses.length > 0 && (
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Courses</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {relatedCourses.map(rc => (
                                <a key={rc._id} href={`/courses/${rc.slug || rc._id}`}
                                    className="group border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition flex flex-col">
                                    <div className="aspect-video bg-slate-100 overflow-hidden">
                                        {(rc.thumbnailPath || rc.thumbnail) ? (
                                            <img src={getFileUrl(rc.thumbnailPath || rc.thumbnail)} alt={rc.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200 text-3xl">📚</div>
                                        )}
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col">
                                        <p className="font-bold text-slate-900 text-sm line-clamp-2 group-hover:text-primary-600">{rc.title}</p>
                                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                            <span className="text-amber-400">★</span>
                                            <span>{(rc.rating || 0).toFixed(1)}</span>
                                            {rc.enrollmentCount > 0 && <span className="ml-1">• {rc.enrollmentCount.toLocaleString()} students</span>}
                                        </div>
                                        <p className="mt-auto pt-2 font-bold text-slate-900 text-sm">{rc.price > 0 ? `₹${rc.price}` : 'Free'}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile sticky buy button — hidden on lg+ where the sidebar card is visible */}
            {!isEnrolled && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-30 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-lg">{course.price > 0 ? `₹${finalPrice}` : 'Free'}</p>
                        <p className="text-xs text-slate-400">Full lifetime access</p>
                    </div>
                    <button
                        onClick={handleEnrollClick}
                        disabled={enrolling}
                        className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl disabled:opacity-60 hover:bg-indigo-700 transition">
                        {enrolling ? 'Enrolling...' : course.price > 0 ? `Enroll for ₹${finalPrice}` : 'Enroll Free'}
                    </button>
                </div>
            )}

            {viewingPdfUrl && (
                <SecurePdfViewer
                    url={viewingPdfUrl}
                    user={user}
                    onClose={() => setViewingPdfUrl(null)}
                />
            )}

        </>
    );
}

export default CourseDetails;
