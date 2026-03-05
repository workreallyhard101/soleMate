import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Footprints, Menu, X, LogOut, User, Shield, ChevronDown, Palette, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, THEMES } from '../../contexts/ThemeContext';
import { useAdminMode } from '../../contexts/AdminModeContext';
import { supabase } from '../../lib/supabase';
import type { ThemeKey } from '../../contexts/ThemeContext';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function AdminModeToggle() {
  const { isAdminMode, toggleAdminMode } = useAdminMode();
  const { theme } = useTheme();
  const activeTextColor = theme.isLight ? '#78350f' : '#fbbf24';
  const activeIconColor = theme.isLight ? '#92400e' : '#fbbf24';

  return (
    <button
      onClick={toggleAdminMode}
      title={isAdminMode ? 'Switch to User View' : 'Switch to Admin View'}
      className={`
        relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
        border transition-all duration-200 select-none
        ${isAdminMode
          ? 'bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25'
          : 'bg-card border-strong text-secondary hover:text-primary hover:border-amber-500/30'
        }
      `}
      style={isAdminMode ? { color: activeTextColor } : undefined}
    >
      <Shield
        className="w-3.5 h-3.5 transition-colors"
        style={isAdminMode ? { color: activeIconColor } : undefined}
      />
      <span className="hidden sm:inline">
        {isAdminMode ? 'Admin Mode' : 'Switch to Admin'}
      </span>
      <div
        className={`
          w-8 h-4 rounded-full transition-all duration-200 relative shrink-0 flex items-center
          ${isAdminMode ? 'bg-amber-500' : 'bg-elevated border border-strong'}
        `}
      >
        <div
          className={`
            absolute w-3 h-3 rounded-full transition-all duration-200 top-0.5
            ${isAdminMode ? 'left-4 bg-white' : 'left-0.5 bg-muted'}
          `}
        />
      </div>
    </button>
  );
}

function DeleteAccountModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  const [confirmText, setConfirmText] = useState('');
  const confirmed = confirmText.toLowerCase() === 'delete';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl p-6 mx-auto" style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border-strong)', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>

        <div className="flex items-start gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-primary">Delete your account?</h2>
            <p className="text-xs text-secondary mt-0.5 leading-relaxed">Your account and all submissions will be marked for deletion.</p>
          </div>
          <button onClick={onClose} className="ml-auto shrink-0 text-secondary hover:text-primary transition-colors p-1 -mr-1 -mt-1 rounded-lg hover:bg-black/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: 'rgb(180,110,10)' }}>Grace Period — 7 days</p>
          <p className="text-xs leading-relaxed" style={{ color: 'rgb(160,95,10)' }}>
            If you sign back in within <span className="font-bold" style={{ color: 'rgb(180,110,10)' }}>7 days</span>, all your data will be fully restored. After 7 days, your account and all submissions will be <span className="font-bold text-red-600">permanently deleted</span> and cannot be recovered.
          </p>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-secondary mb-2">
            Type <span className="font-bold text-primary font-mono">delete</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type delete here..."
            autoFocus
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border outline-none transition-all bg-transparent text-primary placeholder:text-muted"
            style={{
              borderColor: confirmed ? 'rgb(239,68,68)' : 'var(--color-border-strong)',
              boxShadow: confirmed ? '0 0 0 2px rgba(239,68,68,0.15)' : undefined,
            }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 text-secondary hover:text-primary"
            style={{ border: '1px solid var(--color-border-strong)', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: confirmed && !loading ? 'rgb(220,38,38)' : 'rgba(220,38,38,0.35)',
              cursor: confirmed && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {loading ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Navbar() {
  const { user, profile, signOut, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isAdminMode } = useAdminMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    await supabase.rpc('delete_account');
    setDeleteLoading(false);
    setShowDeleteModal(false);
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const userNavLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: null },
    { to: '/leaderboard', label: 'Leaderboard', icon: null },
    { to: '/submit', label: 'Submit Steps', icon: null },
  ];

  const adminNavLinks = [
    { to: '/admin', label: 'Admin', icon: <Shield className="w-3.5 h-3.5" /> },
  ];

  const publicNavLinks: typeof userNavLinks = [];

  const navLinks = !user
    ? publicNavLinks
    : isAdminMode
      ? adminNavLinks
      : userNavLinks;

  const firstName = profile?.full_name?.split(' ')[0] || 'Account';

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md border-b border-strong"
      style={{ backgroundColor: 'color-mix(in srgb, var(--color-surface-bg) 92%, transparent)' }}
    >
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          <Link
            to={!user ? '/' : isAdminMode ? '/admin' : '/dashboard'}
            className="flex items-center gap-2 group shrink-0"
          >
            <div className={`p-1.5 rounded-lg ${isAdminMode ? 'bg-amber-500/10 border border-amber-500/20' : `${theme.primaryBg} border ${theme.primaryBorder}`} group-hover:opacity-80 transition-opacity`}>
              {isAdminMode
                ? <Shield className="w-5 h-5 text-amber-400" />
                : <Footprints className={`w-5 h-5 ${theme.primaryText}`} />
              }
            </div>
            <span className="text-primary font-bold text-lg tracking-tight">
              {isAdminMode
                ? <>Sole<span className="text-amber-400">Admin</span></>
                : <>Sole<span className={theme.primaryText}>Mate</span></>
              }
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? isAdminMode ? 'text-amber-300' : `${theme.primaryText}`
                    : 'text-secondary hover:text-primary hover:bg-white/5'
                }`}
                style={isActive(link.to)
                  ? isAdminMode
                    ? { backgroundColor: 'rgba(245,158,11,0.12)' }
                    : { backgroundColor: hexToRgba(theme.palette.accentRaw, theme.isLight ? 0.35 : 0.15) }
                  : undefined}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            {isAdmin && user && location.pathname !== '/' && location.pathname !== '/rules' && <AdminModeToggle />}

            {user && (
              <div className="relative">
                <button
                  onClick={() => { setThemeMenuOpen(!themeMenuOpen); setUserMenuOpen(false); }}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors text-secondary hover:text-primary"
                  title="Change theme"
                >
                  <Palette className="w-4 h-4" />
                  <span
                    className="w-3 h-3 rounded-full border border-white/30"
                    style={{ backgroundColor: theme.swatch, boxShadow: theme.isLight ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : undefined }}
                  />
                </button>

                {themeMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setThemeMenuOpen(false)} />
                    <div
                      className="absolute right-0 top-full mt-1 w-44 border border-strong rounded-xl shadow-xl z-20 overflow-hidden p-2"
                      style={{ backgroundColor: 'var(--color-card-bg)' }}
                    >
                      <p className="text-xs text-muted font-medium px-2 pb-2">Color Theme</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {THEMES.map((t) => (
                          <button
                            key={t.key}
                            onClick={() => { setTheme(t.key as ThemeKey); setThemeMenuOpen(false); }}
                            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg transition-colors ${
                              theme.key === t.key ? 'bg-white/10' : 'hover:bg-white/5'
                            }`}
                          >
                            <span
                              className={`w-7 h-7 rounded-full border-2 ${theme.key === t.key ? 'border-teal-400' : 'border-white/20'}`}
                              style={{ backgroundColor: t.swatch }}
                            />
                            <span className="text-[11px] text-secondary font-medium">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {user ? (
              <div className="relative">
                <button
                  onClick={() => { setUserMenuOpen(!userMenuOpen); setThemeMenuOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm text-secondary hover:text-primary"
                >
                  <div className={`w-7 h-7 rounded-full overflow-hidden ${isAdminMode ? 'bg-amber-500/10 border border-amber-500/20' : `${theme.primaryBg} border ${theme.primaryBorder}`} flex items-center justify-center shrink-0`}>
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt={firstName} className="w-full h-full object-cover" />
                    ) : (
                      <User className={`w-4 h-4 ${isAdminMode ? 'text-amber-400' : theme.primaryText}`} />
                    )}
                  </div>
                  <span>{firstName}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div
                      className="absolute right-0 top-full mt-1 w-52 border border-strong rounded-xl shadow-xl z-20 overflow-hidden"
                      style={{ backgroundColor: 'var(--color-card-bg)' }}
                    >
                      <div className="px-4 py-3 border-b border-strong flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full overflow-hidden shrink-0 ${isAdminMode ? 'bg-amber-500/10 border border-amber-500/20' : `${theme.primaryBg} border ${theme.primaryBorder}`} flex items-center justify-center`}>
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt={firstName} className="w-full h-full object-cover" />
                          ) : (
                            <User className={`w-4 h-4 ${isAdminMode ? 'text-amber-400' : theme.primaryText}`} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-primary truncate">{profile?.full_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {isAdmin && <Shield className="w-3 h-3 text-amber-400" />}
                            <p className="text-xs text-secondary">{isAdmin ? 'Admin' : 'Competitor'}</p>
                          </div>
                        </div>
                      </div>

                      {!isAdminMode && (
                        <Link
                          to="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-white/5 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          Profile
                        </Link>
                      )}

                      {!isAdminMode && (
                        <button
                          onClick={() => { setUserMenuOpen(false); setShowDeleteModal(true); }}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Account
                        </button>
                      )}

                      <div className="border-t border-strong mt-1">
                        <button
                          onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/access-code"
                  className={`px-4 py-2 text-sm font-medium ${theme.primary} ${theme.primaryHover} text-white rounded-lg transition-colors`}
                  style={{ boxShadow: '0 4px 14px -2px color-mix(in srgb, var(--color-accent-raw) 30%, transparent)' }}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-strong" style={{ backgroundColor: 'var(--color-surface-bg)' }}>
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? isAdminMode ? 'text-amber-300' : `${theme.primaryText}`
                    : 'text-secondary hover:text-primary hover:bg-white/5'
                }`}
                style={isActive(link.to)
                  ? isAdminMode
                    ? { backgroundColor: 'rgba(245,158,11,0.12)' }
                    : { backgroundColor: hexToRgba(theme.palette.accentRaw, theme.isLight ? 0.35 : 0.15) }
                  : undefined}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}

            {isAdmin && user && location.pathname !== '/' && location.pathname !== '/rules' && (
              <div className="pt-2 border-t border-strong">
                <AdminModeToggle />
              </div>
            )}

            {user && (
              <div className="pt-2 border-t border-strong">
                <p className="text-xs text-muted px-3 mb-2">Color Theme</p>
                <div className="flex gap-2 px-3 pb-1 flex-wrap">
                  {THEMES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => { setTheme(t.key as ThemeKey); setMenuOpen(false); }}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${theme.key === t.key ? 'border-teal-400 scale-110' : 'border-white/20'}`}
                      style={{ backgroundColor: t.swatch }}
                      title={t.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {user ? (
              <div className="flex flex-col gap-0.5">
                {!isAdminMode && (
                  <button
                    onClick={() => { setMenuOpen(false); setShowDeleteModal(true); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400/80 hover:bg-red-500/5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); handleSignOut(); }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/5 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-2 border-t border-strong">
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 text-sm text-secondary text-center"
                >
                  Log In
                </Link>
                <Link
                  to="/access-code"
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2.5 text-sm font-medium ${theme.primary} text-white rounded-lg text-center`}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
          loading={deleteLoading}
        />
      )}
    </nav>
  );
}
