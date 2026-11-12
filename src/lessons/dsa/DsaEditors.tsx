/* The editors a panel can show on the DSA lesson page and the Code visualizer. Each one reads what it needs from the
   lesson through a context, so the same editor can be open in more than one panel (splitting copies it). */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Snapshot, Trace } from '../../lib/c/machine';
import { runC } from '../../lib/c/machine';
import type { DsaLessonDef, Snippet } from './lessons';
import { DsaViz } from './DsaViz';
import { PracticeButtons, PracticeCode, PracticePane, PracticeStart, TestsPanel, type PracticeApi } from './Practice';
import { editKey } from '../../lib/codeEdit';

export interface Session { file: string; idx: number; edits: Record<string, string>; input: string }
export type Run = ReturnType<typeof runC> & { src: string };

export interface DsaCtxValue {
    def: DsaLessonDef | null;
    cur: Snippet;
    sess: Session; setSess: Dispatch<SetStateAction<Session>>;
    source: string; edited: boolean; onEdit: (v: string) => void; reset: () => void;
    editing: boolean; setEditing: Dispatch<SetStateAction<boolean>>;
    run: Run | null; trace: Trace | undefined; steps: Trace['steps']; step: Trace['steps'][number] | undefined;
    compileErr: { line?: number; message?: string } | null; statusOk: boolean;
    idx: number; last: number; go: (i: number) => void; prev: Snapshot | null; usesHeap: boolean;
    lines: string[]; callLines: number[]; outText: string;
    nav: RefObject<{ go: (i: number) => void; idx: number; last: number }>;
    /** the exercises of this lesson (null when it has none); wide = the Test cases can be their own panel; openTests puts that panel on screen */
    practice: PracticeApi | null; wide: boolean; openTests: () => void;
    /** About or Practice: kept here so it survives a panel being rebuilt when the layout changes */
    aboutTab: 'about' | 'practice'; setAboutTab: Dispatch<SetStateAction<'about' | 'practice'>>;
}
export const DsaCtx = createContext<DsaCtxValue | null>(null);
const useDsa = (): DsaCtxValue => { const c = useContext(DsaCtx); if (!c) throw new Error('DsaCtx missing'); return c; };

/* ---------- what can be opened, and where ---------- */
export type EditorName = 'code' | 'steps' | 'output' | 'compiler' | 'about' | 'practice' | 'tests';
export const EDITORS: Record<EditorName, { label: string; category: string }> = {
    code: { label: 'Code', category: 'Program' },
    steps: { label: 'Steps', category: 'Program' },
    output: { label: 'Output', category: 'Run' },
    compiler: { label: 'Compiler & Input', category: 'Run' },
    about: { label: 'About', category: 'Learn' },
    practice: { label: 'Practice', category: 'Learn' },
    tests: { label: 'Test cases', category: 'Learn' }
};
/** A lesson is About, Practice (the options, the description and the buttons), Code (the program you work on) and Test cases. Steps, Output and
    Compiler & Input belong to the Code visualizer, which is the only place that runs code step by step. */
export const allowedEditors = (isLesson: boolean, hasPractice = false): EditorName[] => (isLesson ? (['about', ...(hasPractice ? ['practice', 'code', 'tests'] : [])] as EditorName[]) : ['code', 'steps', 'output', 'compiler']);

/* ---------- Code ---------- */
export function CodeEditor() {
    const c = useDsa();
    const gut = useRef<HTMLDivElement>(null), hl = useRef<HTMLDivElement>(null);
    const ta = useRef<HTMLTextAreaElement>(null), sel = useRef<[number, number] | null>(null);
    useLayoutEffect(() => { if (sel.current && ta.current) { ta.current.setSelectionRange(sel.current[0], sel.current[1]); sel.current = null; } });   // put the cursor back after a Tab or Enter edit
    /* Tab indents, Shift+Tab outdents, Enter keeps the indentation (Escape, then Tab, moves the focus on for keyboard users) */
    const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') { e.currentTarget.dataset.free = '1'; return; }
        if (e.key === 'Tab' && e.currentTarget.dataset.free) { delete e.currentTarget.dataset.free; return; }
        const t = e.currentTarget, r = editKey(t.value, t.selectionStart, t.selectionEnd, e.key, e.shiftKey, e.ctrlKey || e.metaKey || e.altKey);
        if (!r) return;
        e.preventDefault();
        sel.current = [r.start, r.end];
        c.onEdit(r.value);
    };
    /* The code is always editable, like the Code panel of a lesson. The line being run is lit behind the text. Once the code has been
       changed, the lit lines would no longer match it, so they are hidden until Run is pressed again. */
    const fresh = !!c.run && c.run.src === c.source;
    const lit: { n: number; kind: string }[] = [];
    if (fresh) {
        if (c.compileErr && c.compileErr.line) lit.push({ n: c.compileErr.line, kind: 'err' });
        else {
            c.callLines.forEach(n => lit.push({ n, kind: 'call' }));
            if (c.step) lit.push({ n: c.step.line, kind: c.step.error ? 'err' : 'cur' });
        }
    }
    const focus = lit.length ? lit[lit.length - 1].n : 0;
    useEffect(() => {      // keep the line being run in view
        const t = ta.current;
        if (!t || !focus) return;
        const lh = parseFloat(getComputedStyle(t).lineHeight) || 20, top = (focus - 1) * lh;
        if (top < t.scrollTop) t.scrollTop = Math.max(0, top - lh);
        else if (top + lh * 2 > t.scrollTop + t.clientHeight) t.scrollTop = top + lh * 2 - t.clientHeight;
    }, [c.idx, c.run, focus]);
    const onScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        const st = e.currentTarget.scrollTop;
        if (gut.current) gut.current.scrollTop = st;
        if (hl.current) hl.current.style.transform = 'translateY(' + -st + 'px)';
    };
    return (
        <div className="edroot dleft-in">
            <div className="dtabs">
                <span className="ftab">{c.cur.label}{c.edited ? ' •' : ''}</span>
                <span className="dsp" />
                {!fresh && <span className="muted small">changed: press Run</span>}
                {c.edited && <button type="button" className="btn small" onClick={c.reset}>Reset</button>}
            </div>
            <div className="edwrap">
                <div className="hlayer" aria-hidden="true"><div ref={hl}>{lit.map((l, i) => <i key={i} className={'hl ' + l.kind} style={{ '--ln': l.n - 1 } as React.CSSProperties} />)}</div></div>
                <div className="edgut" ref={gut} aria-hidden="true">{c.source.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div>
                <textarea ref={ta} className="srcedit" spellCheck={false} wrap="off" value={c.source} onChange={e => c.onEdit(e.target.value)} onKeyDown={onKey}
                    onScroll={onScroll} aria-label="C source code" />
            </div>
        </div>
    );
}

/* ---------- Steps: the explanation, the call stack and the heap (one scrolling picture, so the arrows always stay with the boxes) ---------- */
export function StepsEditor() {
    const c = useDsa();
    const root = useRef<HTMLElement>(null);
    useEffect(() => {      // swipe on touch screens
        const box = root.current;
        if (!box) return;
        let x0 = 0, y0 = 0;
        const ts = (e: TouchEvent) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
        const te = (e: TouchEvent) => {
            const t = e.target as Element;
            if (t.closest && t.closest('textarea, .codeview, .dviz')) return;
            const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
            const N = c.nav.current;
            if (N && Math.abs(dx) > 70 && Math.abs(dy) < 50) N.go(N.idx + (dx < 0 ? 1 : -1));
        };
        box.addEventListener('touchstart', ts, { passive: true }); box.addEventListener('touchend', te, { passive: true });
        return () => { box.removeEventListener('touchstart', ts); box.removeEventListener('touchend', te); };
    }, [c.nav]);
    const { step } = c;
    return (
        <section className="dright edroot" ref={root}>
            {c.compileErr ? (
                <div className="dstep"><h2><span className="n bad">!</span>The code does not compile</h2><p>Line <b>{c.compileErr.line}</b>: {c.compileErr.message}</p><p className="muted">Fix it in the editor, then press Run.</p></div>
            ) : step ? (
                <>
                    <div className="dstep">
                        <h2><span className="n" key={step.n}>{step.n}</span>{step.title}</h2>
                        <div className="dexp" dangerouslySetInnerHTML={{ __html: step.html }} />
                        {step.formula.length > 0 && <div className="dform">{step.formula.map((p, i) => <span key={i} className={p.k ? 'fp ' + p.k : ''}>{p.t}</span>)}</div>}
                    </div>
                    <DsaViz snap={step.snap} prev={c.prev} usesHeap={c.usesHeap} />
                    <div className="dleg"><span><i className="r" />read from</span><span><i className="w" />written to</span><span><i className="p" />pointer</span><span><i className="y" />running now</span></div>
                </>
            ) : <div className="dstep"><p className="muted">Nothing to show yet. Press Run.</p></div>}
        </section>
    );
}

/* ---------- the step bar: it sits under the whole workspace, like the header sits above it ---------- */
export function StepBar() {
    const c = useDsa();
    const { step, idx, last, steps, go } = c;
    return (
        <nav className="bar dbar" aria-label="Steps">
            <button className="btn nav first" type="button" aria-label="First step" title="First step" disabled={idx === 0} onClick={() => go(0)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.5 6l-6 6 6 6M18.5 6l-6 6 6 6" /></svg></button>
            <button className="btn nav back" type="button" aria-label="Previous step" title="Previous step" disabled={idx === 0} onClick={() => go(idx - 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
            <span className="prog" aria-live="polite">{steps.length ? 'Step ' + (Math.min(idx, last) + 1) + ' of ' + steps.length + (step ? ' · line ' + step.line : '') : 'No steps'}</span>
            <button className="btn nav primary dnext next" type="button" aria-label="Next step" title="Next step" disabled={idx >= last} onClick={() => go(idx + 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
            <button className="btn nav last" type="button" aria-label="Last step" title="Last step" disabled={idx >= last} onClick={() => go(last)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 6l6 6-6 6M12.5 6l6 6-6 6" /></svg></button>
        </nav>
    );
}

/* ---------- Output ---------- */
export function OutputEditor() {
    const c = useDsa();
    const { step, compileErr } = c;
    return (
        <pre className="dout edroot"><span className="muted">$ cc {c.cur.id.replace(/-/g, '_')} -o run (in your browser, offline)</span>{'\n'}{c.statusOk ? <span className="good">✓ compiled</span> : <span className="bad">✗ not compiled</span>}{step && !compileErr ? '\n' + (step.kind === 'end' ? 'program finished' : 'paused at line ' + step.line + ' (step ' + step.n + ')') + '\n' : '\n'}{c.outText}<span className="caret">▌</span></pre>
    );
}

/* ---------- Compiler and Input ---------- */
export function CompilerEditor() {
    const c = useDsa();
    const [tab, setTab] = useState<'cc' | 'in'>('cc');
    return (
        <div className="edroot">
            <div className="dtabs small">
                <button type="button" className={tab === 'cc' ? 'on' : ''} onClick={() => setTab('cc')}>Compiler</button>
                <button type="button" className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>Input</button>
            </div>
            {tab === 'cc'
                ? <pre className="dout">{c.compileErr ? <span className="bad">line {c.compileErr.line}: error: {c.compileErr.message}</span> : <span className="good">0 errors. The program is run by Unpacked&apos;s own C interpreter (a large part of C: structs, pointers, malloc, loops, functions). Unsupported things are reported as errors with the line.</span>}</pre>
                : <textarea className="dout inin" placeholder="Text for scanf / getchar goes here, then press Run" value={c.sess.input} onChange={e => c.setSess(s => ({ ...s, input: e.target.value }))} aria-label="Program input" />}
        </div>
    );
}

/* ---------- About (lessons only) ---------- */
export function AboutEditor() {
    const { def, practice, wide, openTests, aboutTab: tab, setAboutTab: setTab } = useDsa();
    if (!def) return <div className="dout about edroot"><p className="muted">About is shown for the lessons. The Code visualizer runs your own code.</p></div>;
    const text = (
        <>
            <p dangerouslySetInnerHTML={{ __html: def.intro }} />
            <h5>Key ideas</h5>
            <ul>{def.ideas.map((x, i) => <li key={i} dangerouslySetInnerHTML={{ __html: x }} />)}</ul>
        </>
    );
    if (!practice) return <div className="dout about edroot">{text}</div>;
    if (wide) return <div className="dout about edroot">{text}</div>;     // on a wide screen Practice, Code and Test cases are panels of their own
    return (
        <div className="edroot abwrap">
            <div className="dtabs small">
                <button type="button" className={tab === 'about' ? 'on' : ''} onClick={() => setTab('about')}>About</button>
                <button type="button" className={tab === 'practice' ? 'on' : ''} onClick={() => setTab('practice')}>Practice</button>
            </div>
            {tab === 'about' ? <div className="dout about edroot">{text}</div> : <PracticePane p={practice} onCheck={openTests} />}
        </div>
    );
}

/** the Practice panel: the options, the description of the chosen one, and the buttons at the very bottom */
export function PracticeEditor() {
    const { practice, wide, openTests } = useDsa();
    if (!practice) return <div className="dout edroot"><p className="muted">Practice is shown for the lessons that have exercises.</p></div>;
    if (!wide) return <PracticePane p={practice} onCheck={openTests} />;
    return (
        <div className="edroot abwrap">
            <div className="dout about edroot"><PracticeStart p={practice} /></div>
            <div className="pfoot"><PracticeButtons p={practice} onCheck={openTests} /></div>
        </div>
    );
}

/** the Code panel: in a lesson it is the program of the chosen practice, in the same editor as the Code visualizer */
export function LessonCode() {
    const { practice, openTests } = useDsa();
    if (!practice) return <div className="dout edroot"><p className="muted">Code is shown for the lessons that have practice.</p></div>;
    return <PracticeCode p={practice} onCheck={openTests} />;
}

export function TestsEditor() {
    const { practice, openTests } = useDsa();
    return <TestsPanel p={practice} onCheck={openTests} />;
}

function CodeOrLesson() { return useDsa().def ? <LessonCode /> : <CodeEditor />; }

export function renderEditor(name: string) {
    switch (name) {
        case 'code': return <CodeOrLesson />;
        case 'steps': return <StepsEditor />;
        case 'output': return <OutputEditor />;
        case 'compiler': return <CompilerEditor />;
        case 'about': return <AboutEditor />;
        case 'practice': return <PracticeEditor />;
        case 'tests': return <TestsEditor />;
        default: return null;
    }
}
