import type { SimplexProblem } from '../../lib/simplex/solver';

export type SimplexExampleKey = 'max' | 'min' | 'mixed';

/** The three built-in examples, exactly as in the original app. */
export const SIMPLEX_EXAMPLES: Record<SimplexExampleKey, SimplexProblem> = {
    max: { mode: 'max', cur: '₱', vars: [{ name: 'T', c: '700' }, { name: 'C', c: '500' }],
        cons: [{ a: ['4', '3'], op: '<=', b: '240' }, { a: ['2', '1'], op: '<=', b: '100' }] },
    min: { mode: 'min', cur: '₱', vars: [{ name: 'x', c: '45' }, { name: 'y', c: '24' }],
        cons: [{ a: ['2', '3'], op: '>=', b: '16' }, { a: ['3', '5'], op: '>=', b: '25' }] },
    mixed: { mode: 'max', cur: '₱', vars: [{ name: 'x', c: '3' }, { name: 'y', c: '5' }],
        cons: [{ a: ['1', '2'], op: '=', b: '10' }, { a: ['1', '0'], op: '<=', b: '8' }] }
};
