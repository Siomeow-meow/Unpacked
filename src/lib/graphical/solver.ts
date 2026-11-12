/* Graphical Method (2 variables, Max or Min). Exact fraction arithmetic (reusing the Simplex Fr class), no DOM.
   solveGraphical(problem) -> steps (title, text, formula parts, graph/table data) + a result summary. */
import { Fr, parseFr } from '../simplex/solver';
import type { ArrowDef, FormulaArrow, FormulaPart } from '../../components/arrows';
import type { StepBase } from '../../lessons/types';

export interface GraphVar { name: string; c: string }
export interface GraphCon { a: [string, string]; op: '<=' | '>=' | '='; b: string; /** optional test point, default (0, 0) */ tp?: [string, string]; /** more points to try, only checked on tab 3 */ more?: [string, string][] }
export interface GraphProblem { mode: 'max' | 'min'; cur?: string; /** objective name, e.g. P or Z */ obj?: string; vars: [GraphVar, GraphVar]; cons: GraphCon[] }

export interface Pt { x: number; y: number }
export interface GraphPoint extends Pt { label?: string; kind: 'focus' | 'corner' | 'test' | 'best' | 'plain'; ok?: boolean }
export interface GraphSpec {
    lines: number[];            // constraint lines drawn so far
    focusLine?: number;
    shade: number[];            // constraints shaded so far
    focusShade?: number;
    region: boolean;            // the feasible region filled
    points: GraphPoint[];
    guides: boolean;            // dashed guide lines from the focus point to the axes
    iso?: { z: number };        // dashed iso-profit (or iso-cost) line through the best corner
    view: GraphView;
    /** the numbers the drawing needs (floats; only for drawing, all the maths above is exact) */
    cons: { a: [number, number]; op: '<=' | '>=' | '='; b: number }[];
    obj: [number, number];
    names: [string, string];
}
export interface GraphView { xmax: number; ymax: number; xstep: number; ystep: number }
export interface TableData { head: string[]; rows: string[][]; hlRow?: number; bestRow?: number; /** columns that are results (green when filled) */ result?: number[] }
export interface GraphStep extends StepBase {
    graph: GraphSpec | null;
    table: TableData | null;
    /** milestone for the Graphs tab */
    gallery?: string;
    final?: boolean;
}
export interface CornerRow { x: string; y: string; z: string }
export interface GraphResult {
    feasible: boolean;
    regionBounded: boolean;
    objectiveUnbounded: boolean;
    intercepts: { x: string; y: string }[][];                  // per constraint
    intersections: { cons: [number, number]; x: string; y: string }[];
    corners: CornerRow[];
    best: CornerRow | null;
    alternateOptima: boolean;
    usage: { used: string; available: string; left: string }[];
}
export interface GraphSolve { steps?: GraphStep[]; error?: string; result?: GraphResult }

export const LINE_COLORS = ['#1c7ed6', '#e8590c', '#9c36b5', '#d6336c', '#0c8599', '#f08c00', '#5f3dc4', '#868e96'];
export const REGION_COLOR = '#f59f00';
export const MAX_CONS = 6;

/* ---------- small exact-number helpers ---------- */
const ZERO = new Fr(0n), ONE = new Fr(1n);
const num = (f: Fr) => Number(f.n) / Number(f.d);
const fr = (n: number) => new Fr(BigInt(n));
const dec = (f: Fr) => { const v = Math.round(num(f) * 100) / 100; return String(v); };
/** exact value, with a decimal hint for fractions: 16/3 (≈5.33) */
const wr = (f: Fr) => (f.d === 1n ? String(f) : '(' + f + ')');
const show = (f: Fr) => (f.d === 1n ? f.toString() : f.toString() + ' (≈' + dec(f) + ')');
const pt = (x: Fr, y: Fr) => '(' + x + ', ' + y + ')';
const SYM = { '<=': '≤', '>=': '≥', '=': '=' } as const;
const cmpOp = (v: Fr, op: string, b: Fr) => { const c = v.cmp(b); return op === '<=' ? c <= 0 : op === '>=' ? c >= 0 : c === 0; };

/** k·name as text: 1 → name, -1 → -name, 0 → '' */
function coefTxt(k: Fr, name: string): string {
    if (k.sign === 0) return '';
    if (k.cmp(ONE) === 0) return name;
    if (k.cmp(ONE.neg()) === 0) return '-' + name;
    return (k.d === 1n ? String(k) : '(' + k + ')') + name;
}
/** "4T + 3C", "-2T + 300", skipping zero terms */
function lin(parts: { k: Fr; name: string }[]): string {
    let out = '';
    parts.forEach(p => {
        if (p.k.sign === 0) return;
        const neg = p.k.sign < 0, abs = neg ? p.k.neg() : p.k;
        const body = p.name === '' ? String(abs) : coefTxt(abs, p.name);
        out += out === '' ? (neg ? '-' : '') + body : (neg ? ' - ' : ' + ') + body;
    });
    return out || '0';
}

interface Con { a: [Fr, Fr]; b: Fr; op: '<=' | '>=' | '='; tp: [Fr, Fr] | null }

const feasibleAt = (cons: Con[], x: Fr, y: Fr) => x.sign >= 0 && y.sign >= 0 && cons.every(c => cmpOp(c.a[0].mul(x).add(c.a[1].mul(y)), c.op, c.b));

/** where two lines meet (null if parallel) */
function meet(a: Con, b: Con): [Fr, Fr] | null {
    const det = a.a[0].mul(b.a[1]).sub(a.a[1].mul(b.a[0]));
    if (det.sign === 0) return null;
    const x = a.b.mul(b.a[1]).sub(a.a[1].mul(b.b)).div(det);
    const y = a.a[0].mul(b.b).sub(a.b.mul(b.a[0])).div(det);
    return [x, y];
}

/** nice axis limit and tick step for a maximum value */
function niceView(maxX: number, maxY: number): GraphView {
    const one = (m: number) => {
        const v = Math.max(m, 1) * 1.06;
        /* the smallest "nice" tick step that keeps the axis to at most 8 intervals */
        for (let p = 1e-3; p < 1e12; p *= 10) {
            for (const f of [1, 2, 2.5, 5]) {
                const step = f * p;
                if (Math.ceil(v / step - 1e-9) <= 8 && step >= v / 8 - 1e-12) return { max: Math.ceil(v / step - 1e-9) * step, step };
            }
        }
        return { max: v, step: v / 5 };
    };
    const X = one(maxX), Y = one(maxY);
    return { xmax: X.max, ymax: Y.max, xstep: X.step, ystep: Y.step };
}

/* ---------- the solver ---------- */
export function solveGraphical(P: GraphProblem): GraphSolve {
    const isMax = P.mode === 'max';
    if (!P.vars || P.vars.length !== 2 || !P.cons || P.cons.length < 1) return { error: 'Need two variables and at least one constraint.' };
    if (P.cons.length > MAX_CONS) return { error: 'At most ' + MAX_CONS + ' constraints.' };
    const names = P.vars.map(v => String(v.name || '').trim());
    for (const n of names) if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n)) return { error: 'Variable names must be letters/numbers only (e.g. T, C, x1), starting with a letter.' };
    if (names[0] === names[1]) return { error: 'Variable names must be different from each other.' };
    const X = names[0], Y = names[1];
    const objName = /^[A-Za-z][A-Za-z0-9_]*$/.test(String(P.obj || '').trim()) ? String(P.obj).trim() : 'Z';
    const cc = P.vars.map(v => parseFr(v.c));
    if (cc.some(x => !x)) return { error: 'Every objective coefficient must be a number (e.g. 700, -2.5, 1/2).' };
    const c: [Fr, Fr] = [cc[0] as Fr, cc[1] as Fr];
    const cons: Con[] = [];
    for (let i = 0; i < P.cons.length; i++) {
        const k = P.cons[i];
        const a0 = parseFr(k.a[0]), a1 = parseFr(k.a[1]), b = parseFr(k.b);
        if (!a0 || !a1 || !b) return { error: 'Constraint ' + (i + 1) + ' has a value that is not a number.' };
        if (a0.sign === 0 && a1.sign === 0) return { error: 'Constraint ' + (i + 1) + ' needs a non-zero coefficient on ' + X + ' or ' + Y + '.' };
        let tp: [Fr, Fr] | null = null;
        if (k.tp && (String(k.tp[0]).trim() !== '' || String(k.tp[1]).trim() !== '')) {
            const tx = parseFr(String(k.tp[0]).trim() === '' ? '0' : k.tp[0]), ty = parseFr(String(k.tp[1]).trim() === '' ? '0' : k.tp[1]);
            if (!tx || !ty) return { error: 'The test point of constraint ' + (i + 1) + ' must be numbers.' };
            tp = [tx, ty];
        }
        cons.push({ a: [a0, a1], b, op: k.op, tp });
    }
    const n = cons.length;
    const conTxt = (k: Con) => lin([{ k: k.a[0], name: X }, { k: k.a[1], name: Y }]) + ' ' + SYM[k.op] + ' ' + k.b;
    const eqTxt = (k: Con) => lin([{ k: k.a[0], name: X }, { k: k.a[1], name: Y }]) + ' = ' + k.b;
    const objTxt = lin([{ k: c[0], name: X }, { k: c[1], name: Y }]);
    const cur = P.cur || '';

    /* ---- geometry (exact) ---- */
    const intercepts: { x: Fr; y: Fr }[][] = cons.map(k => {
        const out: { x: Fr; y: Fr }[] = [];
        if (k.a[1].sign !== 0) out.push({ x: ZERO, y: k.b.div(k.a[1]) });   // X = 0
        if (k.a[0].sign !== 0) out.push({ x: k.b.div(k.a[0]), y: ZERO });   // Y = 0
        return out;
    });
    /* corner candidates in a fixed order: origin, axis intercepts (constraint by constraint), then line-line intersections */
    interface Cand { x: Fr; y: Fr; kind: 'origin' | 'axis' | 'meet'; cons?: [number, number] }
    const cands: Cand[] = [{ x: ZERO, y: ZERO, kind: 'origin' }];
    intercepts.forEach((l, i) => l.forEach(p => cands.push({ x: p.x, y: p.y, kind: 'axis', cons: [i, i] })));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const m = meet(cons[i], cons[j]); if (m) cands.push({ x: m[0], y: m[1], kind: 'meet', cons: [i, j] }); }
    const corners: Cand[] = [];
    cands.forEach(cd => {
        if (!feasibleAt(cons, cd.x, cd.y)) return;
        if (corners.some(o => o.x.cmp(cd.x) === 0 && o.y.cmp(cd.y) === 0)) return;
        corners.push(cd);
    });
    const feasible = corners.length > 0;

    /* recession directions (region unbounded?) */
    const dirs: [Fr, Fr][] = [[ONE, ZERO], [ZERO, ONE]];
    cons.forEach(k => { dirs.push([k.a[1], k.a[0].neg()], [k.a[1].neg(), k.a[0]]); });
    const rays = dirs.filter(d => d[0].sign >= 0 && d[1].sign >= 0 && (d[0].sign > 0 || d[1].sign > 0)
        && cons.every(k => { const v = k.a[0].mul(d[0]).add(k.a[1].mul(d[1])); return k.op === '<=' ? v.sign <= 0 : k.op === '>=' ? v.sign >= 0 : v.sign === 0; }));
    const regionBounded = !feasible || rays.length === 0;
    const objectiveUnbounded = feasible && rays.some(d => { const g = c[0].mul(d[0]).add(c[1].mul(d[1])); return isMax ? g.sign > 0 : g.sign < 0; });

    const zOf = (p: { x: Fr; y: Fr }) => c[0].mul(p.x).add(c[1].mul(p.y));
    let bestIdx = -1;
    if (feasible && !objectiveUnbounded) corners.forEach((p, i) => { if (bestIdx < 0 || (isMax ? zOf(p).cmp(zOf(corners[bestIdx])) > 0 : zOf(p).cmp(zOf(corners[bestIdx])) < 0)) bestIdx = i; });
    const alternate = bestIdx >= 0 && corners.filter(p => zOf(p).cmp(zOf(corners[bestIdx])) === 0).length > 1;

    /* the view: one window for every step so the picture never jumps */
    let mx = 0, my = 0;
    const seeX = (f: Fr) => { if (f.sign > 0) mx = Math.max(mx, num(f)); };
    const seeY = (f: Fr) => { if (f.sign > 0) my = Math.max(my, num(f)); };
    intercepts.forEach(l => l.forEach(p => { seeX(p.x); seeY(p.y); }));
    corners.forEach(p => { seeX(p.x); seeY(p.y); });
    if (!mx) mx = my || 10; if (!my) my = mx || 10;
    if (!regionBounded) { mx *= 1.8; my *= 1.8; }   // an unbounded region runs off the picture: leave room to see that
    const view = niceView(mx, my);
    const f = (v: Fr) => num(v);
    const P0 = (p: { x: Fr; y: Fr }, kind: GraphPoint['kind'], label?: string, ok?: boolean): GraphPoint => ({ x: f(p.x), y: f(p.y), kind, label: label ?? pt(p.x, p.y).replace(/\((.*)\)/, (_m, s) => '(' + s.split(', ').map((q: string) => { const fr2 = parseFr(q); return fr2 ? dec(fr2) : q; }).join(', ') + ')'), ok });

    const steps: GraphStep[] = [];
    const push = (title: string, html: string, o: Partial<GraphStep> & { fparts?: FormulaPart[] | null } = {}) => steps.push({
        title, html, formula: o.formula || '', fparts: o.fparts || null, farrows: (o.farrows as FormulaArrow[]) || null,
        arrows: (o.arrows as ArrowDef[]) || [], group: o.group || title, graph: o.graph || null, table: o.table || null, gallery: o.gallery, final: o.final
    });
    const consNum = cons.map(k => ({ a: [num(k.a[0]), num(k.a[1])] as [number, number], op: k.op, b: num(k.b) }));
    const G = (g: Partial<GraphSpec>): GraphSpec => ({ lines: [], shade: [], region: false, points: [], guides: false, view, cons: consNum, obj: [num(c[0]), num(c[1])], names: [X, Y], ...g });
    /* a formula made only of plain text */
    const plain = (t: string) => ({ formula: t, fparts: [{ t }] as FormulaPart[] });

    /* ===== 1. Set up ===== */
    {
        let html = '<p><b>Decision variables:</b> ' + X + ' and ' + Y + '</p>';
        html += '<p><b>Objective:</b> ' + (isMax ? 'Maximize ' : 'Minimize ') + objName + ' = ' + objTxt + '</p><p><b>Constraints:</b></p><ul>';
        cons.forEach(k => { html += '<li>' + conTxt(k) + '</li>'; });
        html += '<li>' + X + ', ' + Y + ' ≥ 0 (non-negativity: we only look at the first quadrant)</li></ul>';
        html += '<p>Plan: draw each constraint as a line, shade the side that works, keep the overlap (the <b>feasible region</b>), then test its corner points in the objective.</p>';
        push('Set up the problem', html);
    }

    /* ===== 2. Intercepts ===== */
    for (let i = 0; i < n; i++) {
        const k = cons[i];
        const drawn = Array.from({ length: i }, (_, q) => q);
        const lineWord = 'Constraint ' + (i + 1) + ' as a line: ' + eqTxt(k);
        const shows: { x: Fr; y: Fr }[] = [];
        const mkStep = (which: 'x0' | 'y0', last: boolean) => {
            const isX0 = which === 'x0';            // X = 0, solve Y
            const solveName = isX0 ? Y : X, zeroName = isX0 ? X : Y;
            const coef = isX0 ? k.a[1] : k.a[0];
            const p = isX0 ? { x: ZERO, y: k.b.div(k.a[1]) } : { x: k.b.div(k.a[0]), y: ZERO };
            shows.push(p);
            const left = isX0
                ? (k.a[0].sign === 0 ? '' : k.a[0] + '(0)') + (k.a[0].sign === 0 || k.a[1].sign === 0 ? '' : ' + ') + (k.a[1].sign === 0 ? '' : coefTxt(k.a[1], Y))
                : (k.a[0].sign === 0 ? '' : coefTxt(k.a[0], X)) + (k.a[0].sign === 0 || k.a[1].sign === 0 ? '' : ' + ') + (k.a[1].sign === 0 ? '' : k.a[1] + '(0)');
            const val = coefTxt(coef, solveName);
            const eqline = left + ' = ' + k.b;
            const answer = solveName + ' = ' + (coef.cmp(ONE) === 0 ? '' : k.b + ' ÷ ' + (coef.sign < 0 ? '(' + coef + ')' : coef) + ' = ') + p[isX0 ? 'y' : 'x'];
            let html = '<p>' + lineWord + '. To plot it, find where it crosses each axis.</p>';
            html += '<p>Set <b>' + zeroName + ' = 0</b> and solve for <b>' + solveName + '</b>: <b>' + eqline + '</b>' + (val !== solveName ? ' → ' + val + ' = ' + k.b : '') + '</p>';
            html += '<p>The line crosses the ' + (isX0 ? Y : X) + '-axis at <b>' + pt(p.x, p.y) + '</b>' + (p.x.d !== 1n || p.y.d !== 1n ? ' (≈ ' + dec(p.x) + ', ' + dec(p.y) + ')' : '') + '.' + (last ? ' Now both points are on the graph, so draw the line through them.' : '') + '</p>';
            push('Constraint ' + (i + 1) + ': when ' + zeroName + ' = 0', html, {
                ...plain(eqline + '  →  ' + answer),
                graph: G({ lines: last ? drawn.concat(i) : drawn, focusLine: i, points: shows.map(s => P0(s, 'focus')), guides: true }),
                gallery: last && i === n - 1 ? 'Constraint lines' : undefined,
                group: 'Intercepts ' + (i + 1)
            });
        };
        const hasX0 = k.a[1].sign !== 0, hasY0 = k.a[0].sign !== 0;
        if (hasX0 && hasY0 && k.b.sign === 0) {
            // passes through the origin: both intercepts are (0, 0), so use a second point
            const tx = fr(Math.max(1, Math.round(view.xstep))), ty = k.b.sub(k.a[0].mul(tx)).div(k.a[1]);
            const origin = { x: ZERO, y: ZERO };
            push('Constraint ' + (i + 1) + ': through the origin',
                '<p>' + lineWord + '.</p><p>Setting ' + X + ' = 0 gives ' + Y + ' = 0, and setting ' + Y + ' = 0 gives ' + X + ' = 0, so the line passes through <b>(0, 0)</b>. We need a second point.</p>' +
                '<p>Choose <b>' + X + ' = ' + tx + '</b>: ' + k.a[0] + '(' + tx + ') + ' + coefTxt(k.a[1], Y) + ' = 0 → ' + Y + ' = ' + ty + '. Second point: <b>' + pt(tx, ty) + '</b>.</p>',
                { ...plain(X + ' = ' + tx + '  →  ' + Y + ' = ' + ty), graph: G({ lines: drawn.concat(i), focusLine: i, points: [P0(origin, 'focus'), P0({ x: tx, y: ty }, 'focus')], guides: true }), gallery: i === n - 1 ? 'Constraint lines' : undefined, group: 'Intercepts ' + (i + 1) });
        } else if (hasX0 && hasY0) { mkStep('x0', false); mkStep('y0', true); }
        else if (hasX0) {
            mkStep('x0', true);
        } else {
            mkStep('y0', true);
        }
        if (!(hasX0 && hasY0)) {
            const s = steps[steps.length - 1];
            s.html += '<p><i>This line is parallel to the ' + (hasX0 ? X : Y) + '-axis, so it never crosses the other axis.</i></p>';
        }
    }

    /* ===== 3. Test points ===== */
    const tested: number[] = [];
    for (let i = 0; i < n; i++) {
        const k = cons[i];
        let t: [Fr, Fr] = k.tp || [ZERO, ZERO];
        let note = '';
        const onLine = (q: [Fr, Fr]) => k.a[0].mul(q[0]).add(k.a[1].mul(q[1])).cmp(k.b) === 0;
        if (onLine(t)) {
            const old = pt(t[0], t[1]);
            const alt: [Fr, Fr][] = [[fr(1), ZERO], [ZERO, fr(1)], [fr(1), fr(1)], [fr(2), fr(1)], [fr(1), fr(2)], [fr(3), fr(-2)]];
            t = alt.find(q => !onLine(q)) as [Fr, Fr];
            note = '<p><i>' + old + ' lies exactly on the line, so it cannot tell us which side is right. We use ' + pt(t[0], t[1]) + ' instead.</i></p>';
        }
        const lhs = k.a[0].mul(t[0]).add(k.a[1].mul(t[1]));
        const ok = cmpOp(lhs, k.op, k.b);
        const left = (k.a[0].sign === 0 ? '' : k.a[0] + '(' + t[0] + ')') + (k.a[0].sign === 0 || k.a[1].sign === 0 ? '' : ' + ') + (k.a[1].sign === 0 ? '' : k.a[1] + '(' + t[1] + ')');
        tested.push(i);
        const tpLabel = pt(t[0], t[1]);
        const chain = (left || '0') + ' = ' + lhs + ' ' + SYM[k.op] + ' ' + k.b + '?  ' + (ok ? 'Yes ✓' : 'No ✗');
        let html = '<p>Which side of line ' + (i + 1) + ' do we want? Put the test point <b>' + tpLabel + '</b> into <b>' + conTxt(k) + '</b>:</p>';
        html += '<p>' + (left || '0') + ' = <b>' + lhs + '</b>. Is ' + lhs + ' ' + SYM[k.op] + ' ' + k.b + '? <b class="' + (ok ? 'good' : 'bad') + '">' + (ok ? 'Yes, it is satisfied' : 'No, it is not satisfied') + '</b>.</p>';
        html += '<p>' + (k.op === '=' ? 'This is an equality, so only the points ON the line count.' : ok ? 'So shade the side of the line that <b>contains</b> ' + tpLabel + '.' : 'So shade the side of the line that does <b>not</b> contain ' + tpLabel + '.') + '</p>' + note;
        push('Constraint ' + (i + 1) + ': test point', html, {
            ...plain(chain),
            graph: G({ lines: Array.from({ length: n }, (_, q) => q), focusLine: i, shade: tested.slice(), focusShade: i, points: [P0({ x: t[0], y: t[1] }, 'test', tpLabel.replace(/\s/g, ''), ok)] }),
            gallery: i === n - 1 ? 'Shaded sides' : undefined, group: 'Test ' + (i + 1)
        });
    }

    const allLines = Array.from({ length: n }, (_, q) => q);

    /* ===== 4. Feasible region ===== */
    if (!feasible) {
        push('Feasible region: none',
            '<p class="bad"><b>No feasible region.</b> The shaded areas do not overlap anywhere in the first quadrant, so no point satisfies every constraint at the same time.</p><p>The constraints contradict each other, so this problem has <b>no solution</b>. Check the signs (≤ or ≥) and the numbers.</p>',
            { graph: G({ lines: allLines, shade: allLines }), gallery: 'No feasible region' });
        return { steps, result: { feasible: false, regionBounded: true, objectiveUnbounded: false, intercepts: intercepts.map(l => l.map(p => ({ x: String(p.x), y: String(p.y) }))), intersections: [], corners: [], best: null, alternateOptima: false, usage: [] } };
    }
    push('Feasible region',
        '<p>The <b>feasible region</b> is where all the shading overlaps (and ' + X + ', ' + Y + ' ≥ 0). Every point inside satisfies every constraint at once.</p>' +
        (regionBounded ? '<p>The region is a closed shape, and the best answer is always at one of its <b>corner points</b>.</p>'
            : '<p class="bad"><b>The region is unbounded:</b> it keeps going forever in one direction' + (objectiveUnbounded ? ', and the objective can ' + (isMax ? 'grow' : 'shrink') + ' without limit there.' : ', but the objective does not improve that way, so a best corner still exists.') + '</p>'),
        { ...plain('Feasible region = overlap of all shaded areas'), graph: G({ lines: allLines, shade: allLines, region: true }), gallery: 'Feasible region' });

    /* ===== 5. Intersections ===== */
    const axisCorners = corners.filter(p => p.kind !== 'meet');
    const meets = corners.filter(p => p.kind === 'meet');
    const known: Cand[] = [];
    if (axisCorners.length) {
        known.push(...axisCorners);
        let html = '<p>Some corners sit on an axis. We already found them:</p><ul>';
        axisCorners.forEach(p => {
            html += '<li><b>' + pt(p.x, p.y) + '</b>: ' + (p.kind === 'origin' ? X + ' = 0 and ' + Y + ' = 0' : 'constraint ' + ((p.cons as [number, number])[0] + 1) + ' meets the ' + (p.y.sign === 0 ? X : Y) + '-axis (step ' + 'intercepts)') + '</li>';
        });
        html += '</ul>';
        push('Corners on the axes', html, { ...plain('Axis corners: ' + axisCorners.map(p => pt(p.x, p.y)).join('  ')), graph: G({ lines: allLines, shade: allLines, region: true, points: axisCorners.map(p => P0(p, 'corner')) }) });
    }
    const interRes: GraphResult['intersections'] = [];
    meets.forEach(p => {
        const [i, j] = p.cons as [number, number];
        const A = cons[i], B = cons[j];
        /* isolate the variable that is easiest (coefficient 1 or -1), else the first non-zero one */
        const cand: { eq: Con; other: Con; vi: number }[] = [];
        [[A, B], [B, A]].forEach(([e, o]) => [0, 1].forEach(vi => { if (e.a[vi].sign !== 0) cand.push({ eq: e, other: o, vi }); }));
        const unit = cand.find(q => q.eq.a[q.vi].cmp(ONE) === 0 || q.eq.a[q.vi].cmp(ONE.neg()) === 0) || cand[0];
        const eq = unit.eq, other = unit.other, vi = unit.vi, ui = 1 - vi;
        const nm = [X, Y];
        const v = nm[vi], u = nm[ui];
        const eqNo = (eq === A ? i : j) + 1, otherNo = (other === A ? i : j) + 1;
        const q = eq.a[vi], pp = eq.a[ui], r = eq.b;
        const c0 = r.div(q), k1 = pp.div(q).neg();                    // v = c0 + k1·u
        const m = other.a[ui], nn = other.a[vi], s = other.b;
        const vexpr = lin([{ k: c0, name: '' }, { k: k1, name: u }]);
        const sub = lin([{ k: m, name: u }]);                         // m·u
        const subLine = (m.sign === 0 ? '' : sub + ' + ') + (nn.cmp(ONE) === 0 ? '' : nn.cmp(ONE.neg()) === 0 ? '-' : wr(nn)) + '(' + vexpr + ') = ' + s;
        const expC = nn.mul(c0), expK = nn.mul(k1);
        const expand = lin([{ k: m, name: u }, { k: expC, name: '' }, { k: expK, name: u }]) + ' = ' + s;
        const kk = m.add(expK);                                       // combined u coefficient
        const combined = lin([{ k: kk, name: u }, { k: expC, name: '' }]) + ' = ' + s;
        const moved = lin([{ k: kk, name: u }]) + ' = ' + s.sub(expC);
        const uVal = s.sub(expC).div(kk), vVal = c0.add(k1.mul(uVal));
        const pair = 'Lines ' + (i + 1) + ' and ' + (j + 1);
        interRes.push({ cons: [i, j], x: String(p.x), y: String(p.y) });
        known.push(p);
        const shown = (): GraphSpec => G({ lines: allLines, shade: allLines, region: true, points: known.slice(0, -1).map(o => P0(o, 'corner')).concat(P0(p, 'focus')), guides: true });
        const before = (): GraphSpec => G({ lines: allLines, shade: allLines, region: true, points: known.slice(0, -1).map(o => P0(o, 'corner')) });
        push(pair + ': isolate ' + v,
            '<p>Corner where line ' + (i + 1) + ' and line ' + (j + 1) + ' cross. Solve the two equations together by <b>substitution</b>:</p><ul><li>(' + eqNo + ') ' + eqTxt(eq) + '</li><li>(' + otherNo + ') ' + eqTxt(other) + '</li></ul>' +
            '<p>From (' + eqNo + '), get <b>' + v + '</b> by itself: <b>' + v + ' = ' + vexpr + '</b></p>',
            { ...plain(v + ' = ' + vexpr), graph: before(), group: 'Intersection ' + (i + 1) + '-' + (j + 1) });
        push(pair + ': solve for ' + u,
            '<p>Put <b>' + v + ' = ' + vexpr + '</b> into equation (' + otherNo + '):</p><p>' + subLine + '</p><p>' + expand + '</p><p>' + combined + '</p><p>' + moved + '</p><p><b>' + u + ' = ' + uVal + '</b></p>',
            { ...plain(moved + '  →  ' + u + ' = ' + uVal), graph: before(), group: 'Intersection ' + (i + 1) + '-' + (j + 1) });
        push(pair + ': find ' + v,
            '<p>Back-substitute <b>' + u + ' = ' + uVal + '</b> into <b>' + v + ' = ' + vexpr + '</b>:</p><p>' + v + ' = ' + lin([{ k: c0, name: '' }]) + (k1.sign === 0 ? '' : (k1.sign < 0 ? ' - ' : ' + ') + wr(k1.sign < 0 ? k1.neg() : k1) + '(' + uVal + ')') + ' = <b>' + vVal + '</b></p><p>The corner is <b>' + pt(p.x, p.y) + '</b>' + (p.x.d !== 1n || p.y.d !== 1n ? ' (≈ ' + dec(p.x) + ', ' + dec(p.y) + ')' : '') + '.</p>',
            { ...plain(v + ' = ' + c0 + (k1.sign === 0 ? '' : (k1.sign < 0 ? ' - ' : ' + ') + wr(k1.sign < 0 ? k1.neg() : k1) + '(' + uVal + ')') + ' = ' + vVal + '   →   ' + pt(p.x, p.y)), graph: shown(), group: 'Intersection ' + (i + 1) + '-' + (j + 1) });
    });

    /* ===== 6. Corner points table ===== */
    const rows = corners.map(p => [String(p.x), String(p.y), '']);
    const head = [X, Y, objName + ' = ' + objTxt];
    const allCorners = (kind: GraphPoint['kind'] = 'corner') => corners.map(p => P0(p, kind));
    const zs: string[] = corners.map(p => '');
    push('Corner points table',
        '<p>The best answer is at a corner of the feasible region. List every corner and put it into the objective <b>' + objName + ' = ' + objTxt + '</b>.</p><p>We want the <b>' + (isMax ? 'highest' : 'lowest') + '</b> value.</p>',
        { ...plain(objName + ' = ' + objTxt), graph: G({ lines: allLines, shade: allLines, region: true, points: allCorners() }), table: { head, rows: rows.map(r => r.slice()), result: [2] }, group: 'Corner table' });
    corners.forEach((p, i) => {
        const z = zOf(p);
        zs[i] = String(z);
        const cur2 = rows.map((r, ri) => [r[0], r[1], ri <= i ? zs[ri] : '']);
        const fparts: FormulaPart[] = [{ t: objName + ' = ' + c[0] + '(' }, { t: String(p.x), id: 'x' }, { t: ')' + (c[1].sign < 0 ? ' - ' : ' + ') + (c[1].sign < 0 ? c[1].neg() : c[1]) + '(' }, { t: String(p.y), id: 'y' }, { t: ') = ' }, { t: String(z), id: 'r' }];
        push('Corner ' + pt(p.x, p.y) + ': ' + objName,
            '<p>Put the corner <b>' + pt(p.x, p.y) + '</b> into the objective: ' + X + ' = ' + p.x + ', ' + Y + ' = ' + p.y + '.</p><p>' + objName + ' = <b>' + z + '</b></p>',
            {
                fparts, formula: fparts.map(q => q.t).join(''),
                arrows: [{ from: [0, i, 0], to: [0, i, 2], kind: 'val', mid: true }, { from: [0, i, 1], to: [0, i, 2], kind: 'val', mid: true }, { from: [0, i, 1], to: [0, i, 2], kind: 'res' }],
                farrows: [{ cell: [0, i, 0], part: 'x', kind: 'val' }, { cell: [0, i, 1], part: 'y', kind: 'val' }, { cell: [0, i, 2], part: 'r', kind: 'res' }],
                graph: G({ lines: allLines, shade: allLines, region: true, points: corners.map((q, qi) => P0(q, qi === i ? 'focus' : 'corner')), guides: true }),
                table: { head, rows: cur2, hlRow: i, result: [2] }, group: 'Corner table'
            });
    });
    if (objectiveUnbounded) {
        push('No ' + (isMax ? 'maximum' : 'minimum'),
            '<p class="bad"><b>Unbounded.</b> The feasible region goes on forever in a direction where ' + objName + ' keeps ' + (isMax ? 'growing' : 'shrinking') + ', so there is no ' + (isMax ? 'maximum' : 'minimum') + '. Double-check the constraints.</p>',
            { graph: G({ lines: allLines, shade: allLines, region: true, points: allCorners() }), table: { head, rows: corners.map((p, i) => [String(p.x), String(p.y), zs[i]]), result: [2] }, gallery: 'Unbounded' });
        return { steps, result: { feasible: true, regionBounded, objectiveUnbounded: true, intercepts: intercepts.map(l => l.map(p => ({ x: String(p.x), y: String(p.y) }))), intersections: interRes, corners: corners.map((p, i) => ({ x: String(p.x), y: String(p.y), z: zs[i] })), best: null, alternateOptima: false, usage: [] } };
    }
    const best = corners[bestIdx], bz = zOf(best);
    const bestTable: TableData = { head, rows: corners.map((p, i) => [String(p.x), String(p.y), zs[i]]), hlRow: bestIdx, bestRow: bestIdx, result: [2] };
    push('Best corner',
        '<p>The ' + (isMax ? 'highest' : 'lowest') + ' value of ' + objName + ' is <b>' + cur + bz + '</b>, at the corner <b>' + pt(best.x, best.y) + '</b>.</p>' +
        '<p>The dashed line is the ' + (isMax ? 'iso-profit' : 'iso-cost') + ' line ' + objName + ' = ' + bz + '. Slide it ' + (isMax ? 'up and to the right' : 'down and to the left') + ' and the last corner it touches is the best one.</p>' +
        (alternate ? '<p><i>Another corner gives the same value, so every point on the edge between them is also optimal.</i></p>' : ''),
        { ...plain(objName + ' = ' + objTxt + ' = ' + cur + bz + ' at ' + pt(best.x, best.y)), graph: G({ lines: allLines, shade: allLines, region: true, points: corners.map((q, qi) => P0(q, qi === bestIdx ? 'best' : 'corner')), guides: true, iso: { z: num(bz) } }), table: bestTable, gallery: 'Corner points and best corner', group: 'Corner table' });

    /* ===== 7. Conclusion + usage check ===== */
    const usage = cons.map(k => {
        const used = k.a[0].mul(best.x).add(k.a[1].mul(best.y));
        /* ≤: what is left of the supply; ≥: how far above the requirement we are */
        return { used: String(used), available: String(k.b), left: String(k.op === '>=' ? used.sub(k.b) : k.b.sub(used)) };
    });
    const full = usage.every(u => u.left === '0');
    let html = '<p class="good"><b>Optimal solution:</b> ' + X + ' = ' + best.x + ', ' + Y + ' = ' + best.y + '</p>';
    html += '<p><b>' + (isMax ? 'Maximum ' : 'Minimum ') + objName + ' = ' + cur + bz + '</b></p>';
    html += '<p>Check: ' + objName + ' = ' + c[0] + '(' + best.x + ') + ' + c[1] + '(' + best.y + ') = ' + bz + '</p>';
    html += '<p>' + (full ? 'Every constraint is exactly met at this corner, so nothing is left over.' : 'The table shows how much of each constraint is used and how much is left over.') + '</p>';
    if (alternate) html += '<p><i>Another corner ties, so other optimal points exist along that edge.</i></p>';
    push('Conclusion', html, {
        graph: G({ lines: allLines, shade: allLines, region: true, points: [P0(best, 'best')], guides: true }), final: true, group: 'final',
        table: { head: ['Constraint', 'Used', 'Available', 'Left over'], rows: cons.map((k, i) => [String(i + 1) + ': ' + conTxt(k), usage[i].used, usage[i].available, usage[i].left]), result: [3] }
    });
    return {
        steps, result: {
            feasible: true, regionBounded, objectiveUnbounded: false,
            intercepts: intercepts.map(l => l.map(p => ({ x: String(p.x), y: String(p.y) }))),
            intersections: interRes,
            corners: corners.map((p, i) => ({ x: String(p.x), y: String(p.y), z: zs[i] })),
            best: { x: String(best.x), y: String(best.y), z: String(bz) },
            alternateOptima: alternate, usage
        }
    };
}

export const graphicalSummary = (problem: unknown): { method: string; result: string } => {
    const p = problem as GraphProblem;
    const method = p.mode === 'max' ? 'Max' : 'Min';
    try {
        const r = solveGraphical(p);
        if (r.error || !r.result) return { method, result: '—' };
        if (!r.result.feasible) return { method, result: 'No feasible region' };
        if (!r.result.best) return { method, result: 'Unbounded' };
        return { method, result: (p.obj || 'Z') + ' = ' + (p.cur || '') + r.result.best.z + ' at (' + r.result.best.x + ', ' + r.result.best.y + ')' };
    } catch { return { method, result: '—' }; }
};
