import { useState, useEffect, useMemo } from 'react';
import api from '../../lib/api';
import {
  createColumnHelper, flexRender,
  getCoreRowModel, useReactTable,
  getPaginationRowModel, getSortedRowModel, getFilteredRowModel,
} from '@tanstack/react-table';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ExportButtons from '../../components/ExportButtons';

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

const STATUS_BADGE = {
    applied:   { cls: 'bg-amber-100 text-amber-700',   label: 'Applied' },
    verifying: { cls: 'bg-blue-100 text-blue-700',     label: 'Verifying' },
    approved:  { cls: 'bg-emerald-100 text-emerald-700', label: 'Approved' },
    rejected:  { cls: 'bg-rose-100 text-rose-700',     label: 'Rejected' },
};

function AdminSellers() {
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalFilter, setGlobalFilter] = useState('');
    const [viewSeller, setViewSeller] = useState(null);
    const [walletForm, setWalletForm] = useState({ show: false, action: 'add', amount: '', description: '' });
    const [adjustingWallet, setAdjustingWallet] = useState(false);

    useEffect(() => {
        const fetchSellers = async () => {
            try {
                const { data } = await api.get('/admin/sellers');
                setSellers(data.data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchSellers();
    }, []);

    const handleStatusChange = async (sellerId, newStatus) => {
        if (window.confirm(`Change seller status to ${newStatus}?`)) {
            try {
                await api.put(`/sellers/${sellerId}/status`, { status: newStatus });
                const { data } = await api.get('/admin/sellers');
                setSellers(data.data);
            } catch {
                alert('Failed to update seller status');
            }
        }
    };

    const handleWalletAdjust = async (e) => {
        e.preventDefault();
        setAdjustingWallet(true);
        try {
            const { data } = await api.post(`/sellers/${viewSeller._id}/wallet-adjust`, {
                action: walletForm.action,
                amount: walletForm.amount,
                description: walletForm.description
            });
            alert(data.message);
            setViewSeller(data.data);
            setSellers(prev => prev.map(s => s._id === data.data._id ? data.data : s));
            setWalletForm({ show: false, action: 'add', amount: '', description: '' });
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to adjust wallet');
        } finally {
            setAdjustingWallet(false);
        }
    };

    const columnHelper = createColumnHelper();
    const columns = useMemo(() => [
        columnHelper.accessor('user.name', {
            header: 'Name',
            cell: info => (
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                        {(info.getValue() || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-900">{info.getValue() || 'Unknown'}</span>
                </div>
            ),
        }),
        columnHelper.accessor('user.email', {
            header: 'Email',
            cell: info => <span className="text-slate-500">{info.getValue() || 'Unknown'}</span>,
        }),
        columnHelper.accessor('contentType', {
            header: 'Content Type',
            cell: info => <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-semibold">{info.getValue()}</span>,
        }),
        columnHelper.accessor('status', {
            header: 'Status',
            cell: info => {
                const s = STATUS_BADGE[info.getValue()] || { cls: 'bg-slate-100 text-slate-600', label: info.getValue() };
                return <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${s.cls}`}>{s.label}</span>;
            }
        }),
        columnHelper.accessor('lifetimeEarnings', {
            header: 'Lifetime Earnings',
            cell: info => <span className="font-medium text-primary-600">&#8377;{info.getValue()?.toFixed(2) || '0.00'}</span>,
        }),
        columnHelper.accessor('presentBalance', {
            header: 'Balance',
            cell: info => <span className="font-medium text-emerald-600">&#8377;{info.getValue()?.toFixed(2) || '0.00'}</span>,
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: (props) => {
                const seller = props.row.original;
                return (
                    <div className="flex items-center gap-2">
                        <select value={seller.status} onChange={e => handleStatusChange(seller._id, e.target.value)}
                            className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                            <option value="applied">Applied</option>
                            <option value="verifying">Verifying</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <button onClick={() => setViewSeller(seller)}
                            className="text-xs px-2.5 py-1.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-medium hover:bg-primary-100 transition">
                            View
                        </button>
                    </div>
                );
            },
        })
    ], []);

    const table = useReactTable({
        data: sellers,
        columns,
        state: { globalFilter },
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    const approved = sellers.filter(s => s.status === 'approved').length;
    const pending = sellers.filter(s => s.status === 'applied' || s.status === 'verifying').length;

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <AdminPageHeader
                    icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    iconBg="from-indigo-500 to-violet-600"
                    title="Seller Management"
                    subtitle="Review applications and monitor seller performance"
                    actions={
                        <>
                            <div className="relative">
                                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input type="text" value={globalFilter ?? ''} onChange={e => setGlobalFilter(e.target.value)}
                                    placeholder="Search sellers..."
                                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-56 bg-white shadow-sm" />
                            </div>
                            <ExportButtons
                                data={sellers}
                                filename="Sellers_Report"
                                columns={[
                                    { header: 'Name', key: 'user', format: (v) => v?.name || 'Unknown' },
                                    { header: 'Email', key: 'user', format: (v) => v?.email || '' },
                                    { header: 'Content Type', key: 'contentType' },
                                    { header: 'Status', key: 'status' },
                                    { header: 'Lifetime Earnings', key: 'lifetimeEarnings', format: (v) => `₹${(v || 0).toFixed(2)}` },
                                    { header: 'Present Balance', key: 'presentBalance', format: (v) => `₹${(v || 0).toFixed(2)}` },
                                ]}
                            />
                        </>
                    }
                />

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Sellers', value: sellers.length, cls: 'from-indigo-50 to-blue-50 text-indigo-700 border-indigo-200', iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5' },
                        { label: 'Approved', value: approved, cls: 'from-emerald-50 to-green-50 text-emerald-700 border-emerald-200', iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { label: 'Pending Review', value: pending, cls: 'from-amber-50 to-yellow-50 text-amber-700 border-amber-200', iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { label: 'Rejected', value: sellers.filter(s => s.status === 'rejected').length, cls: 'from-rose-50 to-red-50 text-rose-700 border-rose-200', iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
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

                <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
                            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Loading sellers...</span>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                        {table.getHeaderGroups().map(hg => (
                                            <tr key={hg.id}>
                                                {hg.headers.map(header => (
                                                    <th key={header.id} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide cursor-pointer hover:bg-slate-100 select-none" onClick={header.column.getToggleSortingHandler()}>
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                        {{ asc: <SortAsc />, desc: <SortDesc /> }[header.column.getIsSorted()] ?? null}
                                                    </th>
                                                ))}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {table.getRowModel().rows.map(row => (
                                            <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="px-5 py-3.5">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {table.getRowModel().rows.length === 0 && (
                                    <div className="p-12 text-center text-slate-400 text-sm">No sellers found.</div>
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

            {/* View Seller Modal */}
            {viewSeller && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-slate-900">Seller Details</h2>
                            <button onClick={() => { setViewSeller(null); setWalletForm({ show: false, action: 'add', amount: '', description: '' }); }}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-lg font-black shadow-primary">
                                {viewSeller.user?.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                                <p className="font-bold text-slate-900">{viewSeller.user?.name}</p>
                                <p className="text-slate-500 text-sm">{viewSeller.user?.email}</p>
                                {viewSeller.user?.mobile && <p className="text-slate-400 text-xs">{viewSeller.user.mobile}</p>}
                            </div>
                            <div className="ml-auto">
                                {(() => {
                                    const s = STATUS_BADGE[viewSeller.status] || { cls: 'bg-slate-100 text-slate-600', label: viewSeller.status };
                                    return <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${s.cls}`}>{s.label}</span>;
                                })()}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {[
                                { label: 'Content Type', value: viewSeller.contentType },
                                { label: 'Expertise', value: viewSeller.targetedCourse || '—' },
                                { label: 'Lifetime Earnings', value: `₹${viewSeller.lifetimeEarnings?.toFixed(2) || '0.00'}` },
                                { label: 'Present Balance', value: `₹${viewSeller.presentBalance?.toFixed(2) || '0.00'}` },
                                { label: 'Courses Created', value: viewSeller.courseCount ?? viewSeller.totalCourses ?? 0 },
                                { label: 'Total Students', value: viewSeller.totalStudents ?? 0 },
                            ].map(item => (
                                <div key={item.label} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
                                    <p className="font-semibold text-slate-800 text-sm">{item.value}</p>
                                </div>
                            ))}
                        </div>

                        {viewSeller.bio && (
                            <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-xs text-slate-400 mb-1">Bio</p>
                                <p className="text-slate-600 text-sm leading-relaxed">{viewSeller.bio}</p>
                            </div>
                        )}

                        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-slate-800">Adjust Wallet Balance</h3>
                                <button onClick={() => setWalletForm(p => ({ ...p, show: !p.show }))}
                                    className="text-xs text-primary-600 font-semibold hover:underline">
                                    {walletForm.show ? 'Cancel' : 'Adjust'}
                                </button>
                            </div>
                            {walletForm.show && (
                                <form onSubmit={handleWalletAdjust} className="space-y-2.5">
                                    <div className="flex gap-2">
                                        <select value={walletForm.action} onChange={e => setWalletForm(p => ({ ...p, action: e.target.value }))}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                                            <option value="add">Add (+)</option>
                                            <option value="deduct">Deduct (-)</option>
                                        </select>
                                        <input type="number" min="0.01" step="0.01" required placeholder="Amount"
                                            value={walletForm.amount} onChange={e => setWalletForm(p => ({ ...p, amount: e.target.value }))}
                                            className="flex-1 input-field" />
                                    </div>
                                    <input type="text" placeholder="Reason / Note (visible to seller)"
                                        value={walletForm.description} onChange={e => setWalletForm(p => ({ ...p, description: e.target.value }))}
                                        className="input-field" />
                                    <button type="submit" disabled={adjustingWallet || !walletForm.amount}
                                        className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm disabled:opacity-60 ${walletForm.action === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                                        {adjustingWallet ? 'Processing...' : `${walletForm.action === 'add' ? 'Add to' : 'Deduct from'} Wallet`}
                                    </button>
                                </form>
                            )}
                        </div>

                        <button onClick={() => { setViewSeller(null); setWalletForm({ show: false, action: 'add', amount: '', description: '' }); }}
                            className="btn-secondary w-full">
                            Close
                        </button>
                    </div>
                </div>
            )}

        </>
    );
}

export default AdminSellers;
