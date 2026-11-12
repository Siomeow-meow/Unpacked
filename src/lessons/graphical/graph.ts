/* Draws the graph of a step as an SVG string: axes with ticks, one colour per constraint line, shaded sides,
   the feasible region, the point being worked on in green with dashed guide lines to the axes, and the dashed
   iso-profit line. Pixel sizes are given, so text stays the same size on every screen. */
import { LINE_COLORS, REGION_COLOR, type GraphSpec } from '../../lib/graphical/solver';

interface P2 { x: number; y: number }
const EPS = 1e-9;

/** keep the part of a polygon where sgn*(a x + b y - c) <= 0 (Sutherland-Hodgman) */
function clip(poly: P2[], a: number, b: number, c: number, sgn: number): P2[] {
    const g = (p: P2) => sgn * (a * p.x + b * p.y - c);
    const out: P2[] = [];
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const gp = g(p), gq = g(q);
        if (gp <= EPS) out.push(p);
        if ((gp < -EPS && gq > EPS) || (gp > EPS && gq < -EPS)) {
            const t = gp / (gp - gq);
            out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
        }
    }
    return out;
}
const area = (poly: P2[]) => { let s = 0; poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; s += p.x * q.y - q.x * p.y; }); return Math.abs(s) / 2; };

/** the end points of line a x + b y = c inside the box [0,X]x[0,Y] */
function lineInBox(a: number, b: number, c: number, X: number, Y: number): [P2, P2] | null {
    const pts: P2[] = [];
    const add = (x: number, y: number) => { if (x >= -EPS && x <= X + EPS && y >= -EPS && y <= Y + EPS && !pts.some(p => Math.hypot(p.x - x, p.y - y) < 1e-7)) pts.push({ x, y }); };
    if (Math.abs(b) > EPS) { add(0, c / b); add(X, (c - a * X) / b); }
    if (Math.abs(a) > EPS) { add(c / a, 0); add((c - b * Y) / a, Y); }
    return pts.length >= 2 ? [pts[0], pts[1]] : null;
}

const tickTxt = (v: number) => { const r = Math.round(v * 1000) / 1000; return String(r); };
const f1 = (n: number) => n.toFixed(1);
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function graphSvg(g: GraphSpec, W0: number, H0: number): string {
    const small = W0 < 380;
    const L = small ? 34 : 42, R = 14, T = 14, B = small ? 26 : 30;
    /* the plot box is always a square (1 : 1), so a graph never looks stretched; the picture is as small as that needs */
    const side = Math.max(50, Math.min(W0 - L - R, H0 - T - B));
    const w = side, h = side;
    const W = L + R + side, H = T + B + side;
    const { xmax, ymax, xstep, ystep } = g.view;
    const sx = (x: number) => L + (x / xmax) * w, sy = (y: number) => T + h - (y / ymax) * h;
    const fs = small ? 9.5 : 11;
    let s = '<svg class="gsvg" xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Graph of the constraints">';
    const box: P2[] = [{ x: 0, y: 0 }, { x: xmax, y: 0 }, { x: xmax, y: ymax }, { x: 0, y: ymax }];
    const poly = (pp: P2[]) => pp.map(p => f1(sx(p.x)) + ',' + f1(sy(p.y))).join(' ');

    /* grid + ticks */
    for (let v = 0; v <= xmax + 1e-9; v += xstep) {
        s += '<line class="gl" x1="' + f1(sx(v)) + '" y1="' + T + '" x2="' + f1(sx(v)) + '" y2="' + (T + h) + '"/>';
        s += '<text class="gt" x="' + f1(sx(v)) + '" y="' + (T + h + fs + 4) + '" text-anchor="middle" style="font-size:' + fs + 'px">' + tickTxt(v) + '</text>';
    }
    for (let v = 0; v <= ymax + 1e-9; v += ystep) {
        s += '<line class="gl" x1="' + L + '" y1="' + f1(sy(v)) + '" x2="' + (L + w) + '" y2="' + f1(sy(v)) + '"/>';
        s += '<text class="gt" x="' + (L - 5) + '" y="' + f1(sy(v) + fs * 0.35) + '" text-anchor="end" style="font-size:' + fs + 'px">' + tickTxt(v) + '</text>';
    }

    /* shaded sides: the side that satisfies the constraint, clipped to the box */
    g.shade.forEach(i => {
        const k = g.cons[i];
        if (k.op === '=') return;
        const sh = clip(box, k.a[0], k.a[1], k.b, k.op === '<=' ? 1 : -1);
        if (sh.length > 2) s += '<polygon points="' + poly(sh) + '" fill="' + LINE_COLORS[i % LINE_COLORS.length] + '" fill-opacity="' + (g.focusShade === i ? 0.24 : 0.11) + '"/>';
    });

    /* feasible region: the overlap of everything (and the first quadrant) in its own colour */
    if (g.region) {
        let reg = box;
        g.cons.forEach(k => { if (k.op === '=') return; reg = clip(reg, k.a[0], k.a[1], k.b, k.op === '<=' ? 1 : -1); });
        const eqs = g.cons.filter(k => k.op === '=');
        if (reg.length > 2 && area(reg) > 1e-7 && !eqs.length) {
            s += '<polygon points="' + poly(reg) + '" fill="' + REGION_COLOR + '" fill-opacity="0.42" stroke="' + REGION_COLOR + '" stroke-width="2.2" stroke-linejoin="round"/>';
        } else {
            /* an equality constraint (or a single corner): the region is a segment or a point */
            let seg: P2[] = box;
            g.cons.forEach(k => { if (k.op === '=') { const e = lineInBox(k.a[0], k.a[1], k.b, xmax, ymax); if (e) seg = e; } });
            if (seg.length === 2) {
                /* trim the segment against the inequalities by sampling */
                const pts: P2[] = [];
                for (let t = 0; t <= 200; t++) {
                    const p = { x: seg[0].x + (seg[1].x - seg[0].x) * t / 200, y: seg[0].y + (seg[1].y - seg[0].y) * t / 200 };
                    if (g.cons.every(k => { const v = k.a[0] * p.x + k.a[1] * p.y - k.b; return k.op === '<=' ? v <= 1e-7 : k.op === '>=' ? v >= -1e-7 : Math.abs(v) < 1e-7; })) pts.push(p);
                }
                if (pts.length) s += '<polyline points="' + poly([pts[0], pts[pts.length - 1]]) + '" fill="none" stroke="' + REGION_COLOR + '" stroke-width="6" stroke-linecap="round" opacity="0.85"/>';
            }
        }
    }

    /* axes */
    s += '<line class="gax" x1="' + L + '" y1="' + (T + h) + '" x2="' + (L + w) + '" y2="' + (T + h) + '"/><line class="gax" x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (T + h) + '"/>';
    s += '<text class="gname" x="' + (L + w) + '" y="' + (T + h - 6) + '" text-anchor="end" style="font-size:' + (fs + 1) + 'px">' + esc(g.names[0]) + '</text>';
    s += '<text class="gname" x="' + (L + 6) + '" y="' + (T + fs + 2) + '" style="font-size:' + (fs + 1) + 'px">' + esc(g.names[1]) + '</text>';

    /* constraint lines, each with its own colour and a number badge */
    g.lines.forEach(i => {
        const k = g.cons[i], e = lineInBox(k.a[0], k.a[1], k.b, xmax, ymax);
        if (!e) return;
        const col = LINE_COLORS[i % LINE_COLORS.length], focus = g.focusLine === i;
        s += '<line x1="' + f1(sx(e[0].x)) + '" y1="' + f1(sy(e[0].y)) + '" x2="' + f1(sx(e[1].x)) + '" y2="' + f1(sy(e[1].y)) + '" stroke="' + col + '" stroke-width="' + (focus ? 3.6 : 2.4) + '" stroke-linecap="round"/>';
        const end = e[0].y >= e[1].y ? e[0] : e[1], other = end === e[0] ? e[1] : e[0];
        /* the badge sits a little way along the line from its upper end, clear of the axis labels */
        const tt = 0.14;
        const bx = sx(end.x + (other.x - end.x) * tt), by = sy(end.y + (other.y - end.y) * tt);
        s += '<g><circle cx="' + f1(bx) + '" cy="' + f1(by) + '" r="8.5" fill="' + col + '"/><text x="' + f1(bx) + '" y="' + f1(by + 3.6) + '" text-anchor="middle" style="font:700 10px system-ui;fill:#fff">' + (i + 1) + '</text></g>';
    });

    /* iso-profit / iso-cost line through the best corner */
    if (g.iso) {
        const e = lineInBox(g.obj[0], g.obj[1], g.iso.z, xmax, ymax);
        if (e) s += '<line class="giso" x1="' + f1(sx(e[0].x)) + '" y1="' + f1(sy(e[0].y)) + '" x2="' + f1(sx(e[1].x)) + '" y2="' + f1(sy(e[1].y)) + '" stroke-dasharray="7 5" stroke-width="2.2"/>';
    }

    /* dashed guide lines from the point being worked on to the axes */
    if (g.guides) {
        g.points.filter(p => p.kind === 'focus' || p.kind === 'best').forEach(p => {
            s += '<line class="gguide" x1="' + f1(sx(p.x)) + '" y1="' + f1(sy(p.y)) + '" x2="' + f1(sx(p.x)) + '" y2="' + f1(sy(0)) + '" stroke-dasharray="4 3"/>';
            s += '<line class="gguide" x1="' + f1(sx(p.x)) + '" y1="' + f1(sy(p.y)) + '" x2="' + f1(sx(0)) + '" y2="' + f1(sy(p.y)) + '" stroke-dasharray="4 3"/>';
        });
    }

    /* points last, so they sit on top */
    g.points.forEach(p => {
        const cx = sx(p.x), cy = sy(p.y);
        const big = p.kind === 'focus' || p.kind === 'best', test = p.kind === 'test';
        /* test points: green = the constraint holds there, red = it does not */
        const fill = big ? '#2b8a3e' : test ? (p.ok ? '#2b8a3e' : '#c92a2a') : 'var(--ink)';
        s += '<circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + (big ? 6.5 : test ? 5.5 : 4.2) + '" style="fill:' + fill + '" stroke="#fff" stroke-width="1.6"' + '/>';
        if (p.label) {
            const txt = esc(p.label);
            const tw = txt.length * fs * 0.58;
            let tx = cx + 9, anchor = 'start';
            if (tx + tw > W - 4) { tx = cx - 9; anchor = 'end'; }
            const ty = cy - 9 < T + 6 ? cy + fs + 6 : cy - 9;
            s += '<text class="plbl" x="' + f1(tx) + '" y="' + f1(ty) + '" text-anchor="' + anchor + '" style="font-size:' + fs + 'px">' + txt + '</text>';
        }
    });
    return s + '</svg>';
}
