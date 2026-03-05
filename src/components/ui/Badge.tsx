import type { SubmissionStatus, OcrConfidence } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'amber';
  size?: 'sm' | 'md';
}

const variants = {
  default: 'badge-default',
  success: 'badge-success',
  error: 'badge-error',
  warning: 'badge-warning',
  info: 'badge-info',
  amber: 'badge-amber',
};

const sizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const map: Record<SubmissionStatus, { label: string; variant: BadgeProps['variant'] }> = {
    pending: { label: 'Pending Review', variant: 'warning' },
    approved: { label: 'Approved', variant: 'success' },
    rejected: { label: 'Rejected', variant: 'error' },
    flagged: { label: 'Flagged', variant: 'amber' },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function ConfidenceBadge({ confidence }: { confidence: OcrConfidence }) {
  const map: Record<OcrConfidence, { label: string; variant: BadgeProps['variant'] }> = {
    high: { label: 'High Confidence', variant: 'success' },
    medium: { label: 'Medium Confidence', variant: 'warning' },
    low: { label: 'Low Confidence', variant: 'error' },
  };
  const { label, variant } = map[confidence];
  return <Badge variant={variant}>{label}</Badge>;
}
