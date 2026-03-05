import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ChevronDown, Camera, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

const COUNTRY_CODES = [
  { code: '+1', label: '+1 (US/CA)' },
  { code: '+44', label: '+44 (UK)' },
  { code: '+61', label: '+61 (AU)' },
  { code: '+91', label: '+91 (IN)' },
  { code: '+49', label: '+49 (DE)' },
  { code: '+33', label: '+33 (FR)' },
  { code: '+34', label: '+34 (ES)' },
  { code: '+39', label: '+39 (IT)' },
  { code: '+55', label: '+55 (BR)' },
  { code: '+52', label: '+52 (MX)' },
  { code: '+81', label: '+81 (JP)' },
  { code: '+82', label: '+82 (KR)' },
  { code: '+86', label: '+86 (CN)' },
  { code: '+7', label: '+7 (RU)' },
  { code: '+971', label: '+971 (UAE)' },
  { code: '+966', label: '+966 (SA)' },
  { code: '+234', label: '+234 (NG)' },
  { code: '+27', label: '+27 (ZA)' },
  { code: '+20', label: '+20 (EG)' },
  { code: '+64', label: '+64 (NZ)' },
];

function RequiredMark() {
  return <span className="text-red-500 ml-0.5">*</span>;
}

export function SignUpPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phoneCountry: '+1',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    secretPhrase: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionStorage.getItem('access_code_verified')) navigate('/access-code');
  }, [navigate]);

  const validateField = (field: string, value: string, allForm = form): string => {
    switch (field) {
      case 'fullName':
        return value.trim() ? '' : 'Full name is required';
      case 'email':
        if (!value) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
        return '';
      case 'phoneNumber':
        if (!value) return '';
        if (!/^\d+$/.test(value)) return 'Only numbers are allowed';
        if (value.length < 6) return 'Too short';
        if (value.length > 10) return 'Max 10 digits';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Min 8 characters';
        return '';
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== allForm.password) return 'Passwords do not match';
        return '';
      case 'secretPhrase':
        if (!value.trim()) return 'Secret phrase is required';
        if (value.trim().length < 4) return 'Min 4 characters';
        return '';
      default:
        return '';
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;

    if (field === 'phoneNumber' && value && (!/^\d*$/.test(value) || value.length > 10)) return;

    const updatedForm = { ...form, [field]: value };
    setForm(updatedForm);

    const err = validateField(field, value, updatedForm);
    setErrors(p => ({ ...p, [field]: err }));

    if (field === 'password' && updatedForm.confirmPassword) {
      const confirmErr = validateField('confirmPassword', updatedForm.confirmPassword, updatedForm);
      setErrors(p => ({ ...p, confirmPassword: confirmErr }));
    }

    setGeneralError('');
  };

  const validate = () => {
    const fields = ['fullName', 'email', 'phoneNumber', 'password', 'confirmPassword', 'secretPhrase'];
    const e: Record<string, string> = {};
    for (const field of fields) {
      const err = validateField(field, form[field as keyof typeof form]);
      if (err) e[field] = err;
    }
    return e;
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setGeneralError('Profile image must be under 10MB.');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setGeneralError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setLoading(true);
    const phone = form.phoneNumber ? `${form.phoneCountry}${form.phoneNumber}` : '';
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.fullName, phone: phone || null, secret_phrase: form.secretPhrase } },
      });
      if (error) { setGeneralError(error.message.includes('already') ? 'Account already exists.' : error.message); return; }
      if (data.user) {
        if (avatarFile) {
          const ext = avatarFile.name.split('.').pop();
          const path = `${data.user.id}/avatar.${ext}`;
          const { error: uploadError } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
            await supabase.from('users').update({ avatar_url: urlData.publicUrl }).eq('id', data.user.id);
          }
        }
        sessionStorage.removeItem('access_code_verified');
        navigate('/dashboard');
      }
    } catch { setGeneralError('Registration failed. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-5">
          <h1 className="text-xl font-bold text-primary">Create Account</h1>
          <p className="text-muted text-xs mt-1">Join the SoleMate competition</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-strong rounded-2xl p-5 space-y-3">
          {generalError && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300">
              {generalError}
            </div>
          )}

          <div className="flex flex-col items-center pb-1">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative w-20 h-20 rounded-full border-2 border-dashed border-strong hover:border-teal-500 transition-colors group overflow-hidden bg-elevated"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-1">
                  <User className="w-7 h-7 text-muted group-hover:text-teal-400 transition-colors" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </button>
            <p className="text-xs text-muted mt-1.5">Profile photo <span className="text-muted font-normal">— optional</span></p>
          </div>

          <div>
            <label className="text-xs font-medium text-secondary block mb-1">
              Full Name<RequiredMark />
            </label>
            <input
              type="text" value={form.fullName} onChange={set('fullName')}
              placeholder="Your full name" autoComplete="name"
              className={`w-full bg-elevated border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${errors.fullName ? 'border-red-500' : 'border-strong'}`}
            />
            {errors.fullName && <p className="text-xs text-red-400 mt-0.5">{errors.fullName}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-secondary block mb-1">
              Email Address<RequiredMark />
            </label>
            <input
              type="email" value={form.email} onChange={set('email')}
              placeholder="you@example.com" autoComplete="email"
              className={`w-full bg-elevated border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${errors.email ? 'border-red-500' : 'border-strong'}`}
            />
            {errors.email && <p className="text-xs text-red-400 mt-0.5">{errors.email}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-secondary block mb-1">
              Phone Number <span className="text-muted font-normal">— optional</span>
            </label>
            <div className="flex gap-2">
              <div className="relative shrink-0">
                <select
                  value={form.phoneCountry}
                  onChange={set('phoneCountry')}
                  className="appearance-none bg-elevated border border-strong rounded-lg pl-2.5 pr-6 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors cursor-pointer"
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
              </div>
              <input
                type="tel"
                inputMode="numeric"
                value={form.phoneNumber}
                onChange={set('phoneNumber')}
                placeholder="5550001234"
                autoComplete="tel-national"
                className={`flex-1 min-w-0 bg-elevated border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${errors.phoneNumber ? 'border-red-500' : 'border-strong'}`}
              />
            </div>
            {errors.phoneNumber && <p className="text-xs text-red-400 mt-0.5">{errors.phoneNumber}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-secondary block mb-1">
              Password<RequiredMark />
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')}
                placeholder="Min 8 characters" autoComplete="new-password"
                className={`w-full bg-elevated border rounded-lg px-3 py-2 pr-9 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${errors.password ? 'border-red-500' : 'border-strong'}`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-muted hover:text-secondary">
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400 mt-0.5">{errors.password}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-secondary block mb-1">
              Confirm Password<RequiredMark />
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={set('confirmPassword')}
                placeholder="Re-enter your password" autoComplete="new-password"
                className={`w-full bg-elevated border rounded-lg px-3 py-2 pr-9 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${errors.confirmPassword ? 'border-red-500' : 'border-strong'}`}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-2.5 text-muted hover:text-secondary">
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-red-400 mt-0.5">{errors.confirmPassword}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-secondary block mb-1">
              Secret Phrase<RequiredMark /> <span className="text-muted font-normal">— for account recovery</span>
            </label>
            <input
              type="text" value={form.secretPhrase} onChange={set('secretPhrase')}
              placeholder="e.g. blue sunrise 42"
              className={`w-full bg-elevated border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors ${errors.secretPhrase ? 'border-red-500' : 'border-strong'}`}
            />
            {errors.secretPhrase && <p className="text-xs text-red-400 mt-0.5">{errors.secretPhrase}</p>}
          </div>

          <p className="text-[11px] text-muted pt-1">
            Fields marked <span className="text-red-500">*</span> are required
          </p>

          <Button type="submit" loading={loading} className="w-full !mt-3" size="sm">
            Create Account
          </Button>
        </form>

        <p className="text-center text-xs text-muted mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-teal-400 hover:text-teal-300 transition-colors">Log in</Link>
        </p>
      </div>
    </div>
  );
}
