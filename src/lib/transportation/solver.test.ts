import { describe, expect, it } from 'vitest';
import { solveTransport, type TransProblem } from './solver';
import { TRANS_EXAMPLES } from '../../lessons/transportation/examples';

/* The problem from class (balanced). Costs: D: A5 B4 C3, E: A8 B4 C3, F: A9 B7 C5. Supply D100 E300 F300. Demand A300 B200 C200. */
const base = (method: 'nwc' | 'lc', improve?: 'modi' | 'stepping'): TransProblem => ({
    method, improve, cur: '₱',
    sources: [{ name: 'D', supply: '100' }, { name: 'E', supply: '300' }, { name: 'F', supply: '300' }],
    dests: [{ name: 'A', demand: '300' }, { name: 'B', demand: '200' }, { name: 'C', demand: '200' }],
    cost: [['5', '4', '3'], ['8', '4', '3'], ['9', '7', '5']]
});
const alloc = (r: { start: { allocations: { from: string; to: string; units: string }[] } }) => r.start.allocations.map(a => a.from + '-' + a.to + a.units);

/** the lowest possible total cost, found by trying every shipment (supply and demand are small multiples of a unit) */
function bruteForce(P: TransProblem, unit: number): number {
    const sup = P.sources.map(s => Number(s.supply) / unit), dem = P.dests.map(d => Number(d.demand) / unit);
    const cost = P.cost.map(r => r.map(Number));
    const m = sup.length, n = dem.length;
    let best = Infinity;
    const left = sup.slice(), need = dem.slice();
    const go = (i: number, j: number, acc: number) => {
        if (acc >= best) return;
        if (i === m) { if (need.every(x => x === 0)) best = acc; return; }
        if (j === n - 1) {      // the last destination takes what the source can still give (the rest of the supply stays unshipped)
            const q = Math.min(left[i], need[j]);
            left[i] -= q; need[j] -= q;
            go(i + 1, 0, acc + q * cost[i][j]);
            left[i] += q; need[j] += q;
            return;
        }
        for (let q = 0; q <= Math.min(left[i], need[j]); q++) {
            left[i] -= q; need[j] -= q;
            go(i, j + 1, acc + q * cost[i][j]);
            left[i] += q; need[j] += q;
        }
    };
    go(0, 0, 0);
    return best * unit;
}

describe('Transportation: a balanced problem', () => {
    it('supply 700 = demand 700: the first step says it is balanced and the table has no Dummy', () => {
        const out = solveTransport(base('nwc'));
        const r = out.result!;
        expect(r.totalSupply).toBe('700'); expect(r.totalDemand).toBe('700');
        expect(r.dummy).toBeNull();
        expect(out.steps![0].title).toBe('Balance supply and demand');
        expect(out.steps![0].html).toMatch(/already <b>balanced/);
        const t = out.steps![0].table!;
        expect(t.rows).toEqual(['D', 'E', 'F']);
        expect(t.cols).toEqual(['A', 'B', 'C']);
    });
});

describe('Transportation: an unbalanced problem gets a Dummy', () => {
    it('supply bigger than demand adds a Dummy destination (a column) with cost 0', () => {
        const p = base('nwc'); p.dests[0].demand = '250';
        const out = solveTransport(p); const r = out.result!;
        expect(r.dummy).toBe('col'); expect(r.dummyAmount).toBe('50');
        const t = out.steps![0].table!;
        expect(t.cols).toEqual(['A', 'B', 'C', 'Dummy']);
        expect(t.demand).toEqual(['250', '200', '200', '50']);
        expect(t.cost.map(row => row[3])).toEqual(['0', '0', '0']);
        expect(r.optimal).toBe(true);
    });
    it('demand bigger than supply adds a Dummy source (a row) with cost 0', () => {
        const p = base('nwc'); p.sources[0].supply = '60';
        const out = solveTransport(p); const r = out.result!;
        expect(r.dummy).toBe('row'); expect(r.dummyAmount).toBe('40');
        expect(out.steps![0].table!.rows).toEqual(['D', 'E', 'F', 'Dummy']);
        expect(r.optimal).toBe(true);
    });
    it('"Dummy" is a reserved name', () => {
        const p = base('nwc'); p.sources[1].name = 'Dummy';
        expect(solveTransport(p).error).toMatch(/reserved/);
    });
    it('the unbalanced example: supply 75, demand 65, the Dummy takes 10 and the cost is the lowest possible', () => {
        const P = TRANS_EXAMPLES.unbalanced;
        const out = solveTransport(P); const r = out.result!;
        expect(r.totalSupply).toBe('75'); expect(r.totalDemand).toBe('65');
        expect(r.dummy).toBe('col'); expect(r.dummyAmount).toBe('10');
        expect(r.optimal).toBe(true);
        expect(Number(r.optimalCost)).toBe(bruteForce(P, 5));
        expect(r.schedule.reduce((a, s) => a + Number(s.units), 0)).toBe(65);      // only the real demand is shipped
        expect(r.held.reduce((a, h) => a + Number(h.units), 0)).toBe(10);          // 10 units stay behind
        expect(out.steps![out.steps!.length - 1].html).toMatch(/not shipped/);
    });
});

describe('Transportation: Northwest Corner (the board from class)', () => {
    const out = solveTransport(base('nwc')); const r = out.result!;
    it('allocations D-A100, E-A200, E-B100, F-B100, F-C200', () => {
        expect(alloc(r)).toEqual(['D-A100', 'E-A200', 'E-B100', 'F-B100', 'F-C200']);
    });
    it('5 filled cells = m + n - 1, so it is not degenerate', () => { expect(r.start.filled).toBe(5); expect(r.start.needed).toBe(5); expect(r.start.degenerate).toBe(false); });
    it('starting total cost is 4200', () => { expect(r.start.cost).toBe('4200'); });
    it('one step per allocation', () => { expect(out.steps!.filter(s => /^Allocation \d+:/.test(s.title)).length).toBe(5); });
    it('MODI iteration 1 enters F-A (index -2), moves 100 and gives 4000', () => {
        expect(r.iterations[0]).toMatchObject({ enter: 'F-A', index: '-2', theta: '100', leave: 'F-B', cost: '4000' });
    });
    it('reaches 3900 in two iterations and is optimal', () => {
        expect(r.optimal).toBe(true); expect(r.optimalCost).toBe('3900');
        expect(r.iterations.length).toBe(2);
        expect(r.iterations[1]).toMatchObject({ enter: 'E-C', index: '-1', theta: '100', cost: '3900' });
        const costs = r.iterations.map(i => Number(i.cost));
        expect([...costs].sort((a, b) => b - a)).toEqual(costs);     // never goes up
    });
    it('the answer lists every shipment, and it is the last step', () => {
        const total = r.schedule.reduce((a, s) => a + Number(s.cost), 0);
        expect(total).toBe(3900);
        expect(r.schedule.reduce((a, s) => a + Number(s.units), 0)).toBe(700);
        expect(out.steps![out.steps!.length - 1].title).toBe('Answer');
    });
});

describe('Transportation: the Stepping Stone method (the same problem, another way to test for a cheaper schedule)', () => {
    const modi = solveTransport(base('nwc', 'modi')), stone = solveTransport(base('nwc', 'stepping'));
    const r = stone.result!;
    it('tries every empty cell with its own closed loop (4 empty cells), and has no u or v steps', () => {
        const titles = stone.steps!.map(s => s.title);
        expect(titles.filter(t => t.startsWith('Stepping stone 1: stepping stone')).length).toBe(4);
        expect(titles.some(t => /: u[₁-₉]? = |: v/.test(t))).toBe(false);
        expect(titles.some(t => t.startsWith('MODI'))).toBe(false);
    });
    it('the index of F-A is -2: +9 -7 +4 -8 (the loop F-A, F-B, E-B, E-A)', () => {
        const s = stone.steps!.find(z => z.title === 'Stepping stone 1: stepping stone F-A')!;
        expect(s.formula).toMatch(/^Formula:\s+F-A = 9 − 7 \+ 4 − 8\s+Final Answer:\s+F-A = -2$/);
        expect(s.table!.loop!.length).toBe(4);
        expect(s.table!.sign).toBeDefined();
    });
    it('finds the same schedule and cost as MODI: F-A then E-C, 4200 to 4000 to 3900', () => {
        expect(r.optimal).toBe(true); expect(r.optimalCost).toBe('3900');
        expect(r.iterations.map(i => [i.enter, i.index, i.theta, i.cost])).toEqual(modi.result!.iterations.map(i => [i.enter, i.index, i.theta, i.cost]));
        expect(r.iterations[0]).toMatchObject({ enter: 'F-A', index: '-2', theta: '100', cost: '4000' });
        expect(r.schedule).toEqual(modi.result!.schedule);
    });
    it('every index equals the MODI index (cost - u - v) of the same cell', () => {
        const idx = (o: ReturnType<typeof solveTransport>) => o.steps!.find(z => /1: (index of|stepping stone) F-A$/.test(z.title))!.table!.index!;
        expect(idx(stone)[2][0]).toBe(idx(modi)[2][0]);
    });
    it('the Dummy works with it too, on every example, and all agree with the lowest possible cost', () => {
        for (const key of ['nwc', 'lc', 'unbalanced'] as const) {
            const P = TRANS_EXAMPLES[key];
            const a = solveTransport({ ...P, improve: 'modi' }).result!, b = solveTransport({ ...P, improve: 'stepping' }).result!;
            expect(b.optimal).toBe(true);
            expect(b.optimalCost).toBe(a.optimalCost);
        }
        expect(Number(solveTransport({ ...TRANS_EXAMPLES.nwc, improve: 'stepping' }).result!.optimalCost)).toBe(bruteForce(TRANS_EXAMPLES.nwc, 100));
    });
    it('the last step is the Answer', () => { expect(stone.steps![stone.steps!.length - 1].title).toBe('Answer'); });
});

describe('Transportation: Least Cost (ties: larger amount, then row order)', () => {
    const out = solveTransport(base('lc')); const r = out.result!;
    it('allocations E-C200, D-B100, E-B100, F-A300 (D-C and E-C cost 3: E-C can hold more)', () => {
        expect(alloc(r)).toEqual(['E-C200', 'D-B100', 'E-B100', 'F-A300']);
    });
    it('only 4 filled cells: degenerate, so a 0 is added at F-C', () => {
        expect(r.start.filled).toBe(4); expect(r.start.needed).toBe(5);
        expect(r.start.degenerate).toBe(true); expect(r.start.zeroCells).toEqual(['F-C']);
        const z = out.steps!.find(s => s.title === 'Degeneracy: put a 0 in F-C')!;
        expect(z.table!.alloc[2][2]).toBe('0');
    });
    it('starts at 4100, MODI enters D-A and the optimum is 3900 (the same as Northwest Corner)', () => {
        expect(r.start.cost).toBe('4100');
        expect(r.iterations[0]).toMatchObject({ enter: 'D-A', index: '-2', theta: '100', cost: '3900' });
        expect(r.optimal).toBe(true); expect(r.optimalCost).toBe('3900');
    });
    it('Stepping Stone also copes with the degenerate 0 (D-A enters, 3900)', () => {
        const s = solveTransport(base('lc', 'stepping')).result!;
        expect(s.iterations[0]).toMatchObject({ enter: 'D-A', index: '-2', theta: '100', cost: '3900' });
        expect(s.optimalCost).toBe('3900');
    });
});

describe('Transportation: edge cases', () => {
    it('when a row and a column are used up together, the missing filled cells are added as 0 (NW Corner)', () => {
        const r = solveTransport({ method: 'nwc', sources: [{ name: 'A', supply: '10' }, { name: 'B', supply: '10' }], dests: [{ name: 'X', demand: '10' }, { name: 'Y', demand: '10' }], cost: [['1', '2'], ['3', '1']] }).result!;
        expect(r.start.degenerate).toBe(true);
        expect(r.optimal).toBe(true); expect(r.optimalCost).toBe('20');
    });
    it('rejects bad input', () => {
        const p = base('nwc'); p.cost[0][0] = 'x';
        expect(solveTransport(p).error).toMatch(/cost from D to A/);
        const q = base('nwc'); q.sources[1].name = 'D';
        expect(solveTransport(q).error).toMatch(/different/);
    });
});
