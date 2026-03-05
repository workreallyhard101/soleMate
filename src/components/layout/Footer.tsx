import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const RATE_LIMIT_KEY = 'help_req_times';
const MAX_REQUESTS = 3;
const WINDOW_MS = 60 * 60 * 1000;
const SUBJECT_MAX = 60;
const MESSAGE_MAX = 150;

function getStoredTimes(): number[] {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function isRateLimited(): boolean {
  const now = Date.now();
  const times = getStoredTimes().filter((t) => now - t < WINDOW_MS);
  return times.length >= MAX_REQUESTS;
}

function recordSubmission() {
  const now = Date.now();
  const times = getStoredTimes().filter((t) => now - t < WINDOW_MS);
  times.push(now);
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(times));
}

export function Footer() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [request, setRequest] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleSubjectChange = (val: string) => {
    if (val.length <= SUBJECT_MAX) {
      setSubject(val);
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !request.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (subject.trim().length < 3) {
      setError('Subject must be at least 3 characters.');
      return;
    }

    if (isRateLimited()) {
      setError('Too many requests. Please wait before submitting again.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('help_requests')
        .insert({ name: name.trim(), email: email.trim(), subject: subject.trim(), request: request.trim() });
      if (insertError) {
        if (insertError.code === '42501' || insertError.message?.toLowerCase().includes('policy')) {
          setError('Too many requests. Please wait before submitting again.');
        } else {
          throw insertError;
        }
        return;
      }
      recordSubmission();
      setSubmitted(true);
      setName('');
      setEmail('');
      setSubject('');
      setRequest('');
      setTimeout(() => {
        setSubmitted(false);
        setOpen(false);
      }, 2500);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-strong py-2" style={{ backgroundColor: 'var(--color-surface-bg)' }}>
      <div className="w-full px-4 sm:px-6 flex items-center justify-between relative">
        <p className="text-muted text-xs">
          &copy; 2026 Robin. All rights reserved.
        </p>

        <p className="text-muted text-xs absolute left-1/2 -translate-x-1/2">
          For any issues email{' '}
          <a href="mailto:help@robin-sharma.com" className="text-teal-400 hover:text-teal-300 transition-colors">
            help@robin-sharma.com
          </a>
        </p>

        <div className="relative" ref={popupRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-teal-400 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Help
          </button>

          {open && (
            <div
              className="absolute bottom-8 right-0 w-80 border border-strong rounded-xl shadow-2xl z-50 overflow-hidden"
              style={{ backgroundColor: 'var(--color-card-bg)' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-strong" style={{ backgroundColor: 'var(--color-card-bg)' }}>
                <span className="text-sm font-semibold text-primary">Get Help</span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted hover:text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3" style={{ backgroundColor: 'var(--color-card-bg)' }}>
                {submitted ? (
                  <div className="py-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                      <Send className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-primary">Request submitted!</p>
                    <p className="text-xs text-muted mt-1">We'll get back to you soon.</p>
                  </div>
                ) : (
                  <>
                    {error && (
                      <div className="bg-red-900/20 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300">
                        {error}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-1">Name <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setError(''); }}
                        placeholder="Your name"
                        className="w-full border border-strong rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50"
                        style={{ backgroundColor: 'var(--color-elevated-bg)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-1">Email <span className="text-red-400">*</span></label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        placeholder="your@email.com"
                        className="w-full border border-strong rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50"
                        style={{ backgroundColor: 'var(--color-elevated-bg)' }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-secondary">Subject <span className="text-red-400">*</span></label>
                        <span className={`text-[10px] tabular-nums ${subject.length >= SUBJECT_MAX ? 'text-red-400' : subject.length >= SUBJECT_MAX * 0.8 ? 'text-amber-400' : 'text-muted'}`}>
                          {subject.length}/{SUBJECT_MAX}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => handleSubjectChange(e.target.value)}
                        placeholder="Brief summary of your issue"
                        maxLength={SUBJECT_MAX}
                        className="w-full border border-strong rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50"
                        style={{ backgroundColor: 'var(--color-elevated-bg)' }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-secondary">Request <span className="text-red-400">*</span></label>
                        <span className={`text-[10px] tabular-nums ${request.length >= MESSAGE_MAX ? 'text-red-400' : request.length >= MESSAGE_MAX * 0.8 ? 'text-amber-400' : 'text-muted'}`}>
                          {request.length}/{MESSAGE_MAX}
                        </span>
                      </div>
                      <textarea
                        value={request}
                        onChange={(e) => { if (e.target.value.length <= MESSAGE_MAX) { setRequest(e.target.value); setError(''); } }}
                        placeholder="Describe your issue or question..."
                        rows={3}
                        maxLength={MESSAGE_MAX}
                        className="w-full border border-strong rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 resize-none"
                        style={{ backgroundColor: 'var(--color-elevated-bg)' }}
                      />
                    </div>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {submitting ? 'Submitting...' : 'Submit'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
