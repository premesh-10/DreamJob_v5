import { useState, useEffect } from 'react';
import api from '../../lib/api';
import html2pdf from 'html2pdf.js';

// Fetches a short-lived asset token for one of the student's own certificates,
// then fetches the rendered HTML from the public (token-gated) stream endpoint
// — mirrors the courseStream token pattern used for protected course media.
function CertificateViewer({ certificate, onClose }) {
    const [html, setHtml] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.get(`/certificates/${certificate._id}/token`);
                const res = await fetch(`${api.defaults.baseURL}/certificate-stream?token=${data.token}`);
                if (!res.ok) throw new Error('Failed to load certificate');
                const text = await res.text();
                if (!cancelled) setHtml(text);
            } catch {
                if (!cancelled) setError('Could not load this certificate. Please try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [certificate._id]);

    const downloadPDF = () => {
        const element = document.getElementById('certificate-render');
        html2pdf().set({
            margin: 0,
            filename: `certificate-${certificate.certificateNumber}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
        }).from(element).save();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="font-bold text-slate-900">Certificate — {certificate.certificateNumber}</h2>
                    <div className="flex items-center gap-2">
                        {html && <button onClick={downloadPDF} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900">Download PDF</button>}
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                    </div>
                </div>
                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center py-16"><div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                    ) : error ? (
                        <p className="text-center text-red-500 py-10">{error}</p>
                    ) : (
                        <div id="certificate-render" dangerouslySetInnerHTML={{ __html: html }} />
                    )}
                </div>
            </div>
        </div>
    );
}

export default CertificateViewer;
