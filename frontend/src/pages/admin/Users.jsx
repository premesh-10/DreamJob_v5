import { useState, useEffect } from 'react';
import api from '../../lib/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ExportButtons from '../../components/ExportButtons';

function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editModal, setEditModal] = useState({ open: false, user: null, role: '' });
    const [actionLoading, setActionLoading] = useState(null);

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/admin/users');
            setUsers(data.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleBlock = async (userId) => {
        if (window.confirm('Are you sure you want to toggle block status for this user?')) {
            setActionLoading(userId + '_block');
            try {
                const { data } = await api.patch(`/admin/users/${userId}/block`, {});
                alert(data.message);
                setUsers(prev => prev.map(u => u._id === userId ? { ...u, isBlocked: data.isBlocked } : u));
            } catch (error) {
                alert('Failed to update user status: ' + (error.response?.data?.message || error.message));
            } finally {
                setActionLoading(null);
            }
        }
    };

    const handleEditRole = async () => {
        setActionLoading(editModal.user._id + '_role');
        try {
            await api.patch(`/admin/users/${editModal.user._id}/role`, { role: editModal.role });
            setUsers(prev => prev.map(u => u._id === editModal.user._id ? { ...u, role: editModal.role } : u));
            setEditModal({ open: false, user: null, role: '' });
        } catch (error) {
            alert('Failed to update role: ' + (error.response?.data?.message || error.message));
        } finally {
            setActionLoading(null);
        }
    };

    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const allRoles = ['user', 'seller', 'admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin'];

    const stats = [
        { label: 'Total Users', value: users.length, cls: 'from-sky-50 to-blue-50 text-sky-700 border-sky-200', iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
        { label: 'Active', value: users.filter(u => !u.isBlocked).length, cls: 'from-emerald-50 to-green-50 text-emerald-700 border-emerald-200', iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        { label: 'Blocked', value: users.filter(u => u.isBlocked).length, cls: 'from-red-50 to-rose-50 text-red-700 border-red-200', iconPath: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
        { label: 'Admins', value: users.filter(u => u.role.includes('admin') || u.role === 'moderator').length, cls: 'from-violet-50 to-purple-50 text-violet-700 border-violet-200', iconPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    ];

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <AdminPageHeader
                    icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    iconBg="from-sky-500 to-blue-600"
                    title="User Management"
                    subtitle="Manage platform users, roles, and access"
                    actions={
                        <>
                            <div className="relative">
                                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search users..."
                                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-56 bg-white shadow-sm" />
                            </div>
                            <ExportButtons
                                data={filteredUsers}
                                filename="Users_Report"
                                columns={[
                                    { header: 'Name', key: 'name' },
                                    { header: 'Email', key: 'email' },
                                    { header: 'Role', key: 'role' },
                                    { header: 'Subscription', key: 'subscription', format: (v) => v?.plan || 'None' },
                                    { header: 'Status', key: 'isBlocked', format: (v) => v ? 'Blocked' : 'Active' },
                                    { header: 'Joined', key: 'createdAt', format: (v) => new Date(v).toLocaleDateString() },
                                ]}
                            />
                        </>
                    }
                />

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.map(s => (
                        <div key={s.label} className={`bg-gradient-to-br ${s.cls} rounded-2xl border p-4 flex items-center gap-3`}>
                            <div className={`w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center flex-shrink-0`}>
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
                            <span className="text-sm">Loading users...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                    <tr>
                                        {['Name', 'Email', 'Role', 'Subscription', 'Status', 'Joined', 'Actions'].map(h => (
                                            <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.map(u => (
                                        <tr key={u._id} className={`hover:bg-slate-50/70 transition-colors ${u.isBlocked ? 'bg-red-50/40' : ''}`}>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-100 to-violet-100 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                                                        {u.name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-slate-900">{u.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">{u.email}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${
                                                    u.role.includes('admin') || u.role === 'moderator' ? 'bg-violet-100 text-violet-700' :
                                                    u.role === 'seller' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {u.role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase ${
                                                    u.subscription?.plan === 'Ruby' ? 'bg-rose-100 text-rose-700' :
                                                    u.subscription?.plan === 'Platinum' ? 'bg-indigo-100 text-indigo-700' :
                                                    'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {u.subscription?.plan || 'Free'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${u.isBlocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${u.isBlocked ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                    {u.isBlocked ? 'Blocked' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => setEditModal({ open: true, user: u, role: u.role })}
                                                        className="text-xs px-2.5 py-1.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg font-medium hover:bg-primary-100 transition">
                                                        Edit Role
                                                    </button>
                                                    <button onClick={() => handleBlock(u._id)} disabled={actionLoading === u._id + '_block'}
                                                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border transition ${u.isBlocked ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}>
                                                        {actionLoading === u._id + '_block' ? '...' : u.isBlocked ? 'Unblock' : 'Block'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredUsers.length === 0 && (
                                <div className="p-16 text-center text-slate-400">
                                    <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    No users found.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Role Modal */}
            {editModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Edit Role</h3>
                                <p className="text-sm text-slate-500">{editModal.user?.name}</p>
                            </div>
                            <button onClick={() => setEditModal({ open: false, user: null, role: '' })}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
                        <select value={editModal.role} onChange={e => setEditModal({ ...editModal, role: e.target.value })}
                            className="input-field mb-5">
                            {allRoles.map(r => (
                                <option key={r} value={r}>{r.replace('_', ' ')}</option>
                            ))}
                        </select>
                        <div className="flex gap-3">
                            <button onClick={() => setEditModal({ open: false, user: null, role: '' })} className="btn-secondary flex-1">Cancel</button>
                            <button onClick={handleEditRole} disabled={actionLoading}
                                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 disabled:opacity-60 transition-all shadow-primary">
                                {actionLoading ? 'Saving...' : 'Save Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
}

export default AdminUsers;