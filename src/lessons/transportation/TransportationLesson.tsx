/* Lesson 3: Transportation Problem (minimize cost). Provides the solver, the cost-grid form and the grid viz;
   everything else is the shared lesson shell. */
import { useMemo } from 'react';
import { parseFr } from '../../lib/simplex/solver';
import { MAX_SIDE, solveTransport, type TransProblem, type TransStep } from '../../lib/transportation/solver';
import { clamp, clone } from '../../lib/util';
import { ExamplesList, SavedProblems } from '../../components/SavedProblems';
import { LessonShell } from '../../components/LessonShell';
import { StepCard } from '../../components/StepCard';
import { simpleTableHtml } from '../../components/simpleTable';
import { useLesson, type LessonConfig } from '../../components/useLesson';
import type { Chip } from '../../components/SummaryChips';
import { findLesson } from '../registry';
import { transportAdapter } from './adapter';
import { TRANS_EXAMPLES, type TransExampleKey } from './examples';
import { tMetrics, transportTableHtml } from './table';

const validProblem = (p: unknown): p is TransProblem => {
    const x = p as TransProblem | null;
    return !!x && Array.isArray(x.sources) && Array.isArray(x.dests) && Array.isArray(x.cost) && (x.method === 'nwc' || x.method === 'lc')
        && x.sources.length >= 1 && x.dests.length >= 1 && x.cost.length === x.sources.length && x.cost.every(r => Array.isArray(r) && r.length === x.dests.length);
};

const CONFIG: LessonConfig<TransProblem, TransStep> = {
    id: 'transportation',
    defaultProblem: () => clone(TRANS_EXAMPLES.nwc),
    solve: p => solveTransport(p),
    isProblem: validProblem,
    normalize: p => { if (!p.cur && p.cur !== '') p.cur = '₱'; return p; },
    invalidKeys: P => {
        const b: string[] = [];
        P.sources.forEach((s, i) => { if (!parseFr(s.supply)) b.push('sup:' + i); P.cost[i].forEach((x, j) => { if (!parseFr(x)) b.push('cost:' + i + ':' + j); }); });
        P.dests.forEach((d, j) => { if (!parseFr(d.demand)) b.push('dem:' + j); });
        return b;
    },
    demo: q => { const d = q.get('demo') as TransExampleKey | null; return d && TRANS_EXAMPLES[d] ? clone(TRANS_EXAMPLES[d]) : null; }
};

/* ---------- tab 3: every table reached so far ---------- */
function AllTables({ steps, idx, width }: { steps: TransStep[]; idx: number; width: number }) {
    const html = useMemo(() => {
        const latest = new Map<string, number>();
        for (let i = 0; i <= idx; i++) if (steps[i].gallery && (steps[i].table || steps[i].answer)) latest.set(steps[i].gallery as string, i);
        const W = clamp(Math.floor(width - 12), 240, 760);
        let h = '';
        Array.from(latest.values()).sort((a, b) => a - b).forEach(i => {
            const s = steps[i];
            h += '<div class="atw"><div class="tlabel">' + (s.gallery as string).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>';
            if (s.final && s.answer) h += '<div class="gt2">' + simpleTableHtml({ head: s.answer.head, rows: s.answer.rows, foot: s.answer.foot }, 0, W, 220) + '</div>';
            else if (s.table) {
                const t = { ...s.table, flags: {}, sign: {}, loop: undefined, left: undefined, tc: s.table.tc, grayR: [], grayC: [], index: undefined };
                h += transportTableHtml(t, 0, tMetrics(t, W, Math.min(320, 40 * (t.rows.length + 3))));
            }
            h += '</div>';
        });
        return h || '<p class="hint">No table yet. Press Next in the steps to get started.</p>';
    }, [steps, idx, width]);
    return <div className="all" id="allTables" dangerouslySetInnerHTML={{ __html: html }} />;
}

const nextName = (used: string[], prefix: string, letters: boolean): string => {
    if (letters) for (let c = 65; c <= 90; c++) { const n = String.fromCharCode(c); if (!used.includes(n)) return n; }
    for (let k = used.length + 1; k < 99; k++) if (!used.includes(prefix + k)) return prefix + k;
    return prefix + (used.length + 1);
};

export default function TransportationLesson() {
    const L = useLesson(CONFIG);
    const { P, edit, bad } = L;
    const meta = findLesson('qm', 'transportation')!;
    const m = P.sources.length, n = P.dests.length;
    const sp = L.solvedP;
    const chips: Chip[] = sp ? [
        { text: (sp.method === 'nwc' ? 'Northwest Corner' : 'Least Cost') + ' + MODI', obj: true },
        { text: 'Supply ' + sp.sources.map(s => s.name + ' ' + s.supply).join(' · ') },
        { text: 'Demand ' + sp.dests.map(d => d.name + ' ' + d.demand).join(' · ') }
    ] : [];

    const problem = (
        <div className="grid">
            <section className="card" id="setup">
                <div className="row between">
                    <h2>Your problem</h2>
                    <div className="seg" role="radiogroup" aria-label="Starting method">
                        <label><input type="radio" name="method" value="nwc" checked={P.method === 'nwc'} onChange={() => edit(p => { p.method = 'nwc'; })} /> <span>Northwest Corner</span></label>
                        <label><input type="radio" name="method" value="lc" checked={P.method === 'lc'} onChange={() => edit(p => { p.method = 'lc'; })} /> <span>Least Cost</span></label>
                    </div>
                </div>

                <div className="scroll">
                    <table id="form" className="tform">
                        <tbody>
                            <tr>
                                <th className="lbl" title="Cost per unit">Cost</th>
                                {P.dests.map((d, j) => (
                                    <th key={j}><input className="nm" value={d.name} aria-label={'Destination ' + (j + 1) + ' name'}
                                        onChange={e => edit(p => { p.dests[j].name = e.target.value; })} /></th>
                                ))}
                                <th className="lbl">Supply</th>
                            </tr>
                            {P.sources.map((s, i) => (
                                <tr key={i}>
                                    <td><input className="nm" value={s.name} aria-label={'Source ' + (i + 1) + ' name'}
                                        onChange={e => edit(p => { p.sources[i].name = e.target.value; })} /></td>
                                    {P.cost[i].map((x, j) => (
                                        <td key={j}><input className={'num' + (bad.has('cost:' + i + ':' + j) ? ' bad' : '')} inputMode="decimal" value={x}
                                            aria-label={'Cost from ' + s.name + ' to ' + P.dests[j].name}
                                            onChange={e => edit(p => { p.cost[i][j] = e.target.value; }, 'cost:' + i + ':' + j)} /></td>
                                    ))}
                                    <td><input className={'num sup' + (bad.has('sup:' + i) ? ' bad' : '')} inputMode="decimal" value={s.supply} aria-label={'Supply of ' + s.name}
                                        onChange={e => edit(p => { p.sources[i].supply = e.target.value; }, 'sup:' + i)} /></td>
                                </tr>
                            ))}
                            <tr>
                                <th className="lbl">Demand</th>
                                {P.dests.map((d, j) => (
                                    <td key={j}><input className={'num sup' + (bad.has('dem:' + j) ? ' bad' : '')} inputMode="decimal" value={d.demand} aria-label={'Demand of ' + d.name}
                                        onChange={e => edit(p => { p.dests[j].demand = e.target.value; }, 'dem:' + j)} /></td>
                                ))}
                                <td />
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="row wrap gap">
                    <button className="btn small" id="addSrc" disabled={m >= MAX_SIDE} onClick={() => edit(p => { p.sources.push({ name: nextName(p.sources.map(s => s.name), 'S', true), supply: '0' }); p.cost.push(p.dests.map(() => '0')); })}>+ Source</button>
                    <button className="btn small" id="delSrc" disabled={m <= 1} onClick={() => edit(p => { p.sources.pop(); p.cost.pop(); })}>− Source</button>
                    <button className="btn small" id="addDst" disabled={n >= MAX_SIDE} onClick={() => edit(p => { p.dests.push({ name: nextName(p.dests.map(d => d.name), 'D', false), demand: '0' }); p.cost.forEach(r => r.push('0')); })}>+ Destination</button>
                    <button className="btn small" id="delDst" disabled={n <= 1} onClick={() => edit(p => { p.dests.pop(); p.cost.forEach(r => r.pop()); })}>− Destination</button>
                    <label className="cur">Currency <input id="cur" maxLength={3} value={P.cur || ''} onChange={e => edit(p => { p.cur = e.target.value; })} /></label>
                </div>
                <p className="hint" id="modeHint">{P.method === 'nwc'
                    ? 'Northwest Corner starts at the top-left cell and ignores costs. MODI then improves it until the total cost is lowest.'
                    : 'Least Cost starts with the cheapest cells (Dummy last). MODI then improves it until the total cost is lowest.'}</p>

                <p className="error" id="err" role="alert">{L.err}</p>
            </section>

            <section className="card" id="saves">
                <ExamplesList
                    items={[
                        { key: 'nwc', name: 'Northwest Corner (Dummy column)', meta: 'NW' },
                        { key: 'lc', name: 'Least Cost (Dummy column)', meta: 'LC' },
                        { key: 'balanced', name: 'Already balanced', meta: 'LC' },
                        { key: 'dummyrow', name: 'Demand bigger (Dummy row)', meta: 'NW' }
                    ]}
                    onLoad={k => L.loadProblem(TRANS_EXAMPLES[k as TransExampleKey])} />
                <SavedProblems<TransProblem> lesson="transportation" problem={P} isValid={validProblem} fileName="transportation-problems.json"
                    meta={p => (p.method === 'nwc' ? 'NW Corner' : 'Least Cost')} onLoad={q => L.loadProblem(CONFIG.normalize!(q))} onError={L.setErr} />
            </section>
        </div>
    );

    return (
        <LessonShell L={L} subjectId="qm" meta={meta} problem={problem} chips={chips}
            stage={<StepCard ref={L.stage} steps={L.steps} idx={L.idx} dir={L.dir} adapter={transportAdapter} active={L.tab === 2} hidden={!L.has} flow />}
            all={<AllTables steps={L.steps} idx={L.idx} width={L.w3} />} />
    );
}
