import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AdminSidebar from './AdminSidebar';

function AdminLayout() {
    const { user } = useSelector(state => state.auth);

    // If not logged in, redirect to login
    if (!user) {
        return <Navigate to="/login" />;
    }

    // Check for any of the admin roles
    const adminRoles = ['admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin'];
    if (!adminRoles.includes(user?.role)) {
        return <Navigate to="/" />;
    }

    return (
        <div className="flex min-h-screen bg-surface font-sans text-slate-900">
            <AdminSidebar />
            <main className="flex-1 ml-64 p-6 lg:p-8 overflow-y-auto h-screen">
                <Outlet />
            </main>
        </div>
    );
}

export default AdminLayout;
