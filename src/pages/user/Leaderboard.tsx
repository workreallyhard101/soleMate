import { useState, useEffect, useCallback } from 'react';
import { Trophy, Footprints, ChevronDown, Medal, Crown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatSteps, formatMonthKey, getCurrentMonthKey } from '../../lib/deadlineUtils';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import type { LeaderboardEntry } from '../../types';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 shadow shadow-amber-500/40">
        <Medal className="w-4 h-4 text-white" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center shrink-0 shadow shadow-gray-400/30">
        <span className="text-white text-xs font-bold">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center shrink-0 shadow shadow-orange-600/30">
        <span className="text-white text-xs font-bold">3</span>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-elevated border border-strong flex items-center justify-center shrink-0">
      <span className="text-secondary text-xs font-semibold">{rank}</span>
    </div>
  );
}

export function LeaderboardPage() {
  const { user } = useAuth();
  const currentMonth = getCurrentMonthKey();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [winCounts, setWinCounts] = useState<Record<string, number>>({});
  const [months, setMonths] = useState<string[]>([currentMonth]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const fetchMonths = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('month_key');
      if (data) {
        const uniqueMonths = [...new Set(data.map((d) => d.month_key as string))].sort().reverse();
        if (!uniqueMonths.includes(currentMonth)) uniqueMonths.unshift(currentMonth);
        setMonths(uniqueMonths);
      }
    };
    fetchMonths();
  }, [currentMonth]);

  useEffect(() => {
    supabase.rpc('get_superstar_wins').then(({ data }) => {
      if (data) {
        const map: Record<string, number> = {};
        (data as { user_id: string; win_count: number }[]).forEach((r) => {
          map[r.user_id] = r.win_count;
        });
        setWinCounts(map);
      }
    });
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc('get_monthly_leaderboard', { p_month_key: selectedMonth });
    setEntries((data as LeaderboardEntry[]) || []);
    setLastUpdated(new Date());
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'submissions', filter: `month_key=eq.${selectedMonth}` },
        () => { fetchLeaderboard(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedMonth, fetchLeaderboard]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-page">
      <div className="flex-1 overflow-y-auto pt-20 pb-4">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">

          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                Leaderboard
              </h1>
              <p className="text-secondary mt-1">Monthly step count rankings</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="appearance-none bg-card border border-strong rounded-xl pl-4 pr-10 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  {months.map((m) => (
                    <option key={m} value={m}>{formatMonthKey(m)}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : entries.length === 0 ? (
            <Card className="p-12 text-center">
              <Footprints className="w-12 h-12 text-muted mx-auto mb-4" />
              <p className="text-secondary font-medium">No rankings yet</p>
              <p className="text-muted text-sm mt-1">
                {selectedMonth === currentMonth
                  ? 'Submit your steps this week to appear on the leaderboard.'
                  : 'No approved submissions for this month.'}
              </p>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden">
                <div className="px-5 py-3 border-b border-strong bg-elevated/50">
                  <div className="flex items-center text-xs font-medium text-muted uppercase tracking-wide">
                    <span className="w-8 mr-3">Rank</span>
                    <span className="w-8 mr-3" />
                    <span className="flex-1">Participant</span>
                    <span className="text-right w-20 ml-2 hidden sm:flex items-center justify-end gap-1">
                      <Crown className="w-3 h-3 text-amber-400 inline" /> Wins
                    </span>
                    <span className="text-right w-24 ml-4">Steps</span>
                  </div>
                </div>

                <div className="divide-y divide-strong">
                  {entries.map((entry) => {
                    const isMe = entry.user_id === user?.id;
                    const isTop = entry.rank <= 3;
                    return (
                      <div
                        key={entry.user_id}
                        className={`flex items-center gap-3 px-5 py-4 transition-colors ${
                          isMe
                            ? 'bg-teal-500/10 border-l-2 border-l-teal-500'
                            : isTop
                            ? 'bg-amber-500/5 hover:bg-amber-500/10'
                            : 'hover:bg-elevated'
                        }`}
                      >
                        <RankBadge rank={entry.rank} />

                        <div className="w-9 h-9 rounded-full bg-elevated border border-strong flex items-center justify-center text-sm font-semibold text-secondary shrink-0 overflow-hidden">
                          {entry.avatar_url ? (
                            <img src={entry.avatar_url} alt={entry.full_name} className="w-full h-full object-cover" />
                          ) : (
                            entry.full_name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isMe ? 'text-teal-500' : 'text-primary'}`}>
                            {entry.full_name}
                            {isMe && <span className="text-teal-500/70 text-xs font-normal ml-1.5">(you)</span>}
                          </p>
                          {entry.rank === 1 && (
                            <p className="text-xs text-amber-500 font-medium">Leader</p>
                          )}
                        </div>

                        <span className="w-20 text-right shrink-0 ml-2 hidden sm:block">
                          {winCounts[entry.user_id] ? (
                            <span className="inline-flex items-center justify-end gap-1">
                              <Crown className="w-3 h-3 text-amber-400" />
                              <span className="text-sm font-semibold text-amber-500">{winCounts[entry.user_id]}</span>
                            </span>
                          ) : (
                            <span className="text-sm text-muted">—</span>
                          )}
                        </span>

                        <span className={`text-sm font-bold w-24 text-right shrink-0 ${
                          entry.rank === 1 ? 'text-amber-500' : isMe ? 'text-teal-500' : 'text-primary'
                        }`}>
                          {formatSteps(entry.total_steps)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <p className="text-center text-xs text-muted mt-4">
                Updated {lastUpdated.toLocaleTimeString()} · Only approved submissions count
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
