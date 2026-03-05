import { useState, useEffect } from 'react';
import { UserX, UserCheck, Shield, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { UserDetailsDrawer } from './UserDetailsDrawer';
import type { Profile } from '../../types';

export function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleActive = async (userId: string, currentState: boolean) => {
    setActioning(userId + 'active');
    await supabase.from('users').update({ is_active: !currentState }).eq('id', userId);
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: currentState ? 'user_deactivated' : 'user_activated',
      details: { target_user_id: userId },
    });
    await load();
    setActioning(null);
  };

  const toggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    setActioning(userId + 'admin');
    await supabase.rpc('admin_set_user_admin', { p_user_id: userId, p_is_admin: !currentIsAdmin });
    await load();
    setActioning(null);
  };

  const handleAvatarClick = (u: Profile) => {
    setSelectedUser(u);
  };

  const handleDrawerClose = () => {
    setSelectedUser(null);
  };

  const handleDrawerSaved = async () => {
    await load();
    if (selectedUser) {
      const updated = users.find((u) => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-page">
      <div className="flex-1 overflow-hidden flex flex-col pt-20">
        <div className="px-4 sm:px-6 lg:px-8 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-primary">Users</h1>
              <p className="text-xs text-muted">{users.length} registered</p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-1.5 text-sm bg-card border border-strong rounded-lg text-primary placeholder:text-muted focus:outline-none focus:border-amber-500/50 w-48"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-4">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <p className="text-secondary text-sm">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-strong border border-strong rounded-xl overflow-hidden bg-card">
              {filtered.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => handleAvatarClick(u)}
                    className="shrink-0 group focus:outline-none"
                    title="View user details"
                  >
                    <div className="relative w-9 h-9 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-300 overflow-hidden group-hover:ring-2 group-hover:ring-teal-500/60 transition-all">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                        ) : (
                          u.full_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {u.is_admin && !u.is_deleted && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] font-black leading-none border-2 border-card z-10">A</span>
                      )}
                      {u.is_deleted && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] font-black leading-none border-2 border-card z-10">D</span>
                      )}
                    </div>
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleAvatarClick(u)}
                        className={`font-medium text-sm text-left hover:underline ${u.is_deleted ? 'text-muted line-through' : 'text-primary'}`}
                      >
                        {u.full_name}
                      </button>
                      {u.is_admin && !u.is_deleted && <Badge variant="amber" size="sm">Admin</Badge>}
                      {u.is_deleted && <Badge variant="error" size="sm">Deleted</Badge>}
                      {!u.is_deleted && !u.is_active && <Badge variant="error" size="sm">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.id !== currentUser?.id && !u.is_deleted && (
                      <button
                        onClick={() => toggleAdmin(u.id, u.is_admin)}
                        disabled={actioning === u.id + 'admin'}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                          u.is_admin
                            ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-red-600 hover:border-red-700'
                            : 'bg-slate-600 border-slate-700 text-white hover:bg-emerald-600 hover:border-emerald-700'
                        }`}
                      >
                        {actioning === u.id + 'admin' ? <Spinner size="sm" /> : <Shield className="w-3.5 h-3.5" />}
                        {u.is_admin ? 'Revoke Admin' : 'Make Admin'}
                      </button>
                    )}
                    {!u.is_deleted && (
                      <button
                        onClick={() => toggleActive(u.id, u.is_active)}
                        disabled={actioning === u.id + 'active'}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                          u.is_active
                            ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {actioning === u.id + 'active' ? <Spinner size="sm" /> : u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <UserDetailsDrawer
        user={selectedUser}
        onClose={handleDrawerClose}
        onSaved={handleDrawerSaved}
      />
    </div>
  );
}
