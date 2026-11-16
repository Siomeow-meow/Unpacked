/* Practice for the C lessons. Every code example of a lesson is a practice item: the program with a part taken out (see practiceSpec.ts)
   for the learner to write. Check runs it with our own C interpreter and compares the output with what the complete program prints
   (the Test cases panel shows the result); Visualize opens the same code in the Code visualizer; Show solution shows the whole program. */
import { runC } from '../../lib/c/machine';
import { DSA_LESSONS } from './lessons';
import { solutionOf, starterOf } from './practiceSpec';
import { INPUTS } from './practiceTests';

export interface Exercise {
    id: string; title: string;
    /** what to do (trusted HTML) */
    prompt: string;
    /** the program with a part taken out (a bug example: with its bug), for the learner to complete */
    starter: string;
    /** the whole, working program */
    solution: string;
    /** the test cases: what is typed into the program (scanf) and the output the working program prints for it */
    tests: TestCase[];
}
export interface TestCase { input: string; expect: string }
export interface TestResult { input: string; ok: boolean; got: string; expect: string }
export interface CheckResult { compileError?: string; results: TestResult[]; passed: number }

/** run the program on the input of every test case and compare what it prints with what it should print */
export function checkExercise(ex: Exercise, code: string): CheckResult {
    const results: TestResult[] = [];
    for (const t of ex.tests) {
        const r = runC(code, { maxSteps: 6000, input: t.input });
        if (!r.compile.ok) {
            const line = r.compile.line && r.compile.line <= code.split('\n').length ? 'Line ' + r.compile.line + ': ' : '';
            return { compileError: line + (r.compile.message || 'the code does not compile'), results: [], passed: 0 };
        }
        const tr = r.trace;
        const got = tr ? tr.output + (tr.error ? '\n' + tr.error : '') : '';
        /* a missing (or extra) newline at the very end is not a mistake: compare without trailing whitespace */
        results.push({ input: t.input, ok: got.trimEnd() === t.expect.trimEnd(), got, expect: t.expect });
    }
    return { results, passed: results.filter(x => x.ok).length };
}

/** what the complete program prints for an input (the expected output of a test case) */
function outputOf(solution: string, input: string): string {
    const r = runC(solution, { maxSteps: 6000, input });
    if (!r.compile.ok) throw new Error('the solution does not compile: ' + r.compile.message);
    const tr = r.trace;
    return tr ? tr.output + (tr.error ? '\n' + tr.error : '') : '';
}

/** what the Practice tab of a lesson lists: its code examples, in order, each with a part for you to write */
const cache = new Map<string, Exercise>();
export const practiceFor = (lessonId: string): Exercise[] => {
    const l = DSA_LESSONS.find(x => x.id === lessonId);
    return l ? l.snippets.map(sn => cached(sn.id, () => {
        const solution = solutionOf(sn.id, sn.src);
        return {
        id: sn.id, title: sn.label,
        prompt: '<p>' + sn.about + '</p>' + (sn.crash
            ? '<p class="ptask"><b>Your task:</b> this program has a bug and crashes. Fix it so that it runs.</p>'
            : '<p class="ptask"><b>Your task:</b> write the missing code. The <code>// TODO</code> comments in the Code panel say what to write; some ask for a whole function.</p>')
            + '<p class="ptask"><b>Check:</b> runs your program and compares its output with the expected output.</p>'
            + '<p class="ptask"><b>Visualize:</b> opens your program in the Code visualizer to step through it.</p>'
            + '<p class="ptask"><b>Show solution:</b> puts the ' + (sn.crash ? 'fixed' : 'complete') + ' program in the Code panel.</p>',
        starter: starterOf(sn.id, sn.src), solution,
        tests: (INPUTS[sn.id]?.cases ?? ['']).map(input => ({ input, expect: outputOf(solution, input) }))
        };
    })) : [];
};
/** the expected outputs are worked out once (by running the solution), not on every render */
function cached(id: string, make: () => Exercise): Exercise {
    let e = cache.get(id);
    if (!e) { e = make(); cache.set(id, e); }
    return e;
}
