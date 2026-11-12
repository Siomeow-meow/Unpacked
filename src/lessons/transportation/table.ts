/* The transportation grid: sources as rows, destinations as columns. Each cell shows its cost in a small box in the
   top-right corner and the allocation large in the middle (or, for an empty cell in MODI, the circled improvement index).
   Cells carry data-t / data-r / data-c so the shared arrows can point at them. */
import type { TTable } from '../../lib/transportation/solver';
import { clamp, esc } from '../../lib/util';

export interface TMetrics { u: number; w0: number; rowH: number; fs: number; cfs: number }

export function tMetrics(t: TTable, W: number, H: number): TMetrics {
    const n = t.cols.length, m = t.rows.length, uv = !!(t.u || t.v);
    const rowsN = 2 + m + (uv ? 1 : 0);
    const rowH = clamp(Math.floor((H - 2) / rowsN), 24, 96);
    /* the first column must fit the longest row name (or "Demand"); the other columns share what is left */
    const lab = Math.max(6, ...t.rows.map(r => r.length));
    const head = Math.max(6, ...t.cols.map(c => c.length));
    let w0 = 70, u = 60, fs = 12;
    for (let k = 0; k < 4; k++) {          // the label column depends on the font size, which depends on the other columns: settle it
        u = clamp(Math.floor((W - w0) / (n + 1 + (uv ? 0.8 : 0))), 30, 150);
        fs = clamp(Math.min(rowH * 0.44, u * 0.3), 9, 30);
        fs = Math.max(8, Math.min(fs, (u - 6) / (head * 0.68)));      // "Supply" and the longest destination name must fit their column
        fs = Math.max(8, Math.min(fs, (130 - 16) / (lab * 0.74)));    // "Demand" / the longest row name must fit the first column
        w0 = clamp(Math.ceil(lab * fs * 0.74 + 16), 46, 130);
    }
    u = clamp(Math.floor((W - w0) / (n + 1 + (uv ? 0.8 : 0))), 30, 150);
    return { u, w0, rowH, fs, cfs: clamp(Math.min(rowH * 0.27, u * 0.2), 7.5, 15) };
}

export function transportTableHtml(t: TTable, ti: number, mt: TMetrics): string {
    const n = t.cols.length, m = t.rows.length, uv = !!(t.u || t.v);
    const at = (r: string | number, c: string | number) => ' data-t="' + ti + '" data-r="' + r + '" data-c="' + c + '"';
    const { u, rowH } = mt;
    const w0 = mt.w0, w1 = u, w2 = Math.round(u * 0.8);
    const total = w0 + n * w1 + w1 + (uv ? w2 : 0);
    const gray = (i: number, j: number) => (t.grayR.includes(i) || t.grayC.includes(j) ? ' gr' : '');
    const dummyHead = (c: number) => (c === t.newC ? ' newd' : '');
    let h = '<div class="tbl ttbl"><table style="width:' + total + 'px;font-size:' + mt.fs.toFixed(1) + 'px;--cfs:' + mt.cfs.toFixed(1) + 'px;--rh:' + rowH + 'px;--px:3px">';
    h += '<colgroup><col style="width:' + w0 + 'px">' + t.cols.map(() => '<col style="width:' + w1 + 'px">').join('') + '<col style="width:' + w1 + 'px">' + (uv ? '<col style="width:' + w2 + 'px">' : '') + '</colgroup>';
    h += '<thead><tr><th class="corner"></th>';
    t.cols.forEach((c, j) => { h += '<th' + at('h', j) + ' class="' + (t.cols[j] === 'Dummy' ? 'dm' : '') + dummyHead(j) + (t.grayC.includes(j) ? ' gr' : '') + '">' + esc(c) + '</th>'; });
    h += '<th' + at('h', 's') + '>Supply</th>' + (uv ? '<th' + at('h', 'u') + '>uᵢ</th>' : '') + '</tr></thead><tbody>';

    t.rows.forEach((rn, i) => {
        const newRow = i === t.newR;
        h += '<tr><th' + at(i, 'h') + ' class="rowh' + (rn === 'Dummy' ? ' dm' : '') + (newRow ? ' newd' : '') + (t.grayR.includes(i) ? ' gr' : '') + '">' + esc(rn) + '</th>';
        t.cols.forEach((_, j) => {
            const a = t.alloc[i][j], k = i + ',' + j;
            const fl = t.flags[k] || '';
            let cls = 'tc' + (fl ? ' ' + fl : '') + (a === null ? gray(i, j) : '') + (i === t.newR || j === t.newC ? ' newcell' : '');
            const sg = t.sign[k];
            let body: string;
            const idx = t.index && t.index[i] ? t.index[i][j] : null;
            if (a !== null) body = '<span class="al v">' + esc(a) + '</span>';
            else if (idx !== null && idx !== undefined) body = '<span class="idx' + (idx.startsWith('-') ? ' neg' : '') + '">' + esc(idx) + '</span>';
            else body = '<span class="al empty">&nbsp;</span>';
            if (a === null && idx === null) cls += ' blank';
            h += '<td' + at(i, j) + ' class="' + cls + '"><span class="cbox">' + esc(t.cost[i][j]) + '</span>' + (sg ? '<span class="sgn">' + (sg === '+' ? '+' : '−') + '</span>' : '') + body + '</td>';
        });
        h += '<td' + at(i, 's') + ' class="sd">' + supplyHtml(t, i) + '</td>';
        if (uv) h += '<td' + at(i, 'u') + ' class="uvc">' + (t.u && t.u[i] !== null && t.u[i] !== undefined ? '<span class="v">' + esc(t.u[i] as string) + '</span>' : '<span class="empty">&nbsp;</span>') + '</td>';
        h += '</tr>';
    });

    h += '<tr class="dem"><th class="rowh">Demand</th>';
    t.cols.forEach((_, j) => { h += '<td' + at('d', j) + ' class="sd' + (j === t.newC ? ' newcell' : '') + '">' + demandHtml(t, j) + '</td>'; });
    h += '<td' + at('tc', 0) + ' class="tcell">' + (t.tc ? '<span class="v" title="Total cost">TC ' + esc(t.tc) + '</span>' : '') + '</td>' + (uv ? '<td></td>' : '') + '</tr>';
    if (uv) {
        h += '<tr class="vrow"><th class="rowh">vⱼ</th>';
        t.cols.forEach((_, j) => { h += '<td' + at('v', j) + ' class="uvc">' + (t.v && t.v[j] !== null && t.v[j] !== undefined ? '<span class="v">' + esc(t.v[j] as string) + '</span>' : '<span class="empty">&nbsp;</span>') + '</td>'; });
        h += '<td></td><td></td></tr>';
    }
    return h + '</tbody></table></div>';
}

/* "100", or while building the starting solution: what is left ("100 → 30" for the row being filled) */
function supplyHtml(t: TTable, i: number): string {
    if (!t.left) return '<span class="v">' + esc(t.supply[i]) + '</span>';
    const b = t.left.before && t.left.before.i === i ? t.left.before : null;
    return '<span class="v">' + (b ? esc(b.s) + '<i class="to">→</i>' : '') + esc(t.left.s[i]) + '</span>';
}
function demandHtml(t: TTable, j: number): string {
    if (!t.left) return '<span class="v">' + esc(t.demand[j]) + '</span>';
    const b = t.left.before && t.left.before.j === j ? t.left.before : null;
    return '<span class="v">' + (b ? esc(b.d) + '<i class="to">→</i>' : '') + esc(t.left.d[j]) + '</span>';
}

/** the dashed closed path of the MODI loop, drawn over the table (cell centres joined in order) */
export function drawLoop(viz: HTMLElement, t: TTable, ti: number): void {
    if (!t.loop || t.loop.length < 2) return;
    const vr = viz.getBoundingClientRect();
    const pts: string[] = [];
    t.loop.forEach(c => {
        const el = viz.querySelector<HTMLElement>('[data-t="' + ti + '"][data-r="' + c.r + '"][data-c="' + c.c + '"]');
        if (!el) return;
        const r = el.getBoundingClientRect();
        pts.push((r.left - vr.left + viz.scrollLeft + r.width / 2).toFixed(1) + ',' + (r.top - vr.top + viz.scrollTop + r.height / 2).toFixed(1));
    });
    if (pts.length < 2) return;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'loopsvg');
    const W = viz.scrollWidth, H = viz.scrollHeight;
    svg.setAttribute('width', String(W)); svg.setAttribute('height', String(H));
    svg.style.width = W + 'px'; svg.style.height = H + 'px';
    const path = document.createElementNS(NS, 'polygon');
    path.setAttribute('points', pts.join(' '));
    path.setAttribute('class', 'looppath');
    svg.appendChild(path);
    viz.appendChild(svg);
}
