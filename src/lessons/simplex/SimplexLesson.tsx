/* Lesson 2: Simplex Method. Provides the solver, the problem form and the table viz; the shell, step player,
   step card, arrows, chips, examples and saved problems are the shared components. */
import { useMemo } from 'react';
import { buildSteps, parseFr, type SimplexProblem, type SimplexStep } from '../../lib/simplex/solver';
import { clamp, clone, esc } from '../../lib/util';
import { Select } from '../../components/Select';
import { SavedProblems } from '../../components/SavedProblems';
import { LessonShell } from '../../components/LessonShell';
import { StepCard } from '../../components/StepCard';
import { useLesson, type LessonConfig } from '../../components/useLesson';
import type { Chip } from '../../components/SummaryChips';
import { findLesson } from '../registry';
import { SIMPLEX_EXAMPLES, type SimplexExampleKey } from './examples';
import { fitCols, simplexAdapter, tableHtml, textWidthsFor } from './tables';

const validProblem = (p: unknown): p is SimplexProblem => {
    const x = p as SimplexProblem | null;
    return !!x && Array.isArray(x.vars) && Array.isArray(x.cons) && (x.mode === 'max' || x.mode === 'min');
};

const CONFIG: LessonConfig<SimplexProblem, SimplexStep> = {
    id: 'simplex',
    defaultProblem: () => clone(SIMPLEX_EXAMPLES.max),
    solve: p => buildSteps(p),
    isProblem: validProblem,
    normalize: p => { if (!p.cur && p.cur !== '') p.cur = '₱'; return p; },
    invalidKeys: P => {
        const b: string[] = [];
        P.vars.forEach((v, j) => { if (!parseFr(v.c)) b.push('c:' + j); });
        P.cons.forEach((c, i) => {
            c.a.forEach((x, j) => { if (!parseFr(x)) b.push('a:' + i + ':' + j); });
            if (!parseFr(c.b)) b.push('b:' + i);
        });
        return b;
    },
    demo: q => { const d = q.get('demo') as SimplexExampleKey | null; return d && SIMPLEX_EXAMPLES[d] ? clone(SIMPLEX_EXAMPLES[d]) : null; }
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

/* ---------- tab 3: every table reached so far ---------- */
function AllTables({ steps, idx, width }: { steps: SimplexStep[]; idx: number; width: number }) {
    const html = useMemo(() => {
        if (!steps.length) return '';
        const latest: Record<number, SimplexStep['tables'][number]> = {};
        for (let i = 0; i <= idx; i++) {
            const s = steps[i];
            const mm = /^Table (\d+):/.exec(s.title);
            if (!mm || !s.tables.length) continue;
            const k = +mm[1];
            if (s.tables.length === 2) { latest[k - 1] = s.tables[0]; latest[k] = s.tables[1]; }
            else latest[k] = s.tables[0];
        }
        const W = Math.max(240, width - 8);
        const first = steps.find(s => s.tables.length) as SimplexStep;
        const n = first.tables[0].names.length;
        const units = 0.75 + 0.6 + 1 + n + 1.1;
        const u = clamp(Math.floor(W / units), 56, 110);
        const m = fitCols({ u, rowH: 30, side: false, fs: clamp(u / 6.2, 10, 16), px: clamp(u / 10, 4, 10) }, textWidthsFor(steps));
        let h = '';
        Object.keys(latest).map(Number).sort((a, b) => a - b).forEach(k => {
            const t = Object.assign({}, latest[k], { label: '', hl: {} });
            h += '<div class="atw"><div class="tlabel">Table ' + k + '</div>' + tableHtml(t, 0, m) + '</div>';
        });
        return h || '<p class="hint">No table yet. Press Next in the steps to get to Table 1.</p>';
    }, [steps, idx, width]);
    return <div className="all" id="allTables" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function SimplexLesson() {
    const L = useLesson(CONFIG);
    const { P, edit, bad } = L;
    const meta = findLesson('qm', 'simplex')!;

    const setMode = (mode: 'max' | 'min') => {
        if (P.mode === mode) return;
        edit(p => { p.cons.forEach(c => { if (c.op === '<=') c.op = '>='; else if (c.op === '>=') c.op = '<='; }); p.mode = mode; });
    };
    const V = P.vars.length;
    const sp = L.solvedP;
    const chips: Chip[] = sp ? [
        { text: (sp.mode === 'max' ? 'Max' : 'Min') + ' Z = ' + fmtTerms(sp.vars.map(v => ({ c: v.c, name: v.name }))), obj: true },
        ...sp.cons.map(c => {
            const rhs = parseFr(c.b);
            return { text: fmtTerms(c.a.map((a, j) => ({ c: a, name: sp.vars[j].name }))) + ' ' + SYM[c.op] + ' ' + (rhs ? String(rhs) : c.b) };
        })
    ] : [];
    /* the answer line shows the currency in front of the number */
    const textOf = (s: SimplexStep) => {
        const html = s.html;
        if (html.indexOf('Maximum Z') >= 0 || html.indexOf('Minimum Z') >= 0) {
            return html.replace(/(Maximum|Minimum) Z = ([-\d/]+)/, (_m, a, z) => a + ' Z = ' + esc(sp?.cur || '') + z);
        }
        return html;
    };

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
                                <td className="lbl">{P.mode === 'max' ? 'Maximize Z' : 'Minimize Z'}</td>
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
                                            onChange={v => edit(p => { p.cons[i].op = v as SimplexProblem['cons'][number]['op']; })} />
                                    </td>
                                    <td><input className={'num' + (bad.has('b:' + i) ? ' bad' : '')} inputMode="decimal" value={c.b} aria-label={'Constraint ' + (i + 1) + ' right-hand side'}
                                        onChange={e => edit(p => { p.cons[i].b = e.target.value; }, 'b:' + i)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="row wrap gap">
                    <button className="btn small" id="addVar" disabled={V >= 6} onClick={() => edit(p => { p.vars.push({ name: 'x' + (p.vars.length + 1), c: '0' }); p.cons.forEach(c => c.a.push('0')); })}>+ Variable</button>
                    <button className="btn small" id="delVar" disabled={V <= 1} onClick={() => edit(p => { p.vars.pop(); p.cons.forEach(c => c.a.pop()); })}>− Variable</button>
                    <button className="btn small" id="addCon" disabled={P.cons.length >= 8} onClick={() => edit(p => { p.cons.push({ a: p.vars.map(() => '0'), op: p.mode === 'min' ? '>=' : '<=', b: '0' }); })}>+ Constraint</button>
                    <button className="btn small" id="delCon" disabled={P.cons.length <= 1} onClick={() => edit(p => { p.cons.pop(); })}>− Constraint</button>
                    <label className="cur">Currency <input id="cur" maxLength={3} value={P.cur || ''} onChange={e => edit(p => { p.cur = e.target.value; })} /></label>
                </div>
                <p className="hint" id="modeHint">{P.mode === 'max'
                    ? 'Max: we keep going while any Cj - Zj is positive. Tip: ≤ constraints use slack variables.'
                    : 'Min: we keep going while any Cj - Zj is negative. Tip: ≥ constraints use surplus + artificial variables (Big-M), so Min problems usually have ≥ constraints.'}</p>

                <p className="error" id="err" role="alert">{L.err}</p>
            </section>

            <section className="card" id="saves">
                <SavedProblems<SimplexProblem> examples={[
                        { key: 'max', name: 'Max: Default', meta: 'Max' },
                        { key: 'min', name: 'Min: Default', meta: 'Min' },
                        { key: 'mixed', name: 'Max with ≤, ≥ and =', meta: 'Max' }
                    ]} onExample={k => L.loadProblem(SIMPLEX_EXAMPLES[k as SimplexExampleKey])} lesson="simplex" problem={P} isValid={validProblem} fileName="simplex-problems.json"
                    meta={p => (p.mode === 'max' ? 'Max' : 'Min')} onLoad={L.loadProblem} onError={L.setErr} />
            </section>
        </div>
    );

    return (
        <LessonShell L={L} subjectId="qm" meta={meta} problem={problem} chips={chips}
            stage={<StepCard ref={L.stage} steps={L.steps} idx={L.idx} dir={L.dir} adapter={simplexAdapter} textOf={textOf} active={L.tab === 2} hidden={!L.has} />}
            all={<AllTables steps={L.steps} idx={L.idx} width={L.w3} />} />
    );
}
