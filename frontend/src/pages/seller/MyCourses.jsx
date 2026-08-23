import { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { mintStreamUrl } from '../../lib/courseStream';

const API_BASE = 'https://dreamjob-v5.onrender.com';
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const levelColors = { Beginner: 'bg-green-100 text-green-700', Intermediate: 'bg-amber-100 text-amber-700', Advanced: 'bg-red-100 text-red-700' };

const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileUrl = (path) => path ? (path.startsWith('http') ? path : `${API_BASE}${path}`) : '';

// ── Thumbnail Upload Drop Zone ─────────────────────────────────────────────────
function ThumbnailUpload({ current, onChange }) {
    const [preview, setPreview] = useState(current ? getFileUrl(current) : '');
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef();

    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(file);
        onChange(file);
    };

    return (
        <div
            onClick={() => inputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            className={`relative w-full aspect-video rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden transition-all ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50'}`}
        >
            {preview ? (
                <>
                    <img src={preview} alt="Thumbnail" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <div className="text-white text-center">
                            <div className="text-3xl mb-1">📷</div>
                            <p className="text-sm font-semibold">Click to change</p>
                        </div>
                    </div>
                </>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl">🖼️</div>
                    <div>
                        <p className="font-semibold text-slate-700">Drop thumbnail here or click to upload</p>
                        <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP up to 10MB</p>
                    </div>
                </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        </div>
    );
}

function DeleteReasonModal({ title, isOpen, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 mb-4">Please provide a reason for this deletion request. This will be sent to the admin.</p>
                <textarea 
                    value={reason} onChange={e => setReason(e.target.value)} required rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none resize-none mb-4"
                    placeholder="Reason for deletion..."
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200">Cancel</button>
                    <button onClick={() => { if(reason.trim()) onConfirm(reason.trim()); }} disabled={!reason.trim()} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50">Submit Request</button>
                </div>
            </div>
        </div>
    );
}

// ── Create / Edit Course Modal ─────────────────────────────────────────────────
function CourseModal({ course, categories, onClose, onSave }) {
    const initLevels = course?.levels?.length > 0 ? course.levels : (course?.level ? [course.level] : ['Beginner']);
    const [form, setForm] = useState({
        title: course?.title || '',
        description: course?.description || '',
        category: course?.category || '',
        price: course?.price ?? '',
        language: course?.language || 'English',
        levels: initLevels,
        whatYoullLearn: (course?.whatYoullLearn || []).join('\n'),
        requirements: (course?.requirements || []).join('\n'),
        certificateEnabled: course?.certificate?.enabled || false,
    });
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isEdit = !!course?._id;

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    const toggleLevel = (lvl) => {
        setForm(p => {
            const current = p.levels || [];
            const updated = current.includes(lvl) ? current.filter(l => l !== lvl) : [...current, lvl];
            return { ...p, levels: updated.length === 0 ? [lvl] : updated };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const fd = new FormData();
            const { certificateEnabled, ...rest } = form;
            Object.entries({
                ...rest,
                levels: JSON.stringify(rest.levels),
                level: rest.levels[0] || 'Beginner',
                whatYoullLearn: JSON.stringify(rest.whatYoullLearn.split('\n').filter(Boolean)),
                requirements: JSON.stringify(rest.requirements.split('\n').filter(Boolean)),
                certificate: JSON.stringify({ enabled: certificateEnabled }),
            }).forEach(([k, v]) => fd.append(k, v));
            if (thumbnailFile) fd.append('thumbnail', thumbnailFile);

            let savedCourse;
            if (isEdit) {
                const { data } = await api.put(`/courses/${course._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                savedCourse = data.data;
            } else {
                const { data } = await api.post('/courses', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                savedCourse = data.data;
            }
            onSave(savedCourse); onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to save course');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-900">{isEdit ? '✏️ Edit Course' : '🆕 Create New Course'}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                </div>
                {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Thumbnail */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Course Thumbnail</label>
                        <ThumbnailUpload current={course?.thumbnailPath || course?.thumbnail} onChange={setThumbnailFile} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Course Title *</label>
                            <input type="text" name="title" value={form.title} onChange={handleChange} required
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="e.g. Complete Python Bootcamp" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description *</label>
                            <textarea name="description" value={form.description} onChange={handleChange} required rows={3}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                placeholder="What will students learn?" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category *</label>
                            <select name="category" value={form.category} onChange={handleChange} required
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">Select category</option>
                                {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Difficulty Level(s) *</label>
                            <div className="grid grid-cols-3 gap-2">
                                {LEVELS.map(lvl => (
                                    <button key={lvl} type="button" onClick={() => toggleLevel(lvl)}
                                        className={`flex-1 py-2.5 rounded-xl border-2 text-xs sm:text-sm font-semibold transition ${form.levels?.includes(lvl)
                                            ? lvl === 'Beginner' ? 'border-green-500 bg-green-50 text-green-700' : lvl === 'Intermediate' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-red-500 bg-red-50 text-red-700'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                                        {form.levels?.includes(lvl) ? '✓ ' : ''}{lvl}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Price ($)</label>
                            <input type="number" name="price" value={form.price} onChange={handleChange} min="0" step="0.01"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="0 for free" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Language</label>
                            <input type="text" name="language" value={form.language} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">What You'll Learn <span className="text-slate-400 font-normal">(one per line)</span></label>
                            <textarea name="whatYoullLearn" value={form.whatYoullLearn} onChange={handleChange} rows={3}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                placeholder="Build real-world projects&#10;Understand core concepts&#10;Get job-ready skills" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Requirements <span className="text-slate-400 font-normal">(one per line)</span></label>
                            <textarea name="requirements" value={form.requirements} onChange={handleChange} rows={2}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                placeholder="Basic computer skills&#10;Internet connection" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div className={`w-11 h-6 rounded-full transition-colors relative ${form.certificateEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                    onClick={() => setForm(p => ({ ...p, certificateEnabled: !p.certificateEnabled }))}>
                                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.certificateEnabled ? 'translate-x-5' : ''}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Issue Completion Certificate</p>
                                    <p className="text-xs text-slate-400">Students who finish all chapters will receive a certificate</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold disabled:opacity-60">
                            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Course'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Chapter Manager ────────────────────────────────────────────────────────────
function ChapterManager({ course, onUpdate }) {
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [chapterForm, setChapterForm] = useState({ title: '', description: '', isFree: false, videoUrl: '' });
    const [videoFile, setVideoFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [pdfUploading, setPdfUploading] = useState(null);
    const [backfilling, setBackfilling] = useState(false);
    const [backfillResult, setBackfillResult] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [retrying, setRetrying] = useState(null);

    const resetForm = () => { setChapterForm({ title: '', description: '', isFree: false, videoUrl: '' }); setVideoFile(null); };

    const viewChapterPdf = async (chapterId) => {
        try {
            const url = await mintStreamUrl(api, course._id, 'chapter-pdf', chapterId);
            window.open(url, '_blank');
        } catch { alert('Failed to open PDF'); }
    };

    const handleAddChapter = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const fd = new FormData();
            Object.entries(chapterForm).forEach(([k, v]) => fd.append(k, v));
            if (videoFile) fd.append('video', videoFile);
            await api.post(`/courses/${course._id}/chapters`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            resetForm(); setAdding(false); onUpdate();
        } catch (err) { setError(err?.response?.data?.message || 'Failed to add chapter'); }
        finally { setLoading(false); }
    };

    const handleDeleteChapter = async (chapterId, status) => {
        if (status === 'pending_delete') {
            if (!window.confirm('Cancel delete request for this chapter?')) return;
            executeDelete(chapterId);
        } else if (status === 'pending_add' || !course.isPublished) {
            if (!window.confirm('Delete this chapter?')) return;
            executeDelete(chapterId);
        } else {
            setDeleteTarget(chapterId);
        }
    };

    const executeDelete = async (chapterId, reason = '') => {
        try { 
            await api.delete(`/courses/${course._id}/chapters/${chapterId}`, { data: { reason } }); 
            onUpdate(); 
            setDeleteTarget(null);
        } catch { alert('Failed to delete chapter'); }
    };

    const handlePDFUpload = async (chapterId, file) => {
        if (!file) return;
        setPdfUploading(chapterId);
        try {
            const fd = new FormData();
            fd.append('pdf', file);
            fd.append('pdfTitle', file.name);
            await api.post(`/courses/${course._id}/chapters/${chapterId}/pdf`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            onUpdate();
        } catch { alert('Failed to upload PDF'); }
        finally { setPdfUploading(null); }
    };

    const handleRetryProcessing = async (chapterId) => {
        setRetrying(chapterId);
        try {
            await api.post(`/courses/${course._id}/chapters/${chapterId}/reprocess`);
            onUpdate();
        } catch (err) {
            alert(err?.response?.data?.message || 'Failed to requeue processing');
        } finally { setRetrying(null); }
    };

    const handleBackfillDurations = async () => {
        setBackfilling(true); setBackfillResult(null);
        try {
            const { data } = await api.post('/courses/backfill-durations');
            setBackfillResult(data);
            if (data.totalFixed > 0) onUpdate(); // refresh chapter list
        } catch (err) {
            setBackfillResult({ error: err?.response?.data?.message || 'Failed to backfill' });
        } finally { setBackfilling(false); }
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

    return (
        <div className="space-y-3">
            {course.chapters?.length === 0 && !adding && (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-500 text-sm">No chapters yet. Add your first chapter!</p>
                </div>
            )}

            {course.chapters?.map((ch, idx) => (
                <div key={ch._id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">{idx + 1}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold text-slate-900">{ch.title}</h4>
                                    {ch.isFree && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Free Preview</span>}
                                    {ch.approvalStatus === 'pending_add' && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">⏳ Pending Add</span>}
                                    {ch.approvalStatus === 'pending_delete' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold animate-pulse">🗑️ Pending Delete</span>}
                                </div>
                                {ch.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{ch.description}</p>}
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    {(ch.videoPath || ch.videoUrl) && (
                                        <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                                            🎬 {ch.videoPath ? `Video ${ch.videoSize ? `(${formatSize(ch.videoSize)})` : ''}` : 'URL Video'}
                                        </span>
                                    )}
                                    {ch.pdfPath && (
                                        <button onClick={() => viewChapterPdf(ch._id)}
                                            className="flex items-center gap-1 text-xs text-red-600 font-medium hover:underline">
                                            📄 {ch.pdfTitle || 'PDF'} {ch.pdfSize ? `(${formatSize(ch.pdfSize)})` : ''}
                                        </button>
                                    )}
                                    {ch.duration > 0 && (
                                        <span className="text-xs text-slate-400">⏱️ {fmtDuration(ch.duration)}</span>
                                    )}
                                    {ch.processingStatus === 'queued' && (
                                        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                            <span className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> Processing duration…
                                        </span>
                                    )}
                                    {ch.processingStatus === 'processing' && (
                                        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                            <span className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> Processing…
                                            <button onClick={() => handleRetryProcessing(ch._id)} disabled={retrying === ch._id}
                                                className="ml-1 underline text-amber-700 hover:text-amber-900 disabled:opacity-50">
                                                {retrying === ch._id ? 'Retrying…' : 'Stuck? Retry'}
                                            </button>
                                        </span>
                                    )}
                                    {ch.processingStatus === 'failed' && (
                                        <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                                            ⚠️ Duration detection failed
                                            <button onClick={() => handleRetryProcessing(ch._id)} disabled={retrying === ch._id}
                                                className="ml-1 underline text-red-700 hover:text-red-900 disabled:opacity-50">
                                                {retrying === ch._id ? 'Retrying…' : 'Retry'}
                                            </button>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* PDF upload for this chapter */}
                            <label className={`cursor-pointer text-xs px-3 py-2.5 rounded-lg border font-medium transition ${pdfUploading === ch._id ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'} ${ch.approvalStatus === 'pending_delete' ? 'opacity-50 pointer-events-none' : ''}`}>
                                {pdfUploading === ch._id ? 'Uploading...' : '📄 PDF'}
                                <input type="file" accept="application/pdf" className="hidden"
                                    onChange={e => handlePDFUpload(ch._id, e.target.files[0])}
                                    disabled={pdfUploading === ch._id || ch.approvalStatus === 'pending_delete'} />
                            </label>
                            <button onClick={() => handleDeleteChapter(ch._id, ch.approvalStatus)}
                                className={`text-xs px-3 py-2.5 rounded-lg border font-medium ${ch.approvalStatus === 'pending_delete' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}>
                                {ch.approvalStatus === 'pending_delete' ? 'Undo Delete' : ch.approvalStatus === 'pending_add' ? 'Cancel Add' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            ))}

            {adding ? (
                <form onSubmit={handleAddChapter} className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Chapter Title *</label>
                            <input type="text" value={chapterForm.title} onChange={e => setChapterForm(p => ({ ...p, title: e.target.value }))} required
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                                placeholder="e.g. Introduction to Python" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Description</label>
                            <input type="text" value={chapterForm.description} onChange={e => setChapterForm(p => ({ ...p, description: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                                placeholder="Brief description" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Video File (upload)</label>
                            <label className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-white cursor-pointer hover:border-indigo-400 transition text-sm text-slate-600">
                                🎬 {videoFile ? videoFile.name : 'Choose video file'}
                                <input type="file" accept="video/*" className="hidden" onChange={e => setVideoFile(e.target.files[0])} />
                            </label>
                            {videoFile && <p className="text-xs text-slate-400 mt-1">{formatSize(videoFile.size)}</p>}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Or Video URL</label>
                            <input type="url" value={chapterForm.videoUrl} onChange={e => setChapterForm(p => ({ ...p, videoUrl: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                                placeholder="https://youtube.com/..." />
                        </div>
                        <div className="md:col-span-2">
                            <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                                ⚡ <strong>Video duration is detected automatically</strong> by the server when you upload a video file.
                                No need to enter it manually!
                            </p>
                        </div>
                        <div className="flex items-center gap-2 pt-5">
                            <input type="checkbox" id="isFree" checked={chapterForm.isFree}
                                onChange={e => setChapterForm(p => ({ ...p, isFree: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                            <label htmlFor="isFree" className="text-sm font-medium text-slate-700">Free Preview</label>
                        </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => { setAdding(false); resetForm(); }} className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                            {loading ? 'Adding...' : 'Add Chapter'}
                        </button>
                    </div>
                </form>
            ) : (
                <button onClick={() => setAdding(true)}
                    className="w-full py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl text-sm font-semibold hover:border-indigo-500 hover:bg-indigo-50 transition flex items-center justify-center gap-2">
                    <span className="text-lg">+</span> Add Chapter
                </button>
            )}

            {/* Backfill durations for existing videos */}
            {!adding && (
                <div className="pt-1">
                    <button onClick={handleBackfillDurations} disabled={backfilling}
                        className="w-full py-2.5 border border-amber-300 bg-amber-50 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-100 transition flex items-center justify-center gap-2 disabled:opacity-60">
                        {backfilling ? (
                            <><span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> Scanning videos...</>
                        ) : (
                            <>⚡ Auto-detect missing durations</>
                        )}
                    </button>
                    {backfillResult && (
                        <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium ${backfillResult.error ? 'bg-red-50 text-red-700 border border-red-200' : backfillResult.totalFixed > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                            {backfillResult.error
                                ? `❌ ${backfillResult.error}`
                                : backfillResult.totalFixed > 0
                                    ? `✅ Fixed ${backfillResult.totalFixed} chapter duration${backfillResult.totalFixed !== 1 ? 's' : ''} using ffprobe`
                                    : '✅ All chapter durations are already set'}
                        </div>
                    )}
                </div>
            )}
            <DeleteReasonModal 
                isOpen={!!deleteTarget} 
                title="Delete Chapter Request" 
                onClose={() => setDeleteTarget(null)} 
                onConfirm={(reason) => executeDelete(deleteTarget, reason)} 
            />
        </div>
    );

}

// ── Resources Manager ─────────────────────────────────────────────────────────
function ResourcesManager({ course, onUpdate }) {
    const [uploading, setUploading] = useState(false);
    const [resourceTitle, setResourceTitle] = useState('');

    const viewResource = async (resourceId) => {
        try {
            const url = await mintStreamUrl(api, course._id, 'resource', resourceId);
            window.open(url, '_blank');
        } catch { alert('Failed to open resource'); }
    };

    const handleUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('resource', file);
            fd.append('title', resourceTitle || file.name);
            await api.post(`/courses/${course._id}/resources`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setResourceTitle('');
            onUpdate();
        } catch { alert('Failed to upload resource'); }
        finally { setUploading(false); }
    };

    const handleDelete = async (resourceId, status) => {
        if (status === 'pending_delete') {
            if (!window.confirm('Cancel delete request for this resource?')) return;
        } else if (status === 'pending_add') {
            if (!window.confirm('Discard this draft resource?')) return;
        } else {
            if (!window.confirm('Delete this resource?')) return;
        }
        try { await api.delete(`/courses/${course._id}/resources/${resourceId}`); onUpdate(); }
        catch { alert('Failed to delete resource'); }
    };

    return (
        <div className="space-y-3">
            {course.resources?.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">No resources added yet</p>
            )}
            {course.resources?.map(r => (
                <div key={r._id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center text-red-600 font-bold text-sm">
                            {r.fileType === 'pdf' ? '📄' : r.fileType === 'ppt' || r.fileType === 'pptx' ? '📊' : '📎'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-slate-800 text-sm">{r.title}</p>
                                {r.approvalStatus === 'pending_add' && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">⏳ Pending Add</span>}
                                {r.approvalStatus === 'pending_delete' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold animate-pulse">🗑️ Pending Delete</span>}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{r.fileType?.toUpperCase()} • {formatSize(r.fileSize)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => viewResource(r._id)} disabled={r.approvalStatus === 'pending_delete'}
                            className={`text-xs px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 ${r.approvalStatus === 'pending_delete' ? 'opacity-50 pointer-events-none' : ''}`}>
                            View
                        </button>
                        <button onClick={() => handleDelete(r._id, r.approvalStatus)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium ${r.approvalStatus === 'pending_delete' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}>
                            {r.approvalStatus === 'pending_delete' ? 'Undo Delete' : r.approvalStatus === 'pending_add' ? 'Cancel Add' : 'Delete'}
                        </button>
                    </div>
                </div>
            ))}

            {/* Upload new resource */}
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
                <input type="text" value={resourceTitle} onChange={e => setResourceTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    placeholder="Resource title (optional)" />
                <label className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition font-medium text-sm ${uploading ? 'border-indigo-400 bg-indigo-50 text-indigo-500 cursor-not-allowed' : 'border-slate-300 hover:border-indigo-400 text-slate-600 hover:text-indigo-600'}`}>
                    {uploading ? '⏳ Uploading...' : '📎 Click to upload PDF / PPT / DOC'}
                    <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" className="hidden" disabled={uploading}
                        onChange={e => handleUpload(e.target.files[0])} />
                </label>
            </div>
        </div>
    );
}

// ── Course Detail Drawer ──────────────────────────────────────────────────────
function CourseDrawer({ course, onClose, onUpdate, onDelete }) {
    const [tab, setTab] = useState('chapters');
    const [publishing, setPublishing] = useState(false);

    const isPendingDelete = course.approvalStatus === 'pending_delete';

    const handlePublishToggle = async () => {
        setPublishing(true);
        try {
            await api.patch(`/courses/${course._id}/publish`);
            onUpdate();
        } catch (err) {
            const issues = err.response?.data?.issues;
            const message = err.response?.data?.message || 'Failed to toggle publish status';
            alert(issues?.length ? `${message}:\n• ${issues.join('\n• ')}` : message);
        }
        finally { setPublishing(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-2xl bg-white h-screen overflow-y-auto shadow-2xl flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex-shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="font-bold text-slate-900 text-lg leading-tight">{course.title}</h2>
                            <p className="text-slate-500 text-sm mt-1">{course.category} • {(course.levels || [course.level]).join(', ')}</p>
                        </div>
                        <div className="flex items-center flex-wrap gap-2 flex-shrink-0">
                            {course.isPublished ? (
                                course.approvalStatus === 'pending_unpublish' ? (
                                    <button onClick={handlePublishToggle} disabled={publishing || isPendingDelete}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200">
                                        {publishing ? '...' : 'Cancel Unpublish'}
                                    </button>
                                ) : (
                                    <button onClick={handlePublishToggle} disabled={publishing || isPendingDelete}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold transition bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50">
                                        {publishing ? '...' : 'Unpublish'}
                                    </button>
                                )
                            ) : course.approvalStatus === 'pending' ? (
                                <button onClick={handlePublishToggle} disabled={publishing || isPendingDelete}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                                    {publishing ? '...' : 'Cancel Request'}
                                </button>
                            ) : (
                                <button onClick={handlePublishToggle} disabled={publishing || isPendingDelete}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold transition bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50">
                                    {publishing ? '...' : '🚀 Request Publish'}
                                </button>
                            )}
                            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-px bg-slate-100 border-b border-slate-200 flex-shrink-0">
                    {[
                        { label: 'Students', value: course.enrollmentCount ?? course.enrolledUsers?.length ?? 0, icon: '👥' },
                        { label: 'Chapters', value: course.chapters?.length || 0, icon: '📖' },
                        { label: 'Resources', value: course.resources?.length || 0, icon: '📎' },
                    ].map(s => (
                        <div key={s.label} className="bg-white px-4 py-3 text-center">
                            <p className="text-2xl font-black text-indigo-600">{s.value}</p>
                            <p className="text-xs text-slate-500 font-medium">{s.icon} {s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200 flex overflow-x-auto p-2 gap-2 flex-shrink-0">
                    {['chapters', 'resources'].map(t => (
                        <button key={t} disabled={isPendingDelete} onClick={() => setTab(t)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition whitespace-nowrap ${tab === t ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} ${isPendingDelete ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {t}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 relative">
                    {isPendingDelete && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                            <p className="text-red-600 font-bold bg-white px-4 py-2 rounded-lg shadow-md">Locked: Pending Delete</p>
                        </div>
                    )}
                    {tab === 'chapters' && <ChapterManager course={course} onUpdate={onUpdate} />}
                    {tab === 'resources' && <ResourcesManager course={course} onUpdate={onUpdate} />}
                </div>
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
function MyCourses() {
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalCourse, setModalCourse] = useState(undefined);
    const [drawerCourse, setDrawerCourse] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/courses/mine');
            setCourses(data.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchCourses();
        api.get('/courses/categories').then(({ data }) => setCategories(data.data || [])).catch(err => console.error(err));
    }, []);

    const handleDelete = async (courseToDel) => {
        if (courseToDel.approvalStatus === 'pending_delete') {
            if (!window.confirm('Cancel delete request?')) return;
            executeDelete(courseToDel._id);
        } else if (!courseToDel.isPublished) {
            if (!window.confirm('Delete this draft course? All chapters and files will be permanently removed.')) return;
            executeDelete(courseToDel._id);
        } else {
            setDeleteTarget(courseToDel._id);
        }
    };

    const executeDelete = async (id, reason = '') => {
        try { 
            await api.delete(`/courses/${id}`, { data: { reason } }); 
            fetchCourses(); 
            setDeleteTarget(null);
        } catch (err) { alert(err.response?.data?.message || 'Failed to delete course'); }
    };

    // When drawer updates, also refresh course in drawer
    const handleDrawerUpdate = async () => {
        try {
            const { data } = await api.get('/courses/mine');
            setCourses(data.data || []);
            if (drawerCourse) {
                const updated = (data.data || []).find(c => c._id === drawerCourse._id);
                if (updated) setDrawerCourse(updated);
            }
        } catch (err) { console.error(err); }
    };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">My Courses</h1>
                        <p className="text-slate-500 mt-1">{courses.length} course{courses.length !== 1 ? 's' : ''} created</p>
                    </div>
                    <button onClick={() => setModalCourse(null)}
                        className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition">
                        + Create Course
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : courses.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <span className="text-6xl">📚</span>
                        <p className="text-slate-600 font-semibold mt-4 text-lg">No courses yet</p>
                        <p className="text-slate-400 text-sm mt-1">Create your first course and start earning!</p>
                        <button onClick={() => setModalCourse(null)} className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">
                            Create Course
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {courses.map(course => (
                            <div key={course._id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition group">
                                {/* Thumbnail */}
                                <div className="aspect-video bg-gradient-to-br from-indigo-100 to-violet-100 relative overflow-hidden cursor-pointer" onClick={() => setDrawerCourse(course)}>
                                    {(course.thumbnailPath || course.thumbnail) ? (
                                        <img src={getFileUrl(course.thumbnailPath || course.thumbnail)} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            onError={e => { e.target.style.display = 'none'; }} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-5xl">📚</div>
                                    )}
                                    <div className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${course.approvalStatus === 'pending_delete' ? 'bg-red-500 text-white animate-pulse' : course.approvalStatus === 'pending_unpublish' ? 'bg-orange-500 text-white animate-pulse' : course.isPublished ? 'bg-emerald-500 text-white' : course.approvalStatus === 'pending' ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-700 text-white'}`}>
                                        {course.approvalStatus === 'pending_delete' ? '🗑️ Pending Delete' : course.approvalStatus === 'pending_unpublish' ? '⏳ Pending Unpublish' : course.isPublished ? '✓ Published' : course.approvalStatus === 'pending' ? '⏳ Pending Publish' : 'Draft'}
                                    </div>
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <span className="bg-white/90 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full">Manage →</span>
                                    </div>
                                </div>

                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="font-bold text-slate-900 leading-snug line-clamp-2 cursor-pointer hover:text-indigo-700" onClick={() => setDrawerCourse(course)}>{course.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                                        {(course.levels?.length > 0 ? course.levels : [course.level]).map(l => (
                                            <span key={l} className={`text-xs font-medium px-2 py-0.5 rounded-full ${levelColors[l] || 'bg-slate-100 text-slate-600'}`}>{l}</span>
                                        ))}
                                        <span className="text-xs text-slate-500">{course.category}</span>
                                    </div>

                                    {/* Stats row */}
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <div className="text-center bg-slate-50 rounded-lg py-1.5">
                                            <p className="font-bold text-slate-800 text-sm">{course.chapters?.length || 0}</p>
                                            <p className="text-xs text-slate-400">Chapters</p>
                                        </div>
                                        <div className="text-center bg-slate-50 rounded-lg py-1.5">
                                            <p className="font-bold text-slate-800 text-sm">{course.enrollmentCount ?? course.enrolledUsers?.length ?? 0}</p>
                                            <p className="text-xs text-slate-400">Students</p>
                                        </div>
                                        <div className="text-center bg-slate-50 rounded-lg py-1.5">
                                            <p className="font-bold text-slate-800 text-sm">{course.price > 0 ? `₹${course.price}` : 'Free'}</p>
                                            <p className="text-xs text-slate-400">Price</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button onClick={() => setDrawerCourse(course)}
                                            className="flex-1 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition">
                                            Manage
                                        </button>
                                        {course.approvalStatus !== 'pending_delete' && (
                                            <button onClick={() => setModalCourse(course)}
                                                className="px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 transition">
                                                Edit
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(course)}
                                            title={course.approvalStatus === 'pending_delete' ? "Cancel Delete Request" : "Delete Course"}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center ${course.approvalStatus === 'pending_delete' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                                            {course.approvalStatus === 'pending_delete' ? '✕' : '🗑️'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalCourse !== undefined && (
                <CourseModal course={modalCourse} categories={categories} onClose={() => setModalCourse(undefined)} onSave={(savedCourse) => {
                    fetchCourses();
                    if (!modalCourse && savedCourse) {
                        setDrawerCourse(savedCourse); // Auto-open content manager
                    }
                }} />
            )}
            {drawerCourse && (
                <CourseDrawer course={drawerCourse} onClose={() => setDrawerCourse(null)} onUpdate={handleDrawerUpdate} />
            )}
            <DeleteReasonModal 
                isOpen={!!deleteTarget} 
                title="Delete Course Request" 
                onClose={() => setDeleteTarget(null)} 
                onConfirm={(reason) => executeDelete(deleteTarget, reason)} 
            />
        </>
    );
}

export default MyCourses;
