/* The formula line of a step card. Parts with an id are underlined (by the arrow layer) in the colour of the
   arrow that uses them, so the formula and the arrows always match.
   A formula can also be written as labelled boxes: a line break starts a new line, a blank line starts a new box, and
   a first line ending with ":" ("Formula:", "Final Answer:") becomes the caption of its box. */
import { forwardRef, Fragment, type ReactNode } from 'react';
import type { FormulaPart } from './arrows';

interface Props { parts?: FormulaPart[] | null; text?: string; stepKey: number; /** let a long formula wrap onto more lines */ wrap?: boolean }

type Line = FormulaPart[];
interface Box { label: string; lines: Line[] }

/** cut the parts at every line break, then group the lines into boxes at every blank line */
function toBoxes(parts: FormulaPart[]): Box[] | null {
    const lines: Line[] = [[]];
    for (const p of parts) {
        const bits = p.t.split('\n');
        bits.forEach((b, i) => {
            if (i > 0) lines.push([]);
            if (b !== '') lines[lines.length - 1].push(b === p.t ? p : { ...p, t: b });
        });
    }
    const boxes: Box[] = [];
    let cur: Line[] = [];
    const flush = () => {
        if (!cur.length) return;
        const first = cur[0].map(x => x.t).join('');
        const label = cur.length > 1 && /:\s*$/.test(first) ? first.trim() : '';
        boxes.push({ label, lines: label ? cur.slice(1) : cur });
        cur = [];
    };
    for (const ln of lines) { if (ln.length === 0) flush(); else cur.push(ln); }
    flush();
    return boxes.some(b => b.label) ? boxes : null;
}

export const Formula = forwardRef<HTMLDivElement, Props>(function Formula({ parts, text, stepKey, wrap }, ref) {
    const src: FormulaPart[] | null = parts && parts.length ? parts : text ? [{ t: text }] : null;
    const boxes = wrap && src ? toBoxes(src) : null;
    const span = (x: FormulaPart, i: number): ReactNode => x.id
        ? <span key={i} className="fsp" data-p={x.id}>{x.t}</span>
        : <Fragment key={i}>{wrap ? x.t : x.t.replace(/ /g, '\u00a0')}</Fragment>;
    return (
        <div className={'formula' + (wrap ? ' wrap' : '') + (boxes ? ' multi' : '')} id="formula" ref={ref} style={{ visibility: text || (parts && parts.length) ? undefined : 'hidden' }}>
            {/* keyed by step: the spans are rebuilt every step, so an old underline never lingers */}
            <Fragment key={stepKey}>
                {boxes
                    ? boxes.map((b, i) => (
                        <div key={i} className={'fbox' + (/^final/i.test(b.label) ? ' ans' : '')}>
                            {b.label && <div className="flabel">{b.label.replace(/:\s*$/, '')}</div>}
                            {b.lines.map((ln, k) => <div key={k} className="fln">{ln.map(span)}</div>)}
                        </div>))
                    : parts
                        ? parts.map(span)
                        : text || ''}
            </Fragment>
        </div>
    );
});
