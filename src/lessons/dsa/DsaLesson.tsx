/* A Data Structures & Algorithms lesson (and the Code visualizer): run C code one statement at a time and watch the call
   stack and the heap. The C code is run by our own small interpreter (src/lib/c), in the browser, offline.
   On a wide screen the page is a splittable workspace of panels (src/lessons/dsa/workspace); on a phone it keeps the
   Steps / Code tabs. The call stack and the heap are drawn inside the Steps panel as one scrolling picture, so the pointer
   arrows always stay with the boxes they connect. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Select } from '../../components/Select';
import { nextLessonOf } from '../../subjects';
import { runC, type Trace } from '../../lib/c/machine';
import { KEYS, recordProgress, store } from '../../lib/storage';
import { practiceFor } from './exercises';
import { usePractice } from './Practice';
import { openBeside } from '../../lib/layout';
import { PLAYGROUND_ID, PLAYGROUND_STARTER, dsaLesson, type Snippet } from './lessons';
import {
    AboutEditor, CodeEditor, CompilerEditor, DsaCtx, EDITORS, OutputEditor, StepBar, StepsEditor, allowedEditors, renderEditor,
    type DsaCtxValue, type EditorName, type Run, type Session
} from './DsaEditors';
import { Workspace } from './workspace/Workspace';
import { useWorkspace } from './workspace/useWorkspace';

const PLAY_FILE: Snippet = { id: 'playground.c', label: 'Your code', src: PLAYGROUND_STARTER, about: '', watch: [] };
const loadSession = (lessonId: string, files: Snippet[]): Session => {
    const s = store.get<Partial<Session> | null>(KEYS.lesson(lessonId), null);
    const file = s && s.file && files.some(f => f.id === s.file) ? s.file : files[0].id;
    return { file, idx: s?.idx || 0, edits: s?.edits && typeof s.edits === 'object' ? s.edits : {}, input: s?.input || '' };
};

/** true on a window wide enough for the splittable workspace */
function useWide(): boolean {
    const q = '(min-width: 901px)';
    const [w, setW] = useState(() => (window.matchMedia ? window.matchMedia(q).matches : true));
    useEffect(() => {
        if (!window.matchMedia) return;
        const m = window.matchMedia(q), f = () => setW(m.matches);
        m.addEventListener('change', f);
        return () => m.removeEventListener('change', f);
    }, []);
    return w;
}

export default function DsaLesson({ lessonId }: { lessonId: string }) {
    const def = lessonId === PLAYGROUND_ID ? null : dsaLesson(lessonId) ?? null;
    const files: Snippet[] = def ? def.snippets : [PLAY_FILE];
    const [sess, setSess] = useState(() => loadSession(lessonId, files));
    const cur = files.find(f => f.id === sess.file) || files[0];
    const original = cur.src;
    const source = sess.edits[sess.file] ?? original;
    const [run, setRun] = useState<Run | null>(null);
    const [idx, setIdx] = useState(sess.idx);
    const [editing, setEditing] = useState(false);
    const [pane, setPane] = useState<'steps' | 'code'>('steps');
    const [btab, setBtab] = useState<'about' | 'out' | 'cc'>(def ? 'about' : 'out');
    const wide = useWide();
    const back = (useLocation().state as { from?: string } | null)?.from;   // Visualize from a lesson's Practice comes back to that lesson
    const allowed = useMemo(() => allowedEditors(!!def, !!def), [def]);
    const HEAP = /\b(malloc|calloc|realloc)\s*\(/;
    const ws = useWorkspace('dsa:' + lessonId, allowed);
    const [aboutTab, setAboutTab] = useState<'about' | 'practice'>('about');
    const practice = usePractice(lessonId, def ? practiceFor(def.id) : undefined);
    /* after Check, bring the Test cases panel back if it was closed (to the right of the code), so the results are always in view */
    const openTests = useCallback(() => { if (wide) ws.apply(t => openBeside(t, 'tests', 'code', 'horizontal', 0.62) || openBeside(t, 'tests', 'practice', 'vertical', 0.62)); }, [wide, ws.apply]);

    const from = useRef(-9);      // where the last Next/Back started: only a single step forward is animated
    /** `resume`: the lesson was just opened. One that was left at its very last step starts again from step 1. */
    const doRun = useCallback((src: string, keep?: number, resume = false) => {
        const r = runC(src, { input: sess.input });
        setRun({ ...r, src });
        const n = r.trace ? r.trace.steps.length : 0;
        from.current = -9;
        const start = resume && keep !== undefined && n > 1 && keep >= n - 1 ? 0 : keep;
        setIdx(i => Math.max(0, Math.min(start ?? i, n - 1)));
        setEditing(false);
    }, [sess.input]);
    // first run, and a run whenever another file is chosen
    useEffect(() => { if (!def) doRun(source, sess.idx, true); }, [sess.file]);   // eslint-disable-line react-hooks/exhaustive-deps

    const trace: Trace | undefined = run?.trace;
    const steps = trace?.steps || [];
    const step = steps[Math.min(idx, steps.length - 1)];
    const last = steps.length - 1;

    /* save where you are */
    useEffect(() => { store.set(KEYS.lesson(lessonId), { file: sess.file, idx, edits: sess.edits, input: sess.input } satisfies Session); }, [sess, idx]);
    /* a lesson counts as opened, and its progress is the exercises solved */
    const solvedN = practice ? practice.solved : 0, totalN = practice ? practice.list.length : 1;
    useEffect(() => { if (def) recordProgress(lessonId, Math.min(solvedN, totalN), totalN); }, [solvedN, totalN]);   // eslint-disable-line react-hooks/exhaustive-deps

    const go = (i: number) => { from.current = idx; setIdx(Math.max(0, Math.min(i, last))); };
    const fwd = idx === from.current + 1;
    const nav = useRef({ go, idx, last, editing });
    nav.current = { go, idx, last, editing };
    useEffect(() => {
        const k = (e: KeyboardEvent) => {
            const N = nav.current, el = document.activeElement;
            const typing = !!el && /INPUT|TEXTAREA|SELECT/.test(el.tagName);
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (document.querySelector('textarea.srcedit')) document.getElementById('runBtn')?.click(); return; }
            if (typing || N.editing || document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === 'ArrowRight') N.go(N.idx + 1);
            else if (e.key === 'ArrowLeft') N.go(N.idx - 1);
            else if (e.key === 'Home') N.go(0);
            else if (e.key === 'End') N.go(N.last);
        };
        document.addEventListener('keydown', k);
        return () => document.removeEventListener('keydown', k);
    }, []);

    const lines = useMemo(() => (run ? run.src : source).split('\n'), [run, source]);
    const callLines = step ? step.snap.frames.slice(1).map(f => f.line) : [];
    const compileErr = run && !run.compile.ok ? run.compile : null;
    const edited = sess.edits[sess.file] !== undefined && sess.edits[sess.file] !== original;
    const outText = trace && step ? trace.output.slice(0, step.outLen) : '';
    const statusOk = run ? run.compile.ok : true;

    const setFile = (id: string) => { setIdx(0); setSess(s => ({ ...s, file: id, idx: 0 })); setPane('steps'); };
    const onEdit = (v: string) => setSess(s => ({ ...s, edits: { ...s.edits, [s.file]: v } }));
    const reset = () => { setSess(s => { const e = { ...s.edits }; delete e[s.file]; return { ...s, edits: e }; }); doRun(original, 0); };

    const ctx: DsaCtxValue = {
        def, cur, sess, setSess, source, edited, onEdit, reset, editing, setEditing, run, trace, steps, step, compileErr, statusOk,
        idx, last, go, prev: fwd && idx > 0 ? steps[idx - 1].snap : null, usesHeap: HEAP.test(source), lines, callLines, outText, nav, practice, wide, openTests, aboutTab, setAboutTab
    };
    const next = nextLessonOf(lessonId);
    const options = allowed.map(n => ({ name: n, label: EDITORS[n].label, category: EDITORS[n].category }));

    return (
        <DsaCtx.Provider value={ctx}>
            <div className={'app dsa' + (def ? ' lessononly' : '')}>
                <header className="dh">
                    <div className="dh1">
                        <Link to={!def && back ? back : '/dsa'} className="btn nav backarrow" aria-label={!def && back ? 'Back to the lesson' : 'Back to the lessons'} title={!def && back ? 'Back to the lesson' : 'Back to the lessons'}>
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                        </Link>
                        <h1>{def ? def.title : 'Code visualizer'}</h1>
                    </div>
                    <div className="dh2">
                        {!def && <span className={'dstat' + (statusOk ? ' ok' : ' bad')}><i />{statusOk ? 'Compiled · 0 errors' : '1 error'}</span>}
                        {!def && files.length > 1 && <Select value={sess.file} ariaLabel="Code snippet" options={files.map(f => ({ value: f.id, label: f.label }))} onChange={setFile} />}
                        {wide && (
                            <span className="lbtns" role="group" aria-label="Panel layout">
                                <button type="button" className="btn small" onClick={ws.reset} title="Put the panels back as they were at the start">Reset layout</button>
                            </span>
                        )}
                        {!def && <button type="button" id="runBtn" className="btn runbtn" onClick={() => doRun(source, 0)}>▶ Run</button>}
                        {next && <Link to={next.route} className="btn nextlesson" title={'Next lesson: ' + next.name}>Next lesson →</Link>}
                    </div>
                </header>

                {def && !wide ? (
                    <main className="dmain ws-main"><section className="dleft"><AboutEditor /></section></main>
                ) : wide ? (
                    <main className="dmain ws-main">
                        <Workspace ws={ws} options={options} render={name => renderEditor(name)} />
                    </main>
                ) : (
                    <>
                        <div className="dpanes" role="tablist" aria-label="View">
                            <button type="button" className="tab" aria-selected={pane === 'steps'} onClick={() => setPane('steps')}>Steps</button>
                            <button type="button" className="tab" aria-selected={pane === 'code'} onClick={() => setPane('code')}>Code</button>
                        </div>
                        <main className={'dmain pane-' + pane}>
                            <section className="dleft">
                                <CodeEditor />
                                <div className={'dbottom' + (btab === 'about' ? ' tall' : '')}>
                                    <div className="dtabs small">
                                        {(def ? ['about', 'out', 'cc'] as const : ['out', 'cc'] as const).map(t => <button key={t} type="button" className={btab === t ? 'on' : ''} onClick={() => setBtab(t)}>{t === 'about' ? 'About' : t === 'out' ? 'Output' : 'Compiler & Input'}</button>)}
                                    </div>
                                    {btab === 'about' && def ? <AboutEditor /> : btab === 'cc' ? <CompilerEditor /> : <OutputEditor />}
                                </div>
                            </section>
                            <StepsEditor />
                        </main>
                    </>
                )}
                {!def && <footer className="dfoot"><StepBar /></footer>}
            </div>
        </DsaCtx.Provider>
    );
}

export type { EditorName };
