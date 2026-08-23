import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * ExportButtons — reusable export component
 * @param {Array}  data      — array of flat objects to export
 * @param {Array}  columns   — [{ header: 'Label', key: 'objectKey' }, ...]
 * @param {string} filename  — base filename (without extension)
 */
export default function ExportButtons({ data = [], columns = [], filename = 'report' }) {
    const [open, setOpen] = useState(false);

    const flatRows = () =>
        data.map(row =>
            columns.reduce((acc, col) => {
                acc[col.header] = col.format ? col.format(row[col.key], row) : (row[col.key] ?? '');
                return acc;
            }, {})
        );

    const exportCSV = () => {
        const rows = flatRows();
        const headers = columns.map(c => c.header);
        const csvContent = [
            headers.join(','),
            ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setOpen(false);
    };

    const exportExcel = () => {
        const rows = flatRows();
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, `${filename}.xlsx`);
        setOpen(false);
    };

    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

        // Header bar
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), 50, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(filename, 30, 32);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated: ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() - 200, 32);

        const rows = flatRows();
        autoTable(doc, {
            startY: 60,
            head: [columns.map(c => c.header)],
            body: rows.map(r => columns.map(c => r[c.header])),
            headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 30, right: 30 },
            tableLineColor: [226, 232, 240],
            tableLineWidth: 0.3,
        });

        doc.save(`${filename}.pdf`);
        setOpen(false);
    };

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow transition"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
                <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                        {[
                            { label: '📄  PDF', action: exportPDF, color: 'text-rose-600' },
                            { label: '📊  Excel', action: exportExcel, color: 'text-emerald-600' },
                            { label: '📋  CSV', action: exportCSV, color: 'text-blue-600' },
                        ].map(btn => (
                            <button key={btn.label} onClick={btn.action}
                                className={`w-full text-left px-4 py-3 text-sm font-medium ${btn.color} hover:bg-slate-50 transition border-b border-slate-100 last:border-0`}>
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
