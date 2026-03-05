import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, User, Phone, AlertTriangle, Clock, Mail, Key, Eye, EyeOff, Lock, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import type { Profile } from '../../types';

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

interface UserDetailsDrawerProps {
  user: Profile | null;
  onClose: () => void;
  onSaved: () => void;
}

interface EditForm {
  full_name: string;
  email: string;
  phoneCountry: string;
  phoneNumber: string;
  secret_phrase: string;
  new_password: string;
  confirm_password: string;
}

type FormErrors = Partial<Record<keyof EditForm, string>>;

function parsePhone(phone: string | null): { country: string; number: string } {
  if (!phone) return { country: '+1', number: '' };
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (phone.startsWith(c.code)) {
      return { country: c.code, number: phone.slice(c.code.length) };
    }
  }
  return { country: '+1', number: phone };
}

function validateField(field: keyof EditForm, value: string, form: EditForm): string {
  switch (field) {
    case 'full_name':
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
    case 'secret_phrase':
      if (!value.trim()) return '';
      if (value.trim().length < 4) return 'Min 4 characters';
      return '';
    case 'new_password':
      if (!value) return '';
      if (value.length < 8) return 'Min 8 characters';
      return '';
    case 'confirm_password':
      if (!form.new_password) return '';
      if (!value) return 'Please confirm the password';
      if (value !== form.new_password) return 'Passwords do not match';
      return '';
    default:
      return '';
  }
}

export function UserDetailsDrawer({ user, onClose, onSaved }: UserDetailsDrawerProps) {
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState<EditForm>({
    full_name: '', email: '', phoneCountry: '+1', phoneNumber: '',
    secret_phrase: '', new_password: '', confirm_password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editLogs, setEditLogs] = useState<{ field_changed: string; old_value: string | null; new_value: string | null; created_at: string; admin_full_name: string | null }[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const { country, number } = parsePhone(user.phone);
      setForm({
        full_name: user.full_name,
        email: user.email || '',
        phoneCountry: country,
        phoneNumber: number,
        secret_phrase: '',
        new_password: '',
        confirm_password: '',
      });
      setErrors({});
      setSaveError(null);
      setDirty(false);
      loadLogs(user.id);
    }
  }, [user]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const loadLogs = async (userId: string) => {
    setLogsLoading(true);
    const { data: logs } = await supabase
      .from('user_edit_logs')
      .select('field_changed, old_value, new_value, created_at, admin_user_id')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!logs || logs.length === 0) {
      setEditLogs([]);
      setLogsLoading(false);
      return;
    }

    const adminIds = [...new Set(logs.map((l) => l.admin_user_id).filter(Boolean))];
    const { data: admins } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', adminIds);

    const adminMap: Record<string, string> = {};
    for (const a of admins || []) adminMap[a.id] = a.full_name;

    setEditLogs(logs.map((row) => ({
      field_changed: row.field_changed,
      old_value: row.old_value,
      new_value: row.new_value,
      created_at: row.created_at,
      admin_full_name: row.admin_user_id ? (adminMap[row.admin_user_id] ?? null) : null,
    })));
    setLogsLoading(false);
  };

  const handleChange = (field: keyof EditForm, value: string) => {
    if (field === 'phoneNumber' && value && (!/^\d*$/.test(value) || value.length > 10)) return;

    const updatedForm = { ...form, [field]: value };
    setForm(updatedForm);
    setDirty(true);

    const err = validateField(field, value, updatedForm);
    setErrors((prev) => ({ ...prev, [field]: err }));

    if (field === 'new_password' && updatedForm.confirm_password) {
      const confirmErr = validateField('confirm_password', updatedForm.confirm_password, updatedForm);
      setErrors((prev) => ({ ...prev, confirm_password: confirmErr }));
    }
  };

  const validateAll = (): FormErrors => {
    const fields: (keyof EditForm)[] = ['full_name', 'email', 'phoneNumber', 'secret_phrase', 'new_password', 'confirm_password'];
    const e: FormErrors = {};
    for (const field of fields) {
      const err = validateField(field, form[field], form);
      if (err) e[field] = err;
    }
    return e;
  };

  const handleSave = async () => {
    if (!user || !currentUser) return;

    const validationErrors = validateAll();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setSaveError(null);

    const changes: { field: string; old: string | null; next: string | null }[] = [];
    const updatePayload: Record<string, unknown> = {};

    if (form.full_name !== user.full_name) {
      changes.push({ field: 'full_name', old: user.full_name, next: form.full_name });
      updatePayload.full_name = form.full_name;
    }

    const currentEmail = user.email || '';
    if (form.email !== currentEmail) {
      changes.push({ field: 'email', old: currentEmail || null, next: form.email || null });
      updatePayload.email = form.email || null;
    }

    const newPhone = form.phoneNumber ? `${form.phoneCountry}${form.phoneNumber}` : '';
    const currentPhone = user.phone || '';
    if (newPhone !== currentPhone) {
      changes.push({ field: 'phone', old: currentPhone || null, next: newPhone || null });
      updatePayload.phone = newPhone || null;
    }

    if (form.secret_phrase.trim()) {
      changes.push({ field: 'secret_phrase', old: '(hidden)', next: '(updated)' });
      updatePayload.secret_phrase_hash = form.secret_phrase.trim();
    }

    if (form.new_password) {
      changes.push({ field: 'password', old: '(hidden)', next: '(updated)' });
    }

    const needsAuthUpdate = form.new_password || (form.email !== (user.email || ''));

    if (Object.keys(updatePayload).length > 0) {
      await supabase.from('users').update(updatePayload).eq('id', user.id);
    }

    if (needsAuthUpdate) {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setSaving(false);
        setSaveError('Session expired. Please sign in again.');
        return;
      }

      const authPayload: Record<string, string> = { targetUserId: user.id };
      if (form.new_password) authPayload.password = form.new_password;
      if (form.email !== (user.email || '')) authPayload.email = form.email;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(authPayload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaving(false);
        setSaveError(body?.error || `Auth update failed (${res.status})`);
        return;
      }
    }

    if (changes.length > 0) {
      const logRows = changes.map((c) => ({
        admin_user_id: currentUser.id,
        target_user_id: user.id,
        field_changed: c.field,
        old_value: c.old,
        new_value: c.next,
      }));
      await supabase.from('user_edit_logs').insert(logRows);
    }

    setSaving(false);
    setDirty(false);
    setForm((prev) => ({ ...prev, secret_phrase: '', new_password: '', confirm_password: '' }));
    onSaved();
    if (changes.length > 0) {
      await loadLogs(user.id);
    }
  };

  if (!user) return null;

  const inputClass = (hasError: boolean) =>
    `w-full px-3 py-2 text-sm rounded-lg border text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-elevated ${hasError ? 'border-red-500' : 'border-strong'}`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl flex flex-col shadow-2xl rounded-2xl overflow-hidden bg-card border border-strong"
        style={{ height: 'min(92vh, 780px)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-strong shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 shrink-0">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center text-base font-bold text-amber-300 overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                ) : (
                  user.full_name.charAt(0).toUpperCase()
                )}
              </div>
              {user.is_admin && !user.is_deleted && (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] font-black border-2 border-card z-10">A</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-primary leading-tight">{user.full_name}</h2>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Clock className="w-3 h-3 shrink-0" />
                  Joined {new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                {user.is_deleted && user.account_deletion_date && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    Deleted {new Date(user.account_deletion_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {user.is_admin && !user.is_deleted && <Badge variant="amber" size="sm">Admin</Badge>}
                {user.is_deleted && <Badge variant="error" size="sm">Deleted</Badge>}
                {!user.is_deleted && !user.is_active && <Badge variant="error" size="sm">Inactive</Badge>}
                {!user.is_deleted && user.is_active && <Badge variant="success" size="sm">Active</Badge>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col w-[55%] border-r border-strong min-h-0">
            <div className="flex-1 overflow-hidden px-6 py-4 space-y-4">
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Profile Information</p>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    disabled={user.is_deleted}
                    placeholder="Full name"
                    className={inputClass(!!errors.full_name)}
                  />
                  {errors.full_name && <p className="text-xs text-red-400 mt-0.5">{errors.full_name}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    disabled={user.is_deleted}
                    placeholder="you@example.com"
                    className={inputClass(!!errors.email)}
                  />
                  {errors.email && <p className="text-xs text-red-400 mt-0.5">{errors.email}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Phone Number <span className="text-muted font-normal">— optional</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative shrink-0">
                      <select
                        value={form.phoneCountry}
                        onChange={(e) => handleChange('phoneCountry', e.target.value)}
                        disabled={user.is_deleted}
                        className="appearance-none bg-elevated border border-strong rounded-lg pl-2.5 pr-6 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={form.phoneNumber}
                      onChange={(e) => handleChange('phoneNumber', e.target.value)}
                      disabled={user.is_deleted}
                      placeholder="5550001234"
                      className={`flex-1 min-w-0 ${inputClass(!!errors.phoneNumber)}`}
                    />
                  </div>
                  {errors.phoneNumber && <p className="text-xs text-red-400 mt-0.5">{errors.phoneNumber}</p>}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Security</p>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" /> Secret Code <span className="text-muted font-normal">— for account recovery</span>
                  </label>
                  <input
                    type="text"
                    value={form.secret_phrase}
                    onChange={(e) => handleChange('secret_phrase', e.target.value)}
                    disabled={user.is_deleted}
                    placeholder="Enter new secret code to update..."
                    className={inputClass(!!errors.secret_phrase)}
                  />
                  {errors.secret_phrase
                    ? <p className="text-xs text-red-400 mt-0.5">{errors.secret_phrase}</p>
                    : <p className="text-[10px] text-muted">Min 4 characters. Leave blank to keep unchanged.</p>
                  }
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> New Password <span className="text-muted font-normal">— optional</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.new_password}
                      onChange={(e) => handleChange('new_password', e.target.value)}
                      disabled={user.is_deleted}
                      placeholder="Min 8 characters"
                      className={`${inputClass(!!errors.new_password)} pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted hover:text-secondary transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {errors.new_password && <p className="text-xs text-red-400 mt-0.5">{errors.new_password}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-secondary flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={form.confirm_password}
                      onChange={(e) => handleChange('confirm_password', e.target.value)}
                      disabled={user.is_deleted}
                      placeholder="Re-enter new password"
                      className={`${inputClass(!!errors.confirm_password)} pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-muted hover:text-secondary transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {errors.confirm_password && <p className="text-xs text-red-400 mt-0.5">{errors.confirm_password}</p>}
                </div>
              </div>

            </div>

            {!user.is_deleted && (
              <div className="shrink-0 px-6 py-4 border-t border-strong">
                {saveError && (
                  <div className="mb-3 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400">{saveError}</p>
                  </div>
                )}
                <p className="text-[10px] text-muted mb-3">Fields marked <span className="text-red-500">*</span> are required</p>
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${dirty && !saving ? 'bg-teal-500 hover:bg-teal-400' : 'bg-teal-500/40'}`}
                >
                  {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col w-[45%] min-h-0">
            <div className="px-5 py-4 border-b border-strong shrink-0">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Edit History</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {logsLoading ? (
                <div className="flex justify-center py-8"><Spinner size="sm" /></div>
              ) : editLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Clock className="w-8 h-8 text-muted/40 mb-2" />
                  <p className="text-xs text-muted">No changes recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {editLogs.map((log, i) => (
                    <div key={i} className="rounded-lg px-3 py-2.5 border border-strong bg-elevated">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-primary capitalize">{log.field_changed.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-muted whitespace-nowrap ml-2">
                          {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs mb-1.5">
                        <span className="text-muted line-through truncate max-w-[100px]">{log.old_value || '—'}</span>
                        <span className="text-muted shrink-0">→</span>
                        <span className="text-primary truncate max-w-[100px]">{log.new_value || '—'}</span>
                      </div>
                      {log.admin_full_name && (
                        <div className="flex items-center gap-1 text-[10px] text-muted">
                          <User className="w-3 h-3 shrink-0" />
                          <span className="truncate">by {log.admin_full_name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
