import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
} from '@tanstack/react-table';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ExportButtons from '../../components/ExportButtons';
import OrderDetails from '../OrderDetails';

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

const TYPE_COLORS = {
    course:       'bg-blue-100 text-blue-700',
    interview:    'bg-purple-100 text-purple-700',
    subscription: 'bg-emerald-100 text-emerald-700',
    webinar:      'bg-amber-100 text-amber-700',
};

const STATUS_COLORS = {
    PAID:    'bg-emerald-100 text-emerald-700',
    ACTIVE:  'bg-yellow-100 text-yellow-700',
    FAILED:  'bg-red-100 text-red-700',
    EXPIRED: 'bg-slate-100 text-slate-500',
    PENDING: 'bg-yellow-100 text-yellow-700',
};

function AdminPayments() {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalFilter, setGlobalFilter] = useState('');
    const [orderDetailsId, setOrderDetailsId] = useState(null);

    useEffect(() => {
        api.get('/admin/payments')
            .then(r => setPayments(r.data.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const columnHelper = createColumnHelper();

    const columns = useMemo(() => [
        columnHelper.accessor('orderId', {
            header: 'Order ID',
            cell: info => {
                const val = info.getValue();
                return val ? (
                    <button
                        onClick={e => { e.stopPropagation(); setOrderDetailsId(val); }}
                        className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition whitespace-nowrap"
                    >
                        {val}
                    </button>
                ) : (
                    <span className="text-xs text-slate-300 font-mono">—</span>
                );
            },
        }),
        columnHelper.accessor('type', {
            header: 'Type',
            cell: info => (
                <span className={`px-2 py-1 rounded-md text-xs font-bold capitalize ${TYPE_COLORS[info.getValue()] || 'bg-slate-100 text-slate-600'}`}>
                    {info.getValue()}
                </span>
            ),
        }),
        columnHelper.accessor('user.name', {
            header: 'User',
            cell: info => (
                <div>
                    <p className="font-medium text-slate-900 text-sm">{info.getValue() || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">{info.row.original.user?.email}</p>
                </div>
            ),
        }),
        columnHelper.accessor('amount', {
            header: 'Amount',
            cell: info => <span className="font-bold text-slate-900">₹{info.getValue()?.toFixed(2)}</span>,
        }),
        columnHelper.accessor('orderStatus', {
            header: 'Status',
            cell: info => (
                <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${STATUS_COLORS[info.getValue()] || 'bg-slate-100 text-slate-600'}`}>
                    {info.getValue()}
                </span>
            ),
        }),
        columnHelper.accessor('cfPaymentId', {
            header: 'Transaction ID',
            cell: info => (
                <span className="font-mono text-xs text-slate-500">{info.getValue() || '—'}</span>
            ),
        }),
        columnHelper.accessor('invoiceNumber', {
            header: 'Invoice',
            cell: info => (
                <span className="font-mono text-xs text-slate-500">{info.getValue() || '—'}</span>
            ),
        }),
        columnHelper.accessor('couponCode', {
            header: 'Coupon',
            cell: info => info.getValue()
                ? <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">{info.getValue()}</span>
                : <span className="text-slate-300 text-xs">—</span>,
        }),
        columnHelper.accessor('createdAt', {
            header: 'Date',
            cell: info => (
                <span className="text-xs text-slate-500">{new Date(info.getValue()).toLocaleString('en-IN')}</span>
            ),
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => row.original.orderId ? (
                <button
                    onClick={e => { e.stopPropagation(); setOrderDetailsId(row.original.orderId); }}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold"
                >
                    View
                </button>
            ) : null,
        }),
    ], []);

    const table = useReactTable({
        data: payments,
        columns,
        state: { globalFilter },
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <AdminPageHeader
                    icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    iconBg="from-emerald-500 to-teal-600"
                    title="Financial Operations"
                    subtitle="Monitor all payment orders, Order IDs, Transaction IDs, and process refunds"
                    actions={
                        <>
                            <div className="relative">
                                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input type="text" value={globalFilter ?? ''} onChange={e => setGlobalFilter(e.target.value)}
                                    placeholder="Search orders..."
                                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64 bg-white shadow-sm" />
                            </div>
                            <ExportButtons
                            data={payments}
                            filename="Orders_Report"
                            columns={[
                                { header: 'Order ID', key: 'orderId' },
                                { header: 'Invoice', key: 'invoiceNumber' },
                                { header: 'Type', key: 'type' },
                                { header: 'User', key: 'user', format: v => v?.name || 'Unknown' },
                                { header: 'Amount', key: 'amount', format: v => `₹${(v || 0).toFixed(2)}` },
                                { header: 'Status', key: 'orderStatus' },
                                { header: 'Transaction ID', key: 'cfPaymentId' },
                                { header: 'Coupon', key: 'couponCode' },
                                { header: 'Date', key: 'createdAt', format: v => new Date(v).toLocaleString('en-IN') },
                            ]}
                            />
                        </>
                    }
                />

                {!loading && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Orders', value: payments.length, cls: 'from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200', iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                            { label: 'Paid', value: payments.filter(p => p.orderStatus === 'PAID').length, cls: 'from-sky-50 to-blue-50 text-sky-700 border-sky-200', iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                            { label: 'Total Revenue', value: '₹' + payments.filter(p => p.orderStatus === 'PAID').reduce((s, p) => s + (p.amount || 0), 0).toFixed(0), cls: 'from-violet-50 to-purple-50 text-violet-700 border-violet-200', iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                            { label: 'Failed', value: payments.filter(p => p.orderStatus === 'FAILED').length, cls: 'from-red-50 to-rose-50 text-red-700 border-red-200', iconPath: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                        ].map(s => (
                            <div key={s.label} className={`bg-gradient-to-br ${s.cls} rounded-2xl border p-4 flex items-center gap-3`}>
                                <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center flex-shrink-0">
                                    <svg className={`w-5 h-5 ${s.cls.split(' ')[2]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                )}

                <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
                            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Loading orders...</span>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        {table.getHeaderGroups().map(headerGroup => (
                                            <tr key={headerGroup.id}>
                                                {headerGroup.headers.map(header => (
                                                    <th key={header.id} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={header.column.getToggleSortingHandler()}>
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                        {{ asc: <SortAsc />, desc: <SortDesc /> }[header.column.getIsSorted()] ?? null}
                                                    </th>
                                                ))}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {table.getRowModel().rows.map(row => (
                                            <tr
                                                key={row.id}
                                                onClick={() => row.original.orderId && setOrderDetailsId(row.original.orderId)}
                                                className={`transition ${row.original.orderId ? 'hover:bg-indigo-50 cursor-pointer' : 'hover:bg-slate-50'}`}
                                            >
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="px-5 py-4">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                                <span className="text-sm text-slate-500">
                                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} &middot; {payments.length} total orders
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                                        className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition shadow-sm">
                                        Previous
                                    </button>
                                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                                        className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition shadow-sm">
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {orderDetailsId && (
                <OrderDetails orderId={orderDetailsId} onClose={() => setOrderDetailsId(null)} />
            )}

        </>
    );
}

export default AdminPayments;
