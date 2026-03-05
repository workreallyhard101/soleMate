import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Smartphone, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function VerifyOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { phone?: string; isLogin?: boolean } | null;
  const phone = state?.phone || '';
  const isLogin = state?.isLogin || false;

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  if (!phone) {
    navigate('/login');
    return null;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (verifyError) {
        setError('Invalid or expired code. Please try again.');
        return;
      }

      if (data.user && !isLogin) {
        await supabase.from('users').upsert({
          id: data.user.id,
          full_name: data.user.user_metadata?.full_name || '',
          phone,
          secret_phrase_hash: data.user.user_metadata?.secret_phrase
            ? btoa(data.user.user_metadata.secret_phrase)
            : null,
          is_admin: false,
          is_active: true,
        });
      }

      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await supabase.auth.signInWithOtp({ phone });
      setResent(true);
      setTimeout(() => setResent(false), 30000);
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 pt-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 mb-4">
            <Smartphone className="w-7 h-7 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Verify Your Phone</h1>
          <p className="text-secondary text-sm">
            We sent a 6-digit code to <span className="text-primary font-medium">{phone}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="bg-card border border-strong rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {resent && (
            <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3 text-sm text-emerald-300">
              A new code has been sent to your phone.
            </div>
          )}

          <Input
            label="Verification Code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
            placeholder="000000"
            autoFocus
            className="text-center text-xl tracking-widest font-mono"
          />

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Verify Code
          </Button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resent}
            className="flex items-center justify-center gap-2 w-full text-sm text-secondary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
            {resent ? 'Code sent — check your phone' : "Didn't receive it? Resend"}
          </button>
        </form>
      </div>
    </div>
  );
}
