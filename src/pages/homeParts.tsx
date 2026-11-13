/* Small pieces of the Home page: the logo, the lesson thumbnails, the "offline ready" light, and a live preview of
   the step you were last on (drawn by the same viz code the lesson uses). */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buildSteps } from '../lib/simplex/solver';
import { solveGraphical } from '../lib/graphical/solver';
import { solveTransport } from '../lib/transportation/solver';
import { KEYS, store } from '../lib/storage';
import type { StepBase, VizAdapter } from '../lessons/types';
import { simplexAdapter } from '../lessons/simplex/tables';
import { graphicalAdapter } from '../lessons/graphical/adapter';
import { transportAdapter } from '../lessons/transportation/adapter';
import { DSA_THUMBS } from './thumbs';

export function Logo() {
    return (
        <svg className="logo" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
            <circle cx="8.6" cy="6.6" r="1.7" /><rect x="11.2" y="3.4" width="3.4" height="3.4" rx=".7" transform="rotate(14 12.9 5.1)" /><circle cx="16.2" cy="7.2" r="1.5" /><path d="M5 12.5L2.8 9l3.6-.6M19 12.5L21.2 9l-3.6-.6" /><path d="M4.6 12h14.8l-.8 7.2a1 1 0 0 1-1 .9H6.4a1 1 0 0 1-1-.9z" />
        </svg>
    );
}

/* a tiny picture for each lesson */
export function Thumb({ id }: { id: string }) {
    if (id === 'graphical') {
        return (
            <svg viewBox="0 0 72 56" preserveAspectRatio="xMaxYMid meet" className="thumb" aria-hidden="true">
                {/* grid, then the feasible polygon whose corners are the axes, the intercepts and the point where the lines cross */}
                <path d="M22 6V48M34 6V48M46 6V48M58 6V48M10 12H66M10 24H66M10 36H66" stroke="var(--line)" strokeWidth=".7" fill="none" />
                <path d="M10 48V24L28.75 33L40 48z" fill="#f59f00" fillOpacity=".38" />
                <path d="M10 8L40 48" stroke="#1c7ed6" strokeWidth="2" strokeLinecap="round" /><path d="M10 24L60 48" stroke="#e8590c" strokeWidth="2" strokeLinecap="round" />
                <path d="M10 3V48H67" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M7 6L10 2L13 6M63 45L67 48L63 51" fill="none" stroke="var(--muted)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="28.75" cy="33" r="3.4" fill="#2b8a3e" stroke="var(--card)" strokeWidth="1" />
            </svg>
        );
    }
    if (id === 'simplex') {
        return (
            <svg viewBox="0 0 72 56" preserveAspectRatio="xMaxYMid meet" className="thumb" aria-hidden="true">
                {[0, 1, 2].map(r => [0, 1, 2, 3].map(c => (
                    <rect key={r + '-' + c} x={8 + c * 14} y={10 + r * 12} width="13" height="11" rx="1.5" fill={r === 1 && c === 1 ? '#ffd43b' : 'var(--card)'} stroke="var(--line)" />
                )))}
                <path d="M16 6q14-8 28 4" fill="none" stroke="#e8590c" strokeWidth="1.8" /><path d="M42 8l3 3-4 1" fill="none" stroke="#e8590c" strokeWidth="1.8" />
            </svg>
        );
    }
    if (DSA_THUMBS[id]) return <>{DSA_THUMBS[id]}</>;
    return (
        <svg viewBox="0 0 72 56" preserveAspectRatio="xMaxYMid meet" className="thumb" aria-hidden="true">
            {[0, 1, 2].map(r => [0, 1, 2].map(c => (
                <rect key={r + '-' + c} x={10 + c * 17} y={8 + r * 14} width="16" height="13" rx="1.5" fill="var(--card)" stroke="var(--line)" />
            )))}
            <path d="M18 14h17v14h17v14H18z" fill="none" stroke="#e03131" strokeWidth="1.8" strokeDasharray="4 3" />
        </svg>
    );
}

/* a green light once the service worker has everything cached (never shown in dev, where there is no service worker) */
export function useOfflineReady(): boolean {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        let alive = true;
        navigator.serviceWorker.getRegistration().then(reg => { if (reg && alive) navigator.serviceWorker.ready.then(() => { if (alive) setReady(true); }); }).catch(() => { /* ignore */ });
        return () => { alive = false; };
    }, []);
    return ready;
}

/* ---- live preview of the last step ---- */
interface Session { P?: unknown; solvedP?: unknown; idx?: number }
type Any = StepBase & Record<string, unknown>;
const PREVIEW: Record<string, { solve: (p: never) => { steps?: Any[] }; adapter: VizAdapter<never> }> = {
    simplex: { solve: p => buildSteps(p) as never, adapter: simplexAdapter as never },
    graphical: { solve: p => solveGraphical(p) as never, adapter: graphicalAdapter as never },
    transportation: { solve: p => solveTransport(p) as never, adapter: transportAdapter as never }
};

export function LessonPreview({ lesson }: { lesson: string }) {
    const box = useRef<HTMLDivElement>(null);
    const [ok, setOk] = useState(true);
    useLayoutEffect(() => {
        const el = box.current, cfg = PREVIEW[lesson];
        if (!el || !cfg) return;
        const draw = () => {
            try {
                const s = store.get<Session | null>(KEYS.lesson(lesson), null);
                if (!s || !s.solvedP) { setOk(false); return; }
                const steps = cfg.solve(s.solvedP as never).steps;
                if (!steps || !steps.length) { setOk(false); return; }
                let i = Math.min(Math.max(0, s.idx || 0), steps.length - 1);
                /* the nearest step that has a picture (the Graphical lesson wants a graph, not just a table) */
                const pic = (k: number) => cfg.adapter.hasViz(steps[k] as never) && (lesson !== 'graphical' || (!!(steps[k] as Record<string, unknown>).graph && !(steps[k] as Record<string, unknown>).final));
                while (i > 0 && !pic(i)) i--;
                /* the Graphical preview is just the graph (the table would make it tiny) */
                const st = (lesson === 'graphical' ? { ...(steps[i] as object), table: null } : steps[i]) as never;
                if (!cfg.adapter.hasViz(st)) { setOk(false); return; }
                el.innerHTML = '';
                const ctx = cfg.adapter.prepare ? cfg.adapter.prepare(steps as never) : null;
                cfg.adapter.render(el, st, cfg.adapter.mode(st), ctx);
                el.querySelectorAll('.pend').forEach(n => n.classList.remove('pend'));
                setOk(true);
            } catch { setOk(false); }
        };
        draw();
        const ro = window.ResizeObserver ? new ResizeObserver(draw) : null;
        ro?.observe(el);
        return () => ro?.disconnect();
    }, [lesson]);
    return (
        <div className="preview">
            <div ref={box} className="viz pv" style={ok ? undefined : { display: 'none' }} />
            {!ok && <div className="pvEmpty"><Thumb id={lesson} /></div>}
            <span className="pvLabel">Your last step</span>
        </div>
    );
}
