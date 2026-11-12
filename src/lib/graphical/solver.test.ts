import { describe, expect, it } from 'vitest';
import { solveGraphical, type GraphProblem } from './solver';

const MAX: GraphProblem = {
    mode: 'max', cur: '₱', obj: 'P', vars: [{ name: 'T', c: '700' }, { name: 'C', c: '500' }],
    cons: [{ a: ['4', '3'], op: '<=', b: '240' }, { a: ['2', '1'], op: '<=', b: '100' }]
};
const pts = (l: { x: string; y: string }[]) => l.map(p => '(' + p.x + ',' + p.y + ')');

describe('Graphical Method: Max P = 700T + 500C, 4T + 3C ≤ 240, 2T + C ≤ 100', () => {
    const r = solveGraphical(MAX);
    const res = r.result!;
    it('solves without error', () => { expect(r.error).toBeUndefined(); expect(r.steps!.length).toBeGreaterThan(8); });
    it('intercepts: (0,80) (60,0) for constraint 1, (0,100) (50,0) for constraint 2', () => {
        expect(pts(res.intercepts[0])).toEqual(['(0,80)', '(60,0)']);
        expect(pts(res.intercepts[1])).toEqual(['(0,100)', '(50,0)']);
    });
    it('intersection of the two lines is (30,40)', () => {
        expect(res.intersections).toEqual([{ cons: [0, 1], x: '30', y: '40' }]);
    });
    it('corner points and profits', () => {
        const by = Object.fromEntries(res.corners.map(c => ['(' + c.x + ',' + c.y + ')', c.z]));
        expect(by).toEqual({ '(0,0)': '0', '(0,80)': '40000', '(50,0)': '35000', '(30,40)': '41000' });
        expect(res.corners.length).toBe(4);
    });
    it('the best corner is (30,40) with 41000', () => { expect(res.best).toEqual({ x: '30', y: '40', z: '41000' }); expect(res.alternateOptima).toBe(false); });
    it('region is bounded and feasible', () => { expect(res.feasible).toBe(true); expect(res.regionBounded).toBe(true); });
    it('both resources are fully used: 240/240 and 100/100, nothing left over', () => {
        expect(res.usage).toEqual([{ used: '240', available: '240', left: '0' }, { used: '100', available: '100', left: '0' }]);
    });
    it('shows every algebra line of the substitution', () => {
        const text = r.steps!.filter(s => s.title.startsWith('Lines 1 and 2')).map(s => s.html).join(' ');
        for (const piece of ['C = 100 - 2T', '4T + 3(100 - 2T) = 240', '4T + 300 - 6T = 240', '-2T + 300 = 240', '-2T = -60', 'T = 30', '100 - 2(30)']) expect(text).toContain(piece);
    });
    it('has the steps in the required order', () => {
        const t = r.steps!.map(s => s.title);
        const at = (re: RegExp) => t.findIndex(x => re.test(x));
        const order = [/^Set up/, /when T = 0/, /test point/, /^Feasible region/, /isolate/, /^Corner points table/, /^Best corner/, /^Conclusion/].map(at);
        expect(order.every(i => i >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
    });
    it('plots the iso-profit line through the best corner on the best step', () => {
        const best = r.steps!.find(s => s.title === 'Best corner')!;
        expect(best.graph!.iso).toEqual({ z: 41000 });
    });
});

describe('Graphical Method: other cases', () => {
    it('Min with >= constraints: unbounded region, but a best corner still exists', () => {
        const r = solveGraphical({ mode: 'min', vars: [{ name: 'x', c: '45' }, { name: 'y', c: '24' }], cons: [{ a: ['2', '3'], op: '>=', b: '16' }, { a: ['3', '5'], op: '>=', b: '25' }] });
        expect(r.result!.regionBounded).toBe(false);
        expect(r.result!.objectiveUnbounded).toBe(false);
        expect(r.result!.best).not.toBeNull();
    });
    it('empty feasible region is reported', () => {
        const r = solveGraphical({ mode: 'max', vars: [{ name: 'x', c: '1' }, { name: 'y', c: '1' }], cons: [{ a: ['1', '1'], op: '<=', b: '3' }, { a: ['1', '1'], op: '>=', b: '5' }] });
        expect(r.result!.feasible).toBe(false);
        expect(r.steps![r.steps!.length - 1].title).toMatch(/none/);
    });
    it('unbounded objective is reported', () => {
        const r = solveGraphical({ mode: 'max', vars: [{ name: 'x', c: '1' }, { name: 'y', c: '1' }], cons: [{ a: ['1', '-1'], op: '<=', b: '2' }] });
        expect(r.result!.regionBounded).toBe(false);
        expect(r.result!.objectiveUnbounded).toBe(true);
        expect(r.result!.best).toBeNull();
    });
    it('uses another test point when (0,0) is on the line', () => {
        const r = solveGraphical({ mode: 'max', vars: [{ name: 'x', c: '1' }, { name: 'y', c: '1' }], cons: [{ a: ['1', '-1'], op: '<=', b: '0' }, { a: ['1', '1'], op: '<=', b: '4' }] });
        const t = r.steps!.find(s => s.title === 'Constraint 1: test point')!;
        expect(t.html).toContain('lies exactly on the line');
    });
    it('rejects bad input', () => {
        expect(solveGraphical({ mode: 'max', vars: [{ name: 'x', c: 'a' }, { name: 'y', c: '1' }], cons: [{ a: ['1', '1'], op: '<=', b: '1' }] }).error).toMatch(/objective coefficient/);
        expect(solveGraphical({ mode: 'max', vars: [{ name: 'x', c: '1' }, { name: 'x', c: '1' }], cons: [{ a: ['1', '1'], op: '<=', b: '1' }] }).error).toMatch(/different/);
        expect(solveGraphical({ mode: 'max', vars: [{ name: 'x', c: '1' }, { name: 'y', c: '1' }], cons: [{ a: ['0', '0'], op: '<=', b: '1' }] }).error).toMatch(/non-zero/);
    });
});
