import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser } from '../features/auth/authSlice';
import api from '../lib/api';

function Success() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        if (!sessionId) {
            navigate('/');
        } else {
            // Fetch updated user profile (e.g., after a subscription purchase)
            api.get('/auth/me').then(r => {
                if (r.data?.data) {
                    dispatch(setUser(r.data.data));
                }
            }).catch(() => {});
        }
        // In a real app, you might verify the session ID here or just rely on the webhook
    }, [sessionId, navigate, dispatch]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
                <p className="text-slate-500 mb-8">Thank you for your purchase. Your account has been updated.</p>
                <button 
                    onClick={() => navigate('/')}
                    className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 transition"
                >
                    Go to Dashboard
                </button>
            </div>
        </div>
    );
}

export default Success;
