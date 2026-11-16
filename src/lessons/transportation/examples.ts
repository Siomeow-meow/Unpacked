import type { TransProblem } from '../../lib/transportation/solver';

export type TransExampleKey = 'nwc' | 'lc' | 'unbalanced';

/* The problem from class (balanced: supply 700 = demand 700). Costs: D 5 4 3, E 8 4 3, F 9 7 5. */
const SOURCES = [{ name: 'D', supply: '100' }, { name: 'E', supply: '300' }, { name: 'F', supply: '300' }];
const DESTS = [{ name: 'A', demand: '300' }, { name: 'B', demand: '200' }, { name: 'C', demand: '200' }];
const COST = [['5', '4', '3'], ['8', '4', '3'], ['9', '7', '5']];

export const TRANS_EXAMPLES: Record<TransExampleKey, TransProblem> = {
    nwc: { method: 'nwc', cur: '₱', sources: SOURCES, dests: DESTS, cost: COST },
    lc: { method: 'lc', cur: '₱', sources: SOURCES, dests: DESTS, cost: COST },
    /* unbalanced: supply 75 is more than demand 65, so a Dummy destination takes the 10 that are not shipped */
    unbalanced: {
        method: 'lc', cur: '₱',
        sources: [{ name: 'F1', supply: '20' }, { name: 'F2', supply: '30' }, { name: 'F3', supply: '25' }],
        dests: [{ name: 'D1', demand: '15' }, { name: 'D2', demand: '25' }, { name: 'D3', demand: '25' }],
        cost: [['8', '6', '10'], ['9', '12', '13'], ['14', '9', '16']]
    }
};
