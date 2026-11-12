import type { TransProblem } from '../../lib/transportation/solver';

export type TransExampleKey = 'nwc' | 'lc' | 'balanced' | 'dummyrow';

const SOURCES = [{ name: 'A', supply: '100' }, { name: 'B', supply: '60' }, { name: 'C', supply: '120' }];
const DESTS = [{ name: 'W', demand: '70' }, { name: 'X', demand: '50' }, { name: 'Y', demand: '60' }, { name: 'Z', demand: '60' }];
const COST = [['1', '5', '3', '4'], ['4', '2', '2', '4'], ['3', '1', '2', '4']];

export const TRANS_EXAMPLES: Record<TransExampleKey, TransProblem> = {
    nwc: { method: 'nwc', cur: '₱', sources: SOURCES, dests: DESTS, cost: COST },
    lc: { method: 'lc', cur: '₱', sources: SOURCES, dests: DESTS, cost: COST },
    balanced: {
        method: 'lc', cur: '₱',
        sources: [{ name: 'F1', supply: '20' }, { name: 'F2', supply: '30' }, { name: 'F3', supply: '25' }],
        dests: [{ name: 'D1', demand: '15' }, { name: 'D2', demand: '25' }, { name: 'D3', demand: '35' }],
        cost: [['8', '6', '10'], ['9', '12', '13'], ['14', '9', '16']]
    },
    dummyrow: {
        method: 'nwc', cur: '₱',
        sources: [{ name: 'P', supply: '40' }, { name: 'Q', supply: '30' }],
        dests: [{ name: 'R', demand: '30' }, { name: 'S', demand: '35' }, { name: 'T', demand: '25' }],
        cost: [['4', '6', '8'], ['5', '3', '7']]
    }
};
