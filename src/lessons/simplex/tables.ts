/* Simplex table drawing: HTML for one simplex table plus the cell-size maths that makes every step of a problem
   use the same cell size. Ported from the original app.js (behaviour unchanged). */
import { clamp, esc } from '../../lib/util';
import type { SimplexStep, SimplexTable } from '../../lib/simplex/solver';

export interface Metrics { u: number; rowH: number; side: boolean; fs: number; px: number; wide?: boolean }
export interface TextWidths { cj: number; pm: number; u: number; r: number }

export const modeOf = (s: SimplexStep) => (!s.tables.length ? 'textonly' : (s.group === 'final' ? 'final' : 'normal'));

/* Widest text per column type across EVERY step of the problem, so the cell size is chosen once
   and never changes from step to step (no sudden shifting). */
export function measureTexts(stp: SimplexStep[]): TextWidths {
    const cv = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    cv.font = '800 100px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
    const W: TextWidths = { cj: 0, pm: 0, u: 0, r: 0 };
    const add = (k: keyof TextWidths, x: unknown) => {
        if (x === undefined || x === null || x === '') return;
        const w = cv.measureText(String(x)).width;
        if (w > W[k]) W[k] = w;
    };
    add('cj', 'Cj-Zj'); add('pm', '∅');
    stp.forEach(s => s.tables.forEach(t => {
        (t.head || []).forEach(x => add('u', x));
        t.names.forEach(x => add('u', x));
        if (t.hasRatio) add('r', 'Qty÷OC');
        t.rows.forEach(r => { add('cj', r.cj); add('pm', r.name); add('u', r.qty); r.cells.forEach(x => add('u', x)); add('r', r.ratio); });
        if (t.zj) { add('u', t.zj.qty); t.zj.cells.forEach(x => add('u', x)); }
        if (t.cjzj) t.cjzj.forEach(x => add('u', x));
    }));
    return W;
}

/* Make the text fit its column: shrink the font first; only if that would go below 9px, widen the columns
   (the area then scrolls sideways). Either way the result is the same on every step. */
export function fitCols(m: Metrics, textW: TextWidths | null): Metrics {
    if (!textW) return m;
    const S = 1.05, pad = m.px * 2 + 4;
    const cls: [number, number][] = [[0.75, textW.cj], [0.6, textW.pm], [1, textW.u], [1.1, textW.r]];
    let fs = m.fs;
    cls.forEach(c => { if (c[1]) fs = Math.min(fs, (Math.round(m.u * c[0]) - pad) / (c[1] * S / 100)); });
    if (fs >= 9) return Object.assign({}, m, { fs });
    fs = 9;
    let u = m.u;
    cls.forEach(c => { if (c[1]) u = Math.max(u, Math.ceil((c[1] * S * fs / 100 + pad) / c[0]) + 1); });
    return Object.assign({}, m, { fs, u });
}

/* Table size depends only on the problem size and the card size (not on the step's content),
   so every step of a problem uses the same cell size. */
export function metrics(s: SimplexStep, mode: string, viz: HTMLElement, textW: TextWidths | null): Metrics {
    const W = Math.max(200, viz.clientWidth - 2), H = Math.max(100, viz.clientHeight - 4);
    const n = s.tables.length ? s.tables[0].names.length : 0;
    const R = s.tables.length ? s.tables[0].rows.length : 0;
    const units = 0.75 + 0.6 + 1 + n + 1.1;
    const pack = (u: number, rowH: number, side: boolean): Metrics => {
        const p: Metrics = { u, rowH, side, fs: clamp(Math.min(rowH * 0.5, u / 6.2), 9, 22), px: clamp(u / 10, 3, 14) };
        const f = fitCols(p, textW);
        f.wide = f.u > u;
        return f;
    };
    /* option A: tables stacked (old above new) */
    const nT = mode === 'normal' ? Math.max(1, s.tables.length) : 1;
    const stack = pack(clamp(Math.floor(W / units), 40, 150),
        clamp(Math.floor((H - (nT === 2 ? 52 : 0) - 16 - nT * (R + 5)) / (nT * (R + 4))), 15, 60), false);
    if (mode !== 'normal' || W < 760) return stack;
    /* option B: old and new side by side (uses wide screens much better) */
    const side = pack(clamp(Math.floor(((W - 40) / 2) / units), 40, 150),
        clamp(Math.floor((H - 34 - (R + 5)) / (R + 4)), 15, 60), true);
    return !side.wide && side.fs > stack.fs + 0.4 ? side : stack;
}

export const sameShape = (a: SimplexStep, b: SimplexStep) => {
    if (!a.tables.length || a.tables.length !== b.tables.length) return false;
    return a.tables.every((t, i) => t.names.length === b.tables[i].names.length && t.rows.length === b.tables[i].rows.length && t.hasRatio === b.tables[i].hasRatio);
};

const cell = (x: string | undefined) => (x === '' || x === undefined ? '<span class="empty">&nbsp;</span>' : '<span class="v">' + esc(x) + '</span>');

export function tableHtml(t: SimplexTable, ti: number, m: Metrics): string {
    const hl = t.hl || {};
    const n = t.names.length;
    const cc = (j: number) => (hl.col === j ? ' col-hl' : '');
    const at = (r: string | number, c: string | number) => ' data-t="' + ti + '" data-r="' + r + '" data-c="' + c + '"';
    const u = m.u;
    const wcj = Math.round(u * 0.75), wpm = Math.round(u * 0.6), wr = Math.round(u * 1.1);
    const w = wcj + wpm + u + u * n + (t.hasRatio ? wr : 0);
    let h = '<div class="tbl"><table style="width:' + w + 'px;font-size:' + m.fs.toFixed(1) + 'px;--px:' + m.px.toFixed(1) + 'px;--rh:' + m.rowH + 'px"><colgroup><col style="width:' + wcj + 'px"><col style="width:' + wpm + 'px"><col style="width:' + u + 'px">' +
        t.names.map(() => '<col style="width:' + u + 'px">').join('') + (t.hasRatio ? '<col style="width:' + wr + 'px">' : '') + '</colgroup>';
    h += '<thead><tr class="cjhead"><th></th><th></th><th></th>';
    t.head.forEach((x, j) => { h += '<th' + at('h', j) + ' class="' + cc(j).trim() + '">' + esc(x) + '</th>'; });
    if (t.hasRatio) h += '<th></th>';
    h += '</tr><tr><th' + at('n', 'cj') + '>Cj</th><th' + at('n', 'pm') + '>PM</th><th' + at('n', 'q') + '>Qty</th>';
    t.names.forEach((x, j) => { h += '<th' + at('n', j) + ' class="' + cc(j).trim() + '">' + esc(x) + '</th>'; });
    if (t.hasRatio) h += '<th' + at('n', 'ratio') + '>Qty÷OC</th>';
    h += '</tr></thead><tbody>';
    t.rows.forEach((r, i) => {
        h += '<tr' + (hl.row === i ? ' class="row-hl"' : '') + '><td' + at(i, 'cj') + '>' + esc(r.cj) + '</td><td' + at(i, 'pm') + '><b>' + esc(r.name) + '</b></td><td' + at(i, 'q') + '>' + cell(r.qty) + '</td>';
        r.cells.forEach((x, j) => {
            const c = (hl.pivot && hl.row === i && hl.col === j) ? 'pivot' : cc(j).trim();
            h += '<td' + at(i, j) + ' class="' + c + '">' + cell(x) + '</td>';
        });
        if (t.hasRatio) h += '<td' + at(i, 'ratio') + '>' + cell(r.ratio || '') + '</td>';
        h += '</tr>';
    });
    h += '<tr class="calcrow"><td>Zj</td><td>∅</td><td' + at('z', 'q') + '>' + (t.zj ? cell(t.zj.qty) : '') + '</td>';
    for (let j = 0; j < n; j++) h += '<td' + at('z', j) + ' class="' + cc(j).trim() + '">' + (t.zj ? cell(t.zj.cells[j]) : '') + '</td>';
    if (t.hasRatio) h += '<td></td>';
    h += '</tr><tr class="calcrow"><td>Cj-Zj</td><td>∅</td><td>∅</td>';
    for (let j = 0; j < n; j++) h += '<td' + at('cz', j) + ' class="' + cc(j).trim() + '">' + (t.cjzj ? cell(t.cjzj[j]) : '') + '</td>';
    if (t.hasRatio) h += '<td></td>';
    h += '</tr></tbody></table></div>';
    return h;
}

/* ---------- adapter: how the Simplex lesson fills the viz of the shared step card ---------- */
import type { CardMode, VizAdapter } from '../types';

const widthCache = new WeakMap<SimplexStep[], TextWidths>();
/** widest text per column type, cached per solved problem (so the cell size never changes between steps) */
export function textWidthsFor(steps: SimplexStep[]): TextWidths {
    let w = widthCache.get(steps);
    if (!w) { w = measureTexts(steps); widthCache.set(steps, w); }
    return w;
}

export const simplexAdapter: VizAdapter<SimplexStep> = {
    mode: s => modeOf(s) as CardMode,
    hasViz: s => s.tables.length > 0,
    prepare: steps => textWidthsFor(steps),
    sameShape,
    render(v, s, mode, ctx) {
        const textW = ctx as TextWidths;
        let m = metrics(s, mode, v, textW);
        v.style.overflow = 'hidden';
        const build = (mm: Metrics) => {
            let h = '';
            s.tables.forEach((t, ti) => { h += '<div class="tw">' + (t.label ? '<div class="tlabel">' + esc(t.label) + '</div>' : '') + tableHtml(t, ti, mm) + '</div>'; });
            v.classList.toggle('side', !!mm.side && s.tables.length > 1);
            v.innerHTML = h;
        };
        build(m);
        /* safety net: if the tables are still bigger than the area, shrink them until they fit */
        for (let i = 0; i < 5; i++) {
            const needH = v.scrollHeight, needW = v.scrollWidth;
            if (needH <= v.clientHeight + 1 && needW <= v.clientWidth + 1) break;
            const f = Math.min(v.clientHeight / needH, v.clientWidth / needW) * 0.97;
            const rowH = Math.max(13, Math.floor(m.rowH * f)), u = Math.max(32, Math.floor(m.u * f));
            m = fitCols(Object.assign({}, m, { u, rowH, fs: clamp(Math.min(rowH * 0.46, u / 6.2), 8, 16), px: clamp(u / 10, 3, 10) }), textW);
            build(m);
        }
        /* only if it truly cannot fit (tiny screen + big problem) allow scrolling inside the area */
        if (v.scrollHeight > v.clientHeight + 1 || v.scrollWidth > v.clientWidth + 1) v.style.overflow = 'auto';
        return m.u;
    }
};
