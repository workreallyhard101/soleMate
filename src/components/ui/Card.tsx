import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export function Card({ children, className = '', glow = false, ...props }: CardProps) {
  return (
    <div
      className={`
        bg-card border border-strong rounded-xl
        ${glow ? 'shadow-lg' : ''}
        ${className}
      `}
      style={glow ? { boxShadow: '0 10px 30px -5px color-mix(in srgb, var(--color-accent-raw) 8%, transparent)' } : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: 'teal' | 'amber' | 'emerald' | 'red';
  subtext?: string;
}

const accents = {
  teal: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  red: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export function StatCard({ label, value, icon, accent = 'teal', subtext }: StatCardProps) {
  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-secondary mb-0.5">{label}</p>
          <p className="text-xl font-bold text-primary">{value}</p>
          {subtext && <p className="text-xs text-muted mt-0.5">{subtext}</p>}
        </div>
        <div className={`p-2 rounded-lg border ${accents[accent]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
