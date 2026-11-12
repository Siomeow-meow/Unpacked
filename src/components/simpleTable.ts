/* A small table (header, rows, optional total row) whose cells carry data-t / data-r / data-c, so the shared arrows
   can point at them. Used by the Graphical and Transportation lessons. */
import { clamp, esc } from '../lib/util';

export interface SimpleTable { head: string[]; rows: string[][]; hlRow?: number; bestRow?: number; foot?: string[] }

export function simpleTableHtml(t: SimpleTable, ti: number, w: number, h: number): string {
    const rows = t.rows.length + 1 + (t.foot ? 1 : 0);
    const rowH = clamp(Math.floor((h - 4) / rows), 17, 36);
    const px = clamp(Math.floor(w / (t.head.length * 9)), 3, 12);
    /* shrink the text until the widest entry of every column fits the width we were given */
    const chars = t.head.reduce((sum, hd, c) => sum + Math.max(hd.length, ...t.rows.map(r => (r[c] || '').length)), 0);
    const fs = clamp(Math.min(rowH * 0.46, (w - t.head.length * 2 * px - 4) / (chars * 0.6)), 8.5, 16);
    const at = (r: string | number, c: number) => ' data-t="' + ti + '" data-r="' + r + '" data-c="' + c + '"';
    let html = '<div class="tbl gtbl"><table style="font-size:' + fs.toFixed(1) + 'px;--px:' + px + 'px;--rh:' + rowH + 'px;table-layout:auto"><thead><tr>';
    t.head.forEach((x, c) => { html += '<th' + at('h', c) + '>' + esc(x) + '</th>'; });
    html += '</tr></thead><tbody>';
    t.rows.forEach((r, i) => {
        html += '<tr class="' + (t.bestRow === i ? 'best' : t.hlRow === i ? 'row-hl' : '') + '">';
        r.forEach((x, c) => {
            html += '<td' + at(i, c) + (c === 0 && t.head[0] === 'Constraint' ? ' class="lt"' : '') + '>' + (x === '' ? '<span class="empty">&nbsp;</span>' : '<span class="v">' + esc(x) + '</span>') + '</td>';
        });
        html += '</tr>';
    });
    if (t.foot) html += '<tr class="foot">' + t.foot.map((x, c) => '<td' + at('f', c) + '>' + (x === '' ? '&nbsp;' : '<b>' + esc(x) + '</b>') + '</td>').join('') + '</tr>';
    return html + '</tbody></table></div>';
}

