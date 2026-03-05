import { supabase } from './supabase';
import type { Submission, OcrResult } from '../types';
import { toDateString, getMonthKeyForWeek, getWeekEndingSunday } from './deadlineUtils';

export async function uploadProofFile(
  userId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('proof-files')
    .upload(path, file, { upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function createSubmission(
  userId: string,
  ocrResult: OcrResult,
  confirmedSteps: number,
  submissionDate: Date,
  weekEndingDate: Date,
  proofFilePath: string
): Promise<Submission> {
  const monthKey = getMonthKeyForWeek(weekEndingDate);
  const weekEnding = toDateString(weekEndingDate);
  const subDate = toDateString(submissionDate);

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      user_id: userId,
      submission_date: subDate,
      submission_end_date: null,
      week_ending_date: weekEnding,
      month_key: monthKey,
      detected_steps: ocrResult.detectedSteps,
      confirmed_steps: confirmedSteps,
      detected_date_range: ocrResult.detectedDateRange,
      ocr_confidence: ocrResult.confidence,
      proof_file_path: proofFilePath,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createRangeSubmission(
  userId: string,
  ocrResult: OcrResult,
  confirmedSteps: number,
  startDate: Date,
  endDate: Date,
  proofFilePath: string
): Promise<Submission> {
  const weekEndingDate = getWeekEndingSunday(endDate);
  const monthKey = getMonthKeyForWeek(weekEndingDate);
  const weekEnding = toDateString(weekEndingDate);
  const subDate = toDateString(startDate);
  const subEndDate = toDateString(endDate);

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      user_id: userId,
      submission_date: subDate,
      submission_end_date: subEndDate,
      week_ending_date: weekEnding,
      month_key: monthKey,
      detected_steps: ocrResult.detectedSteps,
      confirmed_steps: confirmedSteps,
      detected_date_range: ocrResult.detectedDateRange,
      ocr_confidence: ocrResult.confidence,
      proof_file_path: proofFilePath,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getSingleDaySubmissionInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .is('submission_end_date', null)
    .gte('submission_date', startDate)
    .lte('submission_date', endDate)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getOverlappingRangeSubmission(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .not('submission_end_date', 'is', null)
    .lte('submission_date', endDate)
    .gte('submission_end_date', startDate)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateSubmission(
  submissionId: string,
  confirmedSteps: number,
  submissionDate: string,
  weekEndingDate: string
): Promise<void> {
  const { error } = await supabase
    .from('submissions')
    .update({
      confirmed_steps: confirmedSteps,
      submission_date: submissionDate,
      week_ending_date: weekEndingDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
}

export async function getUserSubmissions(userId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .order('submission_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getSubmissionForDate(
  userId: string,
  submissionDate: string
): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('submission_date', submissionDate)
    .is('submission_end_date', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getRangeCoveringDate(
  userId: string,
  date: string
): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .not('submission_end_date', 'is', null)
    .lte('submission_date', date)
    .gte('submission_end_date', date)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCurrentWeekSubmissions(
  userId: string,
  weekEndingDate: string
): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('week_ending_date', weekEndingDate)
    .order('submission_date', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('proof-files')
    .createSignedUrl(filePath, 3600);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function getAllSubmissionsAdmin(): Promise<(Submission & { users: { full_name: string; avatar_url: string | null } | null })[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, users!submissions_user_id_fkey(full_name, avatar_url)')
    .order('submission_date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as (Submission & { users: { full_name: string; avatar_url: string | null } | null })[];
}
