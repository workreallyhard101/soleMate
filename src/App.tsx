import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AdminModeProvider } from './contexts/AdminModeContext';
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/ui/Toast';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ProtectedRoute, AdminRoute, PublicOnlyRoute, HomeRoute } from './components/layout/ProtectedRoute';

import { HomePage } from './pages/public/Home';

import { AccessCodeGatePage } from './pages/auth/AccessCodeGate';
import { SignUpPage } from './pages/auth/SignUp';
import { LoginPage } from './pages/auth/Login';
import { VerifyOTPPage } from './pages/auth/VerifyOTP';

import { DashboardPage } from './pages/user/Dashboard';
import { SubmitStepsPage } from './pages/user/SubmitSteps';
import { LeaderboardPage } from './pages/user/Leaderboard';
import { ProfilePage } from './pages/user/Profile';

import { AdminDashboardPage } from './pages/admin/AdminDashboard';


function AppInner() {
  const { toasts, removeToast } = useToast();
  const location = useLocation();

  const isLockedPage = ['/', '/dashboard', '/submit', '/leaderboard', '/profile'].includes(location.pathname) ||
    location.pathname.startsWith('/admin');

  return (
    <AdminModeProvider>
      <div className={isLockedPage ? 'h-screen overflow-hidden flex flex-col' : ''}>
        <Navbar />
        <main className={isLockedPage ? 'flex flex-col flex-1 overflow-hidden' : 'flex flex-col min-h-screen'}>
          <Routes>
            <Route path="/" element={<HomeRoute><HomePage /></HomeRoute>} />
            <Route path="/rules" element={<Navigate to="/" replace />} />
            <Route path="/how-it-works" element={<Navigate to="/" replace />} />

            <Route path="/access-code" element={<PublicOnlyRoute><AccessCodeGatePage /></PublicOnlyRoute>} />
            <Route path="/signup" element={<PublicOnlyRoute><SignUpPage /></PublicOnlyRoute>} />
            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/verify-otp" element={<VerifyOTPPage />} />

            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/submit" element={<ProtectedRoute><SubmitStepsPage /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

            <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
            <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
        </main>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </AdminModeProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppInner />
        </ThemeProvider>
      </AuthProvider>
      <Analytics />
    </BrowserRouter>
  );
}
