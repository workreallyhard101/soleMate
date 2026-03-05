import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Flag, Eye, ExternalLink, AlertTriangle, UserX, UserCheck, Shield, Search, Save, Key, MessageSquare, X, Info, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getAllSubmissionsAdmin, getSignedUrl } from '../../lib/submissions';
import { formatDate, formatDateWithYear, formatSteps } from '../../lib/deadlineUtils';
import { StatusBadge } from '../../components/ui/Badge';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { UserDetailsDrawer } from './UserDetailsDrawer';
import type { Submission, SubmissionStatus, Profile } from '../../types';

interface HelpRequest {
  id: string;
  name: string;
  email: string;
  subject: string;
  request: string;
  created_at: string;
  is_read: boolean;
}

type FilterStatus = 'all' | SubmissionStatus;
type SubmissionWithProfile = Submission & { users: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null };

export function AdminDashboardPage() {
  const { user: currentUser } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionWithProfile[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subFilter, setSubFilter] = useState<FilterStatus>('pending');
  const [actioning, setActioning] = useState<string | null>(null);
  const [proofModal, setProofModal] = useState<{ url: string; loading: boolean } | null>(null);

  const [users, setUsers] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userActioning, setUserActioning] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [helpLoading, setHelpLoading] = useState(true);
  const [viewingHelp, setViewingHelp] = useState<HelpRequest | null>(null);

  const [accessCode, setAccessCode] = useState('');
  const [newAccessCode, setNewAccessCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [showCodeInfo, setShowCodeInfo] = useState(false);

  const loadSubmissions = useCallback(async () => {
    setSubsLoading(true);
    try {
      const data = await getAllSubmissionsAdmin();
      setSubmissions(data);
    } finally {
      setSubsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setUsersLoading(false);
  }, []);

  const loadHelpRequests = useCallback(async () => {
    setHelpLoading(true);
    const { data } = await supabase.from('help_requests').select('*').order('created_at', { ascending: false });
    setHelpRequests(data || []);
    setHelpLoading(false);
  }, []);

  const openHelpRequest = async (hr: HelpRequest) => {
    setViewingHelp(hr);
    if (!hr.is_read) {
      await supabase.from('help_requests').update({ is_read: true }).eq('id', hr.id);
      setHelpRequests((prev) => prev.map((r) => r.id === hr.id ? { ...r, is_read: true } : r));
    }
  };

  const deleteHelpRequest = async (hr: HelpRequest) => {
    await supabase.from('help_requests').delete().eq('id', hr.id);
    setHelpRequests((prev) => prev.filter((r) => r.id !== hr.id));
  };

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*');
    const map: Record<string, string> = {};
    (data || []).forEach((s) => { map[s.key] = s.value; });
    setAccessCode(map.access_code || '');
  }, []);

  useEffect(() => {
    loadSubmissions();
    loadUsers();
    loadSettings();
    loadHelpRequests();
  }, [loadSubmissions, loadUsers, loadSettings, loadHelpRequests]);

  const filteredSubs = submissions.filter((s) => subFilter === 'all' || s.status === subFilter);
  const subCounts: Record<FilterStatus, number> = {
    all: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    flagged: submissions.filter((s) => s.status === 'flagged').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
    rejected: submissions.filter((s) => s.status === 'rejected').length,
  };

  const filteredUsers = users.filter((u) =>
    u.full_name.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleSubAction = async (subId: string, action: 'approve' | 'reject' | 'flag') => {
    setActioning(subId + action);
    const fnMap = { approve: 'admin_approve_submission', reject: 'admin_reject_submission', flag: 'admin_flag_submission' };
    const { error } = await supabase.rpc(fnMap[action], { p_submission_id: subId, p_note: null });
    if (!error) await loadSubmissions();
    setActioning(null);
  };

  const handleViewProof = async (filePath: string) => {
    setProofModal({ url: '', loading: true });
    try {
      const url = await getSignedUrl(filePath);
      setProofModal({ url, loading: false });
    } catch {
      setProofModal(null);
    }
  };

  const handleToggleActive = async (userId: string, current: boolean) => {
    setUserActioning(userId + 'active');
    await supabase.from('users').update({ is_active: !current }).eq('id', userId);
    await loadUsers();
    setUserActioning(null);
  };

  const handleToggleAdmin = async (userId: string, current: boolean) => {
    setUserActioning(userId + 'admin');
    await supabase.rpc('admin_set_user_admin', { p_user_id: userId, p_is_admin: !current });
    await loadUsers();
    setUserActioning(null);
  };

  const saveAccessCode = async () => {
    if (!newAccessCode.trim()) return;
    setSavingCode(true);
    try {
      await supabase.from('settings').update({ value: newAccessCode.trim(), updated_at: new Date().toISOString() }).eq('key', 'access_code');
      setAccessCode(newAccessCode.trim());
      setNewAccessCode('');
      setCodeSuccess(true);
      setTimeout(() => setCodeSuccess(false), 3000);
    } finally {
      setSavingCode(false);
    }
  };

  const subFilters: FilterStatus[] = ['pending', 'flagged', 'approved', 'rejected', 'all'];

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-page">
      <div className="flex-1 overflow-hidden flex flex-col pt-16">

        <div className="px-4 sm:px-6 py-3 border-b border-strong bg-card flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 relative">
            <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-muted shrink-0">Access Code:</span>
            <span className="text-xs font-mono text-primary bg-elevated border border-strong rounded px-2 py-0.5">
              {accessCode || '—'}
            </span>
            <button
              onMouseEnter={() => setShowCodeInfo(true)}
              onMouseLeave={() => setShowCodeInfo(false)}
              className="p-0.5 rounded text-muted hover:text-amber-400 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {showCodeInfo && (
              <>
                <div className="absolute left-0 top-full mt-1.5 z-20 bg-card border border-strong rounded-xl shadow-xl p-3.5 w-64">
                  <p className="text-xs font-semibold text-primary mb-1">About the Access Code</p>
                  <p className="text-xs text-secondary leading-relaxed">
                    New users must enter this code on the sign-up page before creating an account. Share it only with members you want to invite. You can change it at any time — existing accounts are not affected.
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newAccessCode}
              onChange={(e) => setNewAccessCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveAccessCode()}
              placeholder="Change access code..."
              className="px-2.5 py-1.5 text-xs bg-elevated border border-strong rounded-lg text-primary placeholder:text-muted focus:outline-none focus:border-amber-500/50 w-40"
            />
            <button
              onClick={saveAccessCode}
              disabled={savingCode || !newAccessCode.trim()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 border border-amber-600 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {savingCode ? <Spinner size="sm" /> : <Save className="w-3 h-3" />}
              {codeSuccess ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex gap-0">

          <div className="w-[50%] shrink-0 flex flex-col overflow-hidden border-r border-strong min-w-0">
            <div className="px-4 py-2.5 border-b border-strong flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {subFilters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setSubFilter(f)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors border ${
                      subFilter === f
                        ? 'sub-filter-active border-amber-500/30'
                        : 'text-secondary border-transparent hover:text-primary hover:border-strong'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {subCounts[f] > 0 && (
                      <span className={`px-1 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                        f === 'pending' ? 'bg-amber-500 text-white' :
                        f === 'flagged' ? 'bg-red-500 text-white' :
                        'bg-elevated text-muted'
                      }`}>
                        {subCounts[f]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted">{filteredSubs.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {subsLoading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              ) : filteredSubs.length === 0 ? (
                <div className="flex flex-col items-center py-12">
                  <CheckCircle className="w-8 h-8 text-muted mb-2" />
                  <p className="text-secondary text-sm">No {subFilter === 'all' ? '' : subFilter} submissions</p>
                </div>
              ) : (
                <div className="divide-y divide-strong">
                  {filteredSubs.map((sub) => {
                    const isAct = actioning?.startsWith(sub.id);
                    const mismatch = sub.confirmed_steps !== sub.detected_steps && sub.detected_steps !== null;
                    return (
                      <div key={sub.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.02]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(() => {
                              const u = Array.isArray(sub.users) ? sub.users[0] : sub.users;
                              return (
                                <div className="w-5 h-5 rounded-full bg-elevated border border-strong flex items-center justify-center text-[9px] font-bold text-secondary shrink-0 overflow-hidden">
                                  {u?.avatar_url ? (
                                    <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                                  ) : (
                                    (u?.full_name ?? '?').charAt(0).toUpperCase()
                                  )}
                                </div>
                              );
                            })()}
                            <span className="font-medium text-primary text-sm truncate">
                              {Array.isArray(sub.users) ? sub.users[0]?.full_name : sub.users?.full_name}
                            </span>
                            <StatusBadge status={sub.status} />
                            <span className="text-[10px] text-muted">(Deadline: {formatDateWithYear(sub.week_ending_date)})</span>
                            {mismatch && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" title="OCR mismatch" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-secondary">
                            <span className="text-muted">Steps:</span>
                            <span className="font-semibold text-primary">{formatSteps(sub.confirmed_steps)}</span>
                            <span className="text-muted">·</span>
                            <span>{sub.submission_end_date
                              ? `${formatDate(sub.submission_date)} – ${formatDate(sub.submission_end_date)}`
                              : formatDate(sub.submission_date)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleViewProof(sub.proof_file_path)}
                            className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="View proof"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {sub.status !== 'approved' && (
                            <button
                              onClick={() => handleSubAction(sub.id, 'approve')}
                              disabled={!!isAct}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              {actioning === sub.id + 'approve' ? <Spinner size="sm" /> : <CheckCircle className="w-3 h-3" />}
                              OK
                            </button>
                          )}
                          {sub.status !== 'rejected' && (
                            <button
                              onClick={() => handleSubAction(sub.id, 'reject')}
                              disabled={!!isAct}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-600 border border-red-700 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              {actioning === sub.id + 'reject' ? <Spinner size="sm" /> : <XCircle className="w-3 h-3" />}
                              No
                            </button>
                          )}
                          {sub.status !== 'flagged' && (
                            <button
                              onClick={() => handleSubAction(sub.id, 'flag')}
                              disabled={!!isAct}
                              className="p-1.5 rounded text-amber-600 hover:text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
                              title="Flag"
                            >
                              {actioning === sub.id + 'flag' ? <Spinner size="sm" /> : <Flag className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="w-[30%] flex flex-col overflow-hidden shrink-0 border-r border-strong">
            <div className="px-4 py-2.5 border-b border-strong flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs font-medium text-secondary">Help Requests</span>
              {helpRequests.filter((r) => !r.is_read).length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500 text-white leading-none">
                  {helpRequests.filter((r) => !r.is_read).length}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {helpLoading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              ) : helpRequests.length === 0 ? (
                <div className="flex flex-col items-center py-12">
                  <MessageSquare className="w-7 h-7 text-muted mb-2" />
                  <p className="text-secondary text-sm">No requests</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 p-3">
                  {helpRequests.map((hr) => (
                    <div key={hr.id} className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors ${!hr.is_read ? 'bg-teal-500/10 border-teal-500/30' : 'bg-elevated border-strong hover:border-muted'}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${!hr.is_read ? 'bg-teal-500/20 border-teal-500/50 text-teal-600' : 'bg-card border-strong text-secondary'}`}>
                        {hr.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-medium truncate ${!hr.is_read ? 'text-primary' : 'text-secondary'}`}>{hr.name}</p>
                          {hr.email && <span className="text-xs text-muted truncate">({hr.email})</span>}
                          {!hr.is_read && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />}
                        </div>
                        {hr.subject ? (
                          <p className={`text-xs truncate ${!hr.is_read ? 'text-secondary' : 'text-muted'}`}>{hr.subject}</p>
                        ) : (
                          <p className="text-xs text-muted truncate">{hr.request}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openHelpRequest(hr)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${!hr.is_read ? 'bg-teal-500 text-white hover:bg-teal-600' : 'bg-elevated border border-strong text-secondary hover:text-primary'}`}
                        >
                          View
                        </button>
                        {hr.is_read && (
                          <button
                            onClick={() => deleteHelpRequest(hr)}
                            className="p-1 rounded text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Delete request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-[20%] flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-2.5 border-b border-strong flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-secondary">{users.length} users</span>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-6 pr-2.5 py-1 text-xs bg-elevated border border-strong rounded-md text-primary placeholder:text-muted focus:outline-none focus:border-amber-500/50 w-32"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {usersLoading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center py-12">
                  <p className="text-secondary text-sm">No users found</p>
                </div>
              ) : (
                <div className="divide-y divide-strong">
                  {filteredUsers.map((u) => {
                    const isAct = userActioning?.startsWith(u.id);
                    return (
                      <div key={u.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.02]">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="shrink-0 group"
                          title="View user details"
                        >
                          <div className="relative w-8 h-8 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-300 overflow-hidden group-hover:ring-2 group-hover:ring-teal-500/60 transition-all">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                              ) : (
                                u.full_name.charAt(0).toUpperCase()
                              )}
                            </div>
                            {u.is_admin && !u.is_deleted && (
                              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] font-black leading-none border-2 border-card z-10">A</span>
                            )}
                          </div>
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate text-primary">{u.full_name}</span>
                            {!u.is_deleted && !u.is_active && <Badge variant="error" size="sm">Off</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {u.id !== currentUser?.id && !u.is_deleted && (
                            <button
                              onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                              disabled={userActioning === u.id + 'admin'}
                              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-bold transition-colors disabled:opacity-50 border ${
                                u.is_admin
                                  ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-red-600 hover:border-red-700'
                                  : 'bg-slate-600 text-white border-slate-700 hover:bg-emerald-600 hover:border-emerald-700'
                              }`}
                              title={u.is_admin ? 'Revoke admin' : 'Make admin'}
                            >
                              {userActioning === u.id + 'admin' ? <Spinner size="sm" /> : (
                                <>
                                  <Shield className="w-3 h-3" />
                                  <span>{u.is_admin ? 'Revoke Admin' : 'Make Admin'}</span>
                                </>
                              )}
                            </button>
                          )}
                          {u.is_deleted ? (
                            <span className="px-1.5 py-1 rounded text-[10px] font-bold text-red-400 border border-red-500/30 bg-red-500/10">Deleted</span>
                          ) : (
                            <button
                              onClick={() => handleToggleActive(u.id, u.is_active)}
                              disabled={!!isAct}
                              className={`p-1.5 rounded transition-colors disabled:opacity-50 ${
                                u.is_active
                                  ? 'text-slate-500 hover:text-red-700 hover:bg-red-100'
                                  : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100'
                              }`}
                              title={u.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {userActioning === u.id + 'active' ? <Spinner size="sm" /> : u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewingHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingHelp(null)} />
          <div className="relative z-10 bg-card border border-strong rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-strong">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-teal-500" />
                <h3 className="text-base font-semibold text-primary">Help Request</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 border border-teal-500/30">
                  <Eye className="w-2.5 h-2.5" />
                  Read
                </span>
              </div>
              <button onClick={() => setViewingHelp(null)} className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-elevated transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-elevated rounded-xl p-3.5 border border-strong">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Name</p>
                  <p className="text-sm font-semibold text-primary">{viewingHelp.name}</p>
                </div>
                <div className="bg-elevated rounded-xl p-3.5 border border-strong">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Email</p>
                  <p className="text-sm font-semibold text-primary break-all">{viewingHelp.email}</p>
                </div>
              </div>
              {viewingHelp.subject && (
                <div className="bg-elevated rounded-xl p-3.5 border border-strong overflow-hidden">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Subject</p>
                  <p className="text-sm font-semibold text-primary break-words">{viewingHelp.subject}</p>
                </div>
              )}
              <div className="bg-elevated rounded-xl p-3.5 border border-strong overflow-hidden">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Request</p>
                <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap break-words">{viewingHelp.request}</p>
              </div>
            </div>
            <div className="px-6 pb-5">
              <button
                onClick={() => setViewingHelp(null)}
                className="w-full py-2 rounded-xl text-sm font-semibold bg-elevated border border-strong text-secondary hover:text-primary hover:bg-card transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <UserDetailsDrawer
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onSaved={() => { loadUsers(); setSelectedUser(null); }}
      />

      {proofModal && (
        <Modal isOpen={true} onClose={() => setProofModal(null)} title="Proof File" size="xl">
          {proofModal.loading ? (
            <div className="flex justify-center py-8"><Spinner size="lg" /></div>
          ) : proofModal.url.includes('pdf') ? (
            <a href={proofModal.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-amber-400 hover:text-amber-300">
              <ExternalLink className="w-4 h-4" />
              Open PDF in new tab
            </a>
          ) : (
            <img src={proofModal.url} alt="Proof" className="w-full rounded-lg" />
          )}
        </Modal>
      )}
    </div>
  );
}
