/* How the Transportation lesson fills the viz of the shared step card: the cost grid (cost in a small box top-right,
   allocation large in the middle), the MODI loop path, and for the answer a schedule table. */
import type { TransStep } from '../../lib/transportation/solver';
import { simpleTableHtml } from '../../components/simpleTable';
import type { CardMode, VizAdapter } from '../types';
import { drawLoop, tMetrics, transportTableHtml } from './table';

export const transportAdapter: VizAdapter<TransStep> = {
    mode: s => (s.final ? 'final' : 'normal') as CardMode,
    hasViz: s => !!(s.table || s.answer),
    sameShape: (a, b) => !!a.table && !!b.table && !a.final && !b.final
        && a.table.rows.length === b.table.rows.length && a.table.cols.length === b.table.cols.length && !!(a.table.u || a.table.v) === !!(b.table.u || b.table.v),
    minHeight(s) {
        if (s.final && s.answer) return (s.answer.rows.length + 2) * 26;
        const t = s.table;
        return t ? (t.rows.length + 2 + (t.u || t.v ? 1 : 0)) * 19 : 0;
    },
    render(v, s) {
        const W = Math.max(160, v.clientWidth - 2), H = Math.max(100, v.clientHeight - 2);
        v.style.overflow = 'hidden';
        if (s.final && s.answer) {
            v.innerHTML = '<div class="gv col"><div class="gt2" style="width:' + W + 'px;max-height:' + H + 'px">' + simpleTableHtml({ head: s.answer.head, rows: s.answer.rows, foot: s.answer.foot }, 0, W, H) + '</div></div>';
            return 60;
        }
        const t = s.table;
        if (!t) return 60;
        const mt = tMetrics(t, W, H);
        v.innerHTML = '<div class="tw">' + transportTableHtml(t, 0, mt) + '</div>';
        /* if it is still too big (tiny screen), shrink it until it fits, then allow scrolling */
        let m = mt;
        for (let k = 0; k < 10 && (v.scrollHeight > v.clientHeight + 1 || v.scrollWidth > v.clientWidth + 1); k++) {
            const f = Math.min(v.clientHeight / v.scrollHeight, v.clientWidth / v.scrollWidth) * 0.96;
            m = { w0: Math.max(40, Math.floor(m.w0 * f)), u: Math.max(18, Math.floor(m.u * f)), rowH: Math.max(11, Math.floor(m.rowH * f)), fs: Math.max(7, m.fs * f), cfs: Math.max(6, m.cfs * f) };
            v.innerHTML = '<div class="tw">' + transportTableHtml(t, 0, m) + '</div>';
        }
        drawLoop(v, t, 0, /( loop| index)$/.test(s.group || ''));     // the loop draws itself on the step that introduces it
        return m.u;
    }
};
