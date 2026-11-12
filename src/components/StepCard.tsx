/* The fixed-size step card (title with number badge, text, formula, viz, legend). Its size never changes with the
   content. The title, text and formula are rendered by React; the viz is filled by the lesson's adapter, and then the
   arrow layer draws the arrows over it. Ported from the original draw() with the behaviour unchanged. */
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { StepBase, VizAdapter } from '../lessons/types';
import {
    AnimCtl, KINDS, animTotal, formulaMarks, glide, layoutArrows, refsOf, rectsOf,
    type Refs, type Rects
} from './arrows';
import { Formula } from './Formula';

export interface StepCardHandle {
    /** redraw the current step; `anim` false = no entrance animation and no arrow animation (reload, resize) */
    draw(anim: boolean): void;
    /** skip the running arrow animation; true if there was one */
    finish(): boolean;
    cancel(): void;
    /** forget what was drawn last (so the next draw plays the entrance animation) */
    reset(): void;
}
interface Props<S extends StepBase> {
    steps: S[];
    idx: number;
    dir: React.RefObject<number>;
    adapter: VizAdapter<S>;
    /** lets a lesson adjust the text (e.g. put the currency in front of the answer) */
    textOf?: (s: S) => string;
    active: boolean;
    hidden: boolean;
    /** flowing layout: the text takes the room it needs (never scrolls) and the viz fills the rest */
    flow?: boolean;
}

function StepCardInner<S extends StepBase>({ steps, idx, dir, adapter, textOf, active, hidden, flow }: Props<S>, ref: React.ForwardedRef<StepCardHandle>) {
    const card = useRef<HTMLElement>(null);
    const text = useRef<HTMLDivElement>(null);
    const formula = useRef<HTMLDivElement>(null);
    const viz = useRef<HTMLDivElement>(null);
    const legend = useRef<HTMLDivElement>(null);
    const ctl = useRef(new AnimCtl());
    const drawn = useRef(-1);
    const measured = useRef({ W: 0, H: 0 });
    const ctxCache = useRef<{ steps: S[]; ctx: unknown } | null>(null);
    const flowRef = useRef(!!flow);
    flowRef.current = !!flow;
    const latest = useRef({ steps, idx, adapter, active });
    latest.current = { steps, idx, adapter, active };
    const s = steps[idx] as S | undefined;

    /* a new step: the text starts at the top */
    useLayoutEffect(() => { if (text.current) text.current.scrollTop = 0; }, [idx, steps]);

    const draw = (animate: boolean) => {
        const { steps, idx, adapter } = latest.current;
        const flow = flowRef.current;
        const st = steps[idx];
        const c = card.current, v = viz.current, fm = formula.current, lg = legend.current, tx = text.current;
        if (!st || !c || !v || !fm || !lg || !tx) return;
        const k = ctl.current;
        k.cancel();
        if (!ctxCache.current || ctxCache.current.steps !== steps) ctxCache.current = { steps, ctx: adapter.prepare ? adapter.prepare(steps) : null };
        const ctx = ctxCache.current.ctx;
        const mode = adapter.mode(st);

        /* "continuous" step: same layout as the step we just left -> keep the card still and
           glide the highlight boxes instead of replaying the whole card entrance */
        const prevS = drawn.current >= 0 && Math.abs(drawn.current - idx) === 1 ? steps[drawn.current] : null;
        const cont = !!(animate && prevS && adapter.sameShape && adapter.sameShape(prevS, st) && adapter.mode(prevS) === mode && v.clientWidth > 0);
        const oldRefs: Refs | null = cont && prevS ? { from: refsOf(prevS, 'from'), to: refsOf(prevS, 'to') } : null;
        const oldRects: Rects | null = oldRefs ? rectsOf(v, oldRefs) : null;

        c.classList.remove('noanim', 'enter-fwd', 'enter-back', 'textonly', 'final', 'cont');
        if (mode !== 'normal') c.classList.add(mode);
        if (!animate) c.classList.add('noanim');
        else if (cont) c.classList.add('cont');
        else if (drawn.current !== idx) { void c.offsetWidth; c.classList.add((dir.current ?? 1) >= 0 ? 'enter-fwd' : 'enter-back'); }
        drawn.current = idx;

        const nArr = st.arrows.length;
        const total = nArr ? animTotal(nArr) / 1000 : 0.1;
        c.style.setProperty('--d', total + 's');
        c.style.setProperty('--d2', (total * 0.6) + 's');

        v.innerHTML = '';
        lg.innerHTML = '';
        /* the legend is filled first, so the viz is measured with the room the legend takes */
        if (adapter.hasViz(st)) {
            const kinds: string[] = [];
            st.arrows.forEach(a => { if (kinds.indexOf(a.kind) < 0) kinds.push(a.kind); });
            lg.innerHTML = kinds.map(kd => { const kk = KINDS[kd] || adapter.legend?.[kd]; return kk ? '<span><i style="background:' + kk.color + '"></i>' + kk.text + '</span>' : ''; }).join('');
        }
        /* flowing card: shrink the text step by step until nothing is cut off and the viz has the room it needs */
        if (flow) {
            const need = adapter.hasViz(st) && adapter.minHeight ? adapter.minHeight(st, v) : 0;
            for (const f of [1, 0.93, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5, 0.45]) {
                c.style.setProperty('--fz', String(f));
                if (c.scrollHeight <= c.clientHeight + 1 && tx.scrollHeight <= tx.clientHeight + 1 && (!need || v.clientHeight >= need)) break;
            }
        }
        if (adapter.hasViz(st)) {
            const unit = adapter.render(v, st, mode, ctx);
            measured.current = { W: v.clientWidth, H: v.clientHeight };
            layoutArrows(k, c, v, st, unit, animate);
            if (st.farrows) formulaMarks(fm, st);
            if (cont && oldRefs && oldRects) glide(k, v, st, oldRefs, oldRects);
        }
    };

    useImperativeHandle(ref, () => ({
        draw,
        finish: () => ctl.current.finish(),
        cancel: () => ctl.current.cancel(),
        reset: () => { ctl.current.cancel(); drawn.current = -1; }
    }));

    /* Re-fit the viz whenever the (fixed) card area changes size: window resize, rotation, first layout. */
    useEffect(() => {
        let rz: ReturnType<typeof setTimeout>;
        const relayout = () => {
            clearTimeout(rz);
            rz = setTimeout(() => {
                const v = viz.current, L = latest.current;
                if (!v || !L.active || !L.steps.length || !v.clientWidth) return;
                if (!L.adapter.hasViz(L.steps[L.idx])) return;
                if (Math.abs(v.clientWidth - measured.current.W) < 3 && Math.abs(v.clientHeight - measured.current.H) < 3) return;
                draw(false);
            }, 120);
        };
        const ro = window.ResizeObserver ? new ResizeObserver(relayout) : null;
        if (ro && viz.current) ro.observe(viz.current);
        window.addEventListener('resize', relayout);
        window.addEventListener('orientationchange', relayout);
        const k = ctl.current;
        return () => {
            clearTimeout(rz);
            ro?.disconnect();
            window.removeEventListener('resize', relayout);
            window.removeEventListener('orientationchange', relayout);
            k.cancel();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <article className={'card stepCard' + (flow ? ' flow' : '')} id="stepCard" ref={card} hidden={hidden}>
            <h3 id="stepTitle">{s && <><span className="n" key={idx}>{idx + 1}</span>{s.title}</>}</h3>
            <div className="stext" id="stepText" ref={text} dangerouslySetInnerHTML={{ __html: s ? (textOf ? textOf(s) : s.html) : '' }} />
            <Formula ref={formula} parts={s?.fparts} text={s?.formula} stepKey={idx} wrap={flow} />
            <div className="viz" id="viz" ref={viz} />
            <div className="legend" id="legend" ref={legend} />
        </article>
    );
}

export const StepCard = forwardRef(StepCardInner) as <S extends StepBase>(p: Props<S> & { ref?: React.Ref<StepCardHandle> }) => React.ReactElement;
