import type { GraphProblem } from '../../lib/graphical/solver';

export type GraphExampleKey = 'max' | 'min' | 'empty' | 'unbounded';

export const GRAPH_EXAMPLES: Record<GraphExampleKey, GraphProblem> = {
    max: { mode: 'max', cur: '₱', obj: 'P', vars: [{ name: 'T', c: '700' }, { name: 'C', c: '500' }],
        cons: [{ a: ['4', '3'], op: '<=', b: '240', tp: ['0', '0'] }, { a: ['2', '1'], op: '<=', b: '100', tp: ['0', '0'] }] },
    min: { mode: 'min', cur: '₱', obj: 'Z', vars: [{ name: 'x', c: '45' }, { name: 'y', c: '24' }],
        cons: [{ a: ['2', '3'], op: '>=', b: '16', tp: ['0', '0'] }, { a: ['3', '5'], op: '>=', b: '25', tp: ['0', '0'] }] },
    empty: { mode: 'max', cur: '₱', obj: 'Z', vars: [{ name: 'x', c: '1' }, { name: 'y', c: '1' }],
        cons: [{ a: ['1', '1'], op: '<=', b: '3', tp: ['0', '0'] }, { a: ['1', '1'], op: '>=', b: '5', tp: ['0', '0'] }] },
    unbounded: { mode: 'max', cur: '₱', obj: 'Z', vars: [{ name: 'x', c: '1' }, { name: 'y', c: '1' }],
        cons: [{ a: ['1', '-1'], op: '<=', b: '2', tp: ['0', '0'] }, { a: ['1', '0'], op: '>=', b: '1', tp: ['0', '0'] }] }
};
