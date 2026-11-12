/* The page every lesson uses: top bar (back to the lesson list, the lesson name, tabs 1 · Problem | 2 · Solve | 3 · Tables or Graph),
   the three panes, and the « ‹ Step x of y › » bar. No sidebar, no drawer. */
import { Link } from 'react-router-dom';
import type { StepBase } from '../lessons/types';
import { findSubject, type LessonMeta } from '../lessons/registry';
import { nextLessonOf } from '../subjects';
import type { Lesson } from './useLesson';
import { SummaryChips, type Chip } from './SummaryChips';

interface Props<P, S extends StepBase> {
    L: Lesson<P, S>;
    subjectId: string;
    meta: LessonMeta;
    /** content of tab 1 */
    problem: React.ReactNode;
    chips: Chip[];
    /** the <StepCard> */
    stage: React.ReactNode;
    /** content of tab 3 (shown when there are steps) */
    all: React.ReactNode;
}

export function LessonShell<P, S extends StepBase>({ L, subjectId, meta, problem, chips, stage, all }: Props<P, S>) {
    const { tab, has, idx, last } = L;
    const subject = findSubject(subjectId);
    const third = meta.thirdTab;
    const next = nextLessonOf(meta.id);
    return (
        <div className="app">
            <header className="hdr">
                <div className="brand">
                    <Link to={'/' + subjectId} className="btn nav backarrow" aria-label={'Back to ' + (subject?.title || 'lessons')} title="Back to the lessons">
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                    </Link>
                    <h1>{meta.title}</h1>
                </div>
                <div className="tabs" role="tablist" aria-label="Sections">
                    <button className="tab" id="tab1" role="tab" aria-selected={tab === 1} aria-controls="pane1" onClick={L.toTab1}>1 · Problem</button>
                    <button className="tab" id="tab2" role="tab" aria-selected={tab === 2} aria-controls="pane2" onClick={() => L.openSolved(2)}>2 · Solve</button>
                    <button className="tab" id="tab3" role="tab" aria-selected={tab === 3} aria-controls="pane3" onClick={() => L.openSolved(3)}>3 · {third}</button>
                </div>
                {next && <Link to={next.route} className="btn nextlesson" title={'Next lesson: ' + next.name}>Next lesson →</Link>}
            </header>

            <main>
                {/* TAB 1 */}
                <section className="pane" id="pane1" role="tabpanel" aria-labelledby="tab1" hidden={tab !== 1}>
                    {problem}
                </section>

                {/* TAB 2 */}
                <section className="pane" id="pane2" role="tabpanel" aria-labelledby="tab2" hidden={tab !== 2} ref={L.pane2}>
                    <SummaryChips chips={chips} hidden={!has} onEdit={L.toTab1} />
                    {stage}
                    <div className="empty2" id="empty2" hidden={has}>Set up your problem in tab <b>1 · Problem</b>, then open this tab.</div>
                </section>

                {/* TAB 3 */}
                <section className="pane" id="pane3" role="tabpanel" aria-labelledby="tab3" hidden={tab !== 3} ref={L.pane3}>
                    {tab === 3 && has && all}
                    <div className="empty2" id="empty3" hidden={has}>Set up your problem in tab <b>1 · Problem</b> first. {third === 'Graph' ? 'The final graph and your test points will show here.' : 'The tables you have reached so far will collect here.'}</div>
                </section>
            </main>

            <nav className="bar" id="bar" hidden={!((tab === 2 || (tab === 3 && L.stepsOnThird)) && has)}>
                <button className="btn nav" id="first" type="button" aria-label="First step" title="First step" disabled={idx === 0} onClick={L.first}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.5 6l-6 6 6 6M18.5 6l-6 6 6 6" /></svg></button>
                <button className="btn nav" id="back" type="button" aria-label="Previous step" title="Previous step" disabled={idx === 0} onClick={L.back}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
                <span id="prog" aria-live="polite">Step {idx + 1} of {L.steps.length}</span>
                <button className="btn nav primary" id="next" type="button" aria-label="Next step" title="Next step" disabled={idx >= last} onClick={L.next}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
                <button className="btn nav" id="last" type="button" aria-label="Last step" title="Last step" disabled={idx >= last} onClick={L.end}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 6l6 6-6 6M12.5 6l6 6-6 6" /></svg></button>
            </nav>
        </div>
    );
}
