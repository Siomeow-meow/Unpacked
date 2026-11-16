import { describe, expect, it } from 'vitest';
import { checkExercise, practiceFor } from './exercises';
import { DSA_LESSONS } from './lessons';
import { BLANKS, FIXES, functionHeaders } from './practiceSpec';
import { INPUTS } from './practiceTests';
import { SNIPPET_OUTPUTS } from './snippetOutputs';

describe('practice: the lesson examples with a part for you to write', () => {
    it('every lesson lists all of its code examples, and nothing else', () => {
        for (const l of DSA_LESSONS) expect(practiceFor(l.id).map(e => e.id)).toEqual(l.snippets.map(s => s.id));
    });
    it('every example is either blanked or a bug to fix, and nothing in the spec is left over', () => {
        const ids = DSA_LESSONS.flatMap(l => l.snippets.map(s => s.id));
        for (const id of ids) expect(!!BLANKS[id] !== !!FIXES[id]).toBe(true);
        for (const id of [...Object.keys(BLANKS), ...Object.keys(FIXES)]) expect(ids).toContain(id);
    });
    for (const l of DSA_LESSONS) for (const ex of practiceFor(l.id)) {
        it(ex.id + ': the solution passes, and the starter compiles but does not pass', () => {
            const sol = checkExercise(ex, ex.solution);
            expect(sol.compileError).toBeUndefined();
            expect(sol.results.map(r => r.got)).toEqual(ex.tests.map(t => t.expect));
            expect(sol.passed).toBe(ex.tests.length);
            const st = checkExercise(ex, ex.starter);
            expect(st.compileError).toBeUndefined();
            expect(st.passed).toBeLessThan(ex.tests.length);   // the starter does not pass every test case
            expect(ex.starter).not.toBe(ex.solution);
        }, 30000);      // the biggest examples run thousands of steps: give a slow computer time
    }
    it('the solution of a bug example does not crash', () => {
        for (const l of DSA_LESSONS) for (const ex of practiceFor(l.id)) if (FIXES[ex.id]) for (const t of ex.tests) expect(t.expect).not.toMatch(/crash|fault|garbage|Use after free|NULL FILE/);
    });
    it('a blank is a TODO comment with the same indentation, and a whole function keeps its header and braces around a TODO', () => {
        const loops = practiceFor('loops')[0];
        expect(loops.starter).toContain('    // TODO: n is read with scanf above: with a for loop');
        expect(loops.starter).toContain('scanf("%d", &n);');
        expect(loops.starter).not.toContain('sum = sum + i;');
        const heap = practiceFor('heap')[0];
        expect(heap.starter).toContain('void swap(int a, int b);\nvoid insert(int value);\n\nvoid swap(int a, int b){\n    // TODO: swap heap[a] and heap[b]\n}');
        expect(heap.starter).toContain('void insert(int value){\n    // TODO: add value at the end');
        expect(heap.starter).not.toContain('heap[i] = value;');
        expect(heap.starter).toContain('int main()');
    });
    it('every function is declared by a prototype above its definition, in the starter and in the solution', () => {
        let checked = 0;
        for (const l of DSA_LESSONS) for (const ex of practiceFor(l.id)) for (const code of [ex.starter, ex.solution]) {
            const lines = code.split('\n').map(x => x.replace(/\s+/g, ' ').trim());
            for (const h of functionHeaders(code)) {
                checked++;
                const at = lines.indexOf(h.proto.replace(/\s+/g, ' ').trim());
                expect(at, ex.id + ': ' + h.proto).toBeGreaterThanOrEqual(0);
                expect(at, ex.id + ': ' + h.proto).toBeLessThan(h.line);
            }
        }
        expect(checked).toBeGreaterThan(200);
    });
    it('every practice has one to five test cases, and the number differs from practice to practice', () => {
        const counts = new Set<number>();
        for (const l of DSA_LESSONS) for (const ex of practiceFor(l.id)) {
            expect(ex.tests.length, ex.id).toBeGreaterThanOrEqual(1);
            expect(ex.tests.length, ex.id).toBeLessThanOrEqual(5);
            expect(new Set(ex.tests.map(t => t.input)).size, ex.id + ': the inputs differ').toBe(ex.tests.length);
            counts.add(ex.tests.length);
        }
        expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
    });
    it('a practice with an input reads it with scanf in the part you are given, and the first case is the example of the lesson', () => {
        for (const l of DSA_LESSONS) for (const ex of practiceFor(l.id)) {
            if (ex.tests.some(t => t.input)) expect(ex.starter, ex.id).toContain('scanf');
            else expect(INPUTS[ex.id]?.cases ?? ['']).toEqual(['']);
            expect(ex.tests[0].expect, ex.id).toBe(SNIPPET_OUTPUTS[ex.id] ?? ex.tests[0].expect);
        }
    });
    it('the expected outputs are right (worked out by hand)', () => {
        const t = (lesson: string, id: string) => practiceFor(lesson).find(e => e.id === id)!.tests;
        expect(t('recursion', 'rec-factorial.c').map(x => x.expect.trim())).toEqual(['4! = 24', '0! = 1', '1! = 1', '5! = 120', '7! = 5040']);
        expect(t('recursion', 'rec-fibonacci.c').map(x => x.expect.trim())).toEqual(['fib(4) = 3', 'fib(0) = 0', 'fib(10) = 55']);
        expect(t('loops', 'loop-for.c')[3].expect.trim()).toBe('total 0');
        expect(t('loops', 'loop-for.c')[2].expect.trim().split('\n').pop()).toBe('total 36');
    });
    it('reports a compile error with the line', () => {
        const r = checkExercise(practiceFor('loops')[0], 'int main(){\n  return 0 +;\n}\n');
        expect(r.compileError).toMatch(/^Line 2/);
    });
});
