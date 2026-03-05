import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError('Invalid email or password.'); return; }
      navigate(from, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-page flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-5">
          <h1 className="text-xl font-bold text-primary">Welcome back</h1>
          <p className="text-muted text-xs mt-1">Log in to your SoleMate account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-strong rounded-2xl p-5 space-y-3">
          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-secondary block mb-1">Email Address</label>
            <input
              type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="you@example.com" autoComplete="email" autoFocus
              className="w-full bg-elevated border border-strong rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-secondary block mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Your password" autoComplete="current-password"
                className="w-full bg-elevated border border-strong rounded-lg px-3 py-2 pr-9 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-muted hover:text-secondary">
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <Button type="submit" loading={loading} className="w-full !mt-4" size="sm">
            <LogIn className="w-3.5 h-3.5" />
            Log In
          </Button>
        </form>

        <p className="text-center text-xs text-muted mt-4">
          Don't have an account?{' '}
          <Link to="/access-code" className="text-teal-400 hover:text-teal-300 transition-colors">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
