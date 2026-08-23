import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';
import api from '../../lib/api';
import ArticleMarkdown from '../../components/knowledge/ArticleMarkdown';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

const CATEGORIES = [
    'Technology', 'Programming', 'JavaScript', 'Python', 'Java', 'C++', 'AI',
    'Machine Learning', 'Deep Learning', 'Cloud', 'AWS', 'Azure', 'GCP',
    'Cyber Security', 'Blockchain', 'Web Development', 'Mobile Development',
    'React', 'Node.js', 'DevOps', 'Docker', 'Kubernetes', 'System Design',
    'DSA', 'Operating Systems', 'Computer Networks', 'DBMS', 'SQL',
    'Interview Preparation', 'Resume Tips', 'Career Guidance', 'Soft Skills',
    'Communication', 'Finance', 'Marketing', 'Product Management', 'UI/UX',
    'Latest Trends', 'Case Studies', 'Success Stories', 'Open Source', 'Research',
];

const STARTER_CONTENT = `# Your Article Title

## Introduction

Write a compelling introduction that hooks your reader...

## Main Content

### Key Point 1

Explain your first key point here.

\`\`\`javascript
// You can include code examples
const example = "Hello, World!";
console.log(example);
\`\`\`

### Key Point 2

Continue with your next point...

## Conclusion

Summarize your key takeaways and call to action.
`;

const CHEATSHEET = [
    ['# Heading 1', 'H1'],        ['## Heading 2', 'H2'],       ['### Heading 3', 'H3'],
    ['**bold**', 'Bold'],          ['*italic*', 'Italic'],        ['~~strike~~', 'Strikethrough'],
    ['`inline code`', 'Code'],     ['```js…```', 'Code block'],   ['> quote', 'Blockquote'],
    ['- item', 'Bullet list'],     ['1. item', 'Ordered list'],   ['[text](url)', 'Link'],
    ['![alt](url)', 'Image'],      ['---', 'Divider'],            ['| a | b |', 'Table'],
];

const STATUS_STYLES = {
    draft:          { bg: 'bg-slate-100',   text: 'text-slate-600',  dot: 'bg-slate-400'   },
    pending_review: { bg: 'bg-amber-50',    text: 'text-amber-700',  dot: 'bg-amber-500'   },
    published:      { bg: 'bg-emerald-50',  text: 'text-emerald-700',dot: 'bg-emerald-500' },
    rejected:       { bg: 'bg-red-50',      text: 'text-red-700',    dot: 'bg-red-500'     },
    archived:       { bg: 'bg-slate-100',   text: 'text-slate-500',  dot: 'bg-slate-400'   },
};
const STATUS_LABELS = {
    draft: 'Draft', pending_review: 'In Review', published: 'Published', rejected: 'Rejected', archived: 'Archived',
};

function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.draft;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {STATUS_LABELS[status] || 'Draft'}
        </span>
    );
}

export default function ArticleEditor() {
    const { id }       = useParams();
    const navigate     = useNavigate();
    const { user }     = useSelector(s => s.auth);
    const isEdit       = !!id;

    const [title,          setTitle]          = useState('');
    const [content,        setContent]        = useState(STARTER_CONTENT);
    const [excerpt,        setExcerpt]        = useState('');
    const [category,       setCategory]       = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [tagInput,       setTagInput]       = useState('');
    const [tags,           setTags]           = useState([]);
    const [coverImage,     setCoverImage]     = useState('');
    const [coverPreview,   setCoverPreview]   = useState('');
    const [activeTab,      setActiveTab]      = useState('edit');
    const [saving,         setSaving]         = useState(false);
    const [submitting,     setSubmitting]     = useState(false);
    const [saved,          setSaved]          = useState(false);
    const [error,          setError]          = useState('');
    const [articleId,      setArticleId]      = useState(id || null);
    const [articleStatus,  setArticleStatus]  = useState('draft');
    const [uploadingCover, setUploadingCover] = useState(false);

    const autoSaveTimer = useRef(null);
    const fileInputRef  = useRef(null);
    const editorRef     = useRef(null);

    const handleEditorMount = useCallback((editor) => {
        editorRef.current = editor;
        const domNode = editor.getDomNode();
        if (!domNode) return;

        // Monaco calls stopPropagation() internally, so we must use capture:true
        // to intercept before Monaco handles the wheel event.
        // Also find the real scrollable ancestor (Layout's <main>) rather than window.
        const getScrollParent = (el) => {
            let node = el.parentElement;
            while (node && node !== document.body) {
                const oy = window.getComputedStyle(node).overflowY;
                if (oy === 'auto' || oy === 'scroll') return node;
                node = node.parentElement;
            }
            return document.documentElement;
        };
        const scrollParent = getScrollParent(domNode);

        domNode.addEventListener('wheel', (e) => {
            const scrollTop    = editor.getScrollTop();
            const scrollHeight = editor.getScrollHeight();
            const clientHeight = editor.getLayoutInfo().height;
            const atTop    = scrollTop <= 0       && e.deltaY < 0;
            const atBottom = (scrollTop + clientHeight >= scrollHeight - 1) && e.deltaY > 0;
            if (atTop || atBottom) {
                e.stopPropagation(); // prevent Monaco from consuming the event
                e.preventDefault();  // prevent any residual browser default
                const delta = e.deltaMode === 0 ? e.deltaY : e.deltaY * 40;
                scrollParent.scrollBy({ top: delta, behavior: 'auto' });
            }
        }, { capture: true, passive: false });
    }, []);

    useEffect(() => {
        if (!isEdit) return;
        api.get(`/knowledge/article/${id}`, { params: {} }).catch(() => {})
            .then(r => {
                if (!r?.data?.article) return;
                const a = r.data.article;
                setTitle(a.title);
                setContent(a.content);
                setExcerpt(a.excerpt || '');
                if (a.category && !CATEGORIES.includes(a.category)) {
                    setCategory('__other__');
                    setCustomCategory(a.category);
                } else {
                    setCategory(a.category || '');
                }
                setTags(a.tags || []);
                setCoverImage(a.coverImage || '');
                if (a.coverImage) setCoverPreview(a.coverImage.startsWith('http') ? a.coverImage : `${API_BASE}${a.coverImage}`);
                setArticleStatus(a.status);
                setArticleId(a._id);
            });
    }, [id, isEdit]);

    const wordCount   = content.replace(/[#*`~\[\]()\->|!]/g, '').trim().split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    const saveDraft = useCallback(async (showSaved = false) => {
        if (!title.trim() || !content.trim()) return;
        setSaving(true);
        try {
            const resolvedCategory = category === '__other__' ? customCategory.trim() : category;
            const payload = { title: title.trim(), content, excerpt, category: resolvedCategory, tags, coverImage };
            let result;
            if (articleId) {
                result = await api.put(`/knowledge/${articleId}`, payload);
            } else {
                result = await api.post('/knowledge', payload);
                setArticleId(result.data.article._id);
            }
            setArticleStatus(result.data.article.status);
            if (showSaved) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to save');
        } finally { setSaving(false); }
    }, [title, content, excerpt, category, customCategory, tags, coverImage, articleId]);

    useEffect(() => {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => { if (title.trim()) saveDraft(false); }, 3000);
        return () => clearTimeout(autoSaveTimer.current);
    }, [title, content, saveDraft]);

    const handleCoverUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingCover(true);
        const fd = new FormData();
        fd.append('cover', file);
        try {
            const r = await api.post('/knowledge/upload/cover', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setCoverImage(r.data.url);
            setCoverPreview(URL.createObjectURL(file));
        } catch { setError('Image upload failed'); } finally { setUploadingCover(false); }
    };

    const addTag = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
            if (t && !tags.includes(t) && tags.length < 10) setTags(prev => [...prev, t]);
            setTagInput('');
        }
    };
    const removeTag = (t) => setTags(prev => prev.filter(x => x !== t));

    const handleSubmit = async () => {
        if (!title.trim())               return setError('Title is required');
        if (content.trim().length < 100) return setError('Content must be at least 100 characters');
        setSubmitting(true);
        setError('');
        try {
            await saveDraft(false);
            await api.post(`/knowledge/${articleId}/submit`);
            navigate('/knowledge/my-articles');
        } catch (e) {
            setError(e.response?.data?.message || 'Submission failed');
        } finally { setSubmitting(false); }
    };

    if (!user) return (
        <div className="text-center py-20">
            <p className="text-slate-600 mb-3">You must be signed in to write articles.</p>
            <Link to="/login" className="btn-primary px-6 py-2.5">Sign In</Link>
        </div>
    );

    return (
        <div className="max-w-full pb-10">

            {/* ── Sticky toolbar ─────────────────────────────────────── */}
            <div className="sticky top-0 z-20 -mt-4 sm:-mt-6 lg:-mt-8 -mx-4 sm:-mx-6 lg:-mx-8 mb-8">
                <div className="bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_12px_rgba(0,0,0,0.06)]">
                    <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">

                        {/* Back */}
                        <Link to="/knowledge/my-articles"
                            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all flex-shrink-0"
                            title="Back to My Articles">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/>
                            </svg>
                        </Link>

                        {/* Page title + status */}
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                            <span className="text-[14px] font-semibold text-slate-700">
                                {isEdit ? 'Edit Article' : 'New Article'}
                            </span>
                            <StatusBadge status={articleStatus} />
                        </div>

                        <div className="flex-1" />

                        {/* Write / Split / Preview toggle */}
                        <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl">
                            {[{ k: 'edit', l: 'Write' }, { k: 'split', l: 'Split' }, { k: 'preview', l: 'Preview' }].map(t => (
                                <button key={t.k} onClick={() => setActiveTab(t.k)}
                                    className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all ${activeTab === t.k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {t.l}
                                </button>
                            ))}
                        </div>

                        {/* Auto-save indicator */}
                        <div className="hidden md:flex items-center gap-1.5 text-[12px] tabular-nums min-w-[120px] justify-end flex-shrink-0">
                            {saving ? (
                                <span className="flex items-center gap-1.5 text-slate-400">
                                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                    </svg>
                                    Saving…
                                </span>
                            ) : saved ? (
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                                    </svg>
                                    Saved
                                </span>
                            ) : (
                                <span className="text-slate-400">{wordCount.toLocaleString()} words · {readingTime} min read</span>
                            )}
                        </div>

                        {/* Actions */}
                        <button onClick={() => saveDraft(true)} disabled={saving}
                            className="hidden sm:inline-flex items-center text-[13px] font-medium px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 flex-shrink-0">
                            Save Draft
                        </button>
                        <button onClick={handleSubmit}
                            disabled={submitting || !title.trim() || content.trim().length < 100}
                            className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
                            {submitting ? (
                                <>
                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                    </svg>
                                    Submitting…
                                </>
                            ) : articleStatus === 'published' ? 'Update' : 'Submit for Review'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Error banner ──────────────────────────────────────── */}
            {error && (
                <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-sm">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>
                    </svg>
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            )}

            {/* ── Cover image ───────────────────────────────────────── */}
            <div className="mb-7">
                {coverPreview ? (
                    <div className="relative rounded-2xl overflow-hidden group shadow-sm">
                        <img src={coverPreview} alt="Cover" className="w-full h-56 object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-end justify-end p-4">
                            <div className="flex gap-2">
                                <button onClick={() => fileInputRef.current?.click()}
                                    className="px-3.5 py-2 bg-white/90 backdrop-blur-sm text-slate-800 rounded-xl text-xs font-semibold shadow hover:bg-white transition-colors">
                                    Change Image
                                </button>
                                <button onClick={() => { setCoverImage(''); setCoverPreview(''); }}
                                    className="px-3.5 py-2 bg-red-500/90 backdrop-blur-sm text-white rounded-xl text-xs font-semibold shadow hover:bg-red-500 transition-colors">
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => fileInputRef.current?.click()}
                        className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-primary-50/40 hover:border-primary-300 transition-all duration-200 flex flex-col items-center justify-center gap-2.5 group cursor-pointer">
                        {uploadingCover ? (
                            <>
                                <div className="w-7 h-7 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-primary-500 font-medium">Uploading…</span>
                            </>
                        ) : (
                            <>
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 group-hover:border-primary-200 shadow-sm flex items-center justify-center transition-colors">
                                    <svg className="w-5 h-5 text-slate-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/>
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-slate-500 group-hover:text-primary-600 transition-colors">Add a cover image</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Recommended: 1200 × 630px · JPG, PNG</p>
                                </div>
                            </>
                        )}
                    </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>

            {/* ── Title ─────────────────────────────────────────────── */}
            <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Your article title..."
                className="w-full text-4xl font-black text-slate-900 placeholder-slate-200 border-0 outline-none bg-transparent mb-2 leading-tight tracking-tight"
            />
            <div className="h-1 bg-gradient-to-r from-primary-500 to-violet-500 rounded-full mb-7 transition-all duration-500"
                style={{ width: title.length > 0 ? `${Math.min(100, (title.length / 60) * 100)}%` : '3rem', maxWidth: '14rem', minWidth: '3rem' }} />

            {/* ── Metadata: two clean rows ──────────────────────────── */}
            <div className="space-y-3 mb-7">

                {/* Row 1: Category + Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    {/* Category */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                        <CategoryPicker
                            value={category}
                            customValue={customCategory}
                            onChange={setCategory}
                            onCustomChange={setCustomCategory}
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Tags <span className="normal-case font-normal text-slate-300">· {tags.length}/10</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5 items-center min-h-[42px] px-3 py-2 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-400 transition-all">
                            {tags.map(t => (
                                <span key={t} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-[12px] font-medium group/tag">
                                    #{t}
                                    <button onClick={() => removeTag(t)}
                                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-primary-400 hover:text-red-500 hover:bg-red-50 transition-colors leading-none">
                                        ×
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={addTag}
                                placeholder={tags.length === 0 ? 'Add tags — press Enter or comma…' : tags.length >= 10 ? 'Max 10 tags reached' : 'Add another tag…'}
                                disabled={tags.length >= 10}
                                className="flex-1 text-sm outline-none bg-transparent min-w-[160px] placeholder-slate-300 py-0.5"
                            />
                        </div>
                    </div>
                </div>

                {/* Row 2: Excerpt — full width, its own row */}
                <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Excerpt <span className="normal-case font-normal text-slate-300">· optional · {excerpt.length}/500</span>
                    </label>
                    <textarea
                        value={excerpt}
                        onChange={e => setExcerpt(e.target.value)}
                        placeholder="A short summary shown on article cards and in search results. If left blank, the first paragraph will be used."
                        rows={2}
                        maxLength={500}
                        className="w-full bg-white border border-slate-200 text-slate-700 text-sm px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all resize-none placeholder-slate-300 leading-relaxed"
                    />
                </div>
            </div>

            {/* ── Mobile Write/Preview toggle ───────────────────────── */}
            <div className="flex sm:hidden items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-4">
                {[{ k: 'edit', l: 'Write' }, { k: 'split', l: 'Split' }, { k: 'preview', l: 'Preview' }].map(t => (
                    <button key={t.k} onClick={() => setActiveTab(t.k)}
                        className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all ${activeTab === t.k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {t.l}
                    </button>
                ))}
            </div>

            {/* ── Editor / Preview area ─────────────────────────────── */}
            <div className={`${activeTab === 'split' ? 'grid grid-cols-2' : ''} rounded-2xl overflow-hidden border border-slate-200 shadow-sm`}>

                {/* Monaco */}
                {(activeTab === 'edit' || activeTab === 'split') && (
                    <div className={activeTab === 'split' ? 'border-r border-slate-200' : ''}>
                        {activeTab === 'split' && <PaneBar label="Markdown" />}
                        <Editor
                            height={activeTab === 'edit' ? '680px' : '650px'}
                            language="markdown"
                            value={content}
                            onChange={v => setContent(v || '')}
                            onMount={handleEditorMount}
                            options={{
                                wordWrap:             'on',
                                minimap:              { enabled: false },
                                fontSize:             14,
                                lineHeight:           26,
                                padding:              { top: 24, bottom: 24 },
                                renderLineHighlight:  'none',
                                scrollBeyondLastLine: false,
                                fontFamily:           "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                                lineNumbers:          'off',
                                folding:              false,
                                glyphMargin:          false,
                                overviewRulerLanes:   0,
                                overviewRulerBorder:  false,
                                scrollbar:            { vertical: 'auto', horizontal: 'hidden', verticalScrollbarSize: 5 },
                            }}
                            theme="vs"
                        />
                    </div>
                )}

                {/* Preview */}
                {(activeTab === 'preview' || activeTab === 'split') && (
                    <div className="flex flex-col">
                        {activeTab === 'split' && <PaneBar label="Preview" />}
                        <div className="flex-1 overflow-auto p-7 md:p-9" style={{ minHeight: activeTab === 'split' ? '650px' : '500px', maxHeight: activeTab === 'split' ? '680px' : 'none' }}>
                            {title && activeTab === 'preview' && (
                                <h1 className="text-4xl font-black text-slate-900 mb-6 leading-tight tracking-tight">{title}</h1>
                            )}
                            {content.trim() ? (
                                <ArticleMarkdown content={content} />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-40 text-center">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                                        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                                        </svg>
                                    </div>
                                    <p className="text-sm text-slate-400">Start writing to see the preview</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Markdown cheatsheet ───────────────────────────────── */}
            <details className="mt-5 group/cs">
                <summary className="flex items-center gap-2 text-[13px] text-slate-400 cursor-pointer select-none hover:text-slate-600 transition-colors list-none w-fit py-1">
                    <svg className="w-3.5 h-3.5 transition-transform duration-200 group-open/cs:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
                    </svg>
                    Markdown Cheatsheet
                </summary>
                <div className="mt-3 p-5 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5">
                    {CHEATSHEET.map(([md, label]) => (
                        <div key={label} className="flex items-center gap-2 text-[12px]">
                            <code className="text-primary-600 font-mono shrink-0">{md.length > 14 ? md.substring(0, 14) + '…' : md}</code>
                            <span className="text-slate-400 truncate">→ {label}</span>
                        </div>
                    ))}
                </div>
            </details>

        </div>
    );
}

function CategoryPicker({ value, customValue, onChange, onCustomChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const filtered = CATEGORIES.filter(c => c.toLowerCase().includes(search.toLowerCase()));
    const displayLabel = value === '__other__' ? (customValue || 'Others') : (value || '');

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-2 bg-white border text-sm px-3 py-2.5 rounded-xl outline-none hover:border-slate-300 transition-all cursor-pointer ${open ? 'border-primary-400 ring-2 ring-primary-500/20' : 'border-slate-200'}`}>
                <span className={`truncate ${displayLabel ? 'text-slate-700' : 'text-slate-300'}`}>
                    {displayLabel || 'Select category…'}
                </span>
                <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
                </svg>
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search categories…"
                            className="w-full text-sm px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary-400 placeholder-slate-300"
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto max-h-44 py-1">
                        {filtered.map(c => (
                            <button key={c} type="button"
                                onClick={() => { onChange(c); setOpen(false); setSearch(''); }}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-primary-50 hover:text-primary-700 ${value === c ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-slate-700'}`}>
                                {c}
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="px-4 py-3 text-sm text-slate-400 text-center">No results — try "Others"</p>
                        )}
                    </div>
                    <div className="border-t border-slate-100">
                        <button type="button"
                            onClick={() => { onChange('__other__'); setOpen(false); setSearch(''); }}
                            className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 hover:bg-slate-50 ${value === '__other__' ? 'text-primary-700 bg-primary-50' : 'text-slate-500'}`}>
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
                            </svg>
                            Others — type a custom category
                        </button>
                    </div>
                </div>
            )}

            {value === '__other__' && (
                <input
                    type="text"
                    value={customValue}
                    onChange={e => onCustomChange(e.target.value)}
                    placeholder="Type your category…"
                    className="mt-2 w-full bg-white border border-slate-200 text-slate-700 text-sm px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all placeholder-slate-300"
                    autoFocus
                />
            )}
        </div>
    );
}

function PaneBar({ label }) {
    return (
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
    );
}
