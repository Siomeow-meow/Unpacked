import { describe, expect, it } from 'vitest';
import { checkExercise, practiceFor } from './exercises';
import { DSA_LESSONS } from './lessons';
import { BLANKS, FIXES, functionHeaders } from './practiceSpec';

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
            expect(sol.results[0].got).toBe(ex.expect);
            expect(sol.results[0].ok).toBe(true);
            const st = checkExercise(ex, ex.starter);
            expect(st.compileError).toBeUndefined();
            expect(st.results[0].ok).toBe(false);
            expect(ex.starter).not.toBe(ex.solution);
        });
    }
    it('the solution of a bug example does not crash', () => {
        for (const l of DSA_LESSONS) for (const ex of practiceFor(l.id)) if (FIXES[ex.id]) expect(ex.expect).not.toMatch(/crash|fault|garbage|Use after free|NULL FILE/);
    });
    it('a blank is a TODO comment with the same indentation, and a whole function keeps its header and braces around a TODO', () => {
        const loops = practiceFor('loops')[0];
        expect(loops.starter).toContain('    // TODO: with a for loop');
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
    it('reports a compile error with the line', () => {
        const r = checkExercise(practiceFor('loops')[0], 'int main(){\n  return 0 +;\n}\n');
        expect(r.compileError).toMatch(/^Line 2/);
    });
});
