import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Flag, Eye, ExternalLink, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getAllSubmissionsAdmin, getSignedUrl } from '../../lib/submissions';
import { formatDate, formatSteps, formatMonthKey } from '../../lib/deadlineUtils';
import { StatusBadge, ConfidenceBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import type { Submission, SubmissionStatus } from '../../types';

type FilterStatus = 'all' | SubmissionStatus;
type SubmissionWithProfile = Submission & { users: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[] | null };

export function SubmissionReviewPage() {
  const [submissions, setSubmissions] = useState<SubmissionWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [actioning, setActioning] = useState<string | null>(null);
  const [proofModal, setProofModal] = useState<{ url: string; loading: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllSubmissionsAdmin();
      setSubmissions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = submissions.filter((s) => filter === 'all' || s.status === filter);

  const counts: Record<FilterStatus, number> = {
    all: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    flagged: submissions.filter((s) => s.status === 'flagged').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
    rejected: submissions.filter((s) => s.status === 'rejected').length,
  };

  const handleAction = async (subId: string, action: 'approve' | 'reject' | 'flag') => {
    setActioning(subId + action);
    const fnMap = {
      approve: 'admin_approve_submission',
      reject: 'admin_reject_submission',
      flag: 'admin_flag_submission',
    };
    await supabase.rpc(fnMap[action], { p_submission_id: subId, p_note: null });
    await load();
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

  const filters: FilterStatus[] = ['pending', 'flagged', 'approved', 'rejected', 'all'];

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-page">
      <div className="flex-1 overflow-hidden flex flex-col pt-20">
        <div className="px-4 sm:px-6 lg:px-8 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-primary">Submissions</h1>
            <span className="text-xs text-muted">{filtered.length} shown</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-card text-secondary border border-strong hover:text-primary'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {counts[f] > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    f === 'pending' ? 'bg-amber-500 text-white' :
                    f === 'flagged' ? 'bg-red-500 text-white' :
                    'bg-elevated text-muted'
                  }`}>
                    {counts[f]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-4">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <CheckCircle className="w-10 h-10 text-muted mb-3" />
              <p className="text-secondary text-sm">No {filter === 'all' ? '' : filter} submissions</p>
            </div>
          ) : (
            <div className="divide-y divide-strong border border-strong rounded-xl overflow-hidden bg-card">
              {filtered.map((sub) => {
                const isActioning = actioning?.startsWith(sub.id);
                const mismatch = sub.confirmed_steps !== sub.detected_steps && sub.detected_steps !== null;
                return (
                  <div key={sub.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                          const u = Array.isArray(sub.users) ? sub.users[0] : sub.users;
                          return (
                            <div className="w-6 h-6 rounded-full bg-elevated border border-strong flex items-center justify-center text-[10px] font-bold text-secondary shrink-0 overflow-hidden">
                              {u?.avatar_url ? (
                                <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                              ) : (
                                (u?.full_name ?? '?').charAt(0).toUpperCase()
                              )}
                            </div>
                          );
                        })()}
                        <span className="font-medium text-primary text-sm">
                          {Array.isArray(sub.users) ? sub.users[0]?.full_name : sub.users?.full_name}
                        </span>
                        <StatusBadge status={sub.status} />
                        <ConfidenceBadge confidence={sub.ocr_confidence} />
                        {mismatch && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            OCR mismatch
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-secondary flex-wrap">
                        <span className="font-semibold text-primary">{formatSteps(sub.confirmed_steps)}</span>
                        <span>{formatDate(sub.submission_date)}</span>
                        <span className="text-muted">Week ending {formatDate(sub.week_ending_date)}</span>
                        <span className="text-muted">{formatMonthKey(sub.month_key)}</span>
                        {sub.admin_note && <span className="text-amber-400/80 truncate max-w-[200px]">{sub.admin_note}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleViewProof(sub.proof_file_path)}
                        className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-white/5 transition-colors"
                        title="View proof"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {sub.status !== 'approved' && (
                        <button
                          onClick={() => handleAction(sub.id, 'approve')}
                          disabled={!!isActioning}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          {actioning === sub.id + 'approve' ? <Spinner size="sm" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                      )}
                      {sub.status !== 'rejected' && (
                        <button
                          onClick={() => handleAction(sub.id, 'reject')}
                          disabled={!!isActioning}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          {actioning === sub.id + 'reject' ? <Spinner size="sm" /> : <XCircle className="w-3.5 h-3.5" />}
                          Reject
                        </button>
                      )}
                      {sub.status !== 'flagged' && (
                        <button
                          onClick={() => handleAction(sub.id, 'flag')}
                          disabled={!!isActioning}
                          className="p-1.5 rounded-lg text-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                          title="Flag"
                        >
                          {actioning === sub.id + 'flag' ? <Spinner size="sm" /> : <Flag className="w-4 h-4" />}
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

      {proofModal && (
        <Modal
          isOpen={true}
          onClose={() => setProofModal(null)}
          title="Proof File"
          size="xl"
        >
          {proofModal.loading ? (
            <div className="flex justify-center py-8"><Spinner size="lg" /></div>
          ) : proofModal.url.includes('pdf') ? (
            <a
              href={proofModal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-amber-400 hover:text-amber-300"
            >
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
