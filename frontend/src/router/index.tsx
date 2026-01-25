/**
 * 路由配置
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import SimpleLayout from '@/components/layout/SimpleLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import Loading from '@/components/common/Loading';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import PublicRoute from '@/components/common/PublicRoute';

// 懶加載頁面組件（代碼分割）
const Home = lazy(() => import('@/pages/Home'));
const QuickExperienceCreate = lazy(() => import('@/pages/QuickExperience/Create'));
const QuickExperienceResult = lazy(() => import('@/pages/QuickExperience/Result'));
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
const ProfileIndex = lazy(() => import('@/pages/Profile/Index'));
const ProfileSettings = lazy(() => import('@/pages/Profile/Settings'));
const ProfilePairing = lazy(() => import('@/pages/Profile/Pairing'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// 路由懶加載包裝器
const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading />}>{children}</Suspense>
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
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
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

