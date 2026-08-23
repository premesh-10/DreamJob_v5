import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Maintenance from './pages/Maintenance';

// User pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Courses from './pages/Courses';
import CourseDetails from './pages/CourseDetails';
import Interviews from './pages/Interviews';
import InterviewGuidelines from './pages/InterviewGuidelines';
// Lazy-loaded: pulls in LiveKit + Monaco editor, which are heavy and only
// needed when a user actually enters a live interview room.
const InterviewRoom = lazy(() => import('./pages/InterviewRoom'));
// Lazy-loaded for the same reason as InterviewRoom — only needed inside a live webinar room.
const WebinarJoin = lazy(() => import('./pages/webinar/WebinarJoin'));
import InterviewFeedback from './pages/InterviewFeedback';
import WebinarFeedback from './pages/webinar/WebinarFeedback';
import Disputes from './pages/Disputes';
import InterviewTracker from './pages/InterviewTracker';
import JobApplicationDetail from './pages/JobApplicationDetail';
import Bookings from './pages/Bookings';
import Pricing from './pages/Pricing';
import Success from './pages/Success';
import PaymentStatus from './pages/PaymentStatus';
import Webinars from './pages/Webinars';
import Reports from './pages/Reports';
import PracticeTests from './pages/PracticeTests';
import PracticeTestDetail from './pages/PracticeTestDetail';
import PracticeTestQuiz from './pages/PracticeTestQuiz';
import PracticeTestReport from './pages/PracticeTestReport';

// Interview Experience Hub
import InterviewHub from './pages/InterviewHub';
import CompaniesList from './pages/hub/CompaniesList';
import CompanyProfile from './pages/hub/CompanyProfile';
import ExperienceDetail from './pages/hub/ExperienceDetail';
import SubmitExperience from './pages/hub/SubmitExperience';
import HubLeaderboard from './pages/hub/HubLeaderboard';
import HubProfile from './pages/hub/HubProfile';
import HubRewards from './pages/hub/HubRewards';

// Knowledge Hub pages
import KnowledgeHub from './pages/knowledge/KnowledgeHub';
import ArticleDetail from './pages/knowledge/ArticleDetail';
import ArticleEditor from './pages/knowledge/ArticleEditor';
import MyArticles from './pages/knowledge/MyArticles';
import KnowledgeBookmarks from './pages/knowledge/KnowledgeBookmarks';
import AuthorProfile from './pages/knowledge/AuthorProfile';
import KnowledgeModeration from './pages/admin/KnowledgeModeration';

// Admin pages
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/admin/Users';
import AdminSellers from './pages/admin/Sellers';
import AdminPayments from './pages/admin/Payments';
import AdminCourses from './pages/admin/Courses';
import AdminBookings from './pages/admin/Bookings';
import AdminDisputes from './pages/admin/Disputes';
import AdminInterviewSessions from './pages/admin/InterviewSessions';
import AdminRecordings from './pages/admin/Recordings';
import AdminVerifications from './pages/admin/Verifications';
import AdminAuditLogs from './pages/admin/AuditLogs';
import AdminWallet from './pages/admin/Wallet';
import AdminSubscriptions from './pages/admin/Subscriptions';
import AdminCoupons from './pages/admin/Coupons';
import AdminFeedback from './pages/admin/Feedback';
import AdminNotifications from './pages/admin/Notifications';
import AdminReports from './pages/admin/Reports';
import AdminSecurity from './pages/admin/Security';
import AdminSettings from './pages/admin/Settings';
import AdminMockInterviewSettings from './pages/admin/MockInterviewSettings';
import AdminInterviews from './pages/admin/Interviews';
import AdminReviews from './pages/admin/Reviews';
import AdminWebinars from './pages/admin/Webinars';
import WebinarAnalytics from './pages/admin/WebinarAnalytics';
import AdminPracticeTests from './pages/admin/PracticeTests';
import AdminHubCompanies from './pages/admin/HubCompanies';
import AdminHubReports from './pages/admin/HubReports';
import AdminHubRewards from './pages/admin/HubRewards';

// User feature pages
import Notifications from './pages/Notifications';
import FeedbackPage from './pages/FeedbackPage';

// Layouts
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';

// Seller Portal
import SellerLayout from './components/SellerLayout';
import SellerLogin from './pages/seller/SellerLogin';
import SellerRegister from './pages/seller/SellerRegister';
import SellerOverview from './pages/seller/SellerOverview';
import MyCourses from './pages/seller/MyCourses';
import SellerPracticeTests from './pages/seller/PracticeTests';
import SellerQuestionBank from './pages/seller/QuestionBank';
import SellerTestSeries from './pages/seller/TestSeries';
import SellerGradingQueue from './pages/seller/GradingQueue';
import InterviewSchedule from './pages/seller/InterviewSchedule';
import RevenueAnalytics from './pages/seller/RevenueAnalytics';
import SellerWallet from './pages/seller/SellerWallet';
import SellerOrders from './pages/seller/SellerOrders';
import SellerStudents from './pages/seller/SellerStudents';
import SellerProfile from './pages/seller/SellerProfile';
import SellerWebinars from './pages/seller/SellerWebinars';
import SellerWebinarAnalytics from './pages/seller/SellerWebinarAnalytics';
import SellerNotifications from './pages/seller/Notifications';
import { useSubscriptionSync } from './hooks/useSubscriptionSync';

function SubscriptionSyncProvider({ children }) {
    useSubscriptionSync();
    return children;
}

function App() {
  return (
    <>
      <Router>
        <SubscriptionSyncProvider>
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
          <Routes>
            {/* ── Standalone (no layout) ── */}
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/success" element={<Success />} />
            <Route path="/practice-tests/:id/quiz" element={<PracticeTestQuiz />} />
            <Route path="/interview-room/:sessionId" element={
                <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>}>
                    <InterviewRoom />
                </Suspense>
            } />
            <Route path="/interview-room/:sessionId/feedback" element={<InterviewFeedback />} />
            <Route path="/webinar-room/:webinarId" element={
                <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>}>
                    <WebinarJoin />
                </Suspense>
            } />
            <Route path="/webinar-room/:webinarId/feedback" element={<WebinarFeedback />} />

            {/* ── User Routes (persistent Layout) ── */}
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:id" element={<CourseDetails />} />
              <Route path="/interviews" element={<Interviews />} />
              <Route path="/interview-guidelines" element={<InterviewGuidelines />} />
              <Route path="/interview-tracker" element={<InterviewTracker />} />
              <Route path="/interview-tracker/:id" element={<JobApplicationDetail />} />
              <Route path="/history" element={<Bookings />} />
              <Route path="/disputes" element={<Disputes />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/payment-status" element={<PaymentStatus />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="/webinars" element={<Webinars />} />
              <Route path="/practice-tests" element={<PracticeTests />} />
              <Route path="/practice-tests/:id" element={<PracticeTestDetail />} />
              <Route path="/practice-tests/:id/attempts/:attemptId" element={<PracticeTestReport />} />
              <Route path="/interview-hub" element={<InterviewHub />} />
              <Route path="/interview-hub/companies" element={<CompaniesList />} />
              <Route path="/interview-hub/companies/:slug" element={<CompanyProfile />} />
              <Route path="/interview-hub/experiences/:id" element={<ExperienceDetail />} />
              <Route path="/interview-hub/submit" element={<SubmitExperience />} />
              <Route path="/interview-hub/leaderboard" element={<HubLeaderboard />} />
              <Route path="/interview-hub/my-profile" element={<HubProfile />} />
              <Route path="/interview-hub/rewards" element={<HubRewards />} />
              <Route path="/knowledge" element={<KnowledgeHub />} />
              <Route path="/knowledge/article/:slug" element={<ArticleDetail />} />
              <Route path="/knowledge/write" element={<ArticleEditor />} />
              <Route path="/knowledge/edit/:id" element={<ArticleEditor />} />
              <Route path="/knowledge/my-articles" element={<MyArticles />} />
              <Route path="/knowledge/bookmarks" element={<KnowledgeBookmarks />} />
              <Route path="/knowledge/author/:userId" element={<AuthorProfile />} />
            </Route>

            {/* ── Admin Routes (persistent AdminLayout) ── */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/sellers" element={<AdminSellers />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/courses" element={<AdminCourses />} />
              <Route path="/admin/interviews" element={<AdminInterviews />} />
              <Route path="/admin/bookings" element={<AdminBookings />} />
              <Route path="/admin/disputes" element={<AdminDisputes />} />
              <Route path="/admin/interview-sessions" element={<AdminInterviewSessions />} />
              <Route path="/admin/recordings" element={<AdminRecordings />} />
              <Route path="/admin/verifications" element={<AdminVerifications />} />
              <Route path="/admin/wallet" element={<AdminWallet />} />
              <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
              <Route path="/admin/coupons" element={<AdminCoupons />} />
              <Route path="/admin/feedback" element={<AdminFeedback />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/security" element={<AdminSecurity />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/mock-interview-settings" element={<AdminMockInterviewSettings />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/webinars" element={<AdminWebinars />} />
              <Route path="/admin/webinar-analytics" element={<WebinarAnalytics />} />
              <Route path="/admin/practice-tests" element={<AdminPracticeTests />} />
              <Route path="/admin/hub/companies" element={<AdminHubCompanies />} />
              <Route path="/admin/hub/reports" element={<AdminHubReports />} />
              <Route path="/admin/hub/rewards" element={<AdminHubRewards />} />
              <Route path="/admin/knowledge" element={<KnowledgeModeration />} />
            </Route>

            {/* ── Seller Portal Routes (persistent SellerLayout) ── */}
            <Route path="/seller/login" element={<SellerLogin />} />
            <Route path="/seller/register" element={<SellerRegister />} />
            <Route element={<SellerLayout />}>
              <Route path="/seller" element={<SellerOverview />} />
              <Route path="/seller/courses" element={<MyCourses />} />
              <Route path="/seller/practice-tests" element={<SellerPracticeTests />} />
              <Route path="/seller/question-bank" element={<SellerQuestionBank />} />
              <Route path="/seller/test-series" element={<SellerTestSeries />} />
              <Route path="/seller/grading-queue" element={<SellerGradingQueue />} />
              <Route path="/seller/interviews" element={<InterviewSchedule />} />
              <Route path="/seller/revenue" element={<RevenueAnalytics />} />
              <Route path="/seller/wallet" element={<SellerWallet />} />
              <Route path="/seller/orders" element={<SellerOrders />} />
              <Route path="/seller/students" element={<SellerStudents />} />
              <Route path="/seller/profile" element={<SellerProfile />} />
              <Route path="/seller/webinars" element={<SellerWebinars />} />
              <Route path="/seller/webinars/:id/analytics" element={<SellerWebinarAnalytics />} />
              <Route path="/seller/notifications" element={<SellerNotifications />} />
            </Route>
          </Routes>
        </div>
        </SubscriptionSyncProvider>
      </Router>
    </>
  );
}

export default App;
