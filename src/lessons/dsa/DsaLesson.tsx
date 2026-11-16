/* A Data Structures & Algorithms lesson (and the Code visualizer): run C code one statement at a time and watch the call
   stack and the heap. The C code is run by our own small interpreter (src/lib/c), in the browser, offline.
   On a wide screen the page is a splittable workspace of panels (src/lessons/dsa/workspace); on a phone it keeps the
   Steps / Code tabs. The call stack and the heap are drawn inside the Steps panel as one scrolling picture, so the pointer
   arrows always stay with the boxes they connect. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { nextLessonOf } from '../../subjects';
import { runC, type Trace } from '../../lib/c/machine';
import { KEYS, recordProgress, store } from '../../lib/storage';
import { practiceFor } from './exercises';
import { usePractice } from './Practice';
import { openBeside } from '../../lib/layout';
import { PLAYGROUND_ID, PLAYGROUND_STARTER, dsaLesson, type Snippet } from './lessons';
import {
    AboutEditor, CodeEditor, CompilerEditor, DsaCtx, EDITORS, OutputEditor, StepBar, StepsEditor, allowedEditors, renderEditor,
    type DsaCtxValue, type EditorName, type FileSpan, type Run, type Session
} from './DsaEditors';
import { LineLabelCtx } from './DsaViz';
import { Workspace } from './workspace/Workspace';
import { cleanFileName, nextFileName } from '../../components/FileTabsBar';
import { useWorkspace } from './workspace/useWorkspace';

const MAIN_ID = 'playground.c';
const NEW_FILE_SRC = '#include <stdio.h>\n\n// This file only runs when main.c has the line:  #include "NAME"\n// (with this file name). Only one file has main().\n';
const loadSession = (lessonId: string, snippets: Snippet[] | null): Session => {
    const s = store.get<Partial<Session> | null>(KEYS.lesson(lessonId), null);
    /* the Code visualizer keeps its own list of files; a lesson has its fixed snippets */
    const saved = Array.isArray(s?.files) ? s!.files!.filter(f => f && typeof f.id === 'string' && typeof f.label === 'string') : [];
    const tabs = snippets ? undefined : (saved.length ? saved : [{ id: MAIN_ID, label: 'main.c' }]);
    const ids = snippets ? snippets.map(f => f.id) : tabs!.map(f => f.id);
    const file = s && s.file && ids.includes(s.file) ? s.file : ids[0];
    return { file, idx: s?.idx || 0, edits: s?.edits && typeof s.edits === 'object' ? s.edits : {}, input: s?.input || '', ...(tabs ? { files: tabs } : {}) };
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
    const [sess, setSess] = useState(() => loadSession(lessonId, def ? def.snippets : null));
    const tabs = sess.files ?? [{ id: MAIN_ID, label: 'main.c' }];
    const files: Snippet[] = def ? def.snippets : tabs.map(f => ({ id: f.id, label: f.label, src: f.id === MAIN_ID ? PLAYGROUND_STARTER : NEW_FILE_SRC, about: '', watch: [] }));
    const cur = files.find(f => f.id === sess.file) || files[0];
    const original = cur.src;
    const own = sess.edits[sess.file] ?? original;     // the text of the open file
    /* The Code visualizer runs the first file (main.c) together with the files it asks for with #include "name" (like C does).
       A file that is not included is not part of the program. A line number of the program is turned back into a file and a
       line with the map. A lesson has just the one snippet. */
    const build = (edits: Record<string, string>): { src: string; map: FileSpan[] } => {
        if (def) return { src: edits[cur.id] ?? cur.src, map: [] };
        const order: Snippet[] = [], seen = new Set<string>();
        const visit = (f: Snippet) => {
            if (seen.has(f.id)) return;
            seen.add(f.id);
            const t = edits[f.id] ?? f.src;
            for (const m of t.matchAll(/^[ \t]*#[ \t]*include[ \t]*"([^"\n]+)"/gm)) {
                const dep = files.find(x => x.label === m[1].trim());
                if (dep) visit(dep);
            }
            order.push(f);      // what a file includes comes before it
        };
        visit(files[0]);
        let start = 0; const map: FileSpan[] = [], parts: string[] = [];
        order.forEach(f => { const t = edits[f.id] ?? f.src, count = t.split('\n').length; map.push({ id: f.id, label: f.label, start, count }); parts.push(t); start += count; });
        return { src: parts.join('\n'), map };
    };
    const source = def ? own : build(sess.edits).src;
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
    const doRun = useCallback((b: { src: string; map: FileSpan[] }, keep?: number, resume = false, ov?: { input: string; eof: boolean }) => {
        const r = runC(b.src, { input: ov ? ov.input : sess.input, eof: ov ? ov.eof : !!sess.eof, interactive: true });
        setRun({ ...r, src: b.src, map: b.map });
        const n = r.trace ? r.trace.steps.length : 0;
        from.current = -9;
        const start = resume && keep !== undefined && n > 1 && keep >= n - 1 ? 0 : keep;
        setIdx(i => Math.max(0, Math.min(start ?? i, n - 1)));
        setEditing(false);
    }, [sess.input, sess.eof]);
    // the first run (choosing another file only changes what is shown; Run runs all the files)
    useEffect(() => { if (!def) doRun(build(sess.edits), sess.idx, true); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

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
    const map = run?.map ?? [];
    const at = (line: number) => map.find(m => line > m.start && line <= m.start + m.count);
    const label = (line: number) => { const m = at(line); return m && map.length > 1 ? m.label + ' line ' + (line - m.start) : 'line ' + line; };
    /* stepping into code of another file (or an error in it) opens that file */
    useEffect(() => {
        if (def || map.length < 2 || !run) return;
        const ln = run.compile.ok ? step?.line : (run.compile as { line?: number }).line;
        const m = ln ? at(ln) : undefined;
        if (m && m.id !== sess.file && tabs.some(t => t.id === m.id)) setSess(s => ({ ...s, file: m.id }));
    }, [idx, run]);   // eslint-disable-line react-hooks/exhaustive-deps
    const outText = trace && step ? trace.output.slice(0, step.outLen) : '';
    const statusOk = run ? run.compile.ok : true;

    const setFile = (id: string) => { setIdx(0); setSess(s => ({ ...s, file: id, idx: 0 })); setPane('steps'); };
    /* the program stopped at a scanf: the typed line is added to the input and the program runs again up to there (and on) */
    const sendInput = (text: string) => { const input = sess.input + text + '\n'; setSess(s => ({ ...s, input })); doRun(build(sess.edits), idx, false, { input, eof: !!sess.eof }); };
    const endInput = () => { setSess(s => ({ ...s, eof: true })); doRun(build(sess.edits), idx, false, { input: sess.input, eof: true }); };
    const clearInput = () => { setSess(s => ({ ...s, input: '', eof: false })); doRun(build(sess.edits), 0, false, { input: '', eof: false }); };
    const pickFile = (id: string) => { if (id !== sess.file) setFile(id); };
    const addFile = () => {
        const id = 'f' + Date.now().toString(36);
        setIdx(0); setPane('steps');
        setSess(s => ({ ...s, file: id, idx: 0, files: [...(s.files ?? tabs), { id, label: nextFileName(tabs) }] }));
    };
    const closeFile = (id: string) => {
        if (tabs.length <= 1) return;
        const t = files.find(f => f.id === id);
        const dirty = sess.edits[id] !== undefined && t && sess.edits[id] !== t.src;
        if (dirty && !window.confirm('Close ' + t!.label + '? Its code will be lost.')) return;
        const at = tabs.findIndex(f => f.id === id), rest = tabs.filter(f => f.id !== id);
        setSess(s => {
            const e = { ...s.edits }; delete e[id];
            const file = s.file === id ? rest[Math.min(at, rest.length - 1)].id : s.file;
            return { ...s, file, idx: s.file === id ? 0 : s.idx, edits: e, files: rest };
        });
        if (id === sess.file) setIdx(0);
    };
    const renameFile = (id: string, name: string) => {
        const v = cleanFileName(name);
        if (!v) return;
        if (tabs.some(t => t.id !== id && t.label === v)) return;
        setSess(s => ({ ...s, files: (s.files ?? tabs).map(f => f.id === id ? { ...f, label: v } : f) }));
    };
    const onEdit = (v: string) => setSess(s => ({ ...s, edits: { ...s.edits, [s.file]: v } }));
    const reset = () => { const e = { ...sess.edits }; delete e[sess.file]; setSess(s => ({ ...s, edits: e })); doRun(build(e), 0); };

    const ctx: DsaCtxValue = {
        def, cur, sess, setSess, waiting: !!run?.trace?.waiting, sendInput, endInput, clearInput, tabs, pickFile, addFile, closeFile, renameFile, source, shown: own, at, label, edited, onEdit, reset, editing, setEditing, run, trace, steps, step, compileErr, statusOk,
        idx, last, go, prev: fwd && idx > 0 ? steps[idx - 1].snap : null, usesHeap: HEAP.test(source), lines, callLines, outText, nav, practice, wide, openTests, aboutTab, setAboutTab
    };
    const next = nextLessonOf(lessonId);
    const options = allowed.map(n => ({ name: n, label: EDITORS[n].label, category: EDITORS[n].category }));

    return (
        <DsaCtx.Provider value={ctx}>
            <LineLabelCtx.Provider value={label}>
            <div className={'app dsa' + (def ? ' lessononly' : '')}>
                <header className="dh">
                    <div className="dh1">
                        <Link to={!def && back ? back : '/dsa'} className="btn nav backarrow" aria-label={!def && back ? 'Back to the lesson' : 'Back to the lessons'} title={!def && back ? 'Back to the lesson' : 'Back to the lessons'}>
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                        </Link>
                        <h1>{def ? def.title : 'Code visualizer'}</h1>
                    </div>
                    <div className="dh2">
                        {wide && (
                            <span className="lbtns" role="group" aria-label="Panel layout">
                                <button type="button" className="btn small" onClick={ws.reset} title="Put the panels back as they were at the start">Reset layout</button>
                            </span>
                        )}
                        {!def && <button type="button" id="runBtn" className="btn runbtn" onClick={() => doRun(build(sess.edits), 0)}>▶ Run</button>}
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
                                        {(def ? ['about', 'out', 'cc'] as const : ['out', 'cc'] as const).map(t => <button key={t} type="button" className={btab === t ? 'on' : ''} onClick={() => setBtab(t)}>{t === 'about' ? 'About' : t === 'out' ? 'Output' : 'Compiler'}</button>)}
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
            </LineLabelCtx.Provider>
        </DsaCtx.Provider>
    );
}

export type { EditorName };
