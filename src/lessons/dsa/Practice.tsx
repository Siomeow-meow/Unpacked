/* Practice for a lesson. The state (which exercise, your code, the last Check) lives in usePractice(), so the Practice tab
   (the problem and the code) and the Test cases panel can be two separate panels that show the same thing. The learner's
   code and what they have solved are saved in this browser, per lesson. */
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { openVisualizer } from '../../home/data';
import { store } from '../../lib/storage';
import { editKey } from '../../lib/codeEdit';
import { highlightC } from '../../lib/codeHighlight';
import { FileTabsBar, cleanFileName, nextFileName, type FileTab } from '../../components/FileTabsBar';
import { checkExercise, type CheckResult, type Exercise } from './exercises';

/* files: the extra files of each exercise (main.c is the one Check runs). The code of file f of exercise e is saved in code[e + '/' + f]. */
interface Saved { code: Record<string, string>; done: Record<string, boolean>; files: Record<string, FileTab[]> }
const MAIN = 'main';
/* v3: the practices read their input with scanf and have several test cases, so what was saved for the older versions is not reused */
const key = (lesson: string) => 'unpacked:practice:' + lesson + ':v3';
const load = (lesson: string): Saved => {
    const s = store.get<Partial<Saved> | null>(key(lesson), null);
    return { code: s && s.code && typeof s.code === 'object' ? s.code : {}, done: s && s.done && typeof s.done === 'object' ? s.done : {}, files: s && s.files && typeof s.files === 'object' ? s.files : {} };
};

export interface PracticeApi {
    lesson: string; list: Exercise[]; ex: Exercise; cur: number; code: string; solved: number; done: Record<string, boolean>;
    result: CheckResult | null; asking: boolean;
    /** the files (tabs) of this exercise, the open one and its code. `code` above is always main.c, the file Check runs. */
    tabs: FileTab[]; file: string; fcode: string; edited: boolean;
    /** the files other than main.c, with their code (Visualize runs them together with main.c) */
    others: { label: string; src: string }[];
    setFcode: (v: string) => void; pickFile: (id: string) => void; addFile: () => void; closeFile: (id: string) => void; renameFile: (id: string, label: string) => void;
    pick: (i: number) => void; setCode: (v: string) => void; check: () => CheckResult;
    startAgain: () => void; showSolution: () => void; confirmSolution: (yes: boolean) => void;
}

/** null when the lesson has no exercises */
export function usePractice(lesson: string, list: Exercise[] | undefined): PracticeApi | null {
    const [saved, setSaved] = useState(() => load(lesson));
    const [cur, setCur] = useState(0);
    const [result, setResult] = useState<CheckResult | null>(null);
    const [sel, setSel] = useState<Record<string, string>>({});   // the open file of each exercise
    const [asking, setAsking] = useState(false);   // "Replace your code with the solution?", asked in the page and not in a browser pop-up
    const ex = list && list[Math.min(cur, list.length - 1)];
    const solved = useMemo(() => (list || []).filter(e => saved.done[e.id]).length, [list, saved.done]);
    if (!list || !ex) return null;
    const code = saved.code[ex.id] ?? ex.starter;
    const tabs: FileTab[] = saved.files[ex.id] && saved.files[ex.id].length ? saved.files[ex.id] : [{ id: MAIN, label: 'main.c' }];
    const file = tabs.some(t => t.id === sel[ex.id]) ? sel[ex.id] : MAIN;
    const NEW_SRC = '#include <stdio.h>\n\n// This file only runs when main.c has the line:  #include "NAME"\n// (with this file name). Only one file has main().\n';
    const fcode = file === MAIN ? code : saved.code[ex.id + '/' + file] ?? NEW_SRC;

    const update = (fn: (s: Saved) => Saved) => setSaved(s => { const n = fn(s); store.set(key(lesson), n); return n; });
    const setCode = (v: string) => { update(s => ({ ...s, code: { ...s.code, [ex.id]: v } })); setResult(null); };
    return {
        lesson, list, ex, cur, code, solved, done: saved.done, result, asking,
        tabs, file, fcode,
        others: tabs.filter(t => t.id !== MAIN).map(t => ({ label: t.label, src: saved.code[ex.id + '/' + t.id] ?? NEW_SRC })),
        edited: file === MAIN ? code !== ex.starter : fcode !== NEW_SRC,
        setFcode: v => { if (file === MAIN) setCode(v); else update(s => ({ ...s, code: { ...s.code, [ex.id + '/' + file]: v } })); },
        pickFile: id => setSel(m => ({ ...m, [ex.id]: id })),
        addFile: () => {
            const id = 'f' + Date.now().toString(36);
            update(s => ({ ...s, files: { ...s.files, [ex.id]: [...tabs, { id, label: nextFileName(tabs) }] } }));
            setSel(m => ({ ...m, [ex.id]: id }));
        },
        closeFile: id => {
            if (id === MAIN || tabs.length <= 1) return;
            if (saved.code[ex.id + '/' + id] !== undefined && saved.code[ex.id + '/' + id] !== NEW_SRC && !window.confirm('Close this file? Its code will be lost.')) return;
            update(s => { const c = { ...s.code }; delete c[ex.id + '/' + id]; return { ...s, code: c, files: { ...s.files, [ex.id]: tabs.filter(t => t.id !== id) } }; });
            setSel(m => ({ ...m, [ex.id]: MAIN }));
        },
        renameFile: (id, name) => {
            const v = cleanFileName(name);
            if (!v || tabs.some(t => t.id !== id && t.label === v)) return;
            update(s => ({ ...s, files: { ...s.files, [ex.id]: tabs.map(t => t.id === id ? { ...t, label: v } : t) } }));
        },
        pick: i => { setCur(i); setResult(null); setAsking(false); },
        setCode,
        check: () => {
            const r = checkExercise(ex, code);
            setResult(r);
            if (!r.compileError && r.passed === r.results.length) update(s => ({ ...s, done: { ...s.done, [ex.id]: true } }));
            return r;
        },
        /* Reset: only the problem you are on goes back to the start (its code, its result and its solved mark); the others stay as they are */
        startAgain: () => {
            update(s => { const code = { ...s.code }, done = { ...s.done }, files = { ...s.files }; Object.keys(code).forEach(k => { if (k.startsWith(ex.id + '/')) delete code[k]; }); delete code[ex.id]; delete done[ex.id]; delete files[ex.id]; return { ...s, code, done, files }; });
            setSel(m => ({ ...m, [ex.id]: MAIN }));
            setResult(null); setAsking(false);
        },
        /* Show solution: the whole program goes into the Code panel (asking first when you have changed the code) */
        showSolution: () => { if (code === ex.starter || code === ex.solution) { setCode(ex.solution); setAsking(false); } else setAsking(true); },
        confirmSolution: yes => { if (yes) setCode(ex.solution); setAsking(false); }
    };
}

/* ---------- small pieces shared by the layouts ---------- */
/** Tab indents, Enter keeps the indentation, Ctrl+Enter checks (Escape, then Tab, moves the focus on for keyboard users) */
function useCodeKeys(p: PracticeApi, check: () => void) {
    const ta = useRef<HTMLTextAreaElement>(null);
    const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') { e.currentTarget.dataset.free = '1'; return; }
        if (e.key === 'Tab' && e.currentTarget.dataset.free) { delete e.currentTarget.dataset.free; return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); check(); return; }
        const t = e.currentTarget, r = editKey(t.value, t.selectionStart, t.selectionEnd, e.key, e.shiftKey, e.ctrlKey || e.metaKey || e.altKey);
        if (!r) return;
        e.preventDefault();
        p.setFcode(r.value);
        requestAnimationFrame(() => ta.current?.setSelectionRange(r.start, r.end));
    };
    return { ta, onKey };
}

/** the exercises of the lesson as options */
function Chips({ p }: { p: PracticeApi }) {
    return (
        <div className="pchips" role="tablist" aria-label="Practice">
            {p.list.map((e, i) => (
                <button key={e.id} type="button" role="tab" aria-selected={i === p.cur} aria-label={(i + 1) + '. ' + e.title + (p.done[e.id] ? ' (solved)' : '')} title={e.title} className={'pchip' + (i === p.cur ? ' on' : '') + (p.done[e.id] ? ' done' : '')} onClick={() => p.pick(i)}>
                    {i + 1}
                </button>
            ))}
        </div>
    );
}

/** "Replace your code with the solution?", asked in the page and not in a browser pop-up */
function Ask({ p }: { p: PracticeApi }) {
    if (!p.asking) return null;
    return (
        <div className="pask" role="alertdialog" aria-label="Replace your code with the solution?">
            <span>Replace your code with the solution?</span>
            <button type="button" className="btn small" autoFocus onClick={() => p.confirmSolution(true)}>Replace</button>
            <button type="button" className="btn small" onClick={() => p.confirmSolution(false)}>Keep mine</button>
        </div>
    );
}

/** Check, Visualize, Show solution, Reset */
export function PracticeButtons({ p, onCheck }: { p: PracticeApi; onCheck: () => void }) {
    const nav = useNavigate();
    const { ex } = p;
    return (
        <div className="pbtns">
            <button type="button" className="btn primary small" onClick={() => { p.check(); onCheck(); }}>Check</button>
            <button type="button" className="btn small" title="Open this code in the Code visualizer and step through it" onClick={() => { openVisualizer(p.code, p.others); nav('/dsa/visualizer', { state: { from: '/dsa/' + p.lesson } }); }}>Visualize</button>
            <button type="button" className="btn small" onClick={p.showSolution}>Show solution</button>
            <button type="button" className="btn small" onClick={p.startAgain} disabled={p.code === ex.starter && !p.done[ex.id] && !p.result} title="Start this problem again: its code, its result and its green mark">Reset</button>
        </div>
    );
}

/* ---------- wide screen, in the About panel: "Start Practice" with the options and the description of the chosen one ---------- */
export function PracticeStart({ p }: { p: PracticeApi }) {
    return (
        <section className="pstart">
            <h5>Practice <span className="pcount">{p.solved} of {p.list.length} solved</span></h5>
            <Chips p={p} />
            <h6 className="ptitle">{p.cur + 1}. {p.ex.title}</h6>
            <div className="pprompt" dangerouslySetInnerHTML={{ __html: p.ex.prompt }} />
            <Ask p={p} />
        </section>
    );
}

/** the files of the exercise; main.c is the one Check runs, so it cannot be closed */
function PracticeTabs({ p }: { p: PracticeApi }) {
    return <FileTabsBar tabs={p.tabs} active={p.file} edited={p.edited} keep={MAIN} onPick={p.pickFile} onAdd={p.addFile} onClose={p.closeFile} onRename={p.renameFile} />;
}

/* ---------- wide screen, the Practice panel: all of it is the code, like the Code panel (but no Reset and no Edit code) ---------- */
export function PracticeCode({ p, onCheck }: { p: PracticeApi; onCheck: () => void }) {
    const gut = useRef<HTMLDivElement>(null), syn = useRef<HTMLDivElement>(null);
    const { ta, onKey } = useCodeKeys(p, () => { p.check(); onCheck(); });
    return (
        <div className="edroot dleft-in">
            <div className="dtabs hasfiles"><PracticeTabs p={p} /></div>
            <div className="edwrap">
                <div className="edgut" ref={gut} aria-hidden="true">{p.fcode.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div>
                <div className="srcwrap">
                    <div className="synlayer" aria-hidden="true"><div ref={syn} dangerouslySetInnerHTML={{ __html: highlightC(p.fcode) }} /></div>
                    <textarea ref={ta} className="srcedit" spellCheck={false} wrap="off" value={p.fcode} onChange={e => p.setFcode(e.target.value)} onKeyDown={onKey}
                        onScroll={e => { const t = e.currentTarget; if (gut.current) gut.current.scrollTop = t.scrollTop; if (syn.current) syn.current.style.transform = 'translate(' + -t.scrollLeft + 'px,' + -t.scrollTop + 'px)'; }} aria-label={'Your code for ' + p.ex.title} />
                </div>
            </div>
        </div>
    );
}

/* ---------- phone, the Practice tab: the options, the description, your code and the buttons in one scrolling page ---------- */
export function PracticePane({ p, onCheck }: { p: PracticeApi; onCheck: () => void }) {
    const { ex, result } = p;
    const { ta, onKey } = useCodeKeys(p, () => { p.check(); onCheck(); });
    return (
        <div className="dout practice edroot">
            <div className="pchips-row"><Chips p={p} /><span className="pcount">{p.solved} of {p.list.length} solved</span></div>
            <h6 className="ptitle">{p.cur + 1}. {ex.title}</h6>
            <div className="pprompt" dangerouslySetInnerHTML={{ __html: ex.prompt }} />
            <div className="dtabs hasfiles ptabs"><PracticeTabs p={p} /></div>
            <textarea ref={ta} className="pedit" spellCheck={false} wrap="off" value={p.fcode} onChange={e => p.setFcode(e.target.value)} onKeyDown={onKey} aria-label={'Your code for ' + ex.title} />
            <PracticeButtons p={p} onCheck={onCheck} />
            <Ask p={p} />
            {result && <TestResults p={p} />}
        </div>
    );
}

/* ---------- the results as a list (on a phone, inside the Practice tab) ---------- */
function TestResults({ p }: { p: PracticeApi }) {
    const { result } = p;
    if (!result) return null;
    const all = !result.compileError && result.passed === result.results.length;
    return (
        <div className="presult" role="status">
            {result.compileError ? <p className="bad">It does not compile. {result.compileError}</p> : (
                <>
                    <p className={all ? 'good' : 'bad'}><b>{all ? 'The output is right. Well done!' : 'The output is not what it should be'}</b></p>
                    {result.results.map((t, i) => (
                        <div key={i} className="prow">
                            <div className="prl">Test case {i + 1}{t.input ? ' · input: ' + t.input : ''}</div>
                            <div className="prl">Expected</div>{out(t.expect || '(nothing)')}
                            <div className="prl">Your output</div>{out(t.got || '(nothing)', !t.ok)}
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

/** a value as a small code box; several lines become a block */
const out = (v: string, bad = false) => (v.trimEnd().includes('\n') ? <pre className={'tcpre' + (bad ? ' bad' : '')}>{v.trimEnd()}</pre> : <code className={bad ? 'bad' : ''}>{v.trimEnd()}</code>);

/* ---------- the Test cases panel: every test as a card, like an online judge ---------- */
export function TestsPanel({ p, onCheck }: { p: PracticeApi | null; onCheck: () => void }) {
    if (!p) return <div className="dout edroot"><p className="muted">Test cases are shown for lessons with Practice. Open the Practice tab, write your code and press Check.</p></div>;
    const { ex, result } = p;
    const ran = !!result && !result.compileError;
    const pass = ran && result.passed === result.results.length;
    return (
        <div className="dout tcases edroot">
            {result?.compileError && <p className="bad tcerr">It does not compile. {result.compileError}</p>}
            {pass && <p className="good tcwin">The output is right. Well done!</p>}
            <ol className="tclist">
                {ex.tests.map((t, i) => {
                    const r = ran ? result.results[i] : undefined;
                    const state = r ? (r.ok ? 'pass' : 'fail') : 'idle';
                    return (
                        <li key={i} className={'tc ' + state}>
                            <div className="tctop"><span className="tcn">Test case {i + 1}</span>{r && <span className={'tcbadge ' + state}>{r.ok ? '✓ Passed' : '✗ Failed'}</span>}</div>
                            <dl>
                                <dt>Input</dt><dd>{t.input ? <code>{t.input}</code> : <span className="muted">(none: the program does not read anything)</span>}</dd>
                                <dt>Expected</dt><dd>{out(t.expect || '(nothing)')}</dd>
                                {r && <><dt>Your output</dt><dd>{out(r.got || '(nothing)', !r.ok)}</dd></>}
                            </dl>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
