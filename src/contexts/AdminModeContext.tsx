import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface AdminModeContextValue {
  isAdminMode: boolean;
  toggleAdminMode: () => void;
  enterAdminMode: () => void;
  exitAdminMode: () => void;
}

const AdminModeContext = createContext<AdminModeContextValue | null>(null);

const ADMIN_PATHS = ['/admin', '/admin/submissions', '/admin/users', '/admin/settings', '/admin/logs'];

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isAdminMode, setIsAdminMode] = useState(() =>
    ADMIN_PATHS.some((p) => location.pathname === p || location.pathname.startsWith('/admin'))
  );

  useEffect(() => {
    if (!isAdmin) {
      setIsAdminMode(false);
      return;
    }
    const onAdminPath = location.pathname.startsWith('/admin');
    if (onAdminPath && !isAdminMode) setIsAdminMode(true);
  }, [location.pathname, isAdmin]);

  const enterAdminMode = () => {
    setIsAdminMode(true);
    navigate('/admin');
  };

  const exitAdminMode = () => {
    setIsAdminMode(false);
    navigate('/dashboard');
  };

  const toggleAdminMode = () => {
    if (isAdminMode) exitAdminMode();
    else enterAdminMode();
  };

  return (
    <AdminModeContext.Provider value={{ isAdminMode, toggleAdminMode, enterAdminMode, exitAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const ctx = useContext(AdminModeContext);
  if (!ctx) throw new Error('useAdminMode must be used within AdminModeProvider');
  return ctx;
}
