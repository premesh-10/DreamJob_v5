import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../lib/api';
import { useNavigate } from 'react-router-dom';

function SellerDashboard() {
    const { user } = useSelector(state => state.auth);
    const navigate = useNavigate();
    const [applicationStatus, setApplicationStatus] = useState(null);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [applyForm, setApplyForm] = useState({ contentType: '', targetedCourse: '' });

    // Create Course state
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [courseForm, setCourseForm] = useState({
        title: '', description: '', category: '', price: 0, thumbnail: '', level: 'Beginner'
    });
    const [courseLoading, setCourseLoading] = useState(false);
    const [myCourses, setMyCourses] = useState([]);

    // Interview profile state
    const [showInterviewModal, setShowInterviewModal] = useState(false);
    const [interviewForm, setInterviewForm] = useState({ domain: '', price: 0, meetingMode: 'Google Meet' });
    const [interviewProfile, setInterviewProfile] = useState(null);
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [slotForm, setSlotForm] = useState({ startTime: '', endTime: '' });

    useEffect(() => {
        if (user?.role === 'seller') {
            setApplicationStatus('approved');
            fetchSellerData();
        } else if (user?.role === 'user') {
            setApplicationStatus('none');
        }
    }, [user]);

    const fetchSellerData = async () => {
        try {
            // Fetch my courses
            const coursesRes = await api.get('/courses');
            const all = coursesRes.data.data || [];
            const mine = all.filter(c => c.seller?._id === user.id || c.seller?.id === user.id);
            setMyCourses(mine);

            // Fetch interview profile
            const interviewRes = await api.get('/interviews');
            const myInterview = interviewRes.data.data?.find(i => i.interviewer?._id === user.id || i.interviewer?.id === user.id);
            if (myInterview) setInterviewProfile(myInterview);
        } catch (err) {
            console.error('Error fetching seller data', err);
        }
    };

    const handleApply = async (e) => {
        e.preventDefault();
        try {
            await api.post('/sellers/apply', applyForm);
            setApplicationStatus('pending');
            setShowApplyModal(false);
            alert('Application submitted successfully!');
        } catch (error) {
            alert(error.response?.data?.message || 'Application failed');
        }
    };

    const handleCreateCourse = async (e) => {
        e.preventDefault();
        setCourseLoading(true);
        try {
            await api.post('/courses', { ...courseForm, price: Number(courseForm.price) });
            setShowCourseModal(false);
            setCourseForm({ title: '', description: '', category: '', price: 0, thumbnail: '', level: 'Beginner' });
            alert('Course created successfully! It will be reviewed by admin before publishing.');
            fetchSellerData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to create course');
        } finally {
            setCourseLoading(false);
        }
    };

    const handleSaveInterview = async (e) => {
        e.preventDefault();
        try {
            await api.post('/interviews', { ...interviewForm, price: Number(interviewForm.price) });
            setShowInterviewModal(false);
            alert('Interview profile saved!');
            fetchSellerData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to save interview profile');
        }
    };

    const handleAddSlot = async (e) => {
        e.preventDefault();
        try {
            await api.post('/interviews/slots', slotForm);
            setShowSlotModal(false);
            setSlotForm({ startTime: '', endTime: '' });
            alert('Slot added successfully!');
            fetchSellerData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to add slot');
        }
    };

    if (applicationStatus === 'none' || applicationStatus === 'pending') {
        return (
                    <div className="max-w-3xl mx-auto text-center py-20">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Become a Seller</h1>
                    <p className="text-lg text-slate-600 mb-8">Share your knowledge and earn money by uploading courses and offering mock interviews.</p>
                    
                    {applicationStatus === 'pending' ? (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl">
                            <h3 className="text-xl font-bold mb-2">Application Pending ⏳</h3>
                            <p>Your application is currently being reviewed by an admin. We will notify you once approved.</p>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setShowApplyModal(true)}
                            className="bg-primary-600 text-white font-bold px-8 py-4 rounded-xl hover:bg-primary-700 transition shadow-lg"
                        >
                            Apply Now
                        </button>
                    )}

                    {showApplyModal && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 text-left">
                            <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
                                <h3 className="text-2xl font-bold text-slate-900 mb-6">Seller Application</h3>
                                <form onSubmit={handleApply}>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Content Type</label>
                                        <select 
                                            required
                                            value={applyForm.contentType}
                                            onChange={e => setApplyForm({...applyForm, contentType: e.target.value})}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="">Select Type</option>
                                            <option value="Courses">Courses</option>
                                            <option value="Interviews">Mock Interviews</option>
                                            <option value="Both">Both</option>
                                        </select>
                                    </div>
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Targeted Course/Domain</label>
                                        <input 
                                            required
                                            type="text"
                                            value={applyForm.targetedCourse}
                                            onChange={e => setApplyForm({...applyForm, targetedCourse: e.target.value})}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                            placeholder="e.g. React.js, System Design"
                                        />
                                    </div>
                                    <div className="flex space-x-4">
                                        <button type="button" onClick={() => setShowApplyModal(false)} className="flex-1 py-2 px-4 bg-slate-100 text-slate-700 font-medium rounded-lg">Cancel</button>
                                        <button type="submit" className="flex-1 py-2 px-4 bg-primary-600 text-white font-medium rounded-lg">Submit</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
    
        );
    }

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Seller Dashboard</h1>
                        <p className="text-slate-500 mt-1">Manage your courses and interview slots</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowInterviewModal(true)}
                            className="bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-900 transition"
                        >
                            {interviewProfile ? '✎ Edit Interview Profile' : '+ Interview Profile'}
                        </button>
                        <button 
                            onClick={() => setShowCourseModal(true)}
                            className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition"
                        >
                            + Create Course
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <p className="text-slate-500 font-medium">My Courses</p>
                        <h2 className="text-3xl font-bold text-slate-900 mt-2">{myCourses.length}</h2>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <p className="text-slate-500 font-medium">Interview Profile</p>
                        <h2 className="text-xl font-bold text-slate-900 mt-2">{interviewProfile ? interviewProfile.domain : 'Not Set'}</h2>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <p className="text-slate-500 font-medium">Available Slots</p>
                        <h2 className="text-3xl font-bold text-slate-900 mt-2">
                            {interviewProfile ? interviewProfile.slots?.filter(s => !s.isBooked).length : 0}
                        </h2>
                    </div>
                </div>

                {/* My Courses */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-900">My Courses</h2>
                        <button onClick={() => setShowCourseModal(true)} className="text-primary-600 font-medium text-sm hover:text-primary-700">+ Add New</button>
                    </div>
                    {myCourses.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">
                            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            <p className="font-medium text-slate-700">No courses yet</p>
                            <p className="text-sm mt-1">Click "Create Course" to publish your first course.</p>
                            <button onClick={() => setShowCourseModal(true)} className="mt-4 bg-slate-900 text-white px-6 py-2 rounded-xl font-medium hover:bg-slate-800 transition">Get Started</button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {myCourses.map(course => (
                                <div key={course._id} className="p-6 flex items-center justify-between hover:bg-slate-50">
                                    <div>
                                        <h3 className="font-semibold text-slate-900 mb-0.5">{course.title}</h3>
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <span>{course.category}</span>
                                            <span>•</span>
                                            <span>${course.price}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <span className="text-amber-400 text-xs">★</span>
                                                <span className="font-medium text-slate-700">{(course.rating || 0).toFixed(1)}</span>
                                                <span className="text-xs">({course.totalReviews || 0})</span>
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${course.isPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {course.isPublished ? 'Published' : 'Under Review'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Interview Profile & Slots */}
                {interviewProfile && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-900">Interview Slots</h2>
                            <button onClick={() => setShowSlotModal(true)} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">+ Add Slot</button>
                        </div>
                        {interviewProfile.slots?.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-6">No slots added yet. Add your availability to start receiving bookings.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {interviewProfile.slots.map(slot => (
                                    <div key={slot._id} className={`p-3 rounded-xl border text-sm ${slot.isBooked ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                                        <p className="font-medium">{new Date(slot.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                        <p className="text-xs mt-1">{slot.isBooked ? '🔴 Booked' : '🟢 Available'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Course Modal */}
            {showCourseModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl p-8 max-w-xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-bold text-slate-900 mb-6">Create New Course</h3>
                        <form onSubmit={handleCreateCourse} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Course Title *</label>
                                <input required type="text" value={courseForm.title}
                                    onChange={e => setCourseForm({...courseForm, title: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    placeholder="e.g. Complete React.js Course" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                                <textarea required value={courseForm.description}
                                    onChange={e => setCourseForm({...courseForm, description: e.target.value})}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    placeholder="Describe what students will learn..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                                    <input required type="text" value={courseForm.category}
                                        onChange={e => setCourseForm({...courseForm, category: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                        placeholder="e.g. Web Development" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
                                    <input type="number" min="0" step="0.01" value={courseForm.price}
                                        onChange={e => setCourseForm({...courseForm, price: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Thumbnail URL</label>
                                <input type="url" value={courseForm.thumbnail}
                                    onChange={e => setCourseForm({...courseForm, thumbnail: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    placeholder="https://..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Level</label>
                                <select value={courseForm.level}
                                    onChange={e => setCourseForm({...courseForm, level: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                                    <option value="Beginner">Beginner</option>
                                    <option value="Intermediate">Intermediate</option>
                                    <option value="Advanced">Advanced</option>
                                </select>
                            </div>
                            <div className="flex space-x-4 pt-2">
                                <button type="button" onClick={() => setShowCourseModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl">Cancel</button>
                                <button type="submit" disabled={courseLoading}
                                    className="flex-1 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-60">
                                    {courseLoading ? 'Creating...' : 'Create Course'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Interview Profile Modal */}
            {showInterviewModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-2xl font-bold text-slate-900 mb-6">
                            {interviewProfile ? 'Edit Interview Profile' : 'Set Up Interview Profile'}
                        </h3>
                        <form onSubmit={handleSaveInterview} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Domain *</label>
                                <input required type="text"
                                    value={interviewForm.domain}
                                    onChange={e => setInterviewForm({...interviewForm, domain: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    placeholder="e.g. Python Developer, DevOps" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Price per Session ($)</label>
                                <input type="number" min="0" value={interviewForm.price}
                                    onChange={e => setInterviewForm({...interviewForm, price: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Meeting Mode</label>
                                <select value={interviewForm.meetingMode}
                                    onChange={e => setInterviewForm({...interviewForm, meetingMode: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                                    <option value="Google Meet">Google Meet</option>
                                    <option value="Zoom">Zoom</option>
                                    <option value="Platform Integrated">Platform Integrated</option>
                                </select>
                            </div>
                            <div className="flex space-x-4 pt-2">
                                <button type="button" onClick={() => setShowInterviewModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl">Cancel</button>
                                <button type="submit"
                                    className="flex-1 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800">
                                    Save Profile
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Slot Modal */}
            {showSlotModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className="text-2xl font-bold text-slate-900 mb-6">Add Interview Slot</h3>
                        <form onSubmit={handleAddSlot} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time *</label>
                                <input required type="datetime-local"
                                    value={slotForm.startTime}
                                    onChange={e => setSlotForm({...slotForm, startTime: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">End Time *</label>
                                <input required type="datetime-local"
                                    value={slotForm.endTime}
                                    onChange={e => setSlotForm({...slotForm, endTime: e.target.value})}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div className="flex space-x-4 pt-2">
                                <button type="button" onClick={() => setShowSlotModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl">Cancel</button>
                                <button type="submit"
                                    className="flex-1 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700">
                                    Add Slot
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </>
    );
}

export default SellerDashboard;
