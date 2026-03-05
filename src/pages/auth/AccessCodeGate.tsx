import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export function AccessCodeGatePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const getRemainingLockTime = () => {
    if (!lockedUntil) return 0;
    return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000 / 60));
  };

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    if (!code.trim()) {
      setError('Please enter the access code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'access_code')
        .single();

      const storedCode = settings?.value || '';
      const isValid = storedCode.toUpperCase().trim() === code.toUpperCase().trim();

      if (isValid) {
        sessionStorage.setItem('access_code_verified', 'true');
        navigate('/signup');
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          const lockTime = Date.now() + LOCKOUT_MS;
          setLockedUntil(lockTime);
          setError(`Too many incorrect attempts. Please wait 15 minutes before trying again.`);
        } else {
          setError(`Incorrect access code. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? '' : 's'} remaining.`);
        }
      }
    } catch {
      setError('Unable to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 pt-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 mb-4">
            <Shield className="w-7 h-7 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Enter Access Code</h1>
          <p className="text-secondary text-sm">
            SoleMate is invite-only. Ask your group organizer for the access code.
          </p>
        </div>

        {isLocked ? (
          <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-5 text-center">
            <Lock className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 font-medium mb-1">Access temporarily locked</p>
            <p className="text-sm text-red-400">
              Too many failed attempts. Try again in {getRemainingLockTime()} minute{getRemainingLockTime() !== 1 ? 's' : ''}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card border border-strong rounded-2xl p-6 space-y-4">
            <div className="relative">
              <Input
                label="Access Code"
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(''); }}
                placeholder="Enter your access code"
                error={error}
                autoFocus
                autoCapitalize="characters"
              />
            </div>

            {attempts > 0 && attempts < MAX_ATTEMPTS && (
              <p className="text-xs text-amber-400 text-center">
                {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining before lockout
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-teal-400 hover:text-teal-300 transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
