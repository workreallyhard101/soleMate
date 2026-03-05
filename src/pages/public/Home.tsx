import { Trophy, Upload, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useCountdown } from '../../hooks/useCountdown';
import { getNextDeadlineDate } from '../../lib/deadlineUtils';

const steps = [
  { num: '01', title: 'Get Access',   desc: 'Enter the private access code.',       color: 'text-teal-400' },
  { num: '02', title: 'Sign Up',      desc: 'Create your account.',                 color: 'text-sky-400' },
  { num: '03', title: 'Track Steps',  desc: 'Any app or device works.',             color: 'text-teal-400' },
  { num: '04', title: 'Submit',       desc: 'Screenshot or PDF by Sun 10 PM CT.',   color: 'text-amber-400' },
  { num: '05', title: 'Get Approved', desc: 'Admin reviews your submission.',        color: 'text-sky-400' },
  { num: '06', title: 'Win',          desc: 'Most steps by month-end wins.',         color: 'text-amber-400' },
];

const rules = [
  { icon: CheckCircle, color: 'text-teal-400',  bg: 'bg-teal-500/10 border-teal-500/20',   text: 'Your steps only — own tracked activity.' },
  { icon: XCircle,     color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20',     text: 'No manipulation — fake steps = disqualification.' },
  { icon: Upload,      color: 'text-teal-400',  bg: 'bg-teal-500/10 border-teal-500/20',   text: 'Valid proof required — clear screenshot or PDF.' },
  { icon: Clock,       color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', text: 'Deadline: Sunday 10 PM CT — no exceptions.' },
  { icon: Trophy,      color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', text: 'Highest approved steps wins. Admin is final.' },
];

export function HomePage() {
  const countdown = useCountdown();
  const deadlineDate = getNextDeadlineDate();
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="h-screen bg-page text-primary flex flex-col pt-16 overflow-hidden">
      <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-6 py-6 min-h-0">

        {/* Hero + Countdown */}
        <div className="flex items-center gap-10 mb-8 shrink-0">
          <div className="flex-1">
            <h1 className="text-4xl font-black tracking-tighter mb-2 leading-none">
              Walk. <span className="text-teal-400">Track.</span> Win.
            </h1>
            <p className="text-secondary text-sm">
              Walk, submit proof, and become the monthly SoleMate Superstar.
            </p>
          </div>

          <div className="shrink-0 bg-card border border-amber-500/20 rounded-2xl px-6 py-4 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5 text-amber-400/60 text-[10px] font-semibold uppercase tracking-widest">
              <Clock className="w-3 h-3" />
              Next Deadline
            </div>
            {countdown.isPast ? (
              <p className="text-red-400 text-sm font-medium">Deadline passed</p>
            ) : (
              <div className="flex items-center gap-3 font-mono">
                {[
                  { value: countdown.days, label: 'D' },
                  { value: countdown.hours, label: 'H' },
                  { value: countdown.minutes, label: 'M' },
                  { value: countdown.seconds, label: 'S' },
                ].map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center">
                    <span className="text-3xl font-extrabold text-orange-400 tabular-nums drop-shadow-[0_0_12px_rgba(251,146,60,0.5)]">
                      {pad(value)}
                    </span>
                    <span className="text-[9px] text-orange-600 font-bold uppercase tracking-widest">{label}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted">{deadlineDate}</p>
          </div>
        </div>

        {/* How It Works + Rules */}
        <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">

          {/* How It Works */}
          <div className="bg-card border border-strong rounded-2xl p-6 flex flex-col">
            <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-5 shrink-0">How It Works</p>
            <ol className="flex flex-col justify-between flex-1">
              {steps.map(({ num, title, desc, color }) => (
                <li key={num} className="flex items-center gap-4">
                  <span className={`text-2xl font-black font-mono tabular-nums shrink-0 w-8 text-right leading-none ${color}`}>{num}.</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-primary">{title}</span>
                    <span className="text-xs text-secondary">{desc}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Rules */}
          <div className="bg-card border border-strong rounded-2xl p-6 flex flex-col">
            <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-5 shrink-0">Competition Rules</p>
            <ul className="flex flex-col justify-between flex-1">
              {rules.map(({ icon: Icon, color, bg, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl border ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                  <p className="text-sm text-secondary leading-relaxed pt-1.5">{text}</p>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
