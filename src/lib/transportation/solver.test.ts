import { describe, expect, it } from 'vitest';
import { solveTransport, type TransProblem } from './solver';

/* costs A: W1 X5 Y3 Z4, B: W4 X2 Y2 Z4, C: W3 X1 Y2 Z4. Supply A100 B60 C120. Demand W70 X50 Y60 Z60. */
const base = (method: 'nwc' | 'lc'): TransProblem => ({
    method, cur: '₱',
    sources: [{ name: 'A', supply: '100' }, { name: 'B', supply: '60' }, { name: 'C', supply: '120' }],
    dests: [{ name: 'W', demand: '70' }, { name: 'X', demand: '50' }, { name: 'Y', demand: '60' }, { name: 'Z', demand: '60' }],
    cost: [['1', '5', '3', '4'], ['4', '2', '2', '4'], ['3', '1', '2', '4']]
});
const alloc = (r: { start: { allocations: { from: string; to: string; units: string }[] } }) => r.start.allocations.map(a => a.from + '-' + a.to + a.units);

describe('Transportation: balance', () => {
    const r = solveTransport(base('nwc')).result!;
    it('supply 280 > demand 240, so a Dummy column with demand 40 and cost 0 is added', () => {
        expect(r.totalSupply).toBe('280'); expect(r.totalDemand).toBe('240');
        expect(r.dummy).toBe('col'); expect(r.dummyAmount).toBe('40');
        const t = solveTransport(base('nwc')).steps![0].table!;
        expect(t.cols).toEqual(['W', 'X', 'Y', 'Z', 'Dummy']);
        expect(t.cost.map(row => row[4])).toEqual(['0', '0', '0']);
        expect(t.demand[4]).toBe('40');
    });
    it('demand bigger than supply adds a Dummy row', () => {
        const p = base('nwc'); p.dests[0].demand = '200';
        const q = solveTransport(p).result!;
        expect(q.dummy).toBe('row');
        expect(q.dummyAmount).toBe('90');       // 100+60+120 = 280 supply, demand 200+50+60+60 = 370
    });
    it('a balanced problem needs no Dummy', () => {
        const p = base('nwc'); p.sources[0].supply = '60';
        expect(solveTransport(p).result!.dummy).toBeNull();
    });
});

describe('Transportation: Northwest Corner', () => {
    const out = solveTransport(base('nwc')); const r = out.result!;
    it('allocations A-W70, A-X30, B-X20, B-Y40, C-Y20, C-Z60, C-Dummy40', () => {
        expect(alloc(r)).toEqual(['A-W70', 'A-X30', 'B-X20', 'B-Y40', 'C-Y20', 'C-Z60', 'C-Dummy40']);
    });
    it('7 filled cells = m + n - 1, so it is not degenerate', () => { expect(r.start.filled).toBe(7); expect(r.start.needed).toBe(7); expect(r.start.degenerate).toBe(false); });
    it('starting total cost is 620', () => { expect(r.start.cost).toBe('620'); });
    it('one step per allocation', () => { expect(out.steps!.filter(s => /^Allocation \d+:/.test(s.title)).length).toBe(7); });
    it('MODI iteration 1 enters A-Z (index -3), moves 30 and gives 530', () => {
        expect(r.iterations[0]).toMatchObject({ enter: 'A-Z', index: '-3', theta: '30', cost: '530' });
    });
    it('reaches 480 in a few iterations and is optimal', () => {
        expect(r.optimal).toBe(true); expect(r.optimalCost).toBe('480');
        expect(r.iterations.length).toBeGreaterThanOrEqual(2); expect(r.iterations.length).toBeLessThanOrEqual(6);
        expect(r.iterations[r.iterations.length - 1].cost).toBe('480');
        const costs = r.iterations.map(i => Number(i.cost));
        expect([...costs].sort((a, b) => b - a)).toEqual(costs);     // never goes up
    });
    it('the answer lists the real shipments and the units the Dummy holds back', () => {
        const total = r.schedule.reduce((a, s) => a + Number(s.cost), 0);
        expect(total).toBe(480);
        expect(r.schedule.every(s => s.to !== 'Dummy')).toBe(true);
        expect(r.held.reduce((a, h) => a + Number(h.units), 0)).toBe(40);
        expect(out.steps![out.steps!.length - 1].title).toBe('Answer');
    });
});

describe('Transportation: Least Cost (Dummy last, ties: larger amount, then row order)', () => {
    const out = solveTransport(base('lc')); const r = out.result!;
    it('allocations A-W70, C-X50, B-Y60, C-Z60, A-Dummy30, C-Dummy10', () => {
        expect(alloc(r)).toEqual(['A-W70', 'C-X50', 'B-Y60', 'C-Z60', 'A-Dummy30', 'C-Dummy10']);
    });
    it('only 6 filled cells: degenerate, so a 0 is added at C-Y', () => {
        expect(r.start.filled).toBe(6); expect(r.start.needed).toBe(7);
        expect(r.start.degenerate).toBe(true); expect(r.start.zeroCells).toEqual(['C-Y']);
        const z = out.steps!.find(s => s.title === 'Degeneracy: put a 0 in C-Y')!;
        expect(z.table!.alloc[2][2]).toBe('0');
    });
    it('total cost is 480 and MODI finds it optimal right away', () => {
        expect(r.start.cost).toBe('480'); expect(r.iterations.length).toBe(0); expect(r.optimal).toBe(true); expect(r.optimalCost).toBe('480');
    });
    it('zero indexes (other schedules cost the same): A-Z, B-Z and B-Dummy', () => {
        expect(r.zeroIndexCells).toEqual(expect.arrayContaining(['A-Z', 'B-Z', 'B-Dummy']));
        expect(r.alternateOptima).toBe(true);
    });
    it('the filled Dummy cell A-Dummy holds 30 of the 40 held back (C holds the other 10)', () => {
        expect(r.held).toEqual([{ name: 'A', units: '30' }, { name: 'C', units: '10' }]);
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
        expect(solveTransport(p).error).toMatch(/cost from A to W/);
        const q = base('nwc'); q.sources[1].name = 'A';
        expect(solveTransport(q).error).toMatch(/different/);
        const d = base('nwc'); d.sources[0].name = 'Dummy';
        expect(solveTransport(d).error).toMatch(/reserved/);
    });
});
