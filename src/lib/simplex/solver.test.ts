import { describe, expect, it } from 'vitest';
import { buildSteps, parseFr } from './solver';
import { SIMPLEX_EXAMPLES } from '../../lessons/simplex/examples';

const extra = [
    { mode: 'min', vars: [{ name: 'x', c: '2' }, { name: 'y', c: '3' }, { name: 'z', c: '1/2' }],
        cons: [{ a: ['1', '1', '1'], op: '>=', b: '10' }, { a: ['2', '0', '1'], op: '=', b: '8' }, { a: ['1', '3', '0'], op: '<=', b: '30' }] },
    { mode: 'max', vars: [{ name: 'a', c: '1' }, { name: 'b', c: '1' }], cons: [{ a: ['1', '1'], op: '>=', b: '5' }, { a: ['1', '1'], op: '<=', b: '3' }] },   // infeasible
    { mode: 'max', vars: [{ name: 'a', c: '1' }, { name: 'b', c: '1' }], cons: [{ a: ['1', '-1'], op: '<=', b: '-2' }] },                                   // negative RHS, unbounded
    { mode: 'max', vars: [{ name: 'a', c: '1.5' }, { name: 'b', c: '2' }], cons: [{ a: ['1', '1'], op: '<=', b: '4' }, { a: ['1', '3'], op: '<=', b: '6' }] }
];

describe('Simplex solver port', () => {
    const all = [...Object.entries(SIMPLEX_EXAMPLES), ...extra.map((p, i) => ['extra' + i, p] as const)];
    for (const [name, p] of all) {
        it('builds its steps without an error: ' + name, () => {
            const r = buildSteps(p as never);
            expect(r.error).toBeUndefined();
            expect(r.steps && r.steps.length).toBeGreaterThan(1);
        });
    }

    it('Max example reaches the known optimum (T=30, C=40, Z=41000)', () => {
        const r = buildSteps(SIMPLEX_EXAMPLES.max);
        expect(r.result).toEqual({ feasible: true, z: '41000', values: { T: '30', C: '40' } });
    });
    it('Min example solves with Big-M', () => {
        const r = buildSteps(SIMPLEX_EXAMPLES.min);
        expect(r.result?.feasible).toBe(true);
        expect(r.steps![0].html).toContain('Big-M');
    });
    it('Mixed example (=, <=) is feasible', () => {
        expect(buildSteps(SIMPLEX_EXAMPLES.mixed).result?.feasible).toBe(true);
    });
    it('detects an infeasible problem', () => {
        expect(buildSteps(extra[1] as never).result?.feasible).toBe(false);
    });
    it('rejects bad input', () => {
        expect(buildSteps({ mode: 'max', vars: [{ name: '1x', c: '1' }], cons: [{ a: ['1'], op: '<=', b: '1' }] }).error).toMatch(/Variable names/);
        expect(buildSteps({ mode: 'max', vars: [{ name: 'x', c: 'abc' }], cons: [{ a: ['1'], op: '<=', b: '1' }] }).error).toMatch(/objective coefficient/);
    });
    it('parses fractions and decimals exactly', () => {
        expect(String(parseFr('1/2'))).toBe('1/2');
        expect(String(parseFr('2.5'))).toBe('5/2');
        expect(String(parseFr('-0.25'))).toBe('-1/4');
        expect(parseFr('x')).toBeNull();
        expect(parseFr('1/0')).toBeNull();
    });
});
