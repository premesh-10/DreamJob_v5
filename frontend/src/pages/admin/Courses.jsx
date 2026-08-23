import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import { mintStreamUrl } from '../../lib/courseStream';
import {
  createColumnHelper, flexRender,
  getCoreRowModel, useReactTable,
  getPaginationRowModel, getSortedRowModel, getFilteredRowModel,
} from '@tanstack/react-table';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ExportButtons from '../../components/ExportButtons';

const API_BASE = 'http://localhost:5000';
const getFileUrl = (p) => p ? (p.startsWith('http') ? p : `${API_BASE}${p}`) : '';
const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDuration = (secs) => {
    if (!secs || secs <= 0) return null;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s > 0 ? `${s}s` : ''}`.trim();
    return `${s}s`;
};

const SortAsc = () => (
    <svg className="w-3.5 h-3.5 inline-block ml-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
    </svg>
);
const SortDesc = () => (
    <svg className="w-3.5 h-3.5 inline-block ml-1 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
    </svg>
);

// ── Action Reason Modal ────────────────────────────────────────────────────────
function ActionReasonModal({ title, promptText, actionText, actionColor, isOpen, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    if (!isOpen) return null;
    const btnClass = actionColor === 'red'
        ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
        : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
                <p className="text-sm text-slate-500 mb-4">{promptText || 'Please provide a reason. This will be sent to the seller.'}</p>
                <textarea
                    value={reason} onChange={e => setReason(e.target.value)} required rows={3}
                    className="input-field resize-none mb-4"
                    placeholder="Reason..."
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                    <button
                        onClick={() => { if (reason.trim()) onConfirm(reason.trim()); }}
                        disabled={!reason.trim()}
                        className={`flex-1 py-2.5 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-all duration-200 shadow-sm ${btnClass}`}
                    >
                        {actionText}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Course Detail Drawer ───────────────────────────────────────────────────────
function CourseDrawer({ course, onClose, onUpdate }) {
    const [tab, setTab] = useState('chapters');

    const viewChapterFile = async (chapterId, type) => {
        try {
            const url = await mintStreamUrl(api, course._id, type, chapterId);
            window.open(url, '_blank');
        } catch { alert('Failed to open file'); }
    };

    const viewResource = async (resourceId) => {
        try {
            const url = await mintStreamUrl(api, course._id, 'resource', resourceId);
            window.open(url, '_blank');
        } catch { alert('Failed to open resource'); }
    };

    const handleApproveChapter = async (chapterId) => {
        try {
            const { data } = await api.patch(`/admin/courses/${course._id}/chapters/${chapterId}/approve`, {});
            if (onUpdate) onUpdate(course._id, data.course);
        } catch { alert('Failed to approve chapter'); }
    };

    const handleApproveResource = async (resourceId) => {
        try {
            const { data } = await api.patch(`/admin/courses/${course._id}/resources/${resourceId}/approve`, {});
            if (onUpdate) onUpdate(course._id, data.course);
        } catch { alert('Failed to approve resource'); }
    };

    const [publishing, setPublishing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [rejectChapterTarget, setRejectChapterTarget] = useState(null);

    const handleTogglePublish = async () => {
        setPublishing(true);
        try {
            const { data } = await api.patch(`/admin/courses/${course._id}/publish`, {});
            onUpdate(course._id, { isPublished: data.isPublished });
        } catch { alert('Failed'); }
        finally { setPublishing(false); }
    };

    const handleDeleteCourse = async (reason) => {
        setDeleting(true);
        try {
            await api.delete(`/admin/courses/${course._id}`, { data: { reason } });
            setDeleteTarget(null);
            onClose();
            onUpdate(course._id, null);
        } catch { alert('Failed to delete course'); setDeleting(false); }
    };

    const handleDeleteChapter = async (reason) => {
        const chapterId = deleteTarget.chapterId;
        try {
            const { data } = await api.delete(`/admin/courses/${course._id}/chapters/${chapterId}`, { data: { reason } });
            setDeleteTarget(null);
            if (onUpdate) onUpdate(course._id, data.course);
        } catch { alert('Failed to delete chapter'); }
    };

    const handleRejectChapter = async (reason) => {
        try {
            const { data } = await api.patch(`/admin/courses/${course._id}/chapters/${rejectChapterTarget}/reject`, { reason });
            setRejectChapterTarget(null);
            if (onUpdate) onUpdate(course._id, data.course);
        } catch { alert('Failed to reject chapter request'); }
    };

    const TABS = [
        { id: 'info', label: 'Info', iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { id: 'chapters', label: 'Chapters', iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
        { id: 'resources', label: 'Resources', iconPath: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-2xl bg-white h-screen overflow-y-auto shadow-2xl flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 flex-shrink-0 bg-slate-50">
                    <div className="flex items-start gap-3">
                        {(course.thumbnailPath || course.thumbnail) ? (
                            <img src={getFileUrl(course.thumbnailPath || course.thumbnail)} alt=""
                                className="w-16 h-12 object-cover rounded-xl flex-shrink-0 shadow-sm"
                                onError={e => e.target.style.display = 'none'} />
                        ) : (
                            <div className="w-16 h-12 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                <svg className="w-7 h-7 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${course.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {course.isPublished && (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    {course.isPublished ? 'Published' : 'Draft'}
                                </span>
                                <span className="text-xs text-slate-400">{course.category}</span>
                            </div>
                            <h2 className="font-bold text-slate-900 text-base leading-tight">{course.title}</h2>
                            <p className="text-xs text-slate-500 mt-0.5">by {course.seller?.name || 'Unknown'} &bull; {course.seller?.email}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button onClick={handleTogglePublish} disabled={publishing}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${course.isPublished ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                                {publishing ? '...' : course.isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                            <button onClick={() => setDeleteTarget({ type: 'course' })} disabled={deleting}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition border border-red-200">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                {deleting ? '...' : 'Delete'}
                            </button>
                            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-4 gap-px bg-slate-100 border-b border-slate-200 flex-shrink-0">
                    {[
                        { label: 'Students', value: course.enrolledUsers?.length || 0 },
                        { label: 'Chapters', value: course.chapters?.length || 0 },
                        { label: 'Resources', value: course.resources?.length || 0 },
                        { label: 'Rating', value: course.rating?.toFixed(1) || '0.0' },
                    ].map(s => (
                        <div key={s.label} className="bg-white px-3 py-3 text-center">
                            <p className="text-xl font-black text-slate-800">{s.value}</p>
                            <p className="text-xs text-slate-400">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 flex-shrink-0 bg-white">
                    {TABS.map(({ id, label, iconPath }) => (
                        <button key={id} onClick={() => setTab(id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-all duration-150 ${
                                tab === id
                                    ? 'border-b-2 border-primary-600 text-primary-700'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={iconPath} />
                            </svg>
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 p-5 overflow-y-auto">
                    {tab === 'info' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="section-label mb-2">Description</h3>
                                <p className="text-sm text-slate-700 leading-relaxed">{course.description}</p>
                            </div>
                            {course.whatYoullLearn?.length > 0 && (
                                <div>
                                    <h3 className="section-label mb-2">What You'll Learn</h3>
                                    <ul className="space-y-1">
                                        {course.whatYoullLearn.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                </svg>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Price', value: course.price > 0 ? `₹${course.price}` : 'Free' },
                                    { label: 'Language', value: course.language || 'English' },
                                    { label: 'Level', value: (course.levels || [course.level]).join(', ') },
                                    { label: 'Reviews', value: course.totalReviews || 0 },
                                ].map(({ label, value }) => (
                                    <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                                        <p className="font-bold text-slate-800">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === 'chapters' && (
                        <div className="space-y-3">
                            {course.chapters?.length === 0 && (
                                <div className="py-12 text-center text-slate-400">
                                    <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                    No chapters yet
                                </div>
                            )}
                            {course.chapters?.map((ch, idx) => (
                                <div key={ch._id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-7 h-7 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">{idx + 1}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className="font-semibold text-slate-800 text-sm">{ch.title}</p>
                                                {ch.isFree && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Free</span>}
                                                {ch.approvalStatus === 'pending_add' && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        Pending Add
                                                    </span>
                                                )}
                                                {ch.approvalStatus === 'pending_delete' && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        Pending Delete
                                                    </span>
                                                )}
                                            </div>
                                            {ch.description && <p className="text-xs text-slate-500 mb-2">{ch.description}</p>}
                                            <div className="flex gap-3 flex-wrap items-center">
                                                {ch.videoPath && (
                                                    <button onClick={() => viewChapterFile(ch._id, 'chapter-video')}
                                                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        Video {ch.videoSize ? `(${formatSize(ch.videoSize)})` : ''}
                                                    </button>
                                                )}
                                                {ch.videoUrl && !ch.videoPath && (
                                                    <a href={ch.videoUrl} target="_blank" rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline font-medium">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                        Video URL
                                                    </a>
                                                )}
                                                {ch.pdfPath && (
                                                    <button onClick={() => viewChapterFile(ch._id, 'chapter-pdf')}
                                                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                        {ch.pdfTitle || 'PDF'} {ch.pdfSize ? `(${formatSize(ch.pdfSize)})` : ''}
                                                    </button>
                                                )}
                                                {ch.duration > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        {fmtDuration(ch.duration)}
                                                    </span>
                                                )}
                                                {ch.approvalStatus === 'pending_add' && (
                                                    <>
                                                        <button onClick={() => handleApproveChapter(ch._id)} className="ml-auto text-xs px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-sm font-semibold">Approve Add</button>
                                                        <button onClick={() => setRejectChapterTarget(ch._id)} className="text-xs px-3 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-semibold">Reject</button>
                                                    </>
                                                )}
                                                {ch.approvalStatus === 'pending_delete' && (
                                                    <>
                                                        <button onClick={() => handleApproveChapter(ch._id)} className="ml-auto text-xs px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm font-semibold">Approve Delete</button>
                                                        <button onClick={() => setRejectChapterTarget(ch._id)} className="text-xs px-3 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-semibold">Reject</button>
                                                    </>
                                                )}
                                                {ch.approvalStatus !== 'pending_add' && ch.approvalStatus !== 'pending_delete' && (
                                                    <button onClick={() => setDeleteTarget({ type: 'chapter', chapterId: ch._id })} className="ml-auto text-xs px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-semibold">Delete Video</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'resources' && (
                        <div className="space-y-3">
                            {course.resources?.length === 0 && (
                                <div className="py-12 text-center text-slate-400">
                                    <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    No resources yet
                                </div>
                            )}
                            {course.resources?.map(r => (
                                <div key={r._id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center border border-red-100">
                                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-slate-800 text-sm">{r.title}</p>
                                                {r.approvalStatus === 'pending_add' && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        Pending Add
                                                    </span>
                                                )}
                                                {r.approvalStatus === 'pending_delete' && (
                                                    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        Pending Delete
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400">{r.fileType?.toUpperCase()} &bull; {formatSize(r.fileSize)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => viewResource(r._id)}
                                            className="text-xs px-3 py-1.5 bg-primary-50 border border-primary-200 text-primary-600 rounded-lg font-medium hover:bg-primary-100 transition">
                                            View
                                        </button>
                                        {r.approvalStatus === 'pending_add' && (
                                            <button onClick={() => handleApproveResource(r._id)} className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-sm font-semibold">Approve Add</button>
                                        )}
                                        {r.approvalStatus === 'pending_delete' && (
                                            <button onClick={() => handleApproveResource(r._id)} className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm font-semibold">Approve Delete</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ActionReasonModal
                title={deleteTarget?.type === 'course' ? 'Delete Course' : 'Delete Video'}
                promptText="Please provide a reason for this deletion. This will be sent to the seller."
                actionText="Delete Permanently"
                actionColor="red"
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={deleteTarget?.type === 'course' ? handleDeleteCourse : handleDeleteChapter}
            />
            <ActionReasonModal
                title="Reject Chapter Request"
                promptText="Please provide a reason for rejecting this chapter. This will be sent to the seller."
                actionText="Reject Request"
                actionColor="orange"
                isOpen={!!rejectChapterTarget}
                onClose={() => setRejectChapterTarget(null)}
                onConfirm={handleRejectChapter}
            />
        </div>
    );
}

// ── Main Admin Courses Page ────────────────────────────────────────────────────
function AdminCourses() {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalFilter, setGlobalFilter] = useState('');
    const [drawerCourse, setDrawerCourse] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);

    const fetchCourses = async () => {
        try {
            const { data } = await api.get('/admin/courses', { params: { limit: 1000 } });
            setCourses(data.data);
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => { fetchCourses(); }, []);

    const handleTogglePublish = async (courseId, currentStatus) => {
        if (window.confirm(`${currentStatus ? 'Unpublish' : 'Publish'} this course?`)) {
            try {
                const { data } = await api.patch(`/admin/courses/${courseId}/publish`, {});
                setCourses(prev => prev.map(c => c._id === courseId ? { ...c, isPublished: data.isPublished, approvalStatus: data.approvalStatus } : c));
            } catch { alert('Failed'); }
        }
    };

    const handleDeleteCourse = async (reason) => {
        try {
            await api.delete(`/admin/courses/${deleteTarget}`, { data: { reason } });
            setCourses(prev => prev.filter(c => c._id !== deleteTarget));
            setDeleteTarget(null);
        } catch { alert('Failed to delete course'); }
    };

    const handleRejectRequest = async (reason) => {
        try {
            const { data } = await api.patch(`/admin/courses/${rejectTarget}/reject`, { reason });
            setCourses(prev => prev.map(c => c._id === rejectTarget ? { ...c, isPublished: data.course.isPublished, approvalStatus: data.course.approvalStatus } : c));
            setRejectTarget(null);
        } catch { alert('Failed to reject request'); }
    };

    const handleUpdate = (courseId, updates) => {
        if (updates === null) {
            setCourses(prev => prev.filter(c => c._id !== courseId));
            if (drawerCourse?._id === courseId) setDrawerCourse(null);
        } else {
            setCourses(prev => prev.map(c => c._id === courseId ? { ...c, ...updates } : c));
            if (drawerCourse?._id === courseId) setDrawerCourse(prev => ({ ...prev, ...updates }));
        }
    };

    const columnHelper = createColumnHelper();
    const columns = useMemo(() => [
        columnHelper.display({
            id: 'thumb',
            header: '',
            cell: props => {
                const c = props.row.original;
                const src = c.thumbnailPath || c.thumbnail;
                return src ? (
                    <img src={src.startsWith('http') ? src : `${API_BASE}${src}`} alt="" className="w-12 h-9 object-cover rounded-lg"
                        onError={e => e.target.style.display = 'none'} />
                ) : (
                    <div className="w-12 h-9 bg-primary-50 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                );
            }
        }),
        columnHelper.accessor('title', {
            header: 'Course Title',
            cell: info => (
                <button onClick={() => setDrawerCourse(info.row.original)}
                    className="font-semibold text-slate-900 max-w-[180px] truncate text-left hover:text-primary-700 transition block">
                    {info.getValue()}
                </button>
            ),
        }),
        columnHelper.accessor('seller.name', {
            header: 'Seller',
            cell: info => <span className="text-slate-600">{info.getValue() || 'Unknown'}</span>
        }),
        columnHelper.accessor('category', {
            header: 'Category',
            cell: info => <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-bold uppercase">{info.getValue()}</span>
        }),
        columnHelper.accessor('price', {
            header: 'Price',
            cell: info => <span className="font-semibold text-emerald-600">{info.getValue() > 0 ? `₹${info.getValue()?.toFixed(2)}` : 'Free'}</span>
        }),
        columnHelper.accessor('chapters', {
            header: 'Ch.',
            cell: info => <span className="font-medium text-slate-600">{info.getValue()?.length || 0}</span>
        }),
        columnHelper.accessor('isPublished', {
            header: 'Status',
            cell: info => {
                const isPub = info.getValue();
                const course = info.row.original;
                const approval = course.approvalStatus;
                if (approval === 'pending_delete') return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-red-500 text-white animate-pulse">Pending Delete</span>;
                if (approval === 'pending_unpublish') return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-orange-500 text-white animate-pulse">Pending Unpub</span>;
                const hasPending = (course.chapters || []).some(c => c.approvalStatus === 'pending_add' || c.approvalStatus === 'pending_delete') ||
                                   (course.resources || []).some(r => r.approvalStatus === 'pending_add' || r.approvalStatus === 'pending_delete');
                if (isPub) {
                    if (hasPending) return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-purple-500 text-white animate-pulse">Pending Updates</span>;
                    return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700">Published</span>;
                }
                if (approval === 'pending') return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500 text-white animate-pulse">Pending</span>;
                return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-500">Draft</span>;
            }
        }),
        columnHelper.accessor(row => row.enrollmentCount ?? row.enrolledUsers?.length ?? 0, {
            id: 'students',
            header: 'Students',
            cell: info => <span className="font-medium">{info.getValue()}</span>
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: props => {
                const course = props.row.original;
                return (
                    <div className="flex gap-1.5">
                        <button onClick={() => setDrawerCourse(course)}
                            className="text-xs px-2.5 py-1.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-medium hover:bg-primary-100 transition">
                            View
                        </button>
                        {course.approvalStatus === 'pending_delete' ? (
                            <>
                                <button onClick={() => setDeleteTarget(course._id)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 shadow-sm">Approve Del</button>
                                <button onClick={() => setRejectTarget(course._id)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">Reject</button>
                            </>
                        ) : course.approvalStatus === 'pending_unpublish' ? (
                            <>
                                <button onClick={() => handleTogglePublish(course._id, course.isPublished)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-orange-600 text-white hover:bg-orange-700 shadow-sm">Approve Unpub</button>
                                <button onClick={() => setRejectTarget(course._id)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">Reject</button>
                            </>
                        ) : course.approvalStatus === 'pending' ? (
                            <>
                                <button onClick={() => handleTogglePublish(course._id, course.isPublished)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">Approve</button>
                                <button onClick={() => setRejectTarget(course._id)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200">Reject</button>
                            </>
                        ) : (
                            <button onClick={() => handleTogglePublish(course._id, course.isPublished)}
                                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${course.isPublished ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'}`}>
                                {course.isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                        )}
                    </div>
                );
            },
        })
    ], []);

    const table = useReactTable({
        data: courses,
        columns,
        state: { globalFilter },
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    const published = courses.filter(c => c.isPublished).length;
    const pending = courses.filter(c => c.approvalStatus === 'pending' || c.approvalStatus === 'pending_delete' || c.approvalStatus === 'pending_unpublish').length;

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <AdminPageHeader
                    icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    iconBg="from-emerald-500 to-teal-600"
                    title="Content Moderation"
                    subtitle={`${published} published · ${courses.length} total courses`}
                    actions={
                        <>
                            <div className="relative">
                                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input type="text" value={globalFilter ?? ''} onChange={e => setGlobalFilter(e.target.value)}
                                    placeholder="Search courses..."
                                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-56 bg-white shadow-sm" />
                            </div>
                            <ExportButtons
                                data={courses}
                                filename="Courses_Report"
                                columns={[
                                    { header: 'Title', key: 'title' },
                                    { header: 'Seller', key: 'seller', format: (v) => v?.name || 'Unknown' },
                                    { header: 'Category', key: 'category' },
                                    { header: 'Price', key: 'price', format: (v) => `₹${(v || 0).toFixed(2)}` },
                                    { header: 'Status', key: 'isPublished', format: (v) => v ? 'Published' : 'Draft' },
                                    { header: 'Students', key: 'enrollmentCount', format: (v, row) => v ?? row?.enrolledUsers?.length ?? 0 },
                                    { header: 'Chapters', key: 'chapters', format: (v) => v?.length || 0 },
                                ]}
                            />
                        </>
                    }
                />

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Courses', value: courses.length, from: 'from-primary-50', text: 'text-primary-700', border: 'border-primary-200', iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                        { label: 'Published', value: published, from: 'from-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { label: 'Pending Review', value: pending, from: 'from-amber-50', text: 'text-amber-700', border: 'border-amber-200', iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { label: 'Total Students', value: courses.reduce((s, c) => s + (c.enrollmentCount ?? c.enrolledUsers?.length ?? 0), 0), from: 'from-violet-50', text: 'text-violet-700', border: 'border-violet-200', iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
                    ].map(s => (
                        <div key={s.label} className={`${s.from} bg-gradient-to-br ${s.text} rounded-2xl border ${s.border} p-4 flex items-center gap-3`}>
                            <div className={`w-10 h-10 rounded-xl ${s.from} flex items-center justify-center border ${s.border} flex-shrink-0`}>
                                <svg className={`w-5 h-5 ${s.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={s.iconPath} />
                                </svg>
                            </div>
                            <div>
                                <p className="text-2xl font-black">{s.value}</p>
                                <p className="text-xs font-medium opacity-70 leading-tight">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
                            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Loading courses...</span>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                        {table.getHeaderGroups().map(hg => (
                                            <tr key={hg.id}>
                                                {hg.headers.map(header => (
                                                    <th key={header.id} className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap text-xs uppercase tracking-wide font-semibold" onClick={header.column.getToggleSortingHandler()}>
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                        {{ asc: <SortAsc />, desc: <SortDesc /> }[header.column.getIsSorted()] ?? null}
                                                    </th>
                                                ))}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {table.getRowModel().rows.map(row => (
                                            <tr key={row.id} className="hover:bg-slate-50/70 transition-colors cursor-pointer group" onClick={() => setDrawerCourse(row.original)}>
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="px-5 py-3.5" onClick={e => { if (cell.column.id === 'actions') e.stopPropagation(); }}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {table.getRowModel().rows.length === 0 && (
                                    <div className="p-16 text-center text-slate-400">
                                        <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        No courses found.
                                    </div>
                                )}
                            </div>
                            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                                <span className="text-sm text-slate-500">Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
                                <div className="flex gap-1.5">
                                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 disabled:opacity-40 text-xs font-medium hover:bg-slate-100 transition">Prev</button>
                                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 disabled:opacity-40 text-xs font-medium hover:bg-slate-100 transition">Next</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {drawerCourse && <CourseDrawer course={drawerCourse} onClose={() => setDrawerCourse(null)} onUpdate={handleUpdate} />}
            <ActionReasonModal
                title="Delete Course"
                promptText="Please provide a reason for this deletion. This will be sent to the seller."
                actionText="Delete Permanently"
                actionColor="red"
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteCourse}
            />
            <ActionReasonModal
                title="Reject Request"
                promptText="Please provide a reason for rejecting this request. This will be sent to the seller."
                actionText="Reject Request"
                actionColor="orange"
                isOpen={!!rejectTarget}
                onClose={() => setRejectTarget(null)}
                onConfirm={handleRejectRequest}
            />

        </>
    );
}

export default AdminCourses;
