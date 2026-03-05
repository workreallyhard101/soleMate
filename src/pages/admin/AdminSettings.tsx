import { useState, useEffect } from 'react';
import { Key, Calendar, AlertTriangle, Save, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getCurrentMonthKey, formatMonthKey } from '../../lib/deadlineUtils';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newAccessCode, setNewAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [anomalyThreshold, setAnomalyThreshold] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [thresholdSuccess, setThresholdSuccess] = useState(false);
  const [freezeModal, setFreezeModal] = useState(false);
  const [freezing, setFreezing] = useState(false);

  const currentMonth = settings.current_month_key || getCurrentMonthKey();

  useEffect(() => {
    supabase.from('settings').select('*').then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });
      setSettings(map);
      setAnomalyThreshold(map.step_anomaly_threshold || '100000');
      setLoading(false);
    });
  }, []);

  const saveAccessCode = async () => {
    if (!newAccessCode.trim()) return;
    setSavingCode(true);
    try {
      await supabase
        .from('settings')
        .update({ value: newAccessCode.toUpperCase().trim(), updated_at: new Date().toISOString() })
        .eq('key', 'access_code_hash');
      await supabase.from('audit_logs').insert({ action: 'access_code_updated', details: {} });
      setNewAccessCode('');
      setCodeSuccess(true);
      setTimeout(() => setCodeSuccess(false), 3000);
    } finally {
      setSavingCode(false);
    }
  };

  const saveThreshold = async () => {
    const val = parseInt(anomalyThreshold);
    if (!val || val < 1000) return;
    setSavingThreshold(true);
    try {
      await supabase
        .from('settings')
        .update({ value: String(val), updated_at: new Date().toISOString() })
        .eq('key', 'step_anomaly_threshold');
      setThresholdSuccess(true);
      setTimeout(() => setThresholdSuccess(false), 3000);
    } finally {
      setSavingThreshold(false);
    }
  };

  const freezeMonth = async () => {
    setFreezing(true);
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      const nextDate = new Date(year, month, 1);
      const nextMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      await supabase.rpc('freeze_month', { p_current_month_key: currentMonth, p_new_month_key: nextMonthKey });
      setSettings((prev) => ({ ...prev, current_month_key: nextMonthKey }));
      setFreezeModal(false);
    } finally {
      setFreezing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden bg-page items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-page">
      <div className="flex-1 overflow-y-auto pt-20 pb-4">
        <div className="px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-primary mb-5">Settings</h1>

          <div className="max-w-lg space-y-4">
            <div className="bg-card border border-strong rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-amber-400" />
                <h2 className="font-medium text-primary text-sm">Access Code</h2>
              </div>
              {codeSuccess && (
                <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-2.5 text-xs text-emerald-300 mb-3">
                  Updated successfully.
                </div>
              )}
              <div className="relative">
                <Input
                  label=""
                  type={showCode ? 'text' : 'password'}
                  value={newAccessCode}
                  onChange={(e) => setNewAccessCode(e.target.value)}
                  placeholder="Enter new access code"
                  className="pr-10 uppercase"
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-2.5 text-muted hover:text-secondary transition-colors"
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-3">
                <Button size="sm" onClick={saveAccessCode} loading={savingCode} disabled={!newAccessCode.trim()}>
                  <Save className="w-3.5 h-3.5" />
                  Update Code
                </Button>
              </div>
            </div>

            <div className="bg-card border border-strong rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="font-medium text-primary text-sm">Anomaly Threshold</h2>
              </div>
              {thresholdSuccess && (
                <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-2.5 text-xs text-emerald-300 mb-3">
                  Threshold updated.
                </div>
              )}
              <Input
                label=""
                type="number"
                value={anomalyThreshold}
                onChange={(e) => setAnomalyThreshold(e.target.value)}
                placeholder="e.g. 100000"
                min="1000"
                max="500000"
              />
              <p className="text-xs text-muted mt-1.5 mb-3">Steps/week above this are auto-flagged</p>
              <Button size="sm" onClick={saveThreshold} loading={savingThreshold} variant="secondary">
                <Save className="w-3.5 h-3.5" />
                Save
              </Button>
            </div>

            <div className="bg-card border border-strong rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h2 className="font-medium text-primary text-sm">Month Management</h2>
              </div>
              <div className="flex items-center justify-between bg-elevated rounded-lg px-3 py-2.5 mb-3">
                <p className="text-xs text-secondary">Current month</p>
                <p className="font-bold text-primary text-sm">{formatMonthKey(currentMonth)}</p>
              </div>
              <p className="text-xs text-muted mb-3">
                Freezing auto-rejects all pending submissions and advances to the next month. Irreversible.
              </p>
              <Button size="sm" variant="danger" onClick={() => setFreezeModal(true)}>
                <RotateCcw className="w-3.5 h-3.5" />
                Freeze & Advance Month
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={freezeModal} onClose={() => setFreezeModal(false)} title="Freeze Current Month">
        <div className="space-y-4">
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
            <p className="text-amber-300 font-medium text-sm mb-1">This action is irreversible</p>
            <ul className="text-xs text-amber-400/80 space-y-1">
              <li>• All pending submissions for {formatMonthKey(currentMonth)} will be rejected</li>
              <li>• Competition advances to next month</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <Button variant="danger" loading={freezing} onClick={freezeMonth} className="flex-1">
              Confirm Freeze
            </Button>
            <Button variant="ghost" onClick={() => setFreezeModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
