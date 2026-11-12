/* Reads what the main page shows from the existing stores (progress, last opened, saved problems, each lesson's session).
   Nothing here is made up: a saved problem's result is solved once from the problem itself and cached. */
import { findLesson } from '../lessons/registry';
import { KEYS, loadProgress, loadSaved, store, type ProgressMap, type SavedItem } from '../lib/storage';
import { findLessonEntry, type SubjectEntry, type SubjectLesson } from '../subjects';

const RESULTS_KEY = 'unpacked:results:v1';

/** 41000 -> 41,000 (only runs of 4+ digits, so coordinates like (30, 40) stay as they are) */
export const pretty = (s: string): string => s.replace(/\d{4,}/g, d => d.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
/** "P = ₱41000 at (30, 40)" -> "₱41,000" */
export const shortResult = (r: string): string => pretty(r.split(' at ')[0].split('=').pop()?.trim() || r);

/** The result of a lesson's problem; for saved problems it is solved once and remembered. */
export function resultOf(lessonId: string, problem: unknown, cacheKey?: string): string {
    const cache = store.get<Record<string, string>>(RESULTS_KEY, {});
    if (cacheKey && cache[cacheKey]) return cache[cacheKey];
    const l = findLesson('qm', lessonId);
    let r = '';
    try { r = l ? l.summarize(problem).result : ''; } catch { r = ''; }
    if (r === '—') r = '';
    if (cacheKey && r) { cache[cacheKey] = r; store.set(RESULTS_KEY, cache); }
    return r;
}

export interface SavedView { item: SavedItem; subject?: SubjectEntry; lesson?: SubjectLesson; result: string }
export function loadSavedViews(): SavedView[] {
    return loadSaved().slice().sort((a, b) => b.ts - a.ts).map(item => {
        const f = findLessonEntry(item.lesson);
        return { item, subject: f?.subject, lesson: f?.lesson, result: pretty(resultOf(item.lesson, item.problem, item.id)) };
    });
}
export const savedCounts = (views: SavedView[]): Record<string, number> => {
    const n: Record<string, number> = {};
    views.forEach(v => { n[v.item.lesson] = (n[v.item.lesson] || 0) + 1; });
    return n;
};

interface Session { P?: unknown; solvedP?: unknown; idx?: number; tab?: number }
/** the problem a lesson was last working on, with its answer and the saved name if it has one */
export function lessonSnapshot(lessonId: string, views: SavedView[]): { name?: string; result: string } {
    const s = store.get<Session | null>(KEYS.lesson(lessonId), null);
    const problem = s ? (s.solvedP || s.P) : null;
    if (!problem) return { result: '' };
    const name = views.find(v => v.item.lesson === lessonId && JSON.stringify(v.item.problem) === JSON.stringify(problem))?.item.name;
    return { name, result: pretty(resultOf(lessonId, problem)) };
}

/** Opens the code visualizer with some code in it */
export function openVisualizer(src: string): void {
    const s = store.get<Record<string, unknown> | null>(KEYS.lesson('visualizer'), null) || {};
    store.set(KEYS.lesson('visualizer'), { ...s, file: 'playground.c', idx: 0, edits: { 'playground.c': src } });
}

/** Opens a saved problem in its lesson (on the Solve tab) */
export function openSavedProblem(v: SavedView): void {
    store.set(KEYS.lesson(v.item.lesson), { P: v.item.problem, solvedP: v.item.problem, idx: 0, tab: 2 });
}

export const loadAll = (): { progress: ProgressMap; views: SavedView[] } => ({ progress: loadProgress(), views: loadSavedViews() });
