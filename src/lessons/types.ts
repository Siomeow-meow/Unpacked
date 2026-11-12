/* What every lesson provides: solve(problem) -> steps, plus an adapter that draws a step's viz.
   A new subject only needs a solver and a viz adapter; the shell, step player, step card, arrows, formula,
   chips, saved problems and examples are shared. */
import type { ArrowDef, FormulaArrow, FormulaPart } from '../components/arrows';

export interface StepBase {
    title: string;
    /** the explanation shown under the title (trusted HTML) */
    html: string;
    /** plain-text version of the formula (used when there are no coloured parts) */
    formula?: string;
    /** formula split into parts; parts with an id get an underline in the colour of their arrow */
    fparts?: FormulaPart[] | null;
    farrows?: FormulaArrow[] | null;
    /** arrows drawn one operation at a time between cells of the viz (data-t / data-r / data-c) */
    arrows: ArrowDef[];
    group?: string;
}

/** 'textonly' = whole card is text; 'final' = text + viz side by side; 'normal' = text, formula, viz, legend */
export type CardMode = 'normal' | 'textonly' | 'final';

export interface VizAdapter<S extends StepBase> {
    mode(s: S): CardMode;
    hasViz(s: S): boolean;
    /** computed once per solved problem (e.g. the widest text per column) and passed back to render() */
    prepare?(steps: S[]): unknown;
    /** keep the card still and glide the highlight boxes when two consecutive steps share a layout */
    sameShape?(a: S, b: S): boolean;
    /** the least height (px) the viz needs to be readable; the step card shrinks its text to leave that much room */
    minHeight?(s: S, viz: HTMLElement): number;
    /** fills `viz` for this step, fitted to its size; returns the cell size in px (arrow scale) */
    render(viz: HTMLElement, s: S, mode: CardMode, ctx: unknown): number;
    /** legend text for arrow kinds not in the default table */
    legend?: Record<string, { color: string; text: string }>;
}

export interface SolveResult<S extends StepBase> { steps?: S[]; error?: string }
