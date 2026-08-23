import { useState, useEffect } from 'react';
import api from '../../lib/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

function NumberField({ label, value, onChange, note, suffix }) {
    return (
        <div>
            <label className="section-label">{label}</label>
            <div className="flex items-center gap-2">
                <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
                    className="input-field" />
                {suffix && <span className="text-sm text-slate-400 flex-shrink-0">{suffix}</span>}
            </div>
            {note && <p className="text-xs text-slate-400 mt-1.5">{note}</p>}
        </div>
    );
}

function ToggleField({ label, value, onChange, note }) {
    return (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors">
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-700">{label}</span>
                <button type="button" onClick={() => onChange(!value)}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-primary-600' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
                </button>
            </div>
            {note && <p className="text-xs text-slate-400">{note}</p>}
        </div>
    );
}

function SectionCard({ icon, title, children }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
                    </svg>
                </div>
                <h2 className="font-bold text-slate-900">{title}</h2>
            </div>
            <div className="p-6 space-y-5">{children}</div>
        </div>
    );
}

function AdminMockInterviewSettings() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/admin/settings').then(r => setSettings(r.data.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    const set = (key, value) => setSettings(s => ({ ...s, [key]: value }));

    const save = async () => {
        setSaving(true); setMsg('');
        try {
            const { data } = await api.put('/admin/settings', settings);
            setSettings(data.data);
            setMsg('saved');
            setTimeout(() => setMsg(''), 3000);
        } catch { setMsg('error'); }
        finally { setSaving(false); }
    };

    if (loading) return (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading settings...</span>
            </div>

    );

    return (
        <>
            <div className="max-w-3xl mx-auto space-y-6">
                <AdminPageHeader
                    icon="M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.899L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    iconBg="from-violet-500 to-indigo-600"
                    title="Mock Interview Settings"
                    subtitle="Operational controls for the live interview platform — changes apply instantly"
                    actions={
                        <button onClick={save} disabled={saving}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 disabled:opacity-60 transition-all shadow-primary">
                            {saving ? (
                                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    }
                />

                {msg === 'saved' && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Settings saved successfully.
                    </div>
                )}
                {msg === 'error' && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Failed to save settings. Please try again.
                    </div>
                )}

                <SectionCard icon="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" title="Join Window">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <NumberField label="Minutes before start" value={settings.interviewJoinWindowMinutesBefore}
                            onChange={v => set('interviewJoinWindowMinutesBefore', v)} suffix="min"
                            note="How early participants can join the room" />
                        <NumberField label="Minutes after scheduled end" value={settings.interviewJoinWindowMinutesAfterEnd}
                            onChange={v => set('interviewJoinWindowMinutesAfterEnd', v)} suffix="min"
                            note="Grace period to join after the slot ends" />
                        <NumberField label="Late-join threshold" value={settings.lateJoinThresholdMinutes}
                            onChange={v => set('lateJoinThresholdMinutes', v)} suffix="min"
                            note="Joining after this many minutes is flagged 'late'" />
                        <NumberField label="No-show grace period" value={settings.noShowGraceMinutes}
                            onChange={v => set('noShowGraceMinutes', v)} suffix="min"
                            note="How long to wait before declaring a no-show" />
                    </div>
                </SectionCard>

                <SectionCard icon="M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.899L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" title="Recording">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ToggleField label="Recording Enabled" value={settings.recordingEnabled}
                            onChange={v => set('recordingEnabled', v)} note="Master switch for Egress recording" />
                        <ToggleField label="Requires Consent" value={settings.recordingRequiresConsent}
                            onChange={v => set('recordingRequiresConsent', v)} note="Both parties must consent before recording" />
                        <ToggleField label="Candidate Can View Recording" value={settings.candidateCanViewOwnRecording}
                            onChange={v => set('candidateCanViewOwnRecording', v)} note="Otherwise only interviewer/admin can view" />
                    </div>
                </SectionCard>

                <SectionCard icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" title="Cancellation & Refunds">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <NumberField label="Full refund cutoff" value={settings.cancellationFullRefundHoursBefore}
                            onChange={v => set('cancellationFullRefundHoursBefore', v)} suffix="hrs before start"
                            note="Cancelling at or before this gets a 100% refund" />
                        <NumberField label="Partial refund %" value={settings.cancellationPartialRefundPercent}
                            onChange={v => set('cancellationPartialRefundPercent', v)} suffix="%"
                            note="Refund percentage for late cancellations" />
                    </div>
                </SectionCard>

                <SectionCard icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" title="Reminders">
                    <div>
                        <label className="section-label">Hours before start (comma-separated)</label>
                        <input type="text" value={(settings.reminderHoursBefore || []).join(', ')}
                            onChange={e => set('reminderHoursBefore', e.target.value.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0))}
                            className="input-field"
                            placeholder="24, 1" />
                        <p className="text-xs text-slate-400 mt-1.5">"24, 1" sends reminders a day before and an hour before</p>
                    </div>
                </SectionCard>
            </div>

        </>
    );
}

export default AdminMockInterviewSettings;
