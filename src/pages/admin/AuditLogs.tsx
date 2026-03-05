import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import type { AuditLog } from '../../types';

type AuditLogWithProfile = AuditLog & { users: { full_name: string } | null };

const actionColors: Record<string, 'success' | 'error' | 'warning' | 'info' | 'amber' | 'default'> = {
  submission_approved: 'success',
  submission_rejected: 'error',
  submission_flagged: 'amber',
  month_frozen: 'warning',
  access_code_updated: 'info',
  user_deactivated: 'error',
  user_activated: 'success',
};

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*, users(full_name)')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setLogs((data || []) as AuditLogWithProfile[]);
        setLoading(false);
      });
  }, []);

  const filtered = logs.filter((l) =>
    l.action.includes(search.toLowerCase()) ||
    (l.users?.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const formatAction = (action: string) => action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-page">
      <div className="flex-1 overflow-hidden flex flex-col pt-20">
        <div className="px-4 sm:px-6 lg:px-8 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-primary">Audit Logs</h1>
              <p className="text-xs text-muted">{logs.length} events</p>
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
              <p className="text-secondary text-sm">No logs found</p>
            </div>
          ) : (
            <div className="divide-y divide-strong border border-strong rounded-xl overflow-hidden bg-card">
              {filtered.map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="shrink-0 w-36">
                    <Badge variant={actionColors[log.action] || 'default'} size="sm">
                      {formatAction(log.action)}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{log.users?.full_name || 'System'}</p>
                  </div>
                  <p className="text-xs text-muted shrink-0">
                    {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
