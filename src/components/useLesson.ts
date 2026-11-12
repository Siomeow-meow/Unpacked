/* The step player + session of a lesson: the problem being edited, the solved problem, the step index, the tab,
   keyboard (← → Home End), swipe, first/prev/next/last, and saving progress. Every lesson uses it as is. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SolveResult, StepBase } from '../lessons/types';
import { KEYS, recordProgress, store } from '../lib/storage';
import { clamp, clone } from '../lib/util';
import type { StepCardHandle } from './StepCard';

export interface Session<P> { P: P; solvedP: P | null; idx: number; tab: number }

export interface LessonConfig<P, S extends StepBase> {
    id: string;
    defaultProblem: () => P;
    solve: (p: P) => SolveResult<S>;
    /** is this stored/imported value a problem of this lesson? */
    isProblem: (p: unknown) => boolean;
    /** fix up an older stored problem (e.g. add a missing default) */
    normalize?: (p: P) => P;
    /** names of the inputs that hold something invalid (they get a red border) */
    invalidKeys?: (p: P) => string[];
    /** false: tab 3 is not part of the step player (no step bar, no arrow keys) */
    thirdHasSteps?: boolean;
    /** `?demo=` links: return a problem to open straight on the Solve tab */
    demo?: (q: URLSearchParams) => P | null;
}

function loadSession<P, S extends StepBase>(cfg: LessonConfig<P, S>): { s: Session<P>; quiet: boolean } {
    const saved = store.get<Partial<Session<P>> | null>(KEYS.lesson(cfg.id), null);
    let P = cfg.defaultProblem();
    if (saved && saved.P && cfg.isProblem(saved.P)) P = cfg.normalize ? cfg.normalize(saved.P) : saved.P;
    const q = new URLSearchParams(location.search);
    const demo = cfg.demo?.(q);
    if (demo) return { s: { P: demo, solvedP: clone(demo), idx: +(q.get('step') || 0) || 0, tab: 2 }, quiet: false };
    const savedSteps = saved && saved.solvedP && cfg.isProblem(saved.solvedP) ? cfg.solve(saved.solvedP).steps : undefined;
    if (saved && savedSteps) {
        /* a lesson that was left at its very last step starts again from step 1 */
        const at = saved.idx || 0, idx = savedSteps.length > 1 && at >= savedSteps.length - 1 ? 0 : at;
        return { s: { P, solvedP: saved.solvedP as P, idx, tab: saved.tab === 1 || saved.tab === 3 ? saved.tab : 2 }, quiet: true };
    }
    return { s: { P, solvedP: null, idx: 0, tab: 1 }, quiet: false };
}

export function useLesson<P, S extends StepBase>(cfg: LessonConfig<P, S>) {
    const [init] = useState(() => loadSession(cfg));
    const [P, setP] = useState<P>(init.s.P);
    const [solvedP, setSolvedP] = useState<P | null>(init.s.solvedP);
    const [idx, setIdx] = useState(init.s.idx);
    const [tab, setTab] = useState(init.s.tab);
    const [err, setErr] = useState('');
    const [bad, setBad] = useState<Set<string>>(new Set());
    const [w3, setW3] = useState(0);
    const [h3, setH3] = useState(0);

    const steps = useMemo<S[]>(() => (solvedP ? cfg.solve(solvedP).steps || [] : []), [solvedP]);   // eslint-disable-line react-hooks/exhaustive-deps
    const has = steps.length > 0;
    const safeIdx = has ? clamp(idx, 0, steps.length - 1) : 0;
    const last = steps.length - 1;

    const stage = useRef<StepCardHandle>(null);
    const dir = useRef(1);
    const quiet = useRef(init.quiet);     // page reload: restore the step without replaying the entrance animations
    const pane2 = useRef<HTMLElement>(null);
    const pane3 = useRef<HTMLElement>(null);

    /* ---- save the session (current problem, progress, tab) ---- */
    useEffect(() => { store.set(KEYS.lesson(cfg.id), { P, solvedP, idx: safeIdx, tab } satisfies Session<P>); }, [P, solvedP, safeIdx, tab]);   // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (has) recordProgress(cfg.id, safeIdx, steps.length); }, [has, safeIdx, steps.length]);   // eslint-disable-line react-hooks/exhaustive-deps

    /* ---- draw the step card whenever it should change ---- */
    useLayoutEffect(() => {
        const st = stage.current;
        if (!st) return;
        if (tab === 2 && has) { st.draw(!quiet.current); quiet.current = false; }
        else { st.cancel(); quiet.current = false; if (tab === 3) st.reset(); }
    }, [tab, safeIdx, steps, has]);

    /* the width the third tab can use */
    useEffect(() => {
        const el = pane3.current;
        if (!el) return;
        const upd = () => { setW3(el.clientWidth); setH3(el.clientHeight); };
        upd();
        const ro = window.ResizeObserver ? new ResizeObserver(upd) : null;
        ro?.observe(el);
        window.addEventListener('resize', upd);
        return () => { ro?.disconnect(); window.removeEventListener('resize', upd); };
    }, []);

    /* ---------- solving ---------- */
    const start = (prob: P, at: number, stay?: boolean): boolean => {
        const r = cfg.solve(prob);
        if (r.error || !r.steps) { setErr(r.error || 'Could not solve this problem.'); return false; }
        setErr('');
        stage.current?.reset();
        setSolvedP(clone(prob));
        setIdx(clamp(at || 0, 0, r.steps.length - 1));
        dir.current = 1;
        if (!stay) setTab(2);
        return true;
    };
    /* Opening tab 2 or 3 solves whatever is currently in tab 1. If nothing changed since the last solve,
       it just returns to where you were. */
    const openSolved = (n: number) => {
        let fresh = false;
        if (!has || JSON.stringify(P) !== JSON.stringify(solvedP)) {
            setBad(new Set(cfg.invalidKeys ? cfg.invalidKeys(P) : []));
            if (!start(P, 0)) return;   // invalid input: stay on tab 1, the error is shown there
            fresh = true;               // start() already opened tab 2
        }
        if (!(fresh && n === 2)) setTab(n);
    };
    const toTab1 = () => { stage.current?.cancel(); setTab(1); };

    /* ---------- navigation ---------- */
    const goTo = (to: number, d: number) => { dir.current = d; setIdx(to); };
    const next = () => {
        if (tab !== 3 && stage.current?.finish()) return;   // first press skips the arrow animation
        if (safeIdx < last) goTo(safeIdx + 1, 1);
    };
    const back = () => { if (safeIdx > 0) goTo(safeIdx - 1, -1); };
    const first = () => { if (safeIdx > 0) goTo(0, -1); };
    const end = () => { if (safeIdx < last) goTo(last, 1); };

    const stepsOnThird = cfg.thirdHasSteps !== false;
    const nav = useRef({ next, back, first, end, tab, has, stepsOnThird });
    nav.current = { next, back, first, end, tab, has, stepsOnThird };
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const N = nav.current;
            const el = document.activeElement;
            if ((el && /INPUT|SELECT|TEXTAREA/.test(el.tagName)) || (N.tab !== 2 && !(N.tab === 3 && N.stepsOnThird)) || !N.has || document.querySelector('dialog[open]')) return;
            if (e.key === 'ArrowRight') N.next();
            if (e.key === 'ArrowLeft') N.back();
            if (e.key === 'Home') N.first();
            if (e.key === 'End') N.end();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);
    /* swipe on touch screens */
    useEffect(() => {
        const box = pane2.current;
        if (!box) return;
        let x0 = 0, y0 = 0, ok = false;
        const ts = (e: TouchEvent) => {
            if (nav.current.tab !== 2) { ok = false; return; }
            const t = e.target as Element;
            const v = t.closest && t.closest('.viz');
            ok = !(v && v.scrollWidth > v.clientWidth + 2);
            x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
        };
        const te = (e: TouchEvent) => {
            if (!ok) return;
            const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
            if (Math.abs(dx) > 70 && Math.abs(dy) < 50) { if (dx < 0) nav.current.next(); else nav.current.back(); }
        };
        box.addEventListener('touchstart', ts, { passive: true });
        box.addEventListener('touchend', te, { passive: true });
        return () => { box.removeEventListener('touchstart', ts); box.removeEventListener('touchend', te); };
    }, []);

    /* ---------- editing the problem ---------- */
    const edit = (fn: (p: P) => void, clearKey?: string) => {
        setP(prev => { const p = clone(prev); fn(p); return p; });
        if (clearKey && bad.has(clearKey)) setBad(b => { const n = new Set(b); n.delete(clearKey); return n; });
    };
    const loadProblem = (p: P) => { setP(clone(p)); setErr(''); setBad(new Set()); };

    return {
        id: cfg.id, P, edit, loadProblem, solvedP, steps, has, idx: safeIdx, last, tab, err, setErr, bad, w3, h3, stepsOnThird,
        stage, dir, pane2, pane3,
        start, openSolved, toTab1, next, back, first, end
    };
}
export type Lesson<P, S extends StepBase> = ReturnType<typeof useLesson<P, S>>;
