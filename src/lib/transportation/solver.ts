/* Transportation Problem (minimize cost): balance with a Dummy, a starting solution (Northwest Corner or Least Cost),
   a degeneracy test, then MODI or the Stepping Stone method until optimal. Exact fractions (the Simplex Fr class), no DOM. */
import { Fr, parseFr } from '../simplex/solver';
import type { ArrowDef, FormulaArrow, FormulaPart } from '../../components/arrows';
import type { StepBase } from '../../lessons/types';

export interface TSource { name: string; supply: string }
export interface TDest { name: string; demand: string }
export interface TransProblem { method: 'nwc' | 'lc'; /** how the schedule is improved (default MODI) */ improve?: 'modi' | 'stepping'; cur?: string; sources: TSource[]; dests: TDest[]; cost: string[][] }

export interface TCell { r: number; c: number }
export interface TTable {
    rows: string[]; cols: string[];
    cost: string[][];
    alloc: (string | null)[][];
    supply: string[]; demand: string[];
    /** supply / demand left while building the starting solution; `before` holds the amounts before the cell being filled,
     *  so its row and column show "before → left" */
    left?: { s: string[]; d: string[]; before?: { i: number; j: number; s: string; d: string } };
    grayR: number[]; grayC: number[];
    u?: (string | null)[]; v?: (string | null)[];
    index?: (string | null)[][];
    /** "r,c" -> extra classes: enter, leave, new, hl */
    flags: Record<string, string>;
    sign: Record<string, '+' | '-'>;
    /** closed loop to draw as a dashed path, in order */
    loop?: TCell[];
    tc?: string | null;
    newR: number; newC: number;       // the Dummy row / column when it was just added (-1 = none)
}
export interface AnswerTable { head: string[]; rows: string[][]; foot?: string[] }
export interface TransStep extends StepBase {
    table: TTable | null;
    answer: AnswerTable | null;
    /** milestone for the Tables tab */
    gallery?: string;
    final?: boolean;
}
export interface TransResult {
    totalSupply: string; totalDemand: string;
    dummy: 'row' | 'col' | null; dummyAmount: string;
    start: { method: 'nwc' | 'lc'; allocations: { from: string; to: string; units: string }[]; filled: number; needed: number; degenerate: boolean; zeroCells: string[]; cost: string };
    iterations: { enter: string; index: string; theta: string; leave: string; cost: string; zeroMove: boolean }[];
    optimalCost: string;
    schedule: { from: string; to: string; units: string; unitCost: string; cost: string }[];
    held: { name: string; units: string }[];
    zeroIndexCells: string[];
    alternateOptima: boolean;
    optimal: boolean;
}
export interface TransSolve { steps?: TransStep[]; error?: string; result?: TransResult }

export const MAX_SIDE = 6;
const ZERO = new Fr(0n);
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => String(n).split('').map(d => SUBS[+d]).join('');
const U = (i: number) => 'u' + sub(i + 1), V = (j: number) => 'v' + sub(j + 1);
const S = (f: Fr) => f.toString();

export function solveTransport(P: TransProblem): TransSolve {
    const m0 = P.sources?.length || 0, n0 = P.dests?.length || 0;
    if (m0 < 1 || n0 < 1) return { error: 'Need at least one source and one destination.' };
    if (m0 > MAX_SIDE || n0 > MAX_SIDE) return { error: 'At most ' + MAX_SIDE + ' sources and ' + MAX_SIDE + ' destinations.' };
    const srcNames = P.sources.map(s => String(s.name || '').trim()), dstNames = P.dests.map(d => String(d.name || '').trim());
    if (srcNames.concat(dstNames).some(n => !n)) return { error: 'Every source and destination needs a name.' };
    if (new Set(srcNames).size !== m0) return { error: 'Source names must be different from each other.' };
    if (new Set(dstNames).size !== n0) return { error: 'Destination names must be different from each other.' };
    if (srcNames.concat(dstNames).some(n => /^dummy$/i.test(n))) return { error: '"Dummy" is reserved: the app adds it by itself when supply and demand differ.' };
    const sup0: Fr[] = [], dem0: Fr[] = [];
    for (let i = 0; i < m0; i++) { const f = parseFr(P.sources[i].supply); if (!f || f.sign < 0) return { error: 'The supply of ' + srcNames[i] + ' must be a number of 0 or more.' }; sup0.push(f); }
    for (let j = 0; j < n0; j++) { const f = parseFr(P.dests[j].demand); if (!f || f.sign < 0) return { error: 'The demand of ' + dstNames[j] + ' must be a number of 0 or more.' }; dem0.push(f); }
    const cost0: Fr[][] = [];
    for (let i = 0; i < m0; i++) {
        cost0.push([]);
        for (let j = 0; j < n0; j++) { const f = parseFr(P.cost[i]?.[j]); if (!f) return { error: 'The cost from ' + srcNames[i] + ' to ' + dstNames[j] + ' must be a number.' }; cost0[i].push(f); }
    }
    const tS = sup0.reduce((a, b) => a.add(b), ZERO), tD = dem0.reduce((a, b) => a.add(b), ZERO);
    if (tS.sign <= 0) return { error: 'Total supply must be more than 0.' };
    if (tD.sign <= 0) return { error: 'Total demand must be more than 0.' };
    const cur = P.cur || '';
    const money = (f: Fr) => cur + S(f);

    /* ---- balance: a Dummy row or column with cost 0 ---- */
    const rows = srcNames.slice(), cols = dstNames.slice();
    const sup = sup0.slice(), dem = dem0.slice();
    const cost: Fr[][] = cost0.map(r => r.slice());
    let dummyRow = -1, dummyCol = -1;
    const diff = tS.sub(tD);
    if (diff.sign > 0) { dummyCol = cols.length; cols.push('Dummy'); dem.push(diff); cost.forEach(r => r.push(ZERO)); }
    else if (diff.sign < 0) { dummyRow = rows.length; rows.push('Dummy'); sup.push(diff.neg()); cost.push(cols.map(() => ZERO)); }
    const m = rows.length, n = cols.length;
    const isDummy = (i: number, j: number) => i === dummyRow || j === dummyCol;
    const cn = (i: number, j: number) => rows[i] + '-' + cols[j];

    type Alloc = (Fr | null)[][];
    const blank = (): Alloc => rows.map(() => cols.map(() => null));
    const tcOf = (a: Alloc) => { let t = ZERO; a.forEach((r, i) => r.forEach((x, j) => { if (x) t = t.add(x.mul(cost[i][j])); })); return t; };
    const basisOf = (a: Alloc): TCell[] => { const out: TCell[] = []; a.forEach((r, i) => r.forEach((x, j) => { if (x) out.push({ r: i, c: j }); })); return out; };

    const steps: TransStep[] = [];
    const push = (title: string, html: string, o: Partial<TransStep> & { fparts?: FormulaPart[] | null } = {}) => steps.push({
        title, html, formula: o.formula || '', fparts: o.fparts || null, farrows: (o.farrows as FormulaArrow[]) || null,
        arrows: (o.arrows as ArrowDef[]) || [], group: o.group || title, table: o.table || null, answer: o.answer || null, gallery: o.gallery, final: o.final
    });
    const plain = (t: string) => ({ formula: t, fparts: [{ t }] as FormulaPart[] });
    /* a formula in labelled boxes: "Formula:" with the working, and "Final Answer:" only when the step has a result */
    const NL = String.fromCharCode(10);
    const FP = (x: string | FormulaPart[]): FormulaPart[] => typeof x === 'string' ? [{ t: x }] : x;
    const fx = (f: string | FormulaPart[], a?: string | FormulaPart[]) => {
        const fparts: FormulaPart[] = [{ t: 'Formula:' + NL }, ...FP(f), ...(a ? [{ t: NL + NL + 'Final Answer:' + NL }, ...FP(a)] : [])];
        return { fparts, formula: fparts.map(x => x.t).join('') };
    };

    interface Snap {
        alloc?: Alloc; left?: TTable['left']; grayR?: number[]; grayC?: number[]; u?: (Fr | null)[]; v?: (Fr | null)[];
        index?: (Fr | null)[][]; flags?: Record<string, string>; sign?: TTable['sign']; loop?: TCell[]; tc?: Fr | null; newR?: number; newC?: number;
    }
    const snap = (o: Snap = {}): TTable => ({
        rows: rows.slice(), cols: cols.slice(),
        cost: cost.map(r => r.map(S)),
        alloc: (o.alloc || blank()).map(r => r.map(x => (x ? S(x) : null))),
        supply: sup.map(S), demand: dem.map(S),
        left: o.left, grayR: o.grayR || [], grayC: o.grayC || [],
        u: o.u ? o.u.map(x => (x ? S(x) : null)) : undefined, v: o.v ? o.v.map(x => (x ? S(x) : null)) : undefined,
        index: o.index ? o.index.map(r => r.map(x => (x ? S(x) : null))) : undefined,
        flags: o.flags || {}, sign: o.sign || {}, loop: o.loop, tc: o.tc ? money(o.tc) : null, newR: o.newR ?? -1, newC: o.newC ?? -1
    });
    const key = (i: number, j: number) => i + ',' + j;

    /* ===== 1. Balance ===== */
    {
        let html = '<p><b>Total supply</b> = ' + sup0.map(S).join(' + ') + ' = <b>' + tS + '</b></p><p><b>Total demand</b> = ' + dem0.map(S).join(' + ') + ' = <b>' + tD + '</b></p>';
        if (diff.sign === 0) html += '<p class="good">Supply equals demand, so the problem is already <b>balanced</b>. No Dummy is needed.</p>';
        else if (diff.sign > 0) html += '<p>Supply is bigger than demand by <b>' + diff + '</b>, so we add a <b>Dummy destination</b> (a column) with demand ' + diff + '. Shipping to Dummy means <i>not</i> shipping, so its costs are <b>0</b>.</p>';
        else html += '<p>Demand is bigger than supply by <b>' + diff.neg() + '</b>, so we add a <b>Dummy source</b> (a row) with supply ' + diff.neg() + '. Receiving from Dummy means <i>not</i> receiving, so its costs are <b>0</b>.</p>';
        push('Balance supply and demand', html, {
            ...(diff.sign === 0 ? fx('Supply ' + tS + ' = Demand ' + tD) : fx('Supply ' + tS + (diff.sign > 0 ? ' > ' : ' < ') + 'Demand ' + tD, 'Dummy ' + (diff.sign > 0 ? 'column' : 'row') + ' = ' + (diff.sign > 0 ? diff : diff.neg()))),
            table: snap({ newR: dummyRow, newC: dummyCol }), gallery: diff.sign === 0 ? 'Balanced table' : 'Balanced table (with Dummy)'
        });
    }

    /* ===== 2. Starting solution ===== */
    const alloc = blank();
    const sl = sup.slice(), dl = dem.slice();
    const done = { r: new Set<number>(), c: new Set<number>() };
    const method = P.method === 'lc' ? 'lc' : 'nwc';
    const improve = P.improve === 'stepping' ? 'stepping' : 'modi';
    const IM = improve === 'stepping' ? 'Stepping stone' : 'MODI';
    const startList: { r: number; c: number; amt: Fr }[] = [];
    let okStart = 0;
    const doAlloc = (i: number, j: number, why: string, extra: string) => {
        const amt = sl[i].cmp(dl[j]) <= 0 ? sl[i] : dl[j];
        const sb = sl[i], db = dl[j];
        alloc[i][j] = amt;
        sl[i] = sl[i].sub(amt); dl[j] = dl[j].sub(amt);
        startList.push({ r: i, c: j, amt });
        okStart++;
        const rowGone = sl[i].sign === 0, colGone = dl[j].sign === 0;
        if (rowGone) done.r.add(i);
        if (colGone) done.c.add(j);
        let html = '<p>' + why + '</p>';
        html += '<p>Allocate <b>min(' + sb + ', ' + db + ') = ' + amt + '</b> to <b>' + cn(i, j) + '</b> (cost ' + cost[i][j] + ' per unit).</p>';
        html += '<p>' + rows[i] + ' has ' + sb + ' − ' + amt + ' = <b>' + sl[i] + '</b> left. ' + cols[j] + ' still needs ' + db + ' − ' + amt + ' = <b>' + dl[j] + '</b>.' +
            (rowGone && colGone ? ' <b>Both the row and the column are used up</b> (greyed out).' : rowGone ? ' Row <b>' + rows[i] + '</b> is used up (greyed out).' : colGone ? ' Column <b>' + cols[j] + '</b> is used up (greyed out).' : '') + '</p>' + extra;
        const parts: FormulaPart[] = [{ t: 'min(' }, { t: S(sb), id: 's' }, { t: ', ' }, { t: S(db), id: 'd' }, { t: ')' }];
        push('Allocation ' + okStart + ': ' + cn(i, j), html, {
            ...fx(parts, [{ t: cn(i, j) + ' = ' }, { t: S(amt), id: 'r' }]),
            arrows: [{ from: [0, i, 's'], to: [0, i, j], kind: 'val', mid: true }, { from: [0, 'd', j], to: [0, i, j], kind: 'val' }],
            farrows: [{ part: 's', kind: 'val' }, { part: 'd', kind: 'val' }, { part: 'r', kind: 'res' }],
            table: snap({ alloc, left: { s: sl.map(S), d: dl.map(S), before: { i, j, s: S(sb), d: S(db) } }, grayR: Array.from(done.r), grayC: Array.from(done.c), flags: { [key(i, j)]: 'hl' } }),
            group: 'Start ' + okStart
        });
        return { rowGone, colGone };
    };
    {
        /* intro: the table before the first allocation */
        push('Starting solution: ' + (method === 'nwc' ? 'Northwest Corner' : 'Least Cost'),
            method === 'nwc'
                ? '<p><b>Northwest Corner method.</b> Start at the <b>top-left</b> cell. Allocate as much as you can: the smaller of the supply left and the demand left.</p><p>If the row is used up, move <b>down</b>. If the column is satisfied, move <b>right</b>. <i>Costs are ignored.</i> One allocation per step.</p>'
                : '<p><b>Least Cost method.</b> Always take the cell with the <b>lowest cost</b> among rows and columns not yet used up. Allocate the smaller of the supply left and the demand left.</p><p><b>Dummy cells are filled last.</b> If two cells have the same cost, take the one that can hold the <b>larger amount</b>; if still tied, the first one in row order. One allocation per step.</p>',
            { ...fx(method === 'nwc' ? 'Northwest Corner: top-left, then right or down' : 'Least Cost: cheapest real cell first, Dummy last'), table: snap({ left: { s: sl.map(S), d: dl.map(S) } }), group: 'Start 0' });
    }
    if (method === 'nwc') {
        let i = 0, j = 0;
        while (i < m && j < n) {
            if (sl[i].sign === 0) { i++; continue; }
            if (dl[j].sign === 0) { j++; continue; }
            const { rowGone, colGone } = doAlloc(i, j, 'We are at <b>' + cn(i, j) + '</b> (' + (startList.length === 0 ? 'top-left' : 'next cell') + ').', '');
            if (rowGone && colGone) { i++; j++; } else if (rowGone) i++; else j++;
        }
    } else {
        for (;;) {
            let best: { r: number; c: number } | null = null;
            const pass = (dummyOk: boolean) => {
                for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
                    if (sl[i].sign <= 0 || dl[j].sign <= 0) continue;
                    if (isDummy(i, j) !== dummyOk) continue;
                    if (!best) { best = { r: i, c: j }; continue; }
                    const cc = cost[i][j].cmp(cost[best.r][best.c]);
                    if (cc < 0) best = { r: i, c: j };
                    else if (cc === 0) {
                        const a = sl[i].cmp(dl[j]) <= 0 ? sl[i] : dl[j], b = sl[best.r].cmp(dl[best.c]) <= 0 ? sl[best.r] : dl[best.c];
                        if (a.cmp(b) > 0) best = { r: i, c: j };      // a tie: the cell that can take the larger amount (else the first in row order)
                    }
                }
            };
            pass(false);
            if (!best) pass(true);
            if (!best) break;
            const b = best as { r: number; c: number };
            const real = !isDummy(b.r, b.c);
            const tie = (() => {
                let ties = 0;
                for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (sl[i].sign > 0 && dl[j].sign > 0 && isDummy(i, j) === !real && cost[i][j].cmp(cost[b.r][b.c]) === 0) ties++;
                return ties > 1;
            })();
            doAlloc(b.r, b.c, real
                ? 'The cheapest cell among the rows and columns still open is <b>' + cn(b.r, b.c) + '</b> with cost <b>' + cost[b.r][b.c] + '</b>.' + (tie ? ' Several cells share that cost, so we take the one that can hold the larger amount (then the first in row order).' : '')
                : 'Only <b>Dummy</b> cells are left, and they are filled last. The cheapest is <b>' + cn(b.r, b.c) + '</b> (cost 0).', '');
        }
    }
    /* in the order they were made */
    const allocs = () => startList.map(x => ({ from: rows[x.r], to: cols[x.c], units: S(x.amt) }));

    /* ===== 3. Degeneracy test ===== */
    const need = m + n - 1;
    const zeroCells: string[] = [];
    {
        let have = basisOf(alloc).length;
        const showTable = (flags: Record<string, string> = {}) => snap({ alloc, flags });
        if (have === need) {
            push('Degeneracy test', '<p>A good basic solution has exactly <b>m + n − 1</b> filled cells: ' + m + ' + ' + n + ' − 1 = <b>' + need + '</b>.</p><p>We have <b>' + have + '</b> filled cells, so the solution is <b class="good">not degenerate</b> and we can go on.</p>',
                { ...fx('filled cells = ' + have + NL + 'm + n − 1 = ' + need, 'not degenerate'), table: showTable(), gallery: 'Starting solution' });
        } else {
            push('Degeneracy test', '<p>A good basic solution has exactly <b>m + n − 1</b> filled cells: ' + m + ' + ' + n + ' − 1 = <b>' + need + '</b>.</p><p>We have only <b>' + have + '</b>, so the solution is <b class="bad">degenerate</b>. MODI needs ' + need + ' filled cells to find every u and v, so we add ' + (need - have === 1 ? 'a' : (need - have)) + ' filled cell' + (need - have === 1 ? '' : 's') + ' with <b>0</b> units.</p>',
                { ...fx('filled cells = ' + have + NL + 'm + n − 1 = ' + need, 'degenerate'), table: showTable(), group: 'Degeneracy' });
            let guard = 0;
            while (have < need && guard++ < 20) {
                /* union-find over rows and columns joined by the filled cells */
                const par = Array.from({ length: m + n }, (_, k) => k);
                const find = (x: number): number => (par[x] === x ? x : (par[x] = find(par[x])));
                basisOf(alloc).forEach(c => { par[find(c.r)] = find(m + c.c); });
                let best: TCell | null = null;
                const pass = (dummyOk: boolean) => {
                    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
                        if (alloc[i][j] || isDummy(i, j) !== dummyOk || find(i) === find(m + j)) continue;     // a cell that closes a loop is not allowed
                        if (!best) { best = { r: i, c: j }; continue; }
                        const cc = cost[i][j].cmp(cost[best.r][best.c]);
                        if (cc < 0) best = { r: i, c: j };
                        else if (cc === 0) {
                            const a = sup[i].cmp(dem[j]) <= 0 ? sup[i] : dem[j], b = sup[best.r].cmp(dem[best.c]) <= 0 ? sup[best.r] : dem[best.c];
                            if (a.cmp(b) > 0) best = { r: i, c: j };
                        }
                    }
                };
                pass(false);
                if (!best) pass(true);
                if (!best) break;
                const z = best as TCell;
                alloc[z.r][z.c] = ZERO;
                have++;
                zeroCells.push(cn(z.r, z.c));
                push('Degeneracy: put a 0 in ' + cn(z.r, z.c),
                    '<p>Put a <b>0</b> in an empty cell that does <b>not</b> form a closed loop with the filled cells (a loop would make u and v impossible to solve one by one). Among those cells we take the cheapest real one: <b>' + cn(z.r, z.c) + '</b> (cost ' + cost[z.r][z.c] + ').</p>' +
                    '<p>If costs tie we take the cell that can hold the larger amount, then the first in row order. Dummy cells are used only if nothing else works.</p><p>Now there are <b>' + have + '</b> filled cells' + (have === need ? ' = m + n − 1. ✓' : ', still fewer than ' + need + '.') + '</p>',
                    { ...fx('filled cells: ' + have + ' of ' + need, cn(z.r, z.c) + ' = 0'), table: showTable({ [key(z.r, z.c)]: 'new' }), arrows: [], gallery: have === need ? 'Starting solution' : undefined, group: 'Degeneracy' });
            }
        }
    }

    /* ===== 4. Total cost of the starting solution ===== */
    let TC = tcOf(alloc);
    const startCost = TC;
    {
        const cells = basisOf(alloc);
        const L = (f: (c: TCell) => string) => 'TC = ' + cells.map(f).join(' + ');
        const lines = [
            L(c => cn(c.r, c.c)),
            L(c => S(cost[c.r][c.c]) + '(' + S(alloc[c.r][c.c] as Fr) + ')'),
            L(c => S(cost[c.r][c.c].mul(alloc[c.r][c.c] as Fr)))
        ];
        push('Total cost of the starting solution',
            '<p>For every filled cell multiply <b>cost per unit × units</b>, then add them all up.</p>',
            { ...fx(lines.join(NL), 'TC = ' + money(TC)), table: snap({ alloc, tc: TC }), group: 'Start cost' });
    }

    /* ===== 5. MODI or Stepping stone ===== */
    const iterations: TransResult['iterations'] = [];
    let optimal = false, zeroIndexCells: string[] = [];
    for (let it = 1; it <= 40; it++) {
        const tag = IM + ' ' + it;
        const basis = basisOf(alloc);
        /* the closed loop of an empty cell: the empty cell, then the filled cells that lead from its row to its column */
        const loopTo = (e: TCell): TCell[] => {
            const prev = new Map<number, { node: number; cell: TCell }>();
            const seen = new Set<number>([e.r]);
            const queue = [e.r];
            while (queue.length && !prev.has(m + e.c)) {
                const x = queue.shift() as number;
                for (const c of basis) {
                    const a = c.r, b = m + c.c;
                    const [from, to] = x === a ? [a, b] : x === b ? [b, a] : [-1, -1];
                    if (from < 0 || seen.has(to)) continue;
                    seen.add(to); prev.set(to, { node: from, cell: c }); queue.push(to);
                }
            }
            const path: TCell[] = [];
            for (let node = m + e.c; node !== e.r;) { const p = prev.get(node) as { node: number; cell: TCell }; path.unshift(p.cell); node = p.node; }
            return [e, ...path];
        };
        let uu: Fr[] | undefined, vv: Fr[] | undefined;
        const index: (Fr | null)[][] = rows.map(() => cols.map(() => null));
        const empties: TCell[] = [];
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (!alloc[i][j]) empties.push({ r: i, c: j });

        if (improve === 'stepping') {
            /* -- stepping stone: the index of every empty cell from its own closed loop, one per step -- */
            empties.forEach((e, k) => {
                const lp = loopTo(e);
                const d = lp.reduce((acc, c, q) => (q % 2 === 0 ? acc.add(cost[c.r][c.c]) : acc.sub(cost[c.r][c.c])), ZERO);
                index[e.r][e.c] = d;
                const sg: TTable['sign'] = {}; lp.forEach((c, q) => { sg[key(c.r, c.c)] = q % 2 === 0 ? '+' : '-'; });
                const fl: Record<string, string> = {}; lp.forEach(c => { fl[key(c.r, c.c)] = 'loop'; }); fl[key(e.r, e.c)] = 'enter loop';
                const terms = lp.map((c, q) => (q % 2 === 0 ? '+' : '−') + ' ' + cost[c.r][c.c]).join(' ').replace(/^\+ /, '');
                const intro = k === 0
                    ? '<p><b>Stepping Stone method.</b> For every <b>empty</b> cell, imagine sending <b>one unit</b> through it. To keep every row and column total the same, trace a <b>closed loop</b> that turns only at filled cells and mark it <b>+ − + − …</b>, starting with + on the empty cell.</p><p>Add the costs of the (+) cells and subtract the costs of the (−) cells. That is the <b>improvement index</b>: how the total cost changes for each unit. <b>Negative = cheaper.</b></p>'
                    : '';
                push(tag + ': stepping stone ' + cn(e.r, e.c),
                    intro + '<p>Empty cell <b>' + cn(e.r, e.c) + '</b>. Loop: <b>' + lp.map((c, q) => cn(c.r, c.c) + ' (' + (q % 2 === 0 ? '+' : '−') + ')').join(', ') + '</b>.</p><p>Index = ' + lp.map((c, q) => (q % 2 === 0 ? '+' : '−') + cost[c.r][c.c]).join(' ') + ' = <b>' + d + '</b>' + (d.sign < 0 ? ' (negative: sending units here would lower the cost)' : d.sign === 0 ? ' (no change)' : '') + '.</p>',
                    { ...fx(cn(e.r, e.c) + ' = ' + terms, cn(e.r, e.c) + ' = ' + S(d)), table: snap({ alloc, index: index.map(r => r.slice()), flags: fl, sign: sg, loop: lp }), group: tag + ' index' });
            });
        } else {
        /* -- u and v, one per step -- */
        const u: (Fr | null)[] = rows.map(() => null), v: (Fr | null)[] = cols.map(() => null);
        u[0] = ZERO;
        const showUV = () => ({ alloc, u: u.slice(), v: v.slice() });
        push(tag + ': ' + U(0) + ' = 0',
            '<p><b>MODI</b> (modified distribution) finds out if a cheaper schedule exists. Give every row a number <b>uᵢ</b> and every column a number <b>vⱼ</b> so that, for each <b>filled</b> cell, <b>uᵢ + vⱼ = cost</b>.</p><p>Start with <b>' + U(0) + ' = 0</b> (the first row, ' + rows[0] + '). Then solve the rest from the filled cells, one at a time.</p>',
            { ...fx(U(0) + ' = 0'), table: snap(showUV()), group: tag + ' uv' });
        let changed = true, guard = 0;
        while (changed && guard++ < 100) {
            changed = false;
            for (const c of basis) {
                const ui = u[c.r], vj = v[c.c];
                if (ui && !vj) {
                    v[c.c] = cost[c.r][c.c].sub(ui);
                    const val = v[c.c] as Fr;
                    const parts: FormulaPart[] = [{ t: V(c.c) + ' = ' }, { t: S(cost[c.r][c.c]), id: 'c' }, { t: ' − ' }, { t: S(ui).replace(/^-(.*)$/, '($&)'), id: 'k' }];
                    const ans: FormulaPart[] = [{ t: V(c.c) + ' = ' }, { t: S(val), id: 'r' }];
                    push(tag + ': ' + V(c.c) + ' = ' + S(val),
                        '<p>Filled cell <b>' + cn(c.r, c.c) + '</b> (cost ' + cost[c.r][c.c] + '): <b>' + U(c.r) + ' + ' + V(c.c) + ' = ' + cost[c.r][c.c] + '</b>. We know ' + U(c.r) + ' = ' + ui + ', so <b>' + V(c.c) + ' = ' + cost[c.r][c.c] + ' − ' + (ui.sign < 0 ? '(' + ui + ')' : ui) + ' = ' + val + '</b>.</p>',
                        { ...fx(parts, ans), arrows: [{ from: [0, c.r, c.c], to: [0, 'v', c.c], kind: 'cost', mid: true }, { from: [0, c.r, 'u'], to: [0, 'v', c.c], kind: 'val' }], farrows: [{ part: 'c', kind: 'cost' }, { part: 'k', kind: 'val' }, { part: 'r', kind: 'res' }], table: snap({ ...showUV(), flags: { [key(c.r, c.c)]: 'hl' } }), group: tag + ' uv' });
                    changed = true;
                } else if (vj && !ui) {
                    u[c.r] = cost[c.r][c.c].sub(vj);
                    const val = u[c.r] as Fr;
                    const parts: FormulaPart[] = [{ t: U(c.r) + ' = ' }, { t: S(cost[c.r][c.c]), id: 'c' }, { t: ' − ' }, { t: S(vj).replace(/^-(.*)$/, '($&)'), id: 'k' }];
                    const ans: FormulaPart[] = [{ t: U(c.r) + ' = ' }, { t: S(val), id: 'r' }];
                    push(tag + ': ' + U(c.r) + ' = ' + S(val),
                        '<p>Filled cell <b>' + cn(c.r, c.c) + '</b> (cost ' + cost[c.r][c.c] + '): <b>' + U(c.r) + ' + ' + V(c.c) + ' = ' + cost[c.r][c.c] + '</b>. We know ' + V(c.c) + ' = ' + vj + ', so <b>' + U(c.r) + ' = ' + cost[c.r][c.c] + ' − ' + (vj.sign < 0 ? '(' + vj + ')' : vj) + ' = ' + val + '</b>.</p>',
                        { ...fx(parts, ans), arrows: [{ from: [0, c.r, c.c], to: [0, c.r, 'u'], kind: 'cost', mid: true }, { from: [0, 'v', c.c], to: [0, c.r, 'u'], kind: 'val' }], farrows: [{ part: 'c', kind: 'cost' }, { part: 'k', kind: 'val' }, { part: 'r', kind: 'res' }], table: snap({ ...showUV(), flags: { [key(c.r, c.c)]: 'hl' } }), group: tag + ' uv' });
                    changed = true;
                }
            }
        }
        if (u.some(x => !x) || v.some(x => !x)) {
            push(IM + ': cannot solve', '<p class="bad">Some u or v could not be found, which means the filled cells do not connect every row and column. This should not happen after the degeneracy fix.</p>', { table: snap({ alloc }) });
            return { steps, error: undefined, result: undefined };
        }
        uu = u as Fr[]; vv = v as Fr[];

        /* -- improvement index of every empty cell, one per step -- */
        empties.forEach((e, k) => {
            const d = cost[e.r][e.c].sub((uu as Fr[])[e.r]).sub((vv as Fr[])[e.c]);
            index[e.r][e.c] = d;
            const parts: FormulaPart[] = [{ t: cn(e.r, e.c) + ': ' }, { t: S(cost[e.r][e.c]) }, { t: ' − ' }, { t: S((uu as Fr[])[e.r]).replace(/^-(.*)$/, '($&)'), id: 'u' }, { t: ' − ' }, { t: S((vv as Fr[])[e.c]).replace(/^-(.*)$/, '($&)'), id: 'v' }];
            const ans: FormulaPart[] = [{ t: cn(e.r, e.c) + ' = ' }, { t: S(d), id: 'r' }];
            push(tag + ': index of ' + cn(e.r, e.c),
                '<p>The <b>improvement index</b> of an empty cell = <b>cost − uᵢ − vⱼ</b>. It tells how the total cost changes for each unit moved into this cell. <b>Negative = cheaper.</b></p>' + (k === 0 ? '<p>It is shown <b>circled</b> in the cell.</p>' : ''),
                {
                    ...fx(parts, ans),
                    arrows: [{ from: [0, e.r, 'u'], to: [0, e.r, e.c], kind: 'val', mid: true }, { from: [0, 'v', e.c], to: [0, e.r, e.c], kind: 'val' }],
                    farrows: [{ part: 'u', kind: 'val' }, { part: 'v', kind: 'val' }, { part: 'r', kind: 'res' }],
                    table: snap({ alloc, u: uu, v: vv, index: index.map(r => r.slice()) }), group: tag + ' index'
                });
        });
        }
        zeroIndexCells = empties.filter(e => (index[e.r][e.c] as Fr).sign === 0).map(e => cn(e.r, e.c));

        /* -- optimal? -- */
        let enter: TCell | null = null;
        empties.forEach(e => { const d = index[e.r][e.c] as Fr; if (d.sign < 0 && (!enter || d.cmp(index[enter.r][enter.c] as Fr) < 0)) enter = e; });
        if (!enter) {
            optimal = true;
            push(tag + ': optimal',
                '<p class="good"><b>No improvement index is negative, so this schedule is optimal.</b></p><p>Total cost = <b>' + money(TC) + '</b>.</p>' +
                (zeroIndexCells.length ? '<p>The index of <b>' + zeroIndexCells.join(', ') + '</b> is exactly <b>0</b>, so moving units there would not change the cost: other schedules cost the same.</p>' : ''),
                { ...fx('all indexes ≥ 0', 'optimal,  TC = ' + money(TC)), table: snap({ alloc, u: uu, v: vv, index }), gallery: it === 1 ? 'Optimal (' + IM + ')' : 'Optimal table', group: tag + ' optimal' });
            break;
        }
        const e = enter as TCell;
        const ei = index[e.r][e.c] as Fr;
        const negs = empties.filter(x => (index[x.r][x.c] as Fr).cmp(ei) === 0);
        push(tag + ': entering cell ' + cn(e.r, e.c),
            '<p>Not optimal yet: some indexes are negative. Pick the <b>most negative</b> one: <b>' + cn(e.r, e.c) + '</b> with index <b>' + ei + '</b>.</p>' + (negs.length > 1 ? '<p>' + negs.map(x => cn(x.r, x.c)).join(' and ') + ' tie, so we take the first in row order.</p>' : '') + '<p>Every unit moved into this cell lowers the cost by ' + ei.neg() + '.</p>',
            { ...fx('most negative index = ' + ei, 'enter ' + cn(e.r, e.c)), table: snap({ alloc, u: uu, v: vv, index, flags: { [key(e.r, e.c)]: 'enter' } }), group: tag + ' enter' });

        const loop: TCell[] = loopTo(e);
        const sign: TTable['sign'] = {};
        loop.forEach((c, k) => { sign[key(c.r, c.c)] = k % 2 === 0 ? '+' : '-'; });
        const minus = loop.filter((_, k) => k % 2 === 1), plus = loop.filter((_, k) => k % 2 === 0);
        const flagsLoop: Record<string, string> = {}; loop.forEach(c => { flagsLoop[key(c.r, c.c)] = 'loop'; }); flagsLoop[key(e.r, e.c)] = 'enter loop';
        if (improve === 'modi') push(tag + ': closed loop',
            '<p>Draw a <b>closed loop</b> that starts at <b>' + cn(e.r, e.c) + '</b> and turns only at filled cells, moving along rows and columns.</p><p>Mark the cells <b>+ − + −</b> in turn, starting with + on ' + cn(e.r, e.c) + ': <b>' + loop.map((c, k) => cn(c.r, c.c) + ' (' + (k % 2 === 0 ? '+' : '−') + ')').join(', ') + '</b>.</p>',
            { ...fx(loop.map((c, k) => (k % 2 === 0 ? '+' : '−') + cn(c.r, c.c)).join('  ')), table: snap({ alloc, u: uu, v: vv, index, flags: flagsLoop, sign, loop }), group: tag + ' loop' });

        /* -- theta: the smallest (−) cell -- */
        const mins = minus.map(c => alloc[c.r][c.c] as Fr);
        const theta = mins.reduce((a, b) => (b.cmp(a) < 0 ? b : a));
        const ties = minus.filter(c => (alloc[c.r][c.c] as Fr).cmp(theta) === 0);
        let leave = ties[0];
        ties.forEach(c => { if (cost[c.r][c.c].cmp(cost[leave.r][leave.c]) > 0) leave = c; });   // a tie: the more expensive cell leaves
        const flagsTheta: Record<string, string> = { ...flagsLoop, [key(leave.r, leave.c)]: 'leave loop' };
        let thetaHtml = '<p>The amount to move is the <b>smallest</b> number among the (−) cells: ' + minus.map(c => cn(c.r, c.c) + ' = ' + alloc[c.r][c.c]).join(', ') + '.</p><p><b>θ = ' + theta + '</b>' + (theta.sign === 0 ? '' : ', so ' + cn(leave.r, leave.c) + ' goes down to 0 and leaves the solution.') + '</p>';
        if (theta.sign === 0) thetaHtml += '<p><b>θ = 0.</b> A (−) cell already holds 0, so no units actually move: only the <b>0 moves</b> (it leaves ' + cn(leave.r, leave.c) + ' and ' + cn(e.r, e.c) + ' becomes a filled cell with 0). The total cost <b>stays the same</b>, but the filled cells are different, so the next u, v and indexes will change.</p>';
        else if (ties.length > 1) thetaHtml += '<p>' + ties.map(c => cn(c.r, c.c)).join(' and ') + ' both reach 0 together. Only <b>one</b> leaves (' + cn(leave.r, leave.c) + ', the one with the higher cost); the other <b>stays as a filled 0</b>, so we keep exactly ' + need + ' filled cells.</p>';
        push(tag + ': θ = ' + theta,
            thetaHtml,
            { ...fx('θ = min(' + minus.map(c => S(alloc[c.r][c.c] as Fr)).join(', ') + ')', 'θ = ' + theta), table: snap({ alloc, u: uu, v: vv, index, flags: flagsTheta, sign, loop }), group: tag + ' theta' });

        /* -- shift θ around the loop -- */
        const old = alloc.map(r => r.slice());
        plus.forEach(c => { alloc[c.r][c.c] = (alloc[c.r][c.c] || ZERO).add(theta); });
        minus.forEach(c => { alloc[c.r][c.c] = (alloc[c.r][c.c] as Fr).sub(theta); });
        alloc[leave.r][leave.c] = null;
        const flagsNew: Record<string, string> = { [key(e.r, e.c)]: 'new' };
        push(tag + ': move ' + theta + ' units',
            '<p>Add θ = <b>' + theta + '</b> to the (+) cells and subtract it from the (−) cells:</p><ul>' + plus.map(c => '<li>' + cn(c.r, c.c) + ' (+): ' + S(old[c.r][c.c] || ZERO) + ' + ' + theta + ' = <b>' + S(alloc[c.r][c.c] as Fr) + '</b></li>').join('') + minus.map(c => '<li>' + cn(c.r, c.c) + ' (−): ' + S(old[c.r][c.c] as Fr) + ' − ' + theta + ' = <b>' + (c === leave ? '0 (leaves)' : S(alloc[c.r][c.c] as Fr)) + '</b></li>').join('') + '</ul>',
            { ...fx('+' + theta + ' on ' + plus.map(c => cn(c.r, c.c)).join(', ') + NL + '−' + theta + ' on ' + minus.map(c => cn(c.r, c.c)).join(', ')), table: snap({ alloc, flags: flagsNew }), group: tag + ' move' });

        /* -- new cost = old cost + index × θ -- */
        const newTC = TC.add(ei.mul(theta));
        const calc = tcOf(alloc);
        const same = theta.sign === 0;
        const parts: FormulaPart[] = [{ t: 'New TC = ' + money(TC) + ' + (' }, { t: S(ei), id: 'i' }, { t: ') × ' }, { t: S(theta), id: 't' }];
        const ans: FormulaPart[] = [{ t: 'New TC = ' }, { t: money(newTC), id: 'r' }];
        push(tag + ': new total cost',
            '<p><b>New cost = old cost + (index × amount moved)</b>.</p>' + (same ? '<p>Because θ = 0 the cost does not change: ' + money(TC) + '.</p>' : '<p>' + money(TC) + ' + (' + ei + ' × ' + theta + ') = <b>' + money(newTC) + '</b>.</p>') +
            (calc.cmp(newTC) === 0 ? '<p class="good">Check: adding up cost × units of the new schedule also gives ' + money(calc) + '. ✓</p>' : ''),
            { ...fx(parts, ans), farrows: [{ part: 'i', kind: 'val' }, { part: 't', kind: 'mult' }, { part: 'r', kind: 'res' }], table: snap({ alloc, tc: newTC, flags: flagsNew }), gallery: 'After ' + IM + ' iteration ' + it, group: tag + ' cost' });
        iterations.push({ enter: cn(e.r, e.c), index: S(ei), theta: S(theta), leave: cn(leave.r, leave.c), cost: S(calc), zeroMove: same });
        TC = calc;
        if (it === 40) push(IM + ' stopped', '<p class="bad">Stopped after 40 iterations (the problem may be cycling).</p>', { table: snap({ alloc }) });
    }

    /* ===== 6. Answer ===== */
    const sched = alloc.flatMap((r, i) => r.map((x, j) => (x && x.sign > 0 && !isDummy(i, j) ? { from: rows[i], to: cols[j], units: S(x), unitCost: S(cost[i][j]), cost: S(x.mul(cost[i][j])) } : null))).filter(Boolean) as TransResult['schedule'];
    const held: TransResult['held'] = [];
    if (dummyCol >= 0) rows.forEach((nm, i) => { const x = alloc[i][dummyCol]; if (x && x.sign > 0) held.push({ name: nm, units: S(x) }); });
    if (dummyRow >= 0) cols.forEach((nm, j) => { const x = alloc[dummyRow][j]; if (x && x.sign > 0) held.push({ name: nm, units: S(x) }); });
    const finalCost = tcOf(alloc);
    let html = '<p class="good"><b>Optimal schedule found.</b></p><p><b>Total cost = ' + money(finalCost) + '</b></p>';
    if (dummyCol >= 0) html += '<p>The Dummy holds back <b>' + diff + '</b> units of supply that are <b>not shipped</b>' + (held.length ? ': ' + held.map(h => h.name + ' keeps ' + h.units).join(', ') : '') + '.</p>';
    if (dummyRow >= 0) html += '<p>The Dummy stands for <b>' + diff.neg() + '</b> units of demand that <b>cannot be met</b>' + (held.length ? ': ' + held.map(h => h.name + ' receives ' + h.units + ' less').join(', ') : '') + '.</p>';
    if (zeroIndexCells.length) html += '<p><i>The index of ' + zeroIndexCells.join(', ') + ' is exactly 0, so other schedules cost the same ' + money(finalCost) + '.</i></p>';
    push('Answer', html, {
        final: true, group: 'final', gallery: 'Optimal schedule',
        answer: { head: ['From', 'To', 'Units', 'Cost per unit', 'Cost'], rows: sched.map(s => [s.from, s.to, s.units, cur + s.unitCost, cur + s.cost]), foot: ['Total', '', S(sched.reduce((a, s) => a.add(parseFr(s.units) as Fr), ZERO)), '', money(finalCost)] },
        table: snap({ alloc })
    });

    return {
        steps,
        result: {
            totalSupply: S(tS), totalDemand: S(tD), dummy: dummyCol >= 0 ? 'col' : dummyRow >= 0 ? 'row' : null, dummyAmount: S(diff.sign < 0 ? diff.neg() : diff),
            start: { method, allocations: allocs(), filled: allocs().length, needed: need, degenerate: zeroCells.length > 0, zeroCells, cost: S(startCost) },
            iterations, optimalCost: S(finalCost), schedule: sched, held, zeroIndexCells, alternateOptima: zeroIndexCells.length > 0, optimal
        }
    };
}

export const transportSummary = (problem: unknown): { method: string; result: string } => {
    const p = problem as TransProblem;
    const method = p.method === 'lc' ? 'Least Cost' : 'Northwest Corner';
    try {
        const r = solveTransport(p);
        if (r.error || !r.result) return { method, result: '—' };
        return { method, result: 'TC = ' + (p.cur || '') + r.result.optimalCost };
    } catch { return { method, result: '—' }; }
};
