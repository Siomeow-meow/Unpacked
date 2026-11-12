/* Lesson 1: Graphical Method (2 variables, Max or Min). Provides the solver, the problem form and the SVG graph;
   everything else is the shared lesson shell. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { parseFr } from '../../lib/simplex/solver';
import { LINE_COLORS, MAX_CONS, solveGraphical, type GraphPoint, type GraphProblem, type GraphStep } from '../../lib/graphical/solver';
import { clamp, clone } from '../../lib/util';
import { Select } from '../../components/Select';
import { ExamplesList, SavedProblems } from '../../components/SavedProblems';
import { LessonShell } from '../../components/LessonShell';
import { StepCard } from '../../components/StepCard';
import { useLesson, type LessonConfig } from '../../components/useLesson';
import type { Chip } from '../../components/SummaryChips';
import { findLesson } from '../registry';
import { graphSvg } from './graph';
import { graphicalAdapter, graphTableHtml } from './adapter';
import { GRAPH_EXAMPLES, type GraphExampleKey } from './examples';

const validProblem = (p: unknown): p is GraphProblem => {
    const x = p as GraphProblem | null;
    return !!x && Array.isArray(x.vars) && x.vars.length === 2 && Array.isArray(x.cons) && (x.mode === 'max' || x.mode === 'min')
        && x.cons.every(c => c && Array.isArray(c.a) && c.a.length === 2);
};

const CONFIG: LessonConfig<GraphProblem, GraphStep> = {
    id: 'graphical',
    defaultProblem: () => clone(GRAPH_EXAMPLES.max),
    solve: p => solveGraphical(p),
    isProblem: validProblem,
    thirdHasSteps: false,
    normalize: p => { if (!p.cur && p.cur !== '') p.cur = '₱'; if (!p.obj) p.obj = 'Z'; p.cons.forEach(c => { if (!c.tp) c.tp = ['0', '0']; }); return p; },
    invalidKeys: P => {
        const b: string[] = [];
        P.vars.forEach((v, j) => { if (!parseFr(v.c)) b.push('c:' + j); });
        P.cons.forEach((c, i) => {
            c.a.forEach((x, j) => { if (!parseFr(x)) b.push('a:' + i + ':' + j); });
            if (!parseFr(c.b)) b.push('b:' + i);
            (c.tp || []).forEach((x, j) => { if (String(x).trim() !== '' && !parseFr(x)) b.push('t:' + i + ':' + j); });
        });
        return b;
    },
    demo: q => { const d = q.get('demo') as GraphExampleKey | null; return d && GRAPH_EXAMPLES[d] ? clone(GRAPH_EXAMPLES[d]) : null; }
};

function fmtTerms(list: { c: string; name: string }[]): string {
    let out = '';
    list.forEach(t => {
        const f = parseFr(t.c);
        if (!f) { out += (out ? ' + ' : '') + t.c + t.name; return; }
        const s = String(f);
        if (s === '0') return;
        const neg = s[0] === '-', abs = neg ? s.slice(1) : s;
        const coef = abs === '1' ? '' : abs;
        out += out === '' ? (neg ? '-' : '') + coef + t.name : (neg ? ' - ' : ' + ') + coef + t.name;
    });
    return out || '0';
}
const SYM = { '<=': '≤', '>=': '≥', '=': '=' } as const;

/* ---------- tab 3: the final graph + test points. Every point is checked against its constraint as you type, and drawn on the graph ---------- */
type Pt2 = [string, string];
const OPS = { '<=': (c: number) => c <= 0, '>=': (c: number) => c >= 0, '=': (c: number) => c === 0 } as const;
function checkPoint(k: GraphProblem['cons'][number], x: string, y: string): { sub: string; lhs: string; cmp: '<' | '>' | '='; ok: boolean } | null {
    const vx = x.trim() === '' ? '0' : x.trim(), vy = y.trim() === '' ? '0' : y.trim();
    const fx = parseFr(vx), fy = parseFr(vy), a0 = parseFr(k.a[0]), a1 = parseFr(k.a[1]), b = parseFr(k.b);
    if (!fx || !fy || !a0 || !a1 || !b) return null;
    const lhs = a0.mul(fx).add(a1.mul(fy));
    const c = lhs.cmp(b);
    /* "4(30) + 3(80)": every coefficient with the point's value put in */
    const term = (co: typeof a0, fv: typeof fx) => String(co) + '(' + String(fv) + ')';
    const second = term(a1, fy);
    return { sub: term(a0, fx) + (second.startsWith('-') ? ' - ' + second.slice(1) : ' + ' + second), lhs: String(lhs), cmp: c < 0 ? '<' : c > 0 ? '>' : '=', ok: OPS[k.op](c) };
}
const MAX_POINTS = 6;
const num = (f: { n: bigint; d: bigint }) => Number(f.n) / Number(f.d);

function FinalGraph({ L }: { L: ReturnType<typeof useLesson<GraphProblem, GraphStep>> }) {
    const { solvedP, steps, w3, h3 } = L;
    const sp = solvedP as GraphProblem;
    const read = (p: GraphProblem): Pt2[][] => p.cons.map(c => [(c.tp || ['0', '0']), ...(c.more || [])].map(q => [q[0], q[1]] as Pt2));
    const [pts, setPts] = useState<Pt2[][]>(() => read(sp));
    const [msg, setMsg] = useState('');
    const card = useRef<HTMLElement>(null);
    const [tpH, setTpH] = useState(260);
    useLayoutEffect(() => { if (card.current) setTpH(card.current.offsetHeight); });   // the graph gets the height that is left under the test points
    useEffect(() => { setPts(read(sp)); }, [sp]);   // eslint-disable-line react-hooks/exhaustive-deps
    const names = sp.vars.map(v => v.name);
    const copy = (a: Pt2[][]) => a.map(r => r.map(q => [q[0], q[1]] as Pt2));

    /* every change is checked and the steps are redone with it (the first point of a constraint is the one used in the steps) */
    const apply = (next: Pt2[][]) => {
        setPts(next);
        if (next.some(r => r.some(q => q.some(x => x.trim() !== '' && !parseFr(x))))) { setMsg('A test point must be numbers.'); return; }
        setMsg('');
        const p = clone(sp);
        p.cons.forEach((c, k) => { c.tp = [next[k][0][0], next[k][0][1]]; c.more = next[k].slice(1).map(q => [q[0], q[1]] as Pt2); });
        L.edit(q => { q.cons = clone(p.cons); });
        L.start(p, L.idx, true);
    };
    const setPt = (i: number, n: number, j: number, v: string) => { const next = copy(pts); next[i][n][j] = v; apply(next); };
    const addPt = (i: number) => { const next = copy(pts); next[i].push(['', '']); apply(next); };
    const delPt = (i: number, n: number) => { const next = copy(pts); next[i].splice(n, 1); apply(next); };

    /* the finished picture: the best-corner step (or the last step that has a graph), plus every test point */
    const fin = steps.find(s => s.title === 'Best corner') || [...steps].reverse().find(s => s.graph);
    const marks: GraphPoint[] = [];
    pts.forEach((row, i) => row.forEach(q => {
        const r = checkPoint(sp.cons[i], q[0], q[1]);
        const fx = parseFr(q[0].trim() === '' ? '0' : q[0]), fy = parseFr(q[1].trim() === '' ? '0' : q[1]);
        if (r && fx && fy) marks.push({ x: num(fx), y: num(fy), kind: 'test', ok: r.ok, label: '(' + String(Math.round(num(fx) * 100) / 100) + ', ' + String(Math.round(num(fy) * 100) / 100) + ')' });
    }));
    const spec = fin && fin.graph
        ? { ...fin.graph, focusLine: undefined, focusShade: undefined, points: fin.graph.points.filter(p => p.kind === 'corner' || p.kind === 'best').concat(marks), guides: fin.graph.points.some(p => p.kind === 'best') }
        : null;

    const wide = w3 >= 760;
    const side = wide ? clamp(Math.min(h3 - 8, w3 - 380), 160, 760) : clamp(Math.min(w3 - 8, h3 - tpH - 14), 150, 640);
    return (
        <div className={'final3' + (wide ? ' wide' : '')}>
            <section className="card tp3" ref={card}>
                <h2>Test points</h2>
                {sp.cons.map((c, i) => (
                    <div className="tpc" key={i}>
                        <div className="tph"><i style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />Test {i + 1}: {fmtTerms(c.a.map((a, j) => ({ c: a, name: names[j] })))} {SYM[c.op]} {c.b}</div>
                        {pts[i]?.map((q, n) => {
                            const r = checkPoint(c, q[0], q[1]);
                            return (
                                <div className="tpr" key={n}>
                                    <div className="tpin">
                                        <span className="lbl">Test:</span>
                                        <span>(</span>
                                        {[0, 1].map(j => (
                                            <span key={j} className="tpi">
                                                <input className="num" inputMode="decimal" placeholder="0" value={q[j]} aria-label={'Constraint ' + (i + 1) + ' point ' + (n + 1) + ' ' + names[j]}
                                                    onChange={e => setPt(i, n, j, e.target.value)} />{j === 0 && <span>,</span>}
                                            </span>
                                        ))}
                                        <span>)</span>
                                        {r && <span className={'verdict ' + (r.ok ? 'good' : 'bad')}>{r.ok ? '✓ satisfied' : '✗ not satisfied'}</span>}
                                    </div>
                                    {r ? (
                                        <div className="eqrow"><div className="eq">{r.sub} = {r.lhs} {r.cmp} {c.b}</div>
                                            {n > 0 && <button className="btn small x" type="button" aria-label="Remove this point" onClick={() => delPt(i, n)}>✕</button>}</div>
                                    ) : <div className="eq bad">Enter numbers</div>}
                                </div>
                            );
                        })}
                        <button className="btn small" type="button" disabled={(pts[i]?.length || 0) >= MAX_POINTS} onClick={() => addPt(i)}>+ Test point</button>
                    </div>
                ))}
                <p className="error" role="alert">{msg || L.err}</p>
            </section>
            {spec && <div className="g3" dangerouslySetInnerHTML={{ __html: graphSvg(spec, side, side) }} />}
        </div>
    );
}

export default function GraphicalLesson() {
    const L = useLesson(CONFIG);
    const { P, edit, bad } = L;
    const meta = findLesson('qm', 'graphical')!;
    const [X, Y] = P.vars;

    const setMode = (mode: 'max' | 'min') => {
        if (P.mode === mode) return;
        edit(p => { p.cons.forEach(c => { if (c.op === '<=') c.op = '>='; else if (c.op === '>=') c.op = '<='; }); p.mode = mode; });
    };
    const sp = L.solvedP;
    const chips: Chip[] = sp ? [
        { text: (sp.mode === 'max' ? 'Max' : 'Min') + ' ' + (sp.obj || 'Z') + ' = ' + fmtTerms(sp.vars.map(v => ({ c: v.c, name: v.name }))), obj: true },
        ...sp.cons.map(c => {
            const rhs = parseFr(c.b);
            return { text: fmtTerms(c.a.map((a, j) => ({ c: a, name: sp.vars[j].name }))) + ' ' + SYM[c.op] + ' ' + (rhs ? String(rhs) : c.b) };
        })
    ] : [];

    const problem = (
        <div className="grid">
            <section className="card" id="setup">
                <div className="row between">
                    <h2>Your problem</h2>
                    <div className="seg" role="radiogroup" aria-label="Procedure">
                        <label><input type="radio" name="mode" value="max" checked={P.mode === 'max'} onChange={() => setMode('max')} /> <span>Max Procedure</span></label>
                        <label><input type="radio" name="mode" value="min" checked={P.mode === 'min'} onChange={() => setMode('min')} /> <span>Min Procedure</span></label>
                    </div>
                </div>

                <div className="scroll">
                    <table id="form">
                        <tbody>
                            <tr>
                                <th />
                                {P.vars.map((v, j) => (
                                    <th key={j}><input className="nm" value={v.name} aria-label={'Variable ' + (j + 1) + ' name'}
                                        onChange={e => edit(p => { p.vars[j].name = e.target.value; })} /></th>
                                ))}
                                <th /><th />
                            </tr>
                            <tr>
                                <td className="lbl">{P.mode === 'max' ? 'Maximize' : 'Minimize'} {P.obj || 'Z'}</td>
                                {P.vars.map((v, j) => (
                                    <td key={j}><input className={'num' + (bad.has('c:' + j) ? ' bad' : '')} inputMode="decimal" value={v.c} aria-label={'Objective coefficient ' + (j + 1)}
                                        onChange={e => edit(p => { p.vars[j].c = e.target.value; }, 'c:' + j)} /></td>
                                ))}
                                <td /><td />
                            </tr>
                            {P.cons.map((c, i) => (
                                <tr key={i}>
                                    <td className="lbl">Constraint {i + 1}</td>
                                    {c.a.map((x, j) => (
                                        <td key={j}><input className={'num' + (bad.has('a:' + i + ':' + j) ? ' bad' : '')} inputMode="decimal" value={x} aria-label={'Constraint ' + (i + 1) + ' coefficient ' + (j + 1)}
                                            onChange={e => edit(p => { p.cons[i].a[j] = e.target.value; }, 'a:' + i + ':' + j)} /></td>
                                    ))}
                                    <td>
                                        <Select value={c.op} ariaLabel={'Constraint ' + (i + 1) + ' type'}
                                            options={[{ value: '<=', label: '≤' }, { value: '>=', label: '≥' }, { value: '=', label: '=' }]}
                                            onChange={v => edit(p => { p.cons[i].op = v as GraphProblem['cons'][number]['op']; })} />
                                    </td>
                                    <td><input className={'num' + (bad.has('b:' + i) ? ' bad' : '')} inputMode="decimal" value={c.b} aria-label={'Constraint ' + (i + 1) + ' right-hand side'}
                                        onChange={e => edit(p => { p.cons[i].b = e.target.value; }, 'b:' + i)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="row wrap gap">
                    <button className="btn small" id="addCon" disabled={P.cons.length >= MAX_CONS} onClick={() => edit(p => { p.cons.push({ a: ['0', '0'], op: p.mode === 'min' ? '>=' : '<=', b: '0', tp: ['0', '0'] }); })}>+ Constraint</button>
                    <button className="btn small" id="delCon" disabled={P.cons.length <= 1} onClick={() => edit(p => { p.cons.pop(); })}>− Constraint</button>
                    <label className="cur">Objective <input id="objName" maxLength={4} value={P.obj || ''} onChange={e => edit(p => { p.obj = e.target.value; })} /></label>
                    <label className="cur nomargin">Currency <input id="cur" maxLength={3} value={P.cur || ''} onChange={e => edit(p => { p.cur = e.target.value; })} /></label>
                </div>
                <p className="hint" id="modeHint">{P.mode === 'max'
                    ? 'Max: we look for the corner of the feasible region with the highest value. Tip: ≤ constraints usually mean limited resources.'
                    : 'Min: we look for the corner of the feasible region with the lowest value. Tip: ≥ constraints usually mean minimum requirements.'}</p>

                <p className="error" id="err" role="alert">{L.err}</p>
            </section>

            <section className="card" id="saves">
                <ExamplesList
                    items={[
                        { key: 'max', name: 'Max: Default', meta: 'Max' },
                        { key: 'min', name: 'Min: Default', meta: 'Min' },
                        { key: 'empty', name: 'No feasible region', meta: 'Max' },
                        { key: 'unbounded', name: 'Unbounded region', meta: 'Max' }
                    ]}
                    onLoad={k => L.loadProblem(GRAPH_EXAMPLES[k as GraphExampleKey])} />
                <SavedProblems<GraphProblem> lesson="graphical" problem={P} isValid={validProblem} fileName="graphical-problems.json"
                    meta={p => (p.mode === 'max' ? 'Max' : 'Min')} onLoad={q => L.loadProblem(CONFIG.normalize!(q))} onError={L.setErr} />
            </section>
        </div>
    );

    return (
        <LessonShell L={L} subjectId="qm" meta={meta} problem={problem} chips={chips}
            stage={<StepCard ref={L.stage} steps={L.steps} idx={L.idx} dir={L.dir} adapter={graphicalAdapter} active={L.tab === 2} hidden={!L.has} flow />}
            all={L.solvedP ? <FinalGraph L={L} /> : null} />
    );
}
