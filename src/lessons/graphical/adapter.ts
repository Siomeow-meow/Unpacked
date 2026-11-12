/* How the Graphical lesson fills the viz of the shared step card: the SVG graph and/or a small table whose cells
   carry data-t / data-r / data-c, so the shared arrows can point at them. */
import type { GraphStep } from '../../lib/graphical/solver';
import { simpleTableHtml as graphTableHtml } from '../../components/simpleTable';
import type { CardMode, VizAdapter } from '../types';
import { graphSvg } from './graph';

export const graphicalAdapter: VizAdapter<GraphStep> = {
    mode: s => (s.final ? 'final' : !s.graph && !s.table ? 'textonly' : 'normal') as CardMode,
    hasViz: s => !!(s.graph || s.table),
    sameShape: (a, b) => !!a.table && !!b.table && a.table.rows.length === b.table.rows.length && !!a.graph === !!b.graph,
    minHeight(s, v) {
        const W = v.clientWidth;
        if (s.graph && s.table) return W >= 320 ? 130 : (s.table.rows.length + 1) * 19 + 4 + 8 + 110;
        if (s.graph) return 140;
        return s.table ? (s.table.rows.length + 2) * (s.final ? 28 : 19) : 0;
    },
    render(v, s) {
        const W = Math.max(160, v.clientWidth - 2), H = Math.max(80, v.clientHeight - 10);
        v.style.overflow = 'hidden';
        /* the conclusion shows the graph too when there is room for it */
        const g = s.graph && !(s.final && H < 340) ? s.graph : null;
        const both = !!(g && s.table);
        /* graph + table: side by side or stacked, whichever lets the square graph be bigger */
        let gs = Math.min(W, H), tw = W, th = H, wide = false;
        if (both && s.table) {
            const needTh = (s.table.rows.length + 1) * (s.final ? 30 : 19) + 4;
            const needTw = s.final ? 340 : 190;
            const gsRow = Math.min(H, W - 12 - needTw), gsCol = Math.min(W, H - needTh - 8);
            if (gsRow >= gsCol && gsRow >= 110) { wide = true; gs = gsRow; tw = W - 12 - gs; }
            else { gs = Math.max(90, gsCol); th = Math.max(40, H - gs - 8); }
        }
        let html = '<div class="gv ' + (wide ? 'row' : 'col') + '">';
        if (g) html += '<div class="gg" style="width:' + gs + 'px;height:' + gs + 'px">' + graphSvg(g, gs, gs) + '</div>';
        if (s.table) html += '<div class="gt2" style="' + (wide ? 'max-width:' : 'width:') + (g ? tw : W) + 'px;max-height:' + (g ? th : H) + 'px">' + graphTableHtml(s.table, 0, tw, g ? th : H) + '</div>';
        v.innerHTML = html + '</div>';
        return 60;
    }
};

export { graphTableHtml };
