/* The animated-arrow layer shared by every lesson. It works on any viz whose cells carry
   data-t (table), data-r (row) and data-c (column) attributes: a step lists arrows from cell refs to cell refs,
   and this module draws them one operation at a time, outlines the cells, and underlines the matching formula parts.
   Ported from the original app.js with the behaviour unchanged. */
import { clamp } from '../lib/util';

export type CellRef = (number | string)[];
export interface ArrowDef { from: CellRef; to: CellRef; kind: string; mid?: boolean; label?: string }
export interface FormulaPart { t: string; id?: string }
export interface FormulaArrow { cell?: CellRef; part: string; kind: string }
export interface ArrowStep { arrows: ArrowDef[]; farrows?: FormulaArrow[] | null }

export const KINDS: Record<string, { color: string; bend: number; text: string }> = {
    cost: { color: '#e8590c', bend: -0.3, text: 'Cj (cost) value' },
    val:  { color: '#1c7ed6', bend: 0.3, text: 'value in the table' },
    old:  { color: '#1c7ed6', bend: 0.22, text: 'old value' },
    mult: { color: '#e8590c', bend: -0.3, text: 'multiplier / divisor' },
    prow: { color: '#9c36b5', bend: 0.3, text: 'new pivot row value' },
    pick: { color: '#c92a2a', bend: 0.35, text: 'selected' },
    swap: { color: '#2b8a3e', bend: -0.3, text: 'swap' },
    res:  { color: '#2b8a3e', bend: 0.3, text: 'result' }
};

/* ---------- animation control (arrows appear one by one; Next skips them) ---------- */
export const T0 = 350, GAP = 650, DUR = 700;
export const animTotal = (n: number) => (n ? T0 + (n - 1) * GAP + DUR : 0);

interface Sched { id: ReturnType<typeof setTimeout>; done: boolean; fn: () => void }
export class AnimCtl {
    busy = false;
    fns: Sched[] = [];
    anims: Animation[] = [];
    el: HTMLElement | null = null;
    cancel() {
        this.fns.forEach(f => clearTimeout(f.id));
        this.busy = false; this.fns = []; this.anims = []; this.el = null;
    }
    sched(ms: number, fn: () => void) {
        const f: Sched = { done: false, fn, id: 0 as never };
        f.id = setTimeout(() => { f.done = true; fn(); }, ms);
        this.fns.push(f);
    }
    /** Skips the running arrow animation. Returns true if there was one to skip. */
    finish(): boolean {
        if (!this.busy) return false;
        this.busy = false;
        if (this.el) this.el.classList.add('noanim');
        this.fns.forEach(f => { if (!f.done) { clearTimeout(f.id); f.done = true; f.fn(); } });
        this.anims.forEach(a => { try { a.finish(); } catch { /* ignore */ } });
        return true;
    }
}

/* ---------- helpers ---------- */
export const keyOf = (r: CellRef) => r.join('|');

/** outline colour of every cell that an arrow leaves (a 'result' arrow leaves a plain value, so it counts as blue) */
export function srcColors(step: ArrowStep): Record<string, string> {
    const out: Record<string, string> = {};
    step.arrows.forEach(a => { const k = keyOf(a.from); if (!out[k]) out[k] = KINDS[a.kind === 'res' ? 'val' : a.kind].color; });
    return out;
}
/** distinct cell references used by a step's arrows ('from' = source boxes, 'to' = green targets) */
export function refsOf(step: ArrowStep, side: 'from' | 'to'): CellRef[] {
    const seen = new Set<string>(), out: CellRef[] = [];
    step.arrows.forEach(a => { if (side === 'to' && a.mid) return; const r = a[side], k = keyOf(r); if (!seen.has(k)) { seen.add(k); out.push(r); } });
    return out;
}
export const cellAt = (viz: HTMLElement, r: CellRef) =>
    viz.querySelector<HTMLElement>('[data-t="' + r[0] + '"][data-r="' + r[1] + '"][data-c="' + r[2] + '"]');

export interface Box { x: number; y: number; w: number; h: number }
export function boxOf(viz: HTMLElement, e: Element): Box {
    const vr = viz.getBoundingClientRect(), r = e.getBoundingClientRect();
    return { x: r.left - vr.left + viz.scrollLeft, y: r.top - vr.top + viz.scrollTop, w: r.width, h: r.height };
}
export interface Refs { from: CellRef[]; to: CellRef[] }
export interface Rects { from: (Box | null)[]; to: (Box | null)[] }
export function rectsOf(viz: HTMLElement, refs: Refs): Rects {
    const out = {} as Rects;
    (['from', 'to'] as const).forEach(side => {
        out[side] = refs[side].map(r => { const e = cellAt(viz, r); return e ? boxOf(viz, e) : null; });
    });
    return out;
}

/* ---------- smooth hand-over between similar steps ---------- */
export function glide(ctl: AnimCtl, viz: HTMLElement, s: ArrowStep, oldRefs: Refs, oldRects: Rects) {
    const colors = srcColors(s);
    (['from', 'to'] as const).forEach(side => {
        const cls = side === 'from' ? 'src' : 'tgt';
        const nr = refsOf(s, side);
        nr.forEach((ref, k) => {
            const e = cellAt(viz, ref);
            if (!e || !oldRefs[side][k]) return;
            if (keyOf(ref) === keyOf(oldRefs[side][k])) { if (side === 'from') { e.style.setProperty('--hc', colors[keyOf(ref)] || '#1c7ed6'); e.classList.add('src'); } return; }   // box stays where it was
            const a = oldRects[side][k];
            if (!a) return;
            const b = boxOf(viz, e);
            const g = document.createElement('div');
            g.className = 'ghost ' + cls;
            const put = (r: Box) => 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px';
            const col = side === 'from' ? (colors[keyOf(ref)] || '#1c7ed6') : '#2b8a3e';
            const tail = ';border-color:' + col + ';background:color-mix(in srgb, ' + col + ' 16%, transparent)';
            g.style.cssText = put(a) + tail;
            viz.appendChild(g);
            if (g.animate) ctl.anims.push(g.animate([
                { left: a.x + 'px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px' },
                { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' }
            ], { duration: 300, easing: 'cubic-bezier(.3,.8,.3,1)', fill: 'forwards' }));
            else g.style.cssText = put(b) + tail;
            const ai = side === 'from' ? Math.max(0, s.arrows.findIndex(x => keyOf(x.from) === keyOf(ref) || (x.mid && keyOf(x.to) === keyOf(ref)))) : 0;
            ctl.sched(side === 'from' ? T0 + ai * GAP + DUR : animTotal(s.arrows.length) - 100, () => g.remove());
        });
    });
}

/* ---------- arrows (animated one by one, labels kept apart) ---------- */
const NS = 'http://www.w3.org/2000/svg';
type Pt = { x: number; y: number };
export function layoutArrows(ctl: AnimCtl, card: HTMLElement, viz: HTMLElement, s: ArrowStep, unit: number, animate: boolean) {
    const find = (a: CellRef) => cellAt(viz, a);
    const nA = s.arrows.length;
    const live = animate && s.arrows.length > 0;
    if (live) { ctl.el = card; ctl.busy = true; ctl.sched(animTotal(nA) + 150, () => { ctl.busy = false; }); }
    /* a cell is outlined only once the arrow that reaches or leaves it has been drawn; colour = its arrow's colour */
    const colors = srcColors(s), first = new Map<HTMLElement, { ai: number; key: string }>(), lit = new Set<HTMLElement>();
    s.arrows.forEach((a, ai) => {
        const f = find(a.from), t = find(a.to);
        if (f && !first.has(f)) first.set(f, { ai, key: keyOf(a.from) });
        if (t && a.mid && !first.has(t)) first.set(t, { ai, key: keyOf(a.to) });
        if (t && !a.mid && !lit.has(t)) {
            lit.add(t);
            if (!live) t.classList.add('tgt');
            else { t.classList.add('pend'); ctl.sched(animTotal(nA) - 60, () => { t.style.setProperty('--d', '0s'); t.classList.remove('pend'); t.classList.add('tgt'); }); }
        }
    });
    first.forEach((v, el) => {
        const on = () => { el.style.setProperty('--hc', colors[v.key] || '#1c7ed6'); el.classList.add('src'); };
        if (!live) on(); else ctl.sched(T0 + v.ai * GAP + DUR, on);
    });
    const sc = clamp(unit / 80, 0.55, 1);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'arrows');
    const W = viz.scrollWidth, H = viz.scrollHeight;
    svg.setAttribute('width', String(W)); svg.setAttribute('height', String(H));
    svg.style.width = W + 'px'; svg.style.height = H + 'px';
    const defs = document.createElementNS(NS, 'defs');
    Object.keys(KINDS).forEach(k => {
        const mk = document.createElementNS(NS, 'marker');
        mk.setAttribute('id', 'ah-' + k); mk.setAttribute('markerUnits', 'userSpaceOnUse');
        mk.setAttribute('markerWidth', '12'); mk.setAttribute('markerHeight', '12');
        mk.setAttribute('refX', '10'); mk.setAttribute('refY', '6'); mk.setAttribute('orient', 'auto');
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', 'M1,1 L11,6 L1,11 Z'); p.setAttribute('fill', KINDS[k].color);
        mk.appendChild(p); defs.appendChild(mk);
    });
    svg.appendChild(defs);
    viz.appendChild(svg);
    const vr = viz.getBoundingClientRect();
    const rectOf = (e: Element): Box => {
        const r = e.getBoundingClientRect();
        return { x: r.left - vr.left + viz.scrollLeft, y: r.top - vr.top + viz.scrollTop, w: r.width, h: r.height };
    };
    const center = (e: Element): Pt => { const r = rectOf(e); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
    /* bounding box of just the text inside a cell (in viz coordinates) */
    const textRect = (e: Element): Box => {
        const rg = document.createRange();
        rg.selectNodeContents(e);
        const r = rg.getBoundingClientRect();
        return { x: r.left - vr.left + viz.scrollLeft, y: r.top - vr.top + viz.scrollTop, w: r.width, h: r.height };
    };
    const shorten = (p: Pt, q: Pt, d: number): Pt => { const l = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: p.x + (q.x - p.x) / l * d, y: p.y + (q.y - p.y) / l * d }; };

    interface Item { a: ArrowDef; ai: number; k: { color: string; bend: number; text: string }; path: SVGPathElement; s1: Pt; c: Pt; e1: Pt; g?: SVGGElement }
    const items: Item[] = [], obstacles: Box[] = [];
    /* arrows sharing a target cell land at different spots on its edge instead of one point */
    const perTarget = new Map<HTMLElement, number>(), seen = new Map<HTMLElement, number>();
    s.arrows.forEach(a => { const te = find(a.to); if (te) perTarget.set(te, (perTarget.get(te) || 0) + 1); });
    s.arrows.forEach((a, ai) => {
        const fe = find(a.from), te = find(a.to);
        if (!fe || !te || fe === te) return;
        const k = KINDS[a.kind];
        const cnt = perTarget.get(te) as number, nth = seen.get(te) || 0;
        seen.set(te, nth + 1);
        /* aim at the number itself: stop just outside the text, not at the cell border */
        const tr0 = rectOf(te), tx = textRect(te);
        const tr = { w: Math.min(tr0.w, tx.w + 8), h: Math.min(tr0.h, tx.h + 6) };
        const spread = cnt > 1 ? (nth - (cnt - 1) / 2) * Math.min(6, tr.w * 0.5 / (cnt - 1)) : 0;
        const p1 = center(fe), p2 = center(te);
        p2.x += spread;
        if (!tx.w) { tr.w = tr0.w; tr.h = tr0.h; }
        const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const off = Math.sign(k.bend) * Math.max(len * Math.abs(k.bend), 26 * sc);
        const c = { x: clamp((p1.x + p2.x) / 2 + nx * off, 8, Math.max(9, W - 8)), y: clamp((p1.y + p2.y) / 2 + ny * off, 8, Math.max(9, H - 8)) };
        /* end the arrow on the target cell's edge (facing the curve), not in the middle */
        let ddx = c.x - p2.x, ddy = c.y - p2.y, dd = Math.hypot(ddx, ddy);
        if (dd < 1) { ddx = 0; ddy = -1; dd = 1; }
        const tEdge = Math.min((tr.w / 2) / (Math.abs(ddx) / dd || 1e-6), (tr.h / 2) / (Math.abs(ddy) / dd || 1e-6));
        /* the curve's control point must lie OUTSIDE the target cell (with room for the head), otherwise the
           curve overshoots and the arrowhead flips backwards */
        const need = tEdge + 3 + 16 * Math.max(sc, 0.8);
        if (dd < need) { c.x = p2.x + ddx / dd * need; c.y = p2.y + ddy / dd * need; dd = need; }
        const e1 = { x: p2.x + ddx / dd * (tEdge + 3), y: p2.y + ddy / dd * (tEdge + 3) };
        const s1 = shorten(p1, c, 8 * sc);
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', 'M' + s1.x + ',' + s1.y + ' Q' + c.x + ',' + c.y + ' ' + e1.x + ',' + e1.y);
        path.setAttribute('fill', 'none'); path.setAttribute('stroke', k.color);
        path.setAttribute('stroke-width', (2.4 * Math.max(sc, 0.8)).toFixed(2)); path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', '0.92');
        svg.appendChild(path);
        obstacles.push(rectOf(fe), rectOf(te));
        items.push({ a, ai, k, path, s1, c, e1 });
    });

    /* place labels so they do not overlap each other, the highlighted cells or cell text */
    const placed: Box[] = [], texts: Box[] = [];
    viz.querySelectorAll('td,th').forEach(e => {
        if (!(e.textContent || '').trim()) return;
        const t = textRect(e);
        if (t.w) texts.push({ x: t.x, y: t.y, w: t.w, h: t.h });
    });
    const overlap = (r1: Box, r2: Box) => Math.max(0, Math.min(r1.x + r1.w, r2.x + r2.w) - Math.max(r1.x, r2.x)) * Math.max(0, Math.min(r1.y + r1.h, r2.y + r2.h) - Math.max(r1.y, r2.y));
    const at = (it: Item, t: number): Pt => {
        const u = 1 - t;
        return { x: u * u * it.s1.x + 2 * u * t * it.c.x + t * t * it.e1.x, y: u * u * it.s1.y + 2 * u * t * it.c.y + t * t * it.e1.y };
    };
    items.forEach(it => {
        if (!it.a.label) return;
        const txt = String(it.a.label);
        const fs = 11.5 * Math.max(sc, 0.85);
        const w = txt.length * fs * 0.6 + 14, h = 20 * Math.max(sc, 0.9);
        let best: { score: number; r: Box; cx: number; cy: number } | null = null;
        const ts = [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78, 0.12, 0.88];
        const shifts = [0, 16, -16, 30, -30, 46, -46, 64, -64, 86, -86, 110, -110];
        ts.forEach((t, ti) => {
            const pt = at(it, t);
            const ddx = it.e1.x - it.s1.x, ddy = it.e1.y - it.s1.y, dl = Math.hypot(ddx, ddy) || 1;
            shifts.forEach((sh, si) => {
                const cx = pt.x + (-ddy / dl) * sh, cy = pt.y + (ddx / dl) * sh;
                const r = { x: cx - w / 2, y: cy - h / 2, w, h };
                let score = ti * 4 + si * 7;
                placed.forEach(p => { score += overlap(r, p) * 40; });
                obstacles.forEach(o => { score += overlap(r, o) * 0.6; });
                texts.forEach(o => { score += overlap(r, o) * 3; });
                if (r.x < 0) score += 400;
                if (r.x + r.w > W) score += 400;
                if (r.y < 0) score += 400;
                if (!best || score < best.score) best = { score, r, cx, cy };
            });
        });
        const bst = best as unknown as { score: number; r: Box; cx: number; cy: number };
        placed.push(bst.r);
        const g = document.createElementNS(NS, 'g');
        const rc = document.createElementNS(NS, 'rect');
        rc.setAttribute('x', String(bst.r.x)); rc.setAttribute('y', String(bst.r.y)); rc.setAttribute('width', String(w)); rc.setAttribute('height', String(h));
        rc.setAttribute('rx', String(h / 2)); rc.setAttribute('class', 'albl'); rc.setAttribute('stroke', it.k.color);
        const tx = document.createElementNS(NS, 'text');
        tx.setAttribute('x', String(bst.cx)); tx.setAttribute('y', String(bst.cy + fs * 0.35)); tx.setAttribute('text-anchor', 'middle');
        tx.setAttribute('class', 'atxt'); tx.setAttribute('fill', it.k.color); tx.style.fontSize = fs + 'px';
        tx.textContent = txt;
        g.appendChild(rc); g.appendChild(tx); svg.appendChild(g);
        it.g = g;
    });

    items.forEach(it => {
        const { path, a, ai, g } = it;
        const head = () => path.setAttribute('marker-end', 'url(#ah-' + a.kind + ')');
        if (!animate || !path.animate) { head(); return; }
        const total = path.getTotalLength();
        const delay = T0 + ai * GAP;
        path.style.strokeDasharray = String(total);
        path.style.strokeDashoffset = String(total);
        const an = path.animate([{ strokeDashoffset: total }, { strokeDashoffset: 0 }], { duration: DUR, delay, easing: 'ease-in-out', fill: 'both' });
        an.onfinish = () => { path.style.strokeDasharray = 'none'; path.style.strokeDashoffset = '0'; head(); };
        ctl.anims.push(an);
        if (g) {
            g.style.opacity = '0';
            g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center';
            ctl.anims.push(g.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }],
                { duration: 350, delay: delay + DUR * 0.55, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'both' }));
        }
    });
}

/** underline each number in the formula in the colour of the arrow that uses it */
export function formulaMarks(formula: HTMLElement, s: ArrowStep) {
    (s.farrows || []).forEach(a => {
        const pe = formula.querySelector<HTMLElement>('[data-p="' + a.part + '"]');
        if (pe) pe.style.boxShadow = 'inset 0 -2px 0 ' + KINDS[a.kind].color;
    });
}
