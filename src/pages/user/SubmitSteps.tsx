import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Image, CheckCircle, AlertTriangle, CreditCard as Edit2, ArrowRight, X, Loader2, Calendar, CalendarRange } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { processFile, validateFile } from '../../lib/ocr';
import {
  uploadProofFile,
  createSubmission,
  createRangeSubmission,
  getSubmissionForDate,
  getRangeCoveringDate,
  getSingleDaySubmissionInRange,
  updateSubmission,
  getOverlappingRangeSubmission,
  getCurrentWeekSubmissions,
} from '../../lib/submissions';

const MAX_SUBMISSIONS_PER_WEEK = 8;
import { useCountdown } from '../../hooks/useCountdown';
import { getWeekEndingSunday, getMondayOfWeek, toDateString, formatSteps, isSubmissionAllowed } from '../../lib/deadlineUtils';
import { ConfidenceBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import type { OcrResult } from '../../types';

type Stage = 'upload' | 'processing' | 'review' | 'done';
type SubmitMode = 'single' | 'range';

function formatLocalDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function todayDateString(): string {
  const now = new Date();
  return toDateString(now);
}

function currentWeekMondayString(): string {
  return toDateString(getMondayOfWeek(new Date()));
}

function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function SubmitStepsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const countdown = useCountdown();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<SubmitMode>('single');
  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [confirmedSteps, setConfirmedSteps] = useState('');
  const [submissionDate, setSubmissionDate] = useState(todayDateString());
  const [rangeStartDate, setRangeStartDate] = useState(todayDateString());
  const [rangeEndDate, setRangeEndDate] = useState(todayDateString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setFile(selectedFile);
    setError('');
    setStage('processing');

    try {
      const result = await processFile(selectedFile);
      setOcrResult(result);
      setConfirmedSteps(String(result.detectedSteps || ''));

      if (result.weekEndingSunday) {
        const correctedSunday = getWeekEndingSunday(result.weekEndingSunday);
        const [y, m, d] = toDateString(correctedSunday).split('-').map(Number);
        const mondayOfThatWeek = new Date(y, m - 1, d - 6);
        const today = todayDateString();
        const sundayStr = toDateString(correctedSunday) > today ? today : toDateString(correctedSunday);
        const mondayStr = toDateString(mondayOfThatWeek) > today ? today : toDateString(mondayOfThatWeek);
        setSubmissionDate(mondayStr);
        setRangeStartDate(mondayStr);
        setRangeEndDate(sundayStr);
      } else {
        setSubmissionDate(todayDateString());
        setRangeStartDate(todayDateString());
        setRangeEndDate(todayDateString());
      }
      setStage('review');
    } catch {
      setError('Failed to process file. Please try again or enter steps manually.');
      setOcrResult({
        rawText: '',
        detectedSteps: null,
        detectedDateRange: null,
        confidence: 'low',
        weekEndingSunday: null,
      });
      setConfirmedSteps('');
      setSubmissionDate(todayDateString());
      setRangeStartDate(todayDateString());
      setRangeEndDate(todayDateString());
      setStage('review');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }, [handleFileSelect]);

  const handleSingleSubmit = async () => {
    if (!user || !file || !ocrResult) return;

    const steps = parseInt(confirmedSteps);
    if (!steps || steps < 1 || steps > 999999) {
      setError('Please enter a valid step count (1–999,999).');
      return;
    }

    if (!submissionDate) {
      setError('Please select the date for this submission.');
      return;
    }

    if (submissionDate < currentWeekMondayString()) {
      setError('You can only submit steps for the current week (Monday through today).');
      return;
    }

    if (submissionDate > todayDateString()) {
      setError('You cannot submit steps for a future date.');
      return;
    }

    const [sy, sm, sd] = submissionDate.split('-').map(Number);
    const subDateObj = new Date(sy, sm - 1, sd);
    const weekEndDateObj = getWeekEndingSunday(subDateObj);

    if (!isSubmissionAllowed(weekEndDateObj)) {
      setError('The submission window for this week has closed (Sunday 10:00 PM Central).');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const weekSubs = await getCurrentWeekSubmissions(user.id, toDateString(weekEndDateObj));
      if (weekSubs.length >= MAX_SUBMISSIONS_PER_WEEK) {
        setError(`You have reached the maximum of ${MAX_SUBMISSIONS_PER_WEEK} submissions for this week.`);
        return;
      }

      const coveringRange = await getRangeCoveringDate(user.id, submissionDate);
      if (coveringRange) {
        const rangeEnd = coveringRange.submission_end_date!;
        setError(
          `This date is already covered by a range submission (${formatShortDate(coveringRange.submission_date)} – ${formatShortDate(rangeEnd)}). You cannot submit a single day that overlaps an existing range.`
        );
        return;
      }

      const existingSubmission = await getSubmissionForDate(user.id, submissionDate);

      if (existingSubmission) {
        if (existingSubmission.status !== 'pending') {
          setError('A non-pending submission already exists for this date. Contact an admin if needed.');
          return;
        }
        await updateSubmission(existingSubmission.id, steps, submissionDate, toDateString(weekEndDateObj));
      } else {
        const proofPath = await uploadProofFile(user.id, file);
        await createSubmission(user.id, ocrResult, steps, subDateObj, weekEndDateObj, proofPath);
      }

      setStage('done');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRangeSubmit = async () => {
    if (!user || !file || !ocrResult) return;

    const steps = parseInt(confirmedSteps);
    if (!steps || steps < 1 || steps > 9999999) {
      setError('Please enter a valid total step count (1–9,999,999).');
      return;
    }

    if (!rangeStartDate || !rangeEndDate) {
      setError('Please select both a start and end date.');
      return;
    }

    if (rangeStartDate > rangeEndDate) {
      setError('Start date must be on or before end date.');
      return;
    }

    if (rangeStartDate < currentWeekMondayString()) {
      setError('You can only submit steps for the current week (Monday through today).');
      return;
    }

    if (rangeEndDate > todayDateString()) {
      setError('You cannot submit steps for future dates.');
      return;
    }

    const numDays = daysBetween(rangeStartDate, rangeEndDate);
    if (numDays > 31) {
      setError('Date range cannot exceed 31 days.');
      return;
    }

    const [ey, em, ed] = rangeEndDate.split('-').map(Number);
    const endDateObj = new Date(ey, em - 1, ed);
    const weekEndDateObj = getWeekEndingSunday(endDateObj);

    if (!isSubmissionAllowed(weekEndDateObj)) {
      setError('The submission window for this week has closed (Sunday 10:00 PM Central).');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const weekSubs = await getCurrentWeekSubmissions(user.id, toDateString(weekEndDateObj));
      if (weekSubs.length >= MAX_SUBMISSIONS_PER_WEEK) {
        setError(`You have reached the maximum of ${MAX_SUBMISSIONS_PER_WEEK} submissions for this week.`);
        return;
      }

      const existingRange = await getOverlappingRangeSubmission(user.id, rangeStartDate, rangeEndDate);
      if (existingRange) {
        const rangeEnd = existingRange.submission_end_date!;
        setError(`A range submission (${formatShortDate(existingRange.submission_date)} – ${formatShortDate(rangeEnd)}) already overlaps these dates. Contact an admin if needed.`);
        return;
      }

      const existingSingleInRange = await getSingleDaySubmissionInRange(user.id, rangeStartDate, rangeEndDate);
      if (existingSingleInRange) {
        setError(`A single-day submission for ${formatShortDate(existingSingleInRange.submission_date)} already exists within this range. You cannot create a range that overlaps existing day submissions.`);
        return;
      }

      const [sy, sm, sd] = rangeStartDate.split('-').map(Number);
      const startDateObj = new Date(sy, sm - 1, sd);

      const proofPath = await uploadProofFile(user.id, file);
      await createRangeSubmission(user.id, ocrResult, steps, startDateObj, endDateObj, proofPath);

      setStage('done');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSubmit = () => {
    if (mode === 'single') return handleSingleSubmit();
    return handleRangeSubmit();
  };

  if (countdown.isPast && stage === 'upload') {
    return (
      <div className="flex flex-col flex-1 overflow-hidden bg-page">
        <div className="flex-1 overflow-y-auto pt-20 flex items-center justify-center px-4">
          <Card className="p-8 max-w-md w-full text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-primary mb-2">Submission Window Closed</h2>
            <p className="text-secondary mb-6">
              The deadline for this week has passed (Sunday 10:00 PM Central). Submissions open again next week.
            </p>
            <Button onClick={() => navigate('/dashboard')} variant="secondary">
              Back to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const doneLabel = mode === 'range' && rangeStartDate && rangeEndDate && rangeStartDate !== rangeEndDate
    ? `${formatShortDate(rangeStartDate)} – ${formatShortDate(rangeEndDate)}`
    : submissionDate
    ? formatLocalDate(submissionDate)
    : '';

  if (stage === 'done') {
    return (
      <div className="flex flex-col flex-1 overflow-hidden bg-page">
        <div className="flex-1 overflow-y-auto pt-20 flex items-center justify-center px-4">
          <Card className="p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-primary mb-2">Submission Received!</h2>
            <p className="text-secondary">
              Your steps for <span className="text-primary font-medium">{doneLabel}</span> have been submitted and are pending admin review.
            </p>
            <p className="text-muted text-sm mt-3">Redirecting...</p>
          </Card>
        </div>
      </div>
    );
  }

  const numDaysInRange = rangeStartDate && rangeEndDate && rangeStartDate <= rangeEndDate
    ? daysBetween(rangeStartDate, rangeEndDate)
    : 0;

  const rangeWeekEndDateObj = rangeEndDate
    ? getWeekEndingSunday(new Date(rangeEndDate + 'T12:00:00'))
    : null;

  const singleWeekEndDateObj = submissionDate
    ? getWeekEndingSunday(new Date(submissionDate + 'T12:00:00'))
    : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-page">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-20 pb-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-primary mb-1">Submit Your Steps</h1>
            <p className="text-secondary text-sm">
              Upload proof for a single day or for a date range (e.g., a full week).
            </p>
          </div>

          {stage === 'upload' && (
            <div className="mb-5">
              <p className="text-sm font-medium text-secondary mb-2">Submission type</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('single')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    mode === 'single'
                      ? 'border-teal-600 bg-teal-500 text-white'
                      : 'border-strong bg-card text-secondary hover:border-teal-500/50 hover:text-primary'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Single Day
                </button>
                <button
                  onClick={() => setMode('range')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    mode === 'range'
                      ? 'border-teal-600 bg-teal-500 text-white'
                      : 'border-strong bg-card text-secondary hover:border-teal-500/50 hover:text-primary'
                  }`}
                >
                  <CalendarRange className="w-4 h-4" />
                  Date Range
                </button>
              </div>
              <p className="text-xs text-muted mt-2">
                {mode === 'single'
                  ? 'Submit steps for a specific day with one proof file.'
                  : 'Submit cumulative steps for multiple days (e.g., Mon–Sun) with one proof file.'}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            {(['upload', 'review'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                  stage === s ? 'bg-teal-500 text-white' :
                  (s === 'review' && stage === 'done') ? 'bg-emerald-500 text-white' :
                  stage === 'done' ? 'bg-emerald-500 text-white' :
                  'bg-elevated text-muted'
                }`}>
                  {i + 1}
                </div>
                <span className={`text-sm ${stage === s ? 'text-primary' : 'text-muted'}`}>
                  {s === 'upload' ? 'Upload Proof' : 'Review & Confirm'}
                </span>
                {i === 0 && <div className="w-12 h-px bg-elevated" />}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 mb-5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {stage === 'upload' && (
            <Card
              className={`border-2 border-dashed transition-colors cursor-pointer ${
                dragOver ? 'border-teal-400 bg-teal-500/15' : 'border-strong hover:border-strong'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center py-14 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-elevated border border-strong flex items-center justify-center mb-4">
                  <Upload className="w-7 h-7 text-secondary" />
                </div>
                <p className="text-primary font-medium mb-1">
                  Drop your file here or click to browse
                </p>
                <p className="text-muted text-sm mb-4">JPG, PNG, WEBP, or PDF · Max 10MB</p>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1"><Image className="w-3 h-3" />Screenshots</span>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" />PDF exports</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
              />
            </Card>
          )}

          {stage === 'processing' && (
            <Card className="p-10 text-center">
              <Loader2 className="w-10 h-10 text-teal-400 mx-auto mb-4 animate-spin" />
              <p className="text-primary font-medium mb-1">Reading your steps...</p>
              <p className="text-muted text-sm">
                {file?.type === 'application/pdf' ? 'Extracting text from PDF' : 'Running OCR on image'}
              </p>
            </Card>
          )}

          {stage === 'review' && ocrResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-primary">Detection Results</h2>
                    <ConfidenceBadge confidence={ocrResult.confidence} />
                  </div>

                  <div className="space-y-2 mb-4">
                    {ocrResult.detectedSteps !== null ? (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-secondary">Steps found:</span>
                        <span className="text-primary font-semibold">{formatSteps(ocrResult.detectedSteps)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-secondary">Step count not detected — enter manually</span>
                      </div>
                    )}
                    {ocrResult.detectedDateRange ? (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-secondary">Date on document:</span>
                        <span className="text-primary font-semibold">{ocrResult.detectedDateRange}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-secondary">No date found — using today</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-elevated rounded-lg text-sm text-secondary">
                    <FileText className="w-4 h-4 shrink-0 text-muted" />
                    <span className="truncate">{file?.name}</span>
                    <button
                      onClick={() => { setStage('upload'); setFile(null); setOcrResult(null); }}
                      className="ml-auto text-muted hover:text-secondary transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Edit2 className="w-4 h-4 text-teal-400" />
                    <h2 className="font-semibold text-primary">Confirm Your Submission</h2>
                  </div>

                  <div className="space-y-4">
                    <Input
                      label={mode === 'range' ? `Total Steps (${numDaysInRange > 1 ? `${numDaysInRange} days` : '1 day'})` : 'Steps for This Day'}
                      type="number"
                      value={confirmedSteps}
                      onChange={(e) => setConfirmedSteps(e.target.value)}
                      placeholder="Enter step count"
                      min="1"
                      max={mode === 'range' ? '9999999' : '999999'}
                      hint={mode === 'range'
                        ? 'Enter the total cumulative steps for the entire date range'
                        : 'Correct this if the auto-detected number is wrong'}
                    />

                    {mode === 'single' ? (
                      <div>
                        <label className="text-sm font-medium text-secondary block mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            Which day is this submission for?
                          </span>
                        </label>
                        <input
                          type="date"
                          value={submissionDate}
                          min={currentWeekMondayString()}
                          max={todayDateString()}
                          onChange={(e) => setSubmissionDate(e.target.value)}
                          className="w-full bg-card border border-strong rounded-lg px-4 py-2.5 text-primary text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                        />
                        {submissionDate && singleWeekEndDateObj && (
                          <p className="text-xs text-muted mt-1">
                            {formatLocalDate(submissionDate)} &mdash; week ending {formatLocalDate(toDateString(singleWeekEndDateObj))}
                          </p>
                        )}
                        {submissionDate && singleWeekEndDateObj && !isSubmissionAllowed(singleWeekEndDateObj) && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Deadline passed — this week is closed (Sunday 10 PM Central)
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-secondary block">
                          <span className="flex items-center gap-1.5">
                            <CalendarRange className="w-3.5 h-3.5" />
                            Date range
                          </span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted mb-1">Start date</p>
                            <input
                              type="date"
                              value={rangeStartDate}
                              min={currentWeekMondayString()}
                              max={rangeEndDate || todayDateString()}
                              onChange={(e) => setRangeStartDate(e.target.value)}
                              className="w-full bg-card border border-strong rounded-lg px-3 py-2.5 text-primary text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted mb-1">End date</p>
                            <input
                              type="date"
                              value={rangeEndDate}
                              min={rangeStartDate || currentWeekMondayString()}
                              max={todayDateString()}
                              onChange={(e) => setRangeEndDate(e.target.value)}
                              className="w-full bg-card border border-strong rounded-lg px-3 py-2.5 text-primary text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                            />
                          </div>
                        </div>
                        {rangeStartDate && rangeEndDate && rangeStartDate <= rangeEndDate && (
                          <div className="flex items-center justify-between text-xs text-muted bg-elevated rounded-lg px-3 py-2">
                            <span>{formatShortDate(rangeStartDate)} &mdash; {formatShortDate(rangeEndDate)}</span>
                            <span className="text-teal-400 font-medium">{numDaysInRange} {numDaysInRange === 1 ? 'day' : 'days'}</span>
                          </div>
                        )}
                        {rangeEndDate && rangeWeekEndDateObj && !isSubmissionAllowed(rangeWeekEndDateObj) && (
                          <p className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Deadline passed for the week ending {formatShortDate(toDateString(rangeWeekEndDateObj))}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 text-sm text-amber-300">
                <p className="font-medium mb-1">Before you submit:</p>
                <ul className="space-y-1 text-amber-400/80 text-xs">
                  {mode === 'single' ? (
                    <>
                      <li>• Each day requires a separate upload — one proof file per day</li>
                      <li>• Confirm the step count matches your fitness app exactly</li>
                    </>
                  ) : (
                    <>
                      <li>• Enter the total cumulative steps across the entire date range</li>
                      <li>• One proof file covers the whole range — use a summary screenshot or weekly export</li>
                    </>
                  )}
                  <li>• Submissions are reviewed and cannot be changed after approval</li>
                </ul>
              </div>

              <Button
                onClick={handleConfirmSubmit}
                loading={submitting}
                className="w-full"
                size="lg"
              >
                <ArrowRight className="w-4 h-4" />
                Confirm & Submit
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
