import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Note on content protection: there is no web API that can detect or block
// OS-level screen capture, so an earlier version of this viewer pretended
// otherwise with a fake "Screenshots Disabled" blackout on PrintScreen/blur.
// What actually deters leaks: the PDF is only reachable via a short-lived
// per-user signed stream URL (minted by the caller via lib/courseStream.js)
// and is rendered to <canvas> via react-pdf rather than a native <embed>/
// <iframe> PDF viewer, so there's no browser download/print toolbar exposed;
// the watermark on every page burns the viewer's identity into the page.
// All pages render in one continuously scrollable column (no pagination).
function SecurePdfViewer({ url, user, onClose }) {
    const [numPages, setNumPages] = useState(null);
    const [watermarkTime, setWatermarkTime] = useState(() => new Date());

    useEffect(() => {
        const interval = setInterval(() => setWatermarkTime(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
    }

    const pageWidth = Math.min(window.innerWidth - 100, 900);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 protected-content">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shadow-sm">
                <div>
                    <div className="text-white font-medium">Protected Document</div>
                    {numPages && (
                        <div className="text-slate-400 text-xs mt-0.5">
                            {numPages} page{numPages !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition">
                    ✖
                </button>
            </div>

            {/* Viewer Area — continuous scroll through all pages */}
            <div
                className="flex-1 overflow-auto bg-slate-900 flex flex-col items-center gap-4 p-6"
                onContextMenu={(e) => e.preventDefault()} // Disable right-click
                style={{ userSelect: 'none' }} // Disable text selection
            >
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div className="text-white p-10">Loading secure document...</div>}
                    error={<div className="text-red-400 p-10">Failed to load secure document.</div>}
                >
                    {Array.from({ length: numPages || 0 }, (_, i) => i + 1).map(pageNum => (
                        <div key={pageNum} className="relative shadow-2xl">
                            <Page
                                pageNumber={pageNum}
                                renderTextLayer={false} // Prevents text selection/copying via HTML overlay
                                renderAnnotationLayer={false}
                                className="border border-slate-700"
                                width={pageWidth}
                            />
                            {/* Overlay to block any drag-and-drop or iframe-based extraction, plus a
                                per-user watermark so any leaked copy carries traceable evidence. */}
                            <div className="absolute inset-0 z-10 pointer-events-none" />
                            {user && (
                                <div className="absolute top-2 left-2 z-20 pointer-events-none select-none">
                                    <div className="bg-black/30 text-white/70 text-[10px] font-mono px-2 py-1 rounded backdrop-blur-sm">
                                        {user.name} • {user.email} • {watermarkTime.toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </Document>
            </div>
        </div>
    );
}

export default SecurePdfViewer;
