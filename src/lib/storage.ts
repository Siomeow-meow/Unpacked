/* Safe localStorage helpers + the one-time migration from the original single-page Simplex app.
   Every read and write is wrapped in try/catch: storage can be blocked (private mode, cleared site data). */
import { buildSteps, type SimplexProblem } from './simplex/solver';

export const store = {
    get<T>(k: string, d: T): T {
        try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; }
    },
    set(k: string, v: unknown): boolean {
        try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
    },
    remove(k: string): void {
        try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
};

/* ---- keys ---- */
export const LEGACY = { state: 'simplex-tutor:v2', saved: 'simplex-tutor:saved:v1', whatsnew: 'simplex-tutor:whatsnew' } as const;
export const KEYS = {
    saved: 'unpacked:saved:v1',
    whatsnew: 'unpacked:whatsnew',
    last: 'unpacked:last:v1',
    progress: 'unpacked:progress:v1',
    migrated: 'unpacked:migrated:v1',
    lesson: (id: string) => 'unpacked:lesson:' + id + ':v1'
};

/* ---- saved problems (all lessons share one list; each item says which lesson it belongs to) ---- */
export interface SavedItem { id: string; name: string; ts: number; lesson: string; problem: unknown }

/* stored data can be old or damaged: keep only what is usable, never crash on it */
export const loadSaved = (): SavedItem[] => {
    const l = store.get<unknown>(KEYS.saved, []);
    if (!Array.isArray(l)) return [];
    return l.filter((x): x is SavedItem => !!x && typeof x === 'object' && typeof (x as SavedItem).id === 'string' && typeof (x as SavedItem).name === 'string' && (x as SavedItem).problem != null)
        .map(x => ({ ...x, ts: +x.ts || 0, lesson: typeof x.lesson === 'string' ? x.lesson : 'simplex' }));
};
export const saveSaved = (list: SavedItem[]): boolean => store.set(KEYS.saved, list);

/* ---- progress ---- */
export interface LessonProgress { idx: number; max: number; total: number; /** when the lesson was last opened (ms) */ ts?: number }
export type ProgressMap = Record<string, LessonProgress>;
export interface LastLesson { lesson: string; idx: number; total: number; ts: number }

export const loadProgress = (): ProgressMap => {
    const m = store.get<unknown>(KEYS.progress, {});
    if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
    const out: ProgressMap = {};
    Object.entries(m as Record<string, Partial<LessonProgress>>).forEach(([k, p]) => {
        if (p && typeof p.idx === 'number' && typeof p.max === 'number' && typeof p.total === 'number' && p.total > 0) out[k] = { idx: p.idx, max: p.max, total: p.total, ts: typeof p.ts === 'number' ? p.ts : undefined };
    });
    return out;
};
export function recordProgress(lesson: string, idx: number, total: number): void {
    if (total <= 0) return;
    const all = loadProgress();
    const prev = all[lesson];
    const max = Math.max(prev && prev.total === total ? prev.max : 0, idx);
    all[lesson] = { idx, max, total, ts: Date.now() };
    store.set(KEYS.progress, all);
    store.set(KEYS.last, { lesson, idx, total, ts: Date.now() } satisfies LastLesson);
}
export const loadLast = (): LastLesson | null => store.get<LastLesson | null>(KEYS.last, null);

/* ---- migration from the original app (keys simplex-tutor:*) ----
   Old keys are never deleted, so the old page keeps working side by side. localStorage is per-origin, and the old and
   new sites share the same origin on GitHub Pages, so the old data is simply there to be read. */
interface LegacyState { P?: SimplexProblem; solvedP?: SimplexProblem | null; idx?: number; tab?: number }
interface LegacySaved { id: string; name: string; ts: number; problem: SimplexProblem }

export function migrateLegacy(): void {
    try {
        if (store.get<string>(KEYS.migrated, '') === '1') return;
        const old = store.get<LegacyState | null>(LEGACY.state, null);
        if (old && old.P && Array.isArray(old.P.vars) && Array.isArray(old.P.cons) && store.get(KEYS.lesson('simplex'), null) === null) {
            store.set(KEYS.lesson('simplex'), { P: old.P, solvedP: old.solvedP || null, idx: old.idx || 0, tab: old.tab || 1 });
            if (old.solvedP) {
                const r = buildSteps(old.solvedP);
                if (r.steps) {
                    const idx = Math.min(Math.max(0, old.idx || 0), r.steps.length - 1);
                    recordProgress('simplex', idx, r.steps.length);
                }
            }
        }
        const oldSaved = store.get<LegacySaved[]>(LEGACY.saved, []);
        if (Array.isArray(oldSaved) && oldSaved.length) {
            const list = loadSaved();
            oldSaved.forEach(s => {
                if (s && s.problem && s.name && !list.some(x => x.id === String(s.id))) {
                    list.push({ id: String(s.id), name: String(s.name), ts: +s.ts || Date.now(), lesson: 'simplex', problem: s.problem });
                }
            });
            list.sort((a, b) => b.ts - a.ts);
            saveSaved(list);
        }
        const seen = store.get<string>(LEGACY.whatsnew, '');
        if (seen && store.get(KEYS.whatsnew, '') === '') store.set(KEYS.whatsnew, seen);
        store.set(KEYS.migrated, '1');
    } catch { /* never block the app on migration */ }
}
