/* The editors a panel can show on the DSA lesson page and the Code visualizer. Each one reads what it needs from the
   lesson through a context, so the same editor can be open in more than one panel (splitting copies it). */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Snapshot, Trace } from '../../lib/c/machine';
import { runC } from '../../lib/c/machine';
import type { DsaLessonDef, Snippet } from './lessons';
import { DsaViz } from './DsaViz';
import { PracticeButtons, PracticeCode, PracticePane, PracticeStart, TestsPanel, type PracticeApi } from './Practice';
import { editKey } from '../../lib/codeEdit';
import { highlightC } from '../../lib/codeHighlight';
import { FileTabsBar } from '../../components/FileTabsBar';

export interface Session { file: string; idx: number; edits: Record<string, string>; input: string; eof?: boolean; files?: { id: string; label: string }[] }
/** where each file starts in the one program that is run: lines start+1 ... start+count belong to the file */
export interface FileSpan { id: string; label: string; start: number; count: number }
export type Run = ReturnType<typeof runC> & { src: string; map: FileSpan[] };

export interface DsaCtxValue {
    def: DsaLessonDef | null;
    cur: Snippet;
    sess: Session; setSess: Dispatch<SetStateAction<Session>>;
    /** the Code visualizer's files (tabs) */
    tabs: { id: string; label: string }[]; pickFile: (id: string) => void; addFile: () => void; closeFile: (id: string) => void; renameFile: (id: string, label: string) => void;
    /** the whole program that is run (all the files together); shown = the text of the open file */
    source: string; shown: string; at: (line: number) => FileSpan | undefined; label: (line: number) => string; edited: boolean; onEdit: (v: string) => void; reset: () => void;
    editing: boolean; setEditing: Dispatch<SetStateAction<boolean>>;
    run: Run | null; trace: Trace | undefined; steps: Trace['steps']; step: Trace['steps'][number] | undefined;
    compileErr: { line?: number; message?: string } | null; statusOk: boolean;
    idx: number; last: number; go: (i: number) => void; prev: Snapshot | null; usesHeap: boolean;
    lines: string[]; callLines: number[]; outText: string;
    nav: RefObject<{ go: (i: number) => void; idx: number; last: number }>;
    /** the program is waiting for input (scanf / getchar): send a typed line, end the input (Ctrl+D), or forget all the input given so far */
    waiting: boolean; sendInput: (text: string) => void; endInput: () => void; clearInput: () => void;
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
    compiler: { label: 'Compiler', category: 'Run' },
    about: { label: 'About', category: 'Learn' },
    practice: { label: 'Practice', category: 'Learn' },
    tests: { label: 'Test cases', category: 'Learn' }
};
/** A lesson is About, Practice (the options, the description and the buttons), Code (the program you work on) and Test cases. Steps, Output and
    Compiler belong to the Code visualizer, which is the only place that runs code step by step. */
export const allowedEditors = (isLesson: boolean, hasPractice = false): EditorName[] => (isLesson ? (['about', ...(hasPractice ? ['practice', 'code', 'tests'] : [])] as EditorName[]) : ['code', 'steps', 'output', 'compiler']);

/* ---------- Code ---------- */
export function CodeEditor() {
    const c = useDsa();
    const gut = useRef<HTMLDivElement>(null), hl = useRef<HTMLDivElement>(null);
    const ta = useRef<HTMLTextAreaElement>(null), sel = useRef<[number, number] | null>(null), syn = useRef<HTMLDivElement>(null);
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
        /* a line of the whole program is lit here only when it is in the open file */
        const loc = (n: number) => { const m = c.at(n); return m ? (m.id === c.sess.file ? n - m.start : 0) : n; };
        const add = (n: number, kind: string) => { const l = loc(n); if (l > 0) lit.push({ n: l, kind }); };
        if (c.compileErr && c.compileErr.line) add(c.compileErr.line, 'err');
        else {
            c.callLines.forEach(n => add(n, 'call'));
            if (c.step) add(c.step.line, c.step.error ? 'err' : 'cur');
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
        if (syn.current) syn.current.style.transform = 'translate(' + -e.currentTarget.scrollLeft + 'px,' + -st + 'px)';
    };
    return (
        <div className="edroot dleft-in">
            <div className={'dtabs' + (c.def ? '' : ' hasfiles')}>
                {c.def ? <span className="ftab">{c.cur.label}{c.edited ? ' •' : ''}</span> : <FileTabs />}
                <span className="dsp" />
                {!fresh && <span className="muted small">changed: press Run</span>}
                {c.edited && <button type="button" className="btn small" onClick={c.reset}>Reset</button>}
            </div>
            <div className="edwrap">
                <div className="hlayer" aria-hidden="true"><div ref={hl}>{lit.map((l, i) => <i key={i} className={'hl ' + l.kind} style={{ '--ln': l.n - 1 } as React.CSSProperties} />)}</div></div>
                <div className="edgut" ref={gut} aria-hidden="true">{c.shown.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div>
                <div className="srcwrap">
                    <div className="synlayer" aria-hidden="true"><div ref={syn} dangerouslySetInnerHTML={{ __html: highlightC(c.shown) }} /></div>
                    <textarea ref={ta} className="srcedit" spellCheck={false} wrap="off" value={c.shown} onChange={e => c.onEdit(e.target.value)} onKeyDown={onKey}
                        onScroll={onScroll} aria-label="C source code" />
                </div>
            </div>
        </div>
    );
}

function FileTabs() {
    const c = useDsa();
    return <FileTabsBar tabs={c.tabs} active={c.sess.file} edited={c.edited} onPick={c.pickFile} onAdd={c.addFile} onClose={c.closeFile} onRename={c.renameFile} />;
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
                <div className="dstep"><h2><span className="n bad">!</span>The code does not compile</h2><p><b>{c.label(c.compileErr.line ?? 0).replace(/^l/, 'L')}</b>: {c.compileErr.message}</p><p className="muted">Fix it in the editor, then press Run.</p></div>
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
            <span className="prog" aria-live="polite">{steps.length ? 'Step ' + (Math.min(idx, last) + 1) + ' of ' + steps.length + (step ? ' · ' + c.label(step.line) : '') : 'No steps'}</span>
            <button className="btn nav primary dnext next" type="button" aria-label="Next step" title="Next step" disabled={idx >= last} onClick={() => go(idx + 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
            <button className="btn nav last" type="button" aria-label="Last step" title="Last step" disabled={idx >= last} onClick={() => go(last)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 6l6 6-6 6M12.5 6l6 6-6 6" /></svg></button>
        </nav>
    );
}

/* ---------- Output ---------- */
export function OutputEditor() {
    const c = useDsa();
    const { step, compileErr } = c;
    const [line, setLine] = useState('');
    const box = useRef<HTMLInputElement>(null);
    const ask = c.waiting && c.idx >= c.last;      // the program is stopped at a scanf and you are looking at that step
    useEffect(() => { if (ask) box.current?.focus(); }, [ask, c.steps.length]);
    const send = () => { c.sendInput(line); setLine(''); };
    return (
        <div className="edroot outwrap">
        <pre className="dout edroot" onClick={() => { if (ask && !window.getSelection()?.toString()) box.current?.focus(); }}><span className="muted">$ cc {c.cur.id.replace(/-/g, '_')} -o run (in your browser, offline)</span>{'\n'}{c.statusOk ? <span className="good">✓ compiled</span> : <span className="bad">✗ not compiled</span>}{step && !compileErr ? '\n' + (step.kind === 'end' ? 'program finished' : 'paused at ' + c.label(step.line) + ' (step ' + step.n + ')') + '\n' : '\n'}{c.outText}{ask
            ? <input ref={box} className="inl" value={line} size={Math.max(1, line.length + 1)} onChange={e => setLine(e.target.value)} aria-label="Input for scanf" autoComplete="off" spellCheck={false}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } else if (e.key === 'd' && e.ctrlKey) { e.preventDefault(); c.endInput(); } }} />
            : <span className="caret">▌</span>}</pre>
        {ask && <div className="stdin note"><span className="muted">Type the input right here and press Enter.</span><button type="button" className="btn small" onClick={c.endInput} title="End of input (Ctrl+D): scanf then returns EOF">End input</button></div>}
        {!ask && c.sess.input && !c.def && <div className="stdin note"><span className="muted">The input given so far is used again each time you press Run.</span><button type="button" className="btn small" onClick={c.clearInput}>Clear input</button></div>}
        </div>
    );
}

/* ---------- Compiler and Input ---------- */
export function CompilerEditor() {
    const c = useDsa();
    return (
        <div className="edroot">
            {true
                ? <pre className="dout">{c.compileErr ? <span className="bad">{c.label(c.compileErr.line ?? 0)}: error: {c.compileErr.message}</span> : <span className="good">0 errors. The program is run by Unpacked&apos;s own C interpreter (a large part of C: structs, pointers, malloc, loops, functions). Unsupported things are reported as errors with the line.</span>}</pre>
                : null}
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
