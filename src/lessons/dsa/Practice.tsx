/* Practice for a lesson. The state (which exercise, your code, the last Check) lives in usePractice(), so the Practice tab
   (the problem and the code) and the Test cases panel can be two separate panels that show the same thing. The learner's
   code and what they have solved are saved in this browser, per lesson. */
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { openVisualizer } from '../../home/data';
import { store } from '../../lib/storage';
import { editKey } from '../../lib/codeEdit';
import { checkExercise, type CheckResult, type Exercise } from './exercises';

interface Saved { code: Record<string, string>; done: Record<string, boolean> }
/* v2: the practices now have a part taken out, so what was saved for the complete programs is not reused */
const key = (lesson: string) => 'unpacked:practice:' + lesson + ':v2';
const load = (lesson: string): Saved => {
    const s = store.get<Partial<Saved> | null>(key(lesson), null);
    return { code: s && s.code && typeof s.code === 'object' ? s.code : {}, done: s && s.done && typeof s.done === 'object' ? s.done : {} };
};

export interface PracticeApi {
    lesson: string; list: Exercise[]; ex: Exercise; cur: number; code: string; solved: number; done: Record<string, boolean>;
    result: CheckResult | null; asking: boolean;
    pick: (i: number) => void; setCode: (v: string) => void; check: () => CheckResult;
    startAgain: () => void; showSolution: () => void; confirmSolution: (yes: boolean) => void;
}

/** null when the lesson has no exercises */
export function usePractice(lesson: string, list: Exercise[] | undefined): PracticeApi | null {
    const [saved, setSaved] = useState(() => load(lesson));
    const [cur, setCur] = useState(0);
    const [result, setResult] = useState<CheckResult | null>(null);
    const [asking, setAsking] = useState(false);   // "Replace your code with the solution?", asked in the page and not in a browser pop-up
    const ex = list && list[Math.min(cur, list.length - 1)];
    const solved = useMemo(() => (list || []).filter(e => saved.done[e.id]).length, [list, saved.done]);
    if (!list || !ex) return null;
    const code = saved.code[ex.id] ?? ex.starter;

    const update = (fn: (s: Saved) => Saved) => setSaved(s => { const n = fn(s); store.set(key(lesson), n); return n; });
    const setCode = (v: string) => { update(s => ({ ...s, code: { ...s.code, [ex.id]: v } })); setResult(null); };
    return {
        lesson, list, ex, cur, code, solved, done: saved.done, result, asking,
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
            update(s => { const code = { ...s.code }, done = { ...s.done }; delete code[ex.id]; delete done[ex.id]; return { ...s, code, done }; });
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
        p.setCode(r.value);
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
            <button type="button" className="btn small" title="Open this code in the Code visualizer and step through it" onClick={() => { openVisualizer(p.code); nav('/dsa/visualizer', { state: { from: '/dsa/' + p.lesson } }); }}>Visualize</button>
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

/* ---------- wide screen, the Practice panel: all of it is the code, like the Code panel (but no Reset and no Edit code) ---------- */
export function PracticeCode({ p, onCheck }: { p: PracticeApi; onCheck: () => void }) {
    const gut = useRef<HTMLDivElement>(null);
    const { ta, onKey } = useCodeKeys(p, () => { p.check(); onCheck(); });
    return (
        <div className="edroot dleft-in">
            <div className="dtabs"><span className="ftab">main.c{p.code !== p.ex.starter ? ' •' : ''}</span></div>
            <div className="edwrap">
                <div className="edgut" ref={gut} aria-hidden="true">{p.code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div>
                <textarea ref={ta} className="srcedit" spellCheck={false} wrap="off" value={p.code} onChange={e => p.setCode(e.target.value)} onKeyDown={onKey}
                    onScroll={e => { if (gut.current) gut.current.scrollTop = e.currentTarget.scrollTop; }} aria-label={'Your code for ' + p.ex.title} />
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
            <textarea ref={ta} className="pedit" spellCheck={false} wrap="off" value={p.code} onChange={e => p.setCode(e.target.value)} onKeyDown={onKey} aria-label={'Your code for ' + ex.title} />
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
                            <div className="prl">Expected</div>{out(t.expect)}
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
                {[{ expect: ex.expect }].map((t, i) => {
                    const r = ran ? result.results[i] : undefined;
                    const state = r ? (r.ok ? 'pass' : 'fail') : 'idle';
                    return (
                        <li key={i} className={'tc ' + state}>
                            <div className="tctop"><span className="tcn">Test case {i + 1}</span>{r && <span className={'tcbadge ' + state}>{r.ok ? '✓ Passed' : '✗ Failed'}</span>}</div>
                            <dl>
                                <dt>Test</dt><dd>Run the whole program</dd>
                                <dt>Expected</dt><dd>{out(t.expect)}</dd>
                                {r && <><dt>Your output</dt><dd>{out(r.got || '(nothing)', !r.ok)}</dd></>}
                            </dl>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
