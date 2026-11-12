/* The formula line of a step card. Parts with an id are underlined (by the arrow layer) in the colour of the
   arrow that uses them, so the formula and the arrows always match. */
import { forwardRef, Fragment } from 'react';
import type { FormulaPart } from './arrows';

interface Props { parts?: FormulaPart[] | null; text?: string; stepKey: number; /** let a long formula wrap onto more lines */ wrap?: boolean }

export const Formula = forwardRef<HTMLDivElement, Props>(function Formula({ parts, text, stepKey, wrap }, ref) {
    return (
        <div className={'formula' + (wrap ? ' wrap' : '')} id="formula" ref={ref} style={{ visibility: text || (parts && parts.length) ? undefined : 'hidden' }}>
            {/* keyed by step: the spans are rebuilt every step, so an old underline never lingers */}
            <Fragment key={stepKey}>
                {parts
                    ? parts.map((x, i) => x.id
                        ? <span key={i} className="fsp" data-p={x.id}>{x.t}</span>
                        : <Fragment key={i}>{wrap ? x.t : x.t.replace(/ /g, '\u00a0')}</Fragment>)
                    : text || ''}
            </Fragment>
        </div>
    );
});
