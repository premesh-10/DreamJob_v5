import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useNavigate, Link } from 'react-router-dom';
import ExportButtons from '../components/ExportButtons';

function AdminDashboard() {
    const navigate = useNavigate();
    const [analytics, setAnalytics] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAdminData = async () => {
            try {
                const [analyticsRes, usersRes] = await Promise.all([
                    api.get('/admin/analytics'),
                    api.get('/admin/users')
                ]);

                setAnalytics(analyticsRes.data.data);
                setUsers(usersRes.data.data.slice(0, 10)); // Show last 10
            } catch (error) {
                console.error('Failed to fetch admin data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAdminData();
    }, []);

    const handleBlock = async (userId, currentBlockStatus) => {
        if (window.confirm(`Are you sure you want to ${currentBlockStatus ? 'unblock' : 'block'} this user?`)) {
            try {
                const { data } = await api.patch(`/admin/users/${userId}/block`, {});
                alert(data.message);
                setUsers(prev => prev.map(u => u._id === userId ? { ...u, isBlocked: data.isBlocked } : u));
            } catch (error) {
                alert('Failed to update user: ' + (error.response?.data?.message || error.message));
            }
        }
    };



    if (loading) {
        return <div className="p-10 text-center text-slate-500">Loading admin dashboard...</div>;
    }

    const statCards = [
        { label: 'Total Users', value: analytics?.totalUsers || 0, color: 'bg-blue-50 text-blue-600', icon: '👤' },
        { label: 'Course Revenue', value: `₹${(analytics?.courseRevenue || 0).toFixed(2)}`, color: 'bg-emerald-50 text-emerald-600', icon: '📘' },
        { label: 'Interview Revenue', value: `₹${(analytics?.interviewRevenue || 0).toFixed(2)}`, color: 'bg-indigo-50 text-indigo-600', icon: '🎙️' },
        { label: 'Active Subscriptions', value: analytics?.activeSubscriptions || 0, color: 'bg-purple-50 text-purple-600', icon: '⭐' },
        { label: 'Pending Sellers', value: analytics?.pendingSellers || 0, color: 'bg-amber-50 text-amber-600', icon: '🕐' },
        { label: 'Total Bookings', value: analytics?.totalBookings || 0, color: 'bg-rose-50 text-rose-600', icon: '📅' },
    ];

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
                        <p className="text-slate-500 mt-1">Platform overview and management</p>
                    </div>
                    <ExportButtons
                        data={users}
                        filename="Dashboard_Users_Report"
                        columns={[
                            { header: 'Name', key: 'name' },
                            { header: 'Email', key: 'email' },
                            { header: 'Role', key: 'role' },
                            { header: 'Subscription', key: 'subscription', format: (v) => v?.plan || 'None' },
                            { header: 'Status', key: 'isBlocked', format: (v) => v ? 'Blocked' : 'Active' },
                            { header: 'Joined', key: 'createdAt', format: (v) => new Date(v).toLocaleDateString() },
                        ]}
                    />
                </div>

                {/* Analytics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                    {statCards.map(card => (
                        <div key={card.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center text-xl mb-3`}>
                                {card.icon}
                            </div>
                            <h3 className="text-slate-500 font-medium text-sm">{card.label}</h3>
                            <p className="text-3xl font-bold text-slate-900 mt-1">{card.value}</p>
                        </div>
                    ))}
                </div>

                {/* Quick Nav */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Manage Users', path: '/admin/users', color: 'bg-blue-600' },
                        { label: 'Manage Sellers', path: '/admin/sellers', color: 'bg-amber-500' },
                        { label: 'View Payments', path: '/admin/payments', color: 'bg-emerald-600' },
                        { label: 'Moderate Courses', path: '/admin/courses', color: 'bg-purple-600' },
                    ].map(item => (
                        <Link key={item.path} to={item.path}
                            className={`${item.color} text-white font-semibold py-4 px-6 rounded-2xl text-center hover:opacity-90 transition shadow-lg`}>
                            {item.label}
                        </Link>
                    ))}
                </div>

                {/* Recent Users Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-bold text-slate-900">Recent Users</h2>
                        <Link to="/admin/users" className="text-blue-600 font-medium text-sm hover:text-blue-700">View All →</Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Subscription</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Joined</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map(u => (
                                    <tr key={u._id} className={`hover:bg-slate-50 transition ${u.isBlocked ? 'opacity-60' : ''}`}>
                                        <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                                        <td className="px-6 py-4">{u.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${
                                                u.role.includes('admin') || u.role === 'moderator' ? 'bg-purple-100 text-purple-700' :
                                                u.role === 'seller' ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                                {u.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${
                                                u.subscription?.plan === 'None' ? 'bg-slate-100 text-slate-600' :
                                                u.subscription?.plan === 'Ruby' ? 'bg-rose-100 text-rose-700' :
                                                u.subscription?.plan === 'Platinum' ? 'bg-indigo-100 text-indigo-700' :
                                                'bg-slate-200 text-slate-800'
                                            }`}>
                                                {u.subscription?.plan}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {u.isBlocked ? 'Blocked' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleBlock(u._id, u.isBlocked)}
                                                className={`font-medium text-sm ${u.isBlocked ? 'text-green-600 hover:text-green-800' : 'text-rose-600 hover:text-rose-800'}`}
                                            >
                                                {u.isBlocked ? 'Unblock' : 'Block'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </>
    );
}

export default AdminDashboard;
