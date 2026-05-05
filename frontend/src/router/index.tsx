/**
 * 路由配置（本檔同時導出 router 與 LazyWrapper 組件，故關閉 only-export-components）
 */
/* eslint-disable react-refresh/only-export-components */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Home as HomeIcon, Rocket, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/layout/AppLayout';
import SimpleLayout from '@/components/layout/SimpleLayout';
const AuthLayout = lazy(() => import('@/components/layout/AuthLayout'));
import Loading from '@/components/common/Loading';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import PublicRoute from '@/components/common/PublicRoute';
import { getAdminLoginUrl } from '@/utils/adminEntry';
import { t } from '@/utils/i18n';

// 懶加載頁面組件（代碼分割）
const Home = lazy(() => import('@/pages/Home'));
const QuickExperienceCreate = lazy(() => import('@/pages/QuickExperience/Create'));
const QuickExperienceResult = lazy(() => import('@/pages/QuickExperience/Result'));
const CollaborativeCreate = lazy(() => import('@/pages/QuickExperience/Collaborative'));
const Login = lazy(() => import('@/pages/Auth/Login'));
const Register = lazy(() => import('@/pages/Auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/Auth/ForgotPassword'));
const CaseList = lazy(() => import('@/pages/Case/List'));
const CaseCreate = lazy(() => import('@/pages/Case/Create'));
const CaseDetail = lazy(() => import('@/pages/Case/Detail'));
const CaseReview = lazy(() => import('@/pages/Case/Review'));
const JudgmentDetail = lazy(() => import('@/pages/Judgment/Detail'));
const ReconciliationList = lazy(() => import('@/pages/Reconciliation/List'));
const ReconciliationDetail = lazy(() => import('@/pages/Reconciliation/Detail'));
const ExecutionDashboard = lazy(() => import('@/pages/Execution/Dashboard'));
const ExecutionCheckIn = lazy(() => import('@/pages/Execution/CheckIn'));
const ExecutionReplan = lazy(() => import('@/pages/Execution/Replan'));
const NotificationsPage = lazy(() => import('@/pages/Notifications'));
const ProfileIndex = lazy(() => import('@/pages/Profile/Index'));
const ProfileSettings = lazy(() => import('@/pages/Profile/Settings'));
const ProfilePairing = lazy(() => import('@/pages/Profile/Pairing'));
const ProfileMyStory = lazy(() => import('@/pages/Profile/MyStory'));
const InterviewChat = lazy(() => import('@/pages/Interview/Chat'));
const InterviewResult = lazy(() => import('@/pages/Interview/Result'));
const ChatRoomPage = lazy(() => import('@/pages/Chat/Room'));
const NotFound = lazy(() => import('@/pages/NotFound'));

export const AdminRedirect = () => {
  const adminLoginUrl = getAdminLoginUrl();
  useEffect(() => {
    if (adminLoginUrl) {
      try {
        window.location.assign(adminLoginUrl);
      } catch {
        // 受限環境（如測試）可能不支持導航；忽略即可
      }
    }
  }, [adminLoginUrl]);
  if (!adminLoginUrl) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertTriangle className="size-12 text-warning" />
        <h2 className="text-xl font-bold text-foreground">{t('admin.redirect.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.login.urlMissing')}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.location.assign('/')}><HomeIcon className="size-4" />{t('notFound.backHome')}</Button>
          <Button variant="outline" onClick={() => window.location.assign('/quick-experience/create')}><Rocket className="size-4" />{t('notFound.goQuickExperience')}</Button>
        </div>
      </div>
    );
  }
  return <Loading />;
};

// 路由懶加載包裝器（導出供測試覆蓋）
// 使用純 CSS 動畫避免 framer-motion 進入初始 bundle
export const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading />}>
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-both">
      {children}
    </div>
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: (
          <LazyWrapper>
            <Home />
          </LazyWrapper>
        ),
      },
      {
        path: 'case/list',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <CaseList />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'case/create',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <CaseCreate />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'case/:id',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <CaseDetail />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'case/:id/review',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <CaseReview />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'judgment/:id',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <JudgmentDetail />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'reconciliation/:judgmentId',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <ReconciliationList />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'reconciliation/:judgmentId/:id',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <ReconciliationDetail />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'execution/dashboard',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <ExecutionDashboard />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'execution/:planId/checkin',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <ExecutionCheckIn />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'execution/:planId/replan',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <ExecutionReplan />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'notifications',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'profile/index',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <ProfileIndex />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'profile/settings',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'profile/pairing',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <ProfilePairing />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'profile/my-story',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <ProfileMyStory />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'interview/:sessionId',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <InterviewChat />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'interview/:sessionId/result',
        element: (
          <LazyWrapper>
            <ProtectedRoute>
              <InterviewResult />
            </ProtectedRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'chat/room',
        element: (
          <LazyWrapper>
            <ChatRoomPage />
          </LazyWrapper>
        ),
      },
      {
        path: 'chat/room/:roomId',
        element: (
          <LazyWrapper>
            <ChatRoomPage />
          </LazyWrapper>
        ),
      },
      {
        path: 'admin/*',
        element: <AdminRedirect />,
      },
    ],
  },
  {
    path: '/quick-experience',
    element: <SimpleLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/quick-experience/create" replace />,
      },
      {
        path: 'create',
        element: (
          <LazyWrapper>
            <QuickExperienceCreate />
          </LazyWrapper>
        ),
      },
      {
        path: 'result/:id',
        element: (
          <LazyWrapper>
            <QuickExperienceResult />
          </LazyWrapper>
        ),
      },
      {
        path: 'collaborative',
        element: (
          <LazyWrapper>
            <CollaborativeCreate />
          </LazyWrapper>
        ),
      },
    ],
  },
  {
    path: '/auth',
    element: <Suspense fallback={<Loading />}><AuthLayout /></Suspense>,
    children: [
      {
        index: true,
        element: <Navigate to="/auth/login" replace />,
      },
      {
        path: 'login',
        element: (
          <LazyWrapper>
            <PublicRoute>
              <Login />
            </PublicRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'register',
        element: (
          <LazyWrapper>
            <PublicRoute>
              <Register />
            </PublicRoute>
          </LazyWrapper>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <LazyWrapper>
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          </LazyWrapper>
        ),
      },
    ],
  },
  {
    path: '*',
    element: (
      <LazyWrapper>
        <NotFound />
      </LazyWrapper>
    ),
  },
]);
