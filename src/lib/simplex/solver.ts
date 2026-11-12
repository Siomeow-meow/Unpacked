/* Simplex step generator (Big-M method). No DOM here, so it can be tested in Node.
   Exact arithmetic: fractions (BigInt) and numbers of the form  c + m*M.
   Ported from the original solver.js: the maths is unchanged, only converted to an ES module with types. */

export interface SimplexVar { name: string; c: string }
export interface SimplexCon { a: string[]; op: '<=' | '>=' | '='; b: string }
export interface SimplexProblem { mode: 'max' | 'min'; cur?: string; vars: SimplexVar[]; cons: SimplexCon[] }
export type CellRef = (number | string)[];
export interface Arrow { from: CellRef; to: CellRef; kind: string; mid?: boolean; label?: string }
export interface FPart { t: string; id?: string }
export interface FArrow { cell: CellRef; part: string; kind: string }
export interface Hl { col?: number; row?: number; pivot?: boolean; final?: boolean }
export interface SimplexTable {
    label: string; head: string[]; names: string[];
    rows: { cj: string; name: string; qty: string; cells: string[]; ratio: string | undefined }[];
    zj: { qty: string; cells: string[] } | null; cjzj: string[] | null; hasRatio: boolean; hl: Hl;
}
export interface SimplexStep {
    title: string; html: string; tables: SimplexTable[]; arrows: Arrow[]; formula: string;
    fparts: FPart[] | null; farrows: FArrow[] | null; calc: unknown[]; group: string;
}
export interface SimplexResult { steps?: SimplexStep[]; error?: string; result?: { feasible: boolean; z: string | null; values: Record<string, string> } }
interface PushOpts { arrows?: Arrow[]; formula?: string; fparts?: FPart[] | null; farrows?: FArrow[] | null; calc?: unknown[]; group?: string }
interface SnapOpts { blank?: Set<string>; label?: string; ratio?: (string | null)[]; zj?: (MNum | null)[]; zjq?: MNum | null; cjzj?: (MNum | null)[]; hl?: Hl }
export interface MNum { c: Fr; m: Fr }
interface Col { name: string; cost: MNum; kind: string }
interface TRow { b: number; qty: Fr; a: Fr[] }
interface Tab { cols: Col[]; rows: TRow[] }

/* ---------- Fractions ---------- */
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
export class Fr {
    n: bigint; d: bigint;
    constructor(n: bigint, d: bigint = 1n) {
        if (d === 0n) throw new Error('Division by zero');
        if (d < 0n) { n = -n; d = -d; }
        const g = gcd(n, d) || 1n;
        this.n = n / g; this.d = d / g;
    }
    add(o: Fr) { return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o: Fr) { return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o: Fr) { return new Fr(this.n * o.n, this.d * o.d); }
    div(o: Fr) { return new Fr(this.n * o.d, this.d * o.n); }
    neg() { return new Fr(-this.n, this.d); }
    cmp(o: Fr) { const x = this.n * o.d - o.n * this.d; return x < 0n ? -1 : x > 0n ? 1 : 0; }
    get sign() { return this.n < 0n ? -1 : this.n > 0n ? 1 : 0; }
    toString() { return this.d === 1n ? String(this.n) : this.n + '/' + this.d; }
}
const ZERO = new Fr(0n), ONE = new Fr(1n), NEG1 = new Fr(-1n);

export function parseFr(s0: unknown): Fr | null {
    const s = String(s0 == null ? '' : s0).trim();
    let m: RegExpExecArray | null;
    if ((m = /^([+-]?\d+)\s*\/\s*(\d+)$/.exec(s))) {
        if (BigInt(m[2]) === 0n) return null;
        return new Fr(BigInt(m[1]), BigInt(m[2]));
    }
    if ((m = /^([+-]?)(\d*)\.?(\d*)$/.exec(s)) && (m[2] || m[3])) {
        const frac = m[3] || '';
        const n = BigInt((m[2] || '0') + frac) * (m[1] === '-' ? -1n : 1n);
        return new Fr(n, 10n ** BigInt(frac.length));
    }
    return null;
}

/* ---------- "c + mM" numbers (for Big-M costs) ---------- */
const mk = (c: Fr, m: Fr = ZERO): MNum => ({ c, m });
const madd = (a: MNum, b: MNum) => mk(a.c.add(b.c), a.m.add(b.m));
const msub = (a: MNum, b: MNum) => mk(a.c.sub(b.c), a.m.sub(b.m));
const mscale = (a: MNum, f: Fr) => mk(a.c.mul(f), a.m.mul(f));
const msign = (a: MNum) => (a.m.sign !== 0 ? a.m.sign : a.c.sign);
const mcmp = (a: MNum, b: MNum) => msign(msub(a, b));

function fmtM(a: MNum, paren?: boolean): string {
    const c = a.c, m = a.m;
    let s: string;
    if (m.sign === 0) s = c.toString();
    else {
        const am = m.sign < 0 ? m.neg() : m;
        const mt = am.cmp(ONE) === 0 ? 'M' : am.toString() + 'M';
        if (c.sign === 0) s = (m.sign < 0 ? '-' : '') + mt;
        else s = c.toString() + (m.sign < 0 ? ' - ' : ' + ') + mt;
    }
    if (paren && ((m.sign !== 0 && c.sign !== 0) || s[0] === '-')) s = '(' + s + ')';
    return s;
}
const pf = (x: Fr) => (x.sign < 0 ? '(' + x + ')' : String(x));

function terms(list: { c: Fr; name: string }[], keepZero?: boolean): string {
    let out = '';
    list.forEach(t => {
        if (t.c.sign === 0 && !keepZero) return;
        const neg = t.c.sign < 0;
        const abs = neg ? t.c.neg() : t.c;
        const coef = (abs.cmp(ONE) === 0 && !keepZero) ? '' : abs.toString();
        out += out === '' ? (neg ? '-' : '') + coef + t.name : (neg ? ' - ' : ' + ') + coef + t.name;
    });
    return out || '0';
}

/* ---------- Build the steps ---------- */
export function buildSteps(P: SimplexProblem): SimplexResult {
    const isMax = P.mode === 'max';
    const V = P.vars.length, K = P.cons.length;
    if (V < 1 || K < 1) return { error: 'Need at least one variable and one constraint.' };

    const names = P.vars.map(v => String(v.name || '').trim());
    for (const n of names) {
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n)) return { error: 'Variable names must be letters/numbers only (e.g. T, C, x1), starting with a letter.' };
    }
    if (new Set(names).size !== names.length) return { error: 'Variable names must be different from each other.' };

    const objCn = P.vars.map(v => parseFr(v.c));
    if (objCn.some(x => !x)) return { error: 'Every objective coefficient must be a number (e.g. 700, -2.5, 1/2).' };
    const objC = objCn as Fr[];
    const cons: { a: Fr[]; b: Fr; op: string; flipped: boolean }[] = [];
    for (let i = 0; i < K; i++) {
        const c = P.cons[i];
        const an = c.a.map(parseFr), bn = parseFr(c.b);
        if (an.some(x => !x) || !bn) return { error: 'Constraint ' + (i + 1) + ' has a value that is not a number.' };
        const a = an as Fr[], b = bn;
        let op: string = c.op, flipped = false, aa = a, bb = b;
        if (bb.sign < 0) { aa = a.map(x => x.neg()); bb = b.neg(); op = op === '<=' ? '>=' : op === '>=' ? '<=' : '='; flipped = true; }
        cons.push({ a: aa, b: bb, op, flipped });
    }

    /* Columns */
    const cols: Col[] = names.map((n, j) => ({ name: n, cost: mk(objC[j]), kind: 'x' }));
    const sCol: Record<number, number> = {}, aCol: Record<number, number> = {};
    cons.forEach((c, i) => { if (c.op !== '=') { sCol[i] = cols.length; cols.push({ name: 'S' + (i + 1), cost: mk(ZERO), kind: 's' }); } });
    cons.forEach((c, i) => { if (c.op !== '<=') { aCol[i] = cols.length; cols.push({ name: 'A' + (i + 1), cost: isMax ? mk(ZERO, NEG1) : mk(ZERO, ONE), kind: 'a' }); } });
    const hasArt = Object.keys(aCol).length > 0;

    let T: Tab = {
        cols,
        rows: cons.map((c, i) => {
            const a = cols.map(() => ZERO);
            c.a.forEach((x, j) => { a[j] = x; });
            if (sCol[i] != null) a[sCol[i]] = c.op === '<=' ? ONE : NEG1;
            if (aCol[i] != null) a[aCol[i]] = ONE;
            return { b: c.op === '<=' ? sCol[i] : aCol[i], qty: c.b, a };
        })
    };

    const steps: SimplexStep[] = [];
    const push = (title: string, html: string, tables: SimplexTable[] | null, o: PushOpts = {}) => steps.push({
        title, html, tables: tables || [], arrows: o.arrows || [], formula: o.formula || '', fparts: o.fparts || null, farrows: o.farrows || null,
        calc: o.calc || [], group: o.group || title
    });

    function snap(T: Tab, o: SnapOpts = {}): SimplexTable {
        const bl = o.blank || new Set();
        return {
            label: o.label || '',
            head: T.cols.map(c => fmtM(c.cost)),
            names: T.cols.map(c => c.name),
            rows: T.rows.map((r, i) => ({
                cj: fmtM(T.cols[r.b].cost), name: T.cols[r.b].name,
                qty: bl.has(i + ':q') ? '' : r.qty.toString(),
                cells: r.a.map((x, j) => (bl.has(i + ':' + j) ? '' : x.toString())),
                ratio: o.ratio ? (o.ratio[i] == null ? '' : o.ratio[i]) : undefined
            })),
            zj: o.zj ? { qty: o.zjq ? fmtM(o.zjq) : '', cells: o.zj.map(z => (z ? fmtM(z) : '')) } : null,
            cjzj: o.cjzj ? o.cjzj.map(z => (z ? fmtM(z) : '')) : null,
            hasRatio: !!o.ratio,
            hl: o.hl || {}
        };
    }
    const allBlank = (T: Tab): Set<string> => {
        const s = new Set<string>();
        T.rows.forEach((r, i) => { s.add(i + ':q'); r.a.forEach((_, j) => s.add(i + ':' + j)); });
        return s;
    };

    /* Step: formulate */
    {
        const objTerms = P.vars.map((v, j) => ({ c: objC[j], name: names[j] }));
        let html = '<p><b>Objective function:</b> ' + (isMax ? 'Max' : 'Min') + ' Z = ' + terms(objTerms) + '</p><p><b>Constraints:</b></p><ul>';
        cons.forEach((c, i) => {
            const sym = c.op === '<=' ? '≤' : c.op === '>=' ? '≥' : '=';
            html += '<li>' + terms(names.map((n, j) => ({ c: c.a[j], name: n }))) + ' ' + sym + ' ' + c.b +
                (c.flipped ? ' <i>(both sides were multiplied by -1 so the right-hand side is positive)</i>' : '') + '</li>';
        });
        html += '<li>' + names.join(', ') + ' ≥ 0 (non-negativity)</li></ul>';
        html += '<p>Turn each inequality into an equation by adding extra variables:</p><ul>';
        cons.forEach((c, i) => {
            const list = names.map((n, j) => ({ c: c.a[j], name: n }));
            if (sCol[i] != null) list.push({ c: c.op === '<=' ? ONE : NEG1, name: 'S' + (i + 1) });
            if (aCol[i] != null) list.push({ c: ONE, name: 'A' + (i + 1) });
            html += '<li>' + terms(list) + ' = ' + c.b + '</li>';
        });
        html += '</ul>';
        html += '<p><b>S</b> (slack) shows unused resources in a ≤ constraint; for a ≥ constraint it becomes a <b>surplus</b> (subtracted).</p>';
        if (hasArt) {
            html += '<p><b>A</b> (artificial) variables give us a starting solution when a constraint is ≥ or =. ' +
                'We punish them with a huge cost <b>M</b> (' + (isMax ? '-M in a Max problem' : '+M in a Min problem') + ') so the method drives them out. This is the <b>Big-M method</b>.</p>';
        }
        const full = cols.map(c => {
            const f = c.cost;
            if (c.kind === 'a') return (isMax ? '- M' : '+ M') + c.name;
            return (f.c.sign < 0 ? '- ' : '+ ') + (f.c.sign < 0 ? f.c.neg() : f.c) + c.name;
        }).join(' ').replace(/^\+ /, '');
        html += '<p><b>New objective:</b> ' + (isMax ? 'Max' : 'Min') + ' Z = ' + full + '</p>';
        push('Set up the problem', html, null);
    }

    let it = 1;
    const n = cols.length;
    push('Table 1: Starting point',
        '<p>Plot the numbers into the table. Each constraint is a row; the Cj of a variable is its coefficient in the objective function.</p>' +
        '<p>The starting <b>Product Mix (PM)</b> is made of the ' + (hasArt ? 'slack and artificial' : 'slack') + ' variables, so each of them has a single <b>1</b> in its own column and 0 in the others.</p>',
        [snap(T)]);

    const MAXIT = 60;
    for (;;) {
        const tn = 'Table ' + it;
        const zj = T.cols.map((_, j) => T.rows.reduce((s, r) => madd(s, mscale(T.cols[r.b].cost, r.a[j])), mk(ZERO)));
        const zjq = T.rows.reduce((s, r) => madd(s, mscale(T.cols[r.b].cost, r.qty)), mk(ZERO));
        const cjzj = T.cols.map((c, j) => msub(c.cost, zj[j]));

        /* ---- Zj, one cell at a time (Qty first, like the notes) ---- */
        {
            const shown = new Array(n).fill(null);
            let shownQ: MNum | null = null;
            (['q'] as (string | number)[]).concat(T.cols.map((_, j) => j)).forEach(target => {
                let value: MNum, label: string, parts: string[];
                if (target === 'q') { shownQ = zjq; value = zjq; label = 'Qty'; parts = T.rows.map(r => fmtM(T.cols[r.b].cost, true) + '(' + r.qty + ')'); }
                else { shown[target as number] = zj[target as number]; value = zj[target as number]; label = T.cols[target as number].name; parts = T.rows.map(r => fmtM(T.cols[r.b].cost, true) + '(' + r.a[target as number] + ')'); }
                const arrows: Arrow[] = [], fparts: FPart[] = [{ t: 'Zj (' + label + ') = ' }], farrows: FArrow[] = [];
                T.rows.forEach((r, i) => {
                    arrows.push({ from: [0, i, 'cj'], to: [0, i, target], kind: 'cost', mid: true });
                    const cs = fmtM(T.cols[r.b].cost, true), vs = '(' + (target === 'q' ? r.qty : r.a[target as number]) + ')';
                    if (i) fparts.push({ t: ' + ' });
                    fparts.push({ t: cs, id: 'c' + i }, { t: vs, id: 'v' + i });
                    farrows.push({ cell: [0, i, 'cj'], part: 'c' + i, kind: 'cost' }, { cell: [0, i, target], part: 'v' + i, kind: 'val' });
                });
                /* then add the products up: 2 -> 3 -> ... -> result */
                for (let i = 1; i < T.rows.length; i++) arrows.push({ from: [0, i - 1, target], to: [0, i, target], kind: 'val', mid: true });
                arrows.push({ from: [0, T.rows.length - 1, target], to: [0, 'z', target], kind: 'res' });
                fparts.push({ t: ' = ' }, { t: fmtM(value), id: 'r' });
                farrows.push({ cell: [0, 'z', target], part: 'r', kind: 'res' });
                push(tn + ': Zj of ' + label,
                    '<p><b>Zj</b> = multiply each row\'s <b>Cj</b> (left) by that row\'s value in the <b>' + label + '</b> column, then add the results.</p>',
                    [snap(T, { zj: shown.slice(), zjq: shownQ })],
                    { arrows, fparts, farrows, formula: 'Zj (' + label + ') = ' + parts.join(' + ') + ' = ' + fmtM(value), group: 'Zj of ' + tn });
            });
        }

        /* ---- Cj - Zj, one cell at a time ---- */
        {
            const shown = new Array(n).fill(null);
            T.cols.forEach((c, j) => {
                shown[j] = cjzj[j];
                push(tn + ': Cj - Zj of ' + c.name,
                    '<p><b>Cj - Zj</b> = the Cj on top of the column minus the Zj of that column.</p>',
                    [snap(T, { zj, zjq, cjzj: shown.slice() })],
                    {
                        arrows: [{ from: [0, 'h', j], to: [0, 'z', j], kind: 'cost', mid: true }, { from: [0, 'z', j], to: [0, 'cz', j], kind: 'res' }],
                        fparts: [{ t: 'Cj - Zj (' + c.name + ') = ' }, { t: fmtM(c.cost), id: 'c' }, { t: ' - ' }, { t: fmtM(zj[j], true), id: 'z' }, { t: ' = ' }, { t: fmtM(cjzj[j]), id: 'r' }],
                        farrows: [{ cell: [0, 'h', j], part: 'c', kind: 'cost' }, { cell: [0, 'z', j], part: 'z', kind: 'val' }, { cell: [0, 'cz', j], part: 'r', kind: 'res' }],
                        formula: 'Cj - Zj (' + c.name + ') = ' + fmtM(c.cost) + ' - ' + fmtM(zj[j], true) + ' = ' + fmtM(cjzj[j]),
                        group: 'Cj - Zj of ' + tn
                    });
            });
        }

        let ent = -1;
        T.cols.forEach((c, j) => {
            const s = msign(cjzj[j]);
            if (isMax ? s > 0 : s < 0) {
                if (ent < 0 || (isMax ? mcmp(cjzj[j], cjzj[ent]) > 0 : mcmp(cjzj[j], cjzj[ent]) < 0)) ent = j;
            }
        });

        if (ent < 0) {
            const artBad = T.rows.some(r => T.cols[r.b].kind === 'a' && r.qty.sign > 0);
            const val: Record<string, Fr> = {};
            T.rows.forEach(r => { val[T.cols[r.b].name] = r.qty; });
            const get = (nm: string) => (val[nm] ? val[nm].toString() : '0');
            let html = '<p>There is no ' + (isMax ? 'positive' : 'negative') + ' Cj - Zj left, so <b>this is the optimal table</b>.</p>';
            if (artBad) {
                html += '<p class="bad"><b>No feasible solution.</b> An artificial variable is still in the product mix with a value above 0, which means the constraints contradict each other and cannot all be satisfied at the same time.</p>';
            } else {
                html += '<p class="good"><b>Optimal solution found!</b></p><ul>' +
                    names.map(nm => '<li><b>' + nm + '</b> = ' + get(nm) + '</li>').join('') + '</ul><ul>' +
                    cons.map((c, i) => (sCol[i] != null ? '<li>S' + (i + 1) + ' = ' + get('S' + (i + 1)) + (get('S' + (i + 1)) === '0' ? ' (constraint ' + (i + 1) + ' is fully used)' : ' (' + (c.op === '<=' ? 'unused amount' : 'extra above the minimum') + ')') + '</li>' : '')).join('') +
                    '</ul><p><b>' + (isMax ? 'Maximum' : 'Minimum') + ' Z = ' + zjq.c + '</b></p>' +
                    '<p>Check: Z = ' + names.map((nm, j) => objC[j] + '(' + get(nm) + ')').join(' + ') + ' = ' + zjq.c + '</p>';
            }
            push(tn + ': Final answer', html, [snap(T, { zj, zjq, cjzj, hl: { final: true } })], { group: 'final' });
            return { steps, result: { feasible: !artBad, z: artBad ? null : zjq.c.toString(), values: Object.fromEntries(names.map(nm => [nm, get(nm)])) } };
        }

        if (it >= MAXIT) {
            push('Stopped', '<p class="bad">Stopped after ' + MAXIT + ' tables (the problem may be cycling).</p>', []);
            return { steps };
        }

        /* ---- Optimal column ---- */
        const ec = T.cols[ent];
        push(tn + ': Find the Optimal Column (OC)',
            '<p>Not optimal yet: a <b>' + (isMax ? 'Max' : 'Min') + '</b> problem continues while some Cj - Zj is ' + (isMax ? 'positive' : 'negative') + '.</p>' +
            '<p>The <b>Optimal Column</b> is the one with the ' + (isMax ? '<b>highest</b> (most positive)' : '<b>lowest</b> (most negative)') + ' Cj - Zj: column <b>' + ec.name + '</b> with <b>' + fmtM(cjzj[ent]) + '</b>.</p>',
            [snap(T, { zj, zjq, cjzj, hl: { col: ent } })],
            { arrows: [{ from: [0, 'cz', ent], to: [0, 'n', ent], kind: 'pick', label: 'OC' }], group: 'oc' + it });

        /* ---- Ratio test, one row at a time ---- */
        const ratios: (Fr | null)[] = T.rows.map(r => (r.a[ent].sign > 0 ? r.qty.div(r.a[ent]) : null));
        let lv = -1;
        ratios.forEach((q, i) => { if (q && (lv < 0 || q.cmp(ratios[lv]!) < 0)) lv = i; });
        const ratioShown: (string | null)[] = T.rows.map(() => null);
        T.rows.forEach((r, i) => {
            ratioShown[i] = ratios[i] ? ratios[i].toString() : '—';
            push(tn + ': Ratio test, ' + T.cols[r.b].name + ' row',
                '<p>Ratio = <b>Qty ÷ Optimal Column value</b>. Rows where the OC value is 0 or negative are skipped.</p>',
                [snap(T, { zj, zjq, cjzj, ratio: ratioShown.slice(), hl: { col: ent } })],
                {
                    arrows: ratios[i]
                        ? [{ from: [0, i, 'q'], to: [0, i, ent], kind: 'val', mid: true }, { from: [0, i, ent], to: [0, i, 'ratio'], kind: 'res' }]
                        : [{ from: [0, i, 'q'], to: [0, i, ent], kind: 'val' }],
                    fparts: ratios[i]
                        ? [{ t: String(r.qty), id: 'q' }, { t: ' ÷ ' }, { t: String(r.a[ent]), id: 'd' }, { t: ' = ' }, { t: String(ratios[i]), id: 'r' }]
                        : [{ t: String(r.qty), id: 'q' }, { t: ' ÷ ' }, { t: String(r.a[ent]), id: 'd' }, { t: ' → skipped (OC value must be above 0)' }],
                    farrows: [{ cell: [0, i, 'q'], part: 'q', kind: 'val' }, { cell: [0, i, ent], part: 'd', kind: 'val' }].concat(ratios[i] ? [{ cell: [0, i, 'ratio'], part: 'r', kind: 'res' }] : []),
                    formula: ratios[i] ? r.qty + ' ÷ ' + r.a[ent] + ' = ' + ratios[i] : r.qty + ' ÷ ' + r.a[ent] + ' → skipped (OC value must be above 0)',
                    group: 'Ratio test ' + tn
                });
        });
        if (lv < 0) {
            push(tn + ': Ratio test', '<p class="bad"><b>Unbounded.</b> Every value in the Optimal Column is 0 or negative, so no row limits ' + ec.name + '. Z can ' + (isMax ? 'grow' : 'shrink') + ' forever. Double-check the constraints.</p>',
                [snap(T, { zj, zjq, cjzj, ratio: ratioShown, hl: { col: ent } })]);
            return { steps };
        }
        const ties = ratios.filter(q => q && q.cmp(ratios[lv]!) === 0).length > 1;
        const leaving = T.cols[T.rows[lv].b];
        push(tn + ': Choose the Replacing Row (RR)',
            '<p>The <b>lowest</b> non-negative ratio is <b>' + ratios[lv] + '</b>, so the <b>Replacing Row</b> is <b>' + leaving.name + '</b>.' + (ties ? ' <i>There is a tie; we pick the first one.</i>' : '') + '</p>',
            [snap(T, { zj, zjq, cjzj, ratio: ratioShown, hl: { col: ent, row: lv } })],
            { arrows: [{ from: [0, lv, 'ratio'], to: [0, lv, 'pm'], kind: 'pick', label: 'lowest' }], group: 'rr' + it });

        /* ---- Pivot ---- */
        const p = T.rows[lv].a[ent];
        const oldView = (label: string, extra?: SnapOpts) => snap(T, Object.assign({ zj, zjq, cjzj, ratio: ratioShown, label, hl: { col: ent, row: lv, pivot: true } }, extra || {}));
        push(tn + ': Find the pivot value',
            '<p>The <b>pivot value</b> is where the Replacing Row and the Optimal Column intersect: <b>' + p + '</b>.</p>' +
            '<p><b>' + leaving.name + '</b> leaves the product mix and <b>' + ec.name + '</b> enters.</p>',
            [oldView('')],
            { arrows: [{ from: [0, lv, 'pm'], to: [0, lv, ent], kind: 'swap', label: 'Replacing Row' }, { from: [0, 'n', ent], to: [0, lv, ent], kind: 'pick', label: 'Optimal Column' }], group: 'pivot' + it });

        /* ---- New table ---- */
        const N = { cols: T.cols, rows: T.rows.map(r => ({ b: r.b, qty: r.qty, a: r.a.slice() })) };
        N.rows[lv] = { b: ent, qty: T.rows[lv].qty.div(p), a: T.rows[lv].a.map(x => x.div(p)) };
        const others = T.rows.map((_, i) => i).filter(i => i !== lv);
        others.forEach(i => {
            const k = T.rows[i].a[ent];
            N.rows[i] = { b: T.rows[i].b, qty: T.rows[i].qty.sub(k.mul(N.rows[lv].qty)), a: T.rows[i].a.map((x, j) => x.sub(k.mul(N.rows[lv].a[j]))) };
        });
        const oldN = 'Table ' + it + ' (old)';
        it++;
        const newN = 'Table ' + it + ' (new)';
        const blank: Set<string> = allBlank(N);
        const view = (_extraNew?: unknown, hl?: Hl): SimplexTable[] => [oldView(oldN), snap(N, { blank, label: newN, hl: hl || {} })];

        push('Table ' + it + ': Swap the product mix',
            '<p><b>' + leaving.name + '</b> is replaced by <b>' + ec.name + '</b>, and the Cj of the row becomes <b>' + fmtM(ec.cost) + '</b>. The other rows keep their product mix.</p>',
            view(), {
                arrows: [
                    { from: [0, lv, 'pm'], to: [1, lv, 'pm'], kind: 'swap', label: 'leaves' },
                    { from: [0, 'n', ent], to: [1, lv, 'pm'], kind: 'pick', label: 'enters' },
                    { from: [0, 'h', ent], to: [1, lv, 'cj'], kind: 'cost', label: 'Cj' }
                ], group: 'swap' + it
            });

        /* pivot row: divide each cell by the pivot */
        (['q'] as (string | number)[]).concat(T.cols.map((_, j) => j)).forEach(c => {
            const oldV = c === 'q' ? T.rows[lv].qty : T.rows[lv].a[c as number];
            const newV = c === 'q' ? N.rows[lv].qty : N.rows[lv].a[c as number];
            blank.delete(lv + ':' + c);
            const lab = c === 'q' ? 'Qty' : T.cols[c as number].name;
            const arrows = c !== ent
                ? [{ from: [0, lv, ent], to: [0, lv, c], kind: 'mult', mid: true }, { from: [0, lv, c], to: [1, lv, c], kind: 'old' }]
                : [{ from: [0, lv, c], to: [1, lv, c], kind: 'old' }];
            push('Table ' + it + ': ' + ec.name + ' row, ' + lab,
                '<p>Divide every value of the Replacing Row by the pivot value (<b>' + p + '</b>). The pivot position becomes <b>1</b>.</p>',
                view(), { arrows, formula: lab + ': ' + oldV + ' ÷ ' + p + ' = ' + newV,
                    fparts: [{ t: lab + ': ' }, { t: String(oldV), id: 'o' }, { t: ' ÷ ' }, { t: String(p), id: 'k' }, { t: ' = ' }, { t: String(newV), id: 'r' }],
                    farrows: [{ cell: [0, lv, c], part: 'o', kind: 'old' }].concat(c !== ent ? [{ cell: [0, lv, ent], part: 'k', kind: 'mult' }] : [], [{ cell: [1, lv, c], part: 'r', kind: 'res' }]), group: 'Table ' + it + ': ' + ec.name + ' row' });
            steps[steps.length - 1].tables[1].hl = { row: lv };
        });

        /* other rows: old - k * (new pivot row) */
        others.forEach(i => {
            const k = T.rows[i].a[ent];
            const nm = T.cols[T.rows[i].b].name;
            const grp = 'Table ' + it + ': ' + nm + ' row';
            const intro = '<p><b>New row = old row - (the number in the Optimal Column of the old row) × (the new ' + ec.name + ' row)</b>.</p>' +
                '<p>The number we multiply by is <b>' + k + '</b>, the value in the ' + ec.name + ' column of the ' + nm + ' row in ' + oldN.replace(' (old)', '') + '.</p>';
            if (k.sign === 0) {
                (['q'] as (string | number)[]).concat(T.cols.map((_, j) => j)).forEach(c => blank.delete(i + ':' + c));
                push('Table ' + it + ': ' + nm + ' row (no change)',
                    '<p>The number in the Optimal Column of this row is <b>0</b>, so subtracting 0 × (new row) changes nothing. The row is simply copied.</p>',
                    view(), {
                        arrows: (['q'] as (string | number)[]).concat(T.cols.map((_, j) => j)).map(c => ({ from: [0, i, c], to: [1, i, c], kind: 'old' })),
                        group: grp
                    });
                steps[steps.length - 1].tables[1].hl = { row: i };
                return;
            }
            (['q'] as (string | number)[]).concat(T.cols.map((_, j) => j)).forEach(c => {
                const o = c === 'q' ? T.rows[i].qty : T.rows[i].a[c as number];
                const pr = c === 'q' ? N.rows[lv].qty : N.rows[lv].a[c as number];
                const res = c === 'q' ? N.rows[i].qty : N.rows[i].a[c as number];
                blank.delete(i + ':' + c);
                const lab = c === 'q' ? 'Qty' : T.cols[c as number].name;
                push('Table ' + it + ': ' + nm + ' row, ' + lab, intro, view(), {
                    arrows: [
                        { from: [0, i, ent], to: [1, lv, c], kind: 'mult', mid: true },
                        { from: [0, i, c], to: [1, lv, c], kind: 'old', mid: true },
                        { from: [1, lv, c], to: [1, i, c], kind: 'res' }
                    ],
                    fparts: [{ t: lab + ': ' }, { t: String(o), id: 'o' }, { t: ' - ' }, { t: pf(k), id: 'k' }, { t: '(' + pr + ')', id: 'p' }, { t: ' = ' }, { t: String(res), id: 'r' }],
                    farrows: [{ cell: [0, i, c], part: 'o', kind: 'old' }, { cell: [0, i, ent], part: 'k', kind: 'mult' }, { cell: [1, lv, c], part: 'p', kind: 'val' }, { cell: [1, i, c], part: 'r', kind: 'res' }],
                    formula: lab + ': ' + o + ' - ' + pf(k) + '(' + pr + ') = ' + res,
                    group: grp
                });
                steps[steps.length - 1].tables[1].hl = { row: i };
            });
        });

        T = N;
    }
}
