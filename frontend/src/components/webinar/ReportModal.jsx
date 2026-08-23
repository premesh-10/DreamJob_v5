import { useState } from 'react';
import api from '../../lib/api';

const REASONS = ['Harassment', 'Inappropriate Behavior', 'Disruptive Conduct', 'Spam', 'Other'];

// Shared by "report this webinar" (RoomChrome) and "report this participant" (EngagementSidebar
// chat) — both just POST to the existing content-report endpoint with a different targetType.
export default function ReportModal({ targetType, targetId, webinarId, label, onClose }) {
    const [reason, setReason] = useState(REASONS[0]);
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await api.post('/experiences/report', { targetType, targetId, webinar: webinarId, reason, details });
            setSubmitted(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit report');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                {submitted ? (
                    <div className="text-center py-4">
                        <p className="text-white font-semibold">✅ Report submitted</p>
                        <p className="text-slate-400 text-sm mt-1">Our moderation team will review this.</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg">Close</button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-3">
                        <h3 className="text-white font-bold text-sm">{label}</h3>
                        {error && <p className="text-red-400 text-xs">{error}</p>}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Reason</label>
                            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none">
                                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Details (optional)</label>
                            <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3}
                                className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none" />
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg">Cancel</button>
                            <button type="submit" disabled={submitting} className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                                {submitting ? 'Submitting…' : 'Submit Report'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
