import { useState, useRef } from 'react';
import { User, Shield, Lock, Save, Camera } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10MB.'); return; }
    setAvatarUploading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      setAvatarPreview(publicUrl);
      await refreshProfile();
    } catch {
      setError('Failed to upload image.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!fullName.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ full_name: fullName.trim() })
        .eq('id', user!.id);

      if (updateError) throw updateError;
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setChangingPassword(true);
    setPasswordError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError('Failed to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-page pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary">Profile</h1>
          <p className="text-secondary mt-1">Manage your account settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="relative shrink-0">
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
                  className="relative w-16 h-16 rounded-full border-2 border-strong hover:border-teal-500 transition-colors group overflow-hidden bg-elevated"
                  disabled={avatarUploading}
                >
                  {(avatarPreview || profile?.avatar_url) ? (
                    <img
                      src={avatarPreview || profile?.avatar_url || ''}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <User className="w-7 h-7 text-muted group-hover:text-teal-400 transition-colors" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                    {avatarUploading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Camera className="w-4 h-4 text-white" />}
                  </div>
                </button>
              </div>
              <div>
                <h2 className="font-semibold text-primary">Personal Info</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={profile?.is_admin ? 'amber' : 'info'}>
                    {profile?.is_admin ? 'Admin' : 'Competitor'}
                  </Badge>
                </div>
                <p className="text-xs text-muted mt-1">Click photo to change</p>
              </div>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3 text-sm text-emerald-300">
                  Changes saved successfully.
                </div>
              )}

              <Input
                label="Full Name"
                type="text"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(''); }}
              />

              <Input
                label="Email"
                type="email"
                value={user?.email || ''}
                disabled
                hint="Email cannot be changed. Contact an admin for help."
              />

              {profile?.phone && (
                <Input
                  label="Phone"
                  type="tel"
                  value={profile.phone}
                  disabled
                  hint="Phone cannot be changed. Contact an admin for help."
                />
              )}

              <Button onClick={handleSaveName} loading={saving}>
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-teal-400" />
              </div>
              <h2 className="font-semibold text-primary">Change Password</h2>
            </div>

            <div className="space-y-4">
              {passwordError && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3 text-sm text-emerald-300">
                  Password changed successfully.
                </div>
              )}

              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                placeholder="At least 8 characters"
              />

              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                placeholder="Repeat new password"
              />

              <Button onClick={handleChangePassword} loading={changingPassword} variant="secondary">
                <Shield className="w-4 h-4" />
                Change Password
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

