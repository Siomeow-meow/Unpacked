/* Practice for the C lessons. Every code example of a lesson is a practice item: the program with a part taken out (see practiceSpec.ts)
   for the learner to write. Check runs it with our own C interpreter and compares the output with what the complete program prints
   (the Test cases panel shows the result); Visualize opens the same code in the Code visualizer; Show solution shows the whole program. */
import { runC } from '../../lib/c/machine';
import { DSA_LESSONS } from './lessons';
import { SNIPPET_OUTPUTS } from './snippetOutputs';
import { solutionOf, starterOf } from './practiceSpec';

export interface Exercise {
    id: string; title: string;
    /** what to do (trusted HTML) */
    prompt: string;
    /** the program with a part taken out (a bug example: with its bug), for the learner to complete */
    starter: string;
    /** the whole, working program */
    solution: string;
    /** the output the working program prints */
    expect: string;
}
export interface TestResult { label: string; ok: boolean; got: string; expect: string }
export interface CheckResult { compileError?: string; results: TestResult[]; passed: number }

/** run the whole program as it is and compare what it prints with what it should print */
export function checkExercise(ex: Exercise, code: string): CheckResult {
    const r = runC(code, { maxSteps: 6000 });
    if (!r.compile.ok) {
        const line = r.compile.line && r.compile.line <= code.split('\n').length ? 'Line ' + r.compile.line + ': ' : '';
        return { compileError: line + (r.compile.message || 'the code does not compile'), results: [], passed: 0 };
    }
    const tr = r.trace;
    const got = tr ? tr.output + (tr.error ? '\n' + tr.error : '') : '';
    const results: TestResult[] = [{ label: 'Run the whole program', ok: got === ex.expect, got, expect: ex.expect }];
    return { results, passed: results.filter(x => x.ok).length };
}

/** what the Practice tab of a lesson lists: its code examples, in order, each with a part for you to write */
export const practiceFor = (lessonId: string): Exercise[] => {
    const l = DSA_LESSONS.find(x => x.id === lessonId);
    return l ? l.snippets.map(sn => ({
        id: sn.id, title: sn.label,
        prompt: '<p>' + sn.about + '</p>' + (sn.crash
            ? '<p class="ptask"><b>Your task:</b> this program has a bug and crashes. Fix it so that it runs.</p>'
            : '<p class="ptask"><b>Your task:</b> write the missing code. The <code>// TODO</code> comments in the Code panel say what to write; some ask for a whole function.</p>')
            + '<p class="ptask"><b>Check:</b> runs your program and compares its output with the expected output.</p>'
            + '<p class="ptask"><b>Visualize:</b> opens your program in the Code visualizer to step through it.</p>'
            + '<p class="ptask"><b>Show solution:</b> puts the ' + (sn.crash ? 'fixed' : 'complete') + ' program in the Code panel.</p>',
        starter: starterOf(sn.id, sn.src), solution: solutionOf(sn.id, sn.src), expect: SNIPPET_OUTPUTS[sn.id] ?? ''
    })) : [];
};
