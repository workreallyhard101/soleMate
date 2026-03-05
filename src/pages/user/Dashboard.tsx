import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Footprints, Trophy, Upload, Clock, CheckCircle, ChevronRight, Crown, Medal, CalendarRange, Trash2, ChevronDown, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getUserSubmissions } from '../../lib/submissions';
import { useCountdown } from '../../hooks/useCountdown';
import { formatDate, formatDateShort, formatDateWithYear, formatSteps, formatMonthKey, getWeekEndingSunday, toDateString, getCurrentMonthKey, getNextDeadlineDate, getMondayOfWeek } from '../../lib/deadlineUtils';
import { StatusBadge } from '../../components/ui/Badge';
import { Card, StatCard } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { supabase } from '../../lib/supabase';
import type { Submission, LeaderboardEntry } from '../../types';

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (current <= endDate) {
    days.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function shortDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function shortDayNum(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function submissionDateLabel(sub: Submission): string {
  if (sub.submission_end_date && sub.submission_end_date !== sub.submission_date) {
    return `${formatDateShort(sub.submission_date)} – ${formatDateShort(sub.submission_end_date)}`;
  }
  return formatDateShort(sub.submission_date);
}

export function DashboardPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const countdown = useCountdown();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []); 

  const currentWeekEnding = (() => {
    const chicagoNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    return toDateString(getWeekEndingSunday(chicagoNow));
  })();
  const currentMonthKey = getCurrentMonthKey();
  const deadlineDate = getNextDeadlineDate();
  const pad = (n: number) => String(n).padStart(2, '0');

  const prevMonthKey = (() => {
    const [year, month] = currentMonthKey.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const [monthOptions, setMonthOptions] = useState<{ key: string; label: string }[]>([
    { key: currentMonthKey, label: formatMonthKey(currentMonthKey) },
  ]);

  useEffect(() => {
    const fetchAvailableMonths = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('month_key');
      if (data) {
        const unique = [...new Set(data.map((d) => d.month_key as string))].sort().reverse();
        if (!unique.includes(currentMonthKey)) unique.unshift(currentMonthKey);
        setMonthOptions(unique.map((key) => ({ key, label: formatMonthKey(key) })));
      }
    };
    fetchAvailableMonths();
  }, [currentMonthKey]);

  const [superstar, setSuperstar] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserSubmissions(user.id)
      .then(setSubmissions)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    supabase
      .rpc('get_monthly_leaderboard', { p_month_key: selectedMonthKey })
      .then(({ data }) => setLeaderboard((data as LeaderboardEntry[]) || []));
  }, [selectedMonthKey]);

  useEffect(() => {
    supabase
      .rpc('get_monthly_leaderboard', { p_month_key: prevMonthKey })
      .then(({ data }) => {
        const entries = (data as LeaderboardEntry[]) || [];
        setSuperstar(entries.length > 0 ? entries[0] : null);
      });
  }, [prevMonthKey]);

  const [weekMonthView, setWeekMonthView] = useState<'week' | 'month'>('week');

  const currentWeekSubmissions = submissions.filter(
    (s) => s.week_ending_date === currentWeekEnding
  );

  const monthSubmissions = submissions.filter((s) => s.month_key === selectedMonthKey);
  const monthlyTotal = monthSubmissions
    .filter((s) => s.status === 'approved')
    .reduce((sum, s) => sum + s.confirmed_steps, 0);

  const overallTotal = submissions
    .filter((s) => s.status === 'approved')
    .reduce((sum, s) => sum + s.confirmed_steps, 0);

  const approvedCount = monthSubmissions.filter((s) => s.status === 'approved').length;
  const pendingCount = monthSubmissions.filter((s) => s.status === 'pending').length;
  const rejectedCount = monthSubmissions.filter((s) => s.status === 'rejected').length;
  const totalSubmittedCount = monthSubmissions.length;
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-3.5 h-3.5 text-amber-400" />;
    if (rank === 2) return <Medal className="w-3.5 h-3.5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-3.5 h-3.5 text-amber-600" />;
    return <span className="text-xs text-muted font-mono w-3.5 text-center">{rank}</span>;
  };

  const sortedWeekSubs = [...currentWeekSubmissions].sort((a, b) =>
    a.submission_date.localeCompare(b.submission_date)
  );

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    const idToDelete = confirmDeleteId;
    setDeletingId(idToDelete);
    setConfirmDeleteId(null);
    const { error } = await supabase.from('submissions').delete().eq('id', idToDelete);
    setDeletingId(null);
    if (!error) {
      setSubmissions((prev) => prev.filter((s) => s.id !== idToDelete));
      supabase
        .rpc('get_monthly_leaderboard', { p_month_key: selectedMonthKey })
        .then(({ data }) => setLeaderboard((data as LeaderboardEntry[]) || []));
    }
  };

  return (
    <>
    <div className="flex flex-col flex-1 overflow-hidden bg-page">
      <div className="flex-1 overflow-y-auto pt-20 pb-2">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {profile?.is_deleted && profile?.account_deletion_date && (() => {
          const deletedAt = new Date(profile.account_deletion_date);
          const cutoff = new Date(deletedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
          const msLeft = cutoff.getTime() - now.getTime();
          if (msLeft <= 0) return null;
          const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
          return (
            <div className="mb-4 flex items-start gap-3 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-orange-400">Account Scheduled for Deletion</p>
                <p className="text-xs text-orange-400/70 mt-0.5">
                  Your account will be permanently deleted in <span className="font-semibold text-orange-300">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</span> on {cutoff.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Logging back in within this window will automatically restore your account.
                </p>
              </div>
            </div>
          );
        })()}
        {profile?.is_active === false && !profile?.is_deleted && (
          <div className="mb-4 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-red-400 text-sm font-bold">!</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400">Account Inactive</p>
              <p className="text-xs text-red-400/70 mt-0.5">Your account has been deactivated. Your approved steps are not being counted towards the leaderboard. Please contact the admin for more information.</p>
            </div>
          </div>
        )}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-primary">
            Welcome back, <span className={theme.primaryText}>{firstName}</span>
          </h1>
          <div className="relative inline-flex items-center mt-0.5">
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="appearance-none bg-card border border-strong rounded-lg text-secondary text-sm pl-3 pr-7 py-1 outline-none cursor-pointer hover:text-primary hover:border-teal-500/50 transition-colors focus:ring-1 focus:ring-teal-500"
              style={{ width: 'auto' }}
            >
              {monthOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label} Competition</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none w-3.5 h-3.5 text-muted absolute right-2 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {/* Monthly Total + Overall Total */}
          <div className="bg-gradient-to-br from-teal-500/10 to-cyan-500/5 border border-teal-500/20 rounded-xl px-4 pt-3 pb-3 flex flex-col h-[96px]">
            <div className="flex items-start justify-between gap-3 flex-1">
              <div className="flex flex-col items-center flex-1">
                <p className="text-[10px] font-medium text-teal-400/80 uppercase tracking-wider">Monthly</p>
                <span className="text-2xl font-bold text-primary mt-1 leading-none">{formatSteps(monthlyTotal)}</span>
              </div>
              <div className="w-px self-stretch bg-teal-500/20 mt-1" />
              <div className="flex flex-col items-center flex-1">
                <p className="text-[10px] font-medium text-teal-400/60 uppercase tracking-wider">Overall</p>
                <span className="text-2xl font-bold text-secondary mt-1 leading-none">{formatSteps(overallTotal)}</span>
              </div>
            </div>
          </div>

          {/* Steps Submitted */}
          <div className="bg-card border border-border rounded-xl px-4 pt-3 pb-4 flex flex-col h-[96px]">
            <p className="text-xs font-medium text-secondary uppercase tracking-wider text-center">Steps Submitted</p>
            <div className="grid grid-cols-3 gap-2 mt-2 flex-1">
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-emerald-400 leading-none">{approvedCount}</span>
                <span className="text-[10px] text-emerald-400/70 uppercase tracking-wide mt-1">Approved</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-amber-400 leading-none">{pendingCount}</span>
                <span className="text-[10px] text-amber-400/70 uppercase tracking-wide mt-1">Pending</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-red-400 leading-none">{rejectedCount}</span>
                <span className="text-[10px] text-red-400/70 uppercase tracking-wide mt-1">Rejected</span>
              </div>
            </div>
          </div>

          {/* Next Deadline */}
          <div className="bg-card border border-amber-500/20 rounded-xl px-4 pt-3 pb-4 flex flex-col h-[96px]">
            <p className="text-xs font-medium text-secondary uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Clock className="w-3 h-3 text-amber-500/70" />
              Next Deadline
            </p>
            <div className="mt-2 flex flex-col items-center">
              {countdown.isPast ? (
                <p className="text-xl font-bold text-red-400">Passed</p>
              ) : (
                <div className="flex items-center gap-1.5 font-mono">
                  {[
                    { value: countdown.days, label: 'D' },
                    { value: countdown.hours, label: 'H' },
                    { value: countdown.minutes, label: 'M' },
                    { value: countdown.seconds, label: 'S' },
                  ].map(({ value, label }, i, arr) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="flex flex-col items-center">
                        <span className="text-xl font-extrabold text-orange-400 tabular-nums leading-none">{pad(value)}</span>
                        <span className="text-[9px] text-orange-600 font-semibold uppercase tracking-wider mt-0.5">{label}</span>
                      </div>
                      {i < arr.length - 1 && <span className="text-orange-600/40 font-bold mb-3">:</span>}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted mt-0.5">{deadlineDate}</p>
            </div>
          </div>

          {/* SoleMate Superstar */}
          <div className="bg-card border border-amber-400/30 rounded-xl px-4 pt-3 pb-4 flex flex-col h-[96px] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-yellow-500/5 pointer-events-none" />
            <p className="text-xs font-medium text-secondary uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Crown className="w-3 h-3 text-amber-400" />
              SoleMate Superstar
            </p>
            <div className="mt-2 flex flex-col items-center">
              {!superstar ? (
                <>
                  <p className="text-xl font-bold text-muted leading-none">TBD</p>
                  <p className="text-[10px] text-muted mt-1">No winner yet</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-amber-400 truncate leading-none">
                    {superstar.full_name.split(' ')[0]}
                    {superstar.user_id === user?.id && (
                      <span className="text-[10px] font-normal text-amber-500/70 ml-1">you!</span>
                    )}
                  </p>
                  <p className="text-[10px] text-amber-600/70 mt-1 font-medium">{formatMonthKey(prevMonthKey)} winner · {formatSteps(superstar.total_steps)} steps</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <Card className="lg:col-span-2 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 bg-elevated rounded-lg p-0.5">
                <button
                  onClick={() => setWeekMonthView('week')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${weekMonthView === 'week' ? 'bg-card text-primary shadow-sm' : 'text-muted hover:text-secondary'}`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setWeekMonthView('month')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${weekMonthView === 'month' ? 'bg-card text-primary shadow-sm' : 'text-muted hover:text-secondary'}`}
                >
                  This Month
                </button>
              </div>
              <div className="flex items-center gap-3">
                {weekMonthView === 'week' && (
                  <span className="text-xs text-muted">Ending {formatDate(currentWeekEnding)}</span>
                )}
                {!countdown.isPast && selectedMonthKey === currentMonthKey && (
                  <Link
                    to="/submit"
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${theme.primary} ${theme.primaryHover} text-white text-xs font-medium rounded-lg transition-all`}
                  >
                    <Upload className="w-3 h-3" />
                    Upload Steps
                  </Link>
                )}
              </div>
            </div>

            {weekMonthView === 'week' ? (() => {
              const weekStart = new Date(currentWeekEnding + 'T00:00:00');
              weekStart.setDate(weekStart.getDate() - 6);
              const weekDays: string[] = [];
              for (let i = 0; i < 7; i++) {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                weekDays.push(toDateString(d));
              }

              const dateToSub = new Map<string, Submission>();
              for (const sub of sortedWeekSubs) {
                const covered = sub.submission_end_date && sub.submission_end_date !== sub.submission_date
                  ? getDaysBetween(sub.submission_date, sub.submission_end_date!)
                  : [sub.submission_date];
                for (const d of covered) dateToSub.set(d, sub);
              }

              const renderedBarSubIds = new Set<string>();

              return (
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    {weekDays.map((day) => {
                      const sub = dateToSub.get(day);
                      const circleColor = !sub
                        ? 'bg-elevated border border-strong text-secondary'
                        : sub.status === 'approved'
                        ? 'bg-emerald-500/40 border-2 border-emerald-500 text-emerald-300'
                        : sub.status === 'rejected'
                        ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                        : 'bg-amber-500/20 border-2 border-amber-500 text-amber-400';
                      const date = new Date(day + 'T00:00:00');
                      const dayNum = date.getDate();
                      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                      return (
                        <div key={day} className="flex flex-col items-center flex-1 min-w-0">
                          <span className="text-[9px] text-muted mb-1 font-medium">{dayName}</span>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${circleColor}`}>
                            {dayNum}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    {weekDays.map((day) => {
                      const sub = dateToSub.get(day);
                      if (!sub || !sub.confirmed_steps) {
                        return <div key={day} className="flex-1 h-5" />;
                      }
                      const isRange = sub.submission_end_date && sub.submission_end_date !== sub.submission_date;
                      if (isRange) {
                        const rangeDays = getDaysBetween(sub.submission_date, sub.submission_end_date!);
                        const daysInWeek = rangeDays.filter(d => weekDays.includes(d));
                        const isFirstInWeek = daysInWeek[0] === day;
                        if (!isFirstInWeek) return <div key={day} style={{ flex: 0, width: 0, overflow: 'hidden' }} />;
                        if (renderedBarSubIds.has(sub.id)) return <div key={day} style={{ flex: 0, width: 0, overflow: 'hidden' }} />;
                        renderedBarSubIds.add(sub.id);
                        const spanCount = daysInWeek.length;
                        const barColor = sub.status === 'approved'
                          ? 'bg-emerald-500/40 border border-emerald-500 text-emerald-300'
                          : sub.status === 'rejected'
                          ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                          : 'bg-amber-500/20 border border-amber-500/50 text-amber-400';
                        return (
                          <div key={day} className="h-5 flex items-center justify-center" style={{ flex: spanCount, paddingLeft: '2px' }}>
                            <div className={`w-full h-4 rounded-full flex items-center justify-center ${barColor}`}>
                              <span className="text-[9px] font-semibold whitespace-nowrap px-1">{formatSteps(sub.confirmed_steps)}</span>
                            </div>
                          </div>
                        );
                      }
                      const barColor = sub.status === 'approved'
                        ? 'bg-emerald-500/40 border border-emerald-500 text-emerald-300'
                        : sub.status === 'rejected'
                        ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                        : 'bg-amber-500/20 border border-amber-500/50 text-amber-400';
                      return (
                        <div key={day} className="flex-1 h-5 flex items-center justify-center" style={{ paddingLeft: '2px' }}>
                          <div className={`w-full h-4 rounded-full flex items-center justify-center ${barColor}`}>
                            <span className="text-[9px] font-semibold whitespace-nowrap px-1">{formatSteps(sub.confirmed_steps)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {sortedWeekSubs.some((s) => s.admin_note) && (
                    <div className="mt-3 space-y-1">
                      {sortedWeekSubs.filter((s) => s.admin_note).map((s) => (
                        <p key={s.id} className="text-[11px] text-muted">
                          Note ({formatDate(s.submission_date)}): {s.admin_note}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })() : (() => {
              const [selYear, selMonth] = selectedMonthKey.split('-').map(Number);
              const selMonthStr = String(selMonth).padStart(2, '0');
              const selMonthPrefix = `${selYear}-${selMonthStr}`;

              // Weeks belong to this month if their Sunday is in this month
              // AND their Monday is also in this month (no week that started in a prior month).
              const firstOfMonth = new Date(selYear, selMonth - 1, 1);
              const firstSunday = getWeekEndingSunday(firstOfMonth);
              // Advance until we find a Sunday in this month whose Monday is also in this month
              let firstSundayClamped = new Date(firstSunday);
              while (
                toDateString(firstSundayClamped).substring(0, 7) < selMonthPrefix ||
                toDateString(getMondayOfWeek(firstSundayClamped)).substring(0, 7) < selMonthPrefix
              ) {
                firstSundayClamped = new Date(firstSundayClamped.getTime() + 7 * 86400000);
              }

              // Collect all weeks (Mon–Sun) whose Sunday is in the selected month
              const weeks: { monday: Date; sunday: Date; weekDays: string[] }[] = [];
              const cursor = new Date(firstSundayClamped);
              while (toDateString(cursor).substring(0, 7) === selMonthPrefix) {
                const sunday = new Date(cursor);
                const monday = getMondayOfWeek(sunday);
                const days: string[] = [];
                const d = new Date(monday);
                while (d <= sunday) {
                  days.push(toDateString(d));
                  d.setDate(d.getDate() + 1);
                }
                weeks.push({ monday, sunday, weekDays: days });
                cursor.setDate(cursor.getDate() + 7);
              }

              const dateToSub = new Map<string, Submission>();
              for (const sub of monthSubmissions) {
                const covered = sub.submission_end_date && sub.submission_end_date !== sub.submission_date
                  ? getDaysBetween(sub.submission_date, sub.submission_end_date!)
                  : [sub.submission_date];
                for (const d of covered) dateToSub.set(d, sub);
              }

              const today = toDateString(new Date());

              return (
                <div>
                  <div className="grid grid-cols-7 mb-1">
                    {['Mo','Tu','We','Th','Fr','Sa','Su'].map((d) => (
                      <div key={d} className="text-center text-[9px] font-semibold text-muted py-0.5">{d}</div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {weeks.map(({ sunday, weekDays }) => {
                      const renderedBarSubIds = new Set<string>();
                      return (
                        <div key={toDateString(sunday)}>
                          <div className="grid grid-cols-7 gap-y-0.5">
                            {weekDays.map((day) => {
                              const inMonth = day.substring(0, 7) === selMonthPrefix;
                              const sub = dateToSub.get(day);
                              const dayNum = parseInt(day.split('-')[2]);
                              const isToday = day === today;
                              const cellColor = !sub
                                ? isToday
                                  ? 'bg-teal-500/10 border border-teal-500/40 text-teal-400'
                                  : inMonth ? 'text-primary' : 'text-muted/30'
                                : sub.status === 'approved'
                                ? 'bg-emerald-500/40 border border-emerald-500 text-emerald-300'
                                : sub.status === 'rejected'
                                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                                : 'bg-amber-500/20 border border-amber-500/40 text-amber-400';
                              return (
                                <div key={day} className="flex justify-center">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${cellColor} ${!inMonth ? 'opacity-30' : ''}`}>
                                    {dayNum}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5 mb-1">
                            {weekDays.map((day) => {
                              const inMonth = day.substring(0, 7) === selMonthPrefix;
                              const sub = inMonth ? dateToSub.get(day) : undefined;
                              if (!sub || !sub.confirmed_steps) {
                                return <div key={day} className="flex-1 h-4" />;
                              }
                              const isRange = sub.submission_end_date && sub.submission_end_date !== sub.submission_date;
                              if (isRange) {
                                const rangeDays = getDaysBetween(sub.submission_date, sub.submission_end_date!);
                                const daysInWeek = rangeDays.filter(d => weekDays.includes(d));
                                const isFirstInWeek = daysInWeek[0] === day;
                                if (!isFirstInWeek || renderedBarSubIds.has(sub.id)) {
                                  return <div key={day} style={{ flex: 0, width: 0, overflow: 'hidden' }} />;
                                }
                                renderedBarSubIds.add(sub.id);
                                const spanCount = daysInWeek.length;
                                const barColor = sub.status === 'approved'
                                  ? 'bg-emerald-500/40 border border-emerald-500 text-emerald-300'
                                  : sub.status === 'rejected'
                                  ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                                  : 'bg-amber-500/20 border border-amber-500/50 text-amber-400';
                                return (
                                  <div key={day} className="h-4 flex items-center justify-center" style={{ flex: spanCount, paddingLeft: '2px' }}>
                                    <div className={`w-full h-3.5 rounded-full flex items-center justify-center ${barColor}`}>
                                      <span className="text-[8px] font-semibold whitespace-nowrap px-1">{formatSteps(sub.confirmed_steps)}</span>
                                    </div>
                                  </div>
                                );
                              }
                              const barColor = sub.status === 'approved'
                                ? 'bg-emerald-500/40 border border-emerald-500 text-emerald-300'
                                : sub.status === 'rejected'
                                ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                                : 'bg-amber-500/20 border border-amber-500/50 text-amber-400';
                              return (
                                <div key={day} className="flex-1 h-4 flex items-center justify-center" style={{ paddingLeft: '2px' }}>
                                  <div className={`w-full h-3.5 rounded-full flex items-center justify-center ${barColor}`}>
                                    <span className="text-[8px] font-semibold whitespace-nowrap px-1">{formatSteps(sub.confirmed_steps)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-strong flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted">Approved</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-[10px] text-muted">Pending</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-[10px] text-muted">Rejected</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-[10px] text-muted">Today</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-primary flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Leaderboard
              </h2>
              <Link
                to="/leaderboard"
                className={`text-xs ${theme.primaryText} hover:opacity-80 transition-opacity flex items-center gap-0.5`}
              >
                See all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Trophy className="w-8 h-8 text-muted mb-2" />
                <p className="text-xs text-muted">No rankings yet this month</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {leaderboard.slice(0, 5).map((entry) => {
                  const isMe = entry.user_id === user?.id;
                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors ${
                        isMe
                          ? 'bg-teal-500/10 border-teal-500/40'
                          : 'bg-elevated border-strong hover:border-border'
                      }`}
                    >
                      <span className={`text-sm font-bold tabular-nums w-5 text-center shrink-0 ${
                        entry.rank === 1 ? 'text-amber-400' : entry.rank === 2 ? 'text-gray-300' : entry.rank === 3 ? 'text-amber-600' : 'text-muted'
                      }`}>{entry.rank}</span>
                      <div className="w-6 h-6 rounded-full bg-elevated border border-strong flex items-center justify-center text-[10px] font-semibold text-secondary shrink-0 overflow-hidden">
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt={entry.full_name} className="w-full h-full object-cover" />
                        ) : (
                          entry.full_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <p className={`text-sm font-medium truncate flex-1 min-w-0 ${isMe ? theme.primaryText : 'text-primary'}`}>
                        {entry.full_name.split(' ')[0]}
                        {isMe && <span className="text-[10px] ml-1 opacity-70">(you)</span>}
                      </p>
                      <p className="text-xs text-muted shrink-0">{formatSteps(entry.total_steps)} steps</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-primary">
              Submission History
              {monthSubmissions.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted">({monthSubmissions.length})</span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : monthSubmissions.length === 0 ? (
            <div className="text-center py-8">
              <Footprints className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-muted">
                {selectedMonthKey === currentMonthKey
                  ? 'No submissions yet. Start by uploading your first day!'
                  : `No submissions for ${formatMonthKey(selectedMonthKey)}.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-strong">
                    <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider pb-2 w-1/4">Date / Range</th>
                    <th className="text-right text-[11px] font-semibold text-muted uppercase tracking-wider pb-2 pr-16 w-1/4">Steps</th>
                    <th className="text-left text-[11px] font-semibold text-muted uppercase tracking-wider pb-2 pl-16 w-1/4">Status</th>
                    <th className="text-right text-[11px] font-semibold text-muted uppercase tracking-wider pb-2 w-1/4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-strong">
                  {monthSubmissions.map((sub) => (
                    <tr key={sub.id} className="group">
                      <td className="py-3 w-1/4">
                        <div className="flex items-center gap-1.5">
                          {sub.submission_end_date && sub.submission_end_date !== sub.submission_date && (
                            <CalendarRange className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          )}
                          <span className="text-primary font-medium">{submissionDateLabel(sub)}</span>
                        </div>
                        {sub.admin_note && (
                          <p className="text-[11px] text-muted mt-0.5 truncate">Note: {sub.admin_note}</p>
                        )}
                      </td>
                      <td className="py-3 pr-16 text-right font-mono font-semibold text-primary tabular-nums whitespace-nowrap w-1/4">
                        {formatSteps(sub.confirmed_steps)}
                      </td>
                      <td className="py-3 pl-16 w-1/4">
                        <StatusBadge status={sub.status} />
                      </td>
                      <td className="py-3 text-right w-1/4">
                        <button
                          onClick={() => setConfirmDeleteId(sub.id)}
                          disabled={deletingId === sub.id}
                          className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          title="Delete submission"
                        >
                          {deletingId === sub.id ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      </div>
    </div>

    {confirmDeleteId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
        <div className="relative bg-card border border-strong rounded-2xl shadow-2xl p-6 w-full max-w-sm">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-primary">Delete Submission</h3>
              <p className="text-sm text-secondary mt-1">This submission will be permanently removed. This action cannot be undone.</p>
            </div>
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-strong text-secondary hover:bg-elevated transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
