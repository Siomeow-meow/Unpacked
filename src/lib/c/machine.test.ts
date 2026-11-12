import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { runC } from './machine';

const run = (src: string, input = '') => { const r = runC(src, { input }); expect(r.compile.ok).toBe(true); return r.trace!; };

describe('C interpreter: language', () => {
    it('runs printf, variables, loops and functions', () => {
        const t = run('#include <stdio.h>\nint sq(int x){ return x*x; }\nint main(){ int s = 0; for(int i = 1; i <= 4; i++){ s += sq(i); } printf("sum=%d\\n", s); return 0; }');
        expect(t.output).toBe('sum=30\n'); expect(t.error).toBeUndefined(); expect(t.exitCode).toBe(0);
    });
    it('records a step for every statement, ending with "Program ends"', () => {
        const t = run('int main(){ int a = 1; a = a + 2; return a; }');
        expect(t.steps[0].title).toBe('Program starts');
        expect(t.steps.map(s => s.kind)).toEqual(['call', 'decl', 'expr', 'return', 'end']);
        expect(t.steps[2].formula.map(p => p.t).join('')).toBe('a = 1 + 2 = 3');
    });
    it('#define constants, arrays and struct initialisers', () => {
        const t = run('#define N 3\ntypedef struct { int id; char name[8]; float g; } S;\nint main(){ int a[N] = {1,2,3}; S s = {7, "ana", 2.5}; printf("%d %d %s %.1f", a[2], s.id, s.name, s.g); return 0; }');
        expect(t.output).toBe('3 7 ana 2.5');
    });
    it('pointers, structs by value and by pointer', () => {
        const t = run('typedef struct { int n; } P;\nvoid inc(P p){ p.n++; }\nvoid inc2(P *p){ p->n++; }\nint main(){ P x; x.n = 1; inc(x); inc2(&x); printf("%d", x.n); return 0; }');
        expect(t.output).toBe('2');
    });
    it('compile errors report the line', () => {
        const r = runC('int main(){\n  int x = ;\n  return 0;\n}');
        expect(r.compile.ok).toBe(false); expect(r.compile.line).toBe(2);
    });
    it('scanf reads the Input tab', () => {
        const t = run('int main(){ int a, b; scanf("%d %d", &a, &b); printf("%d", a + b); return 0; }', '4 5');
        expect(t.output).toBe('9');
    });
});

describe('C interpreter: stack and heap', () => {
    const src = '#include <stdlib.h>\nint main(){\n  int *p = malloc(3 * sizeof(int));\n  p[0] = 10; p[1] = 20;\n  free(p);\n  return 0;\n}';
    it('malloc shows up on the heap with a ? for every cell that was not set', () => {
        const t = run(src);
        const s = t.steps.find(x => x.line === 4 && x.kind === 'expr')!;     // after p[0] = 10
        const b = s.snap.heap[0];
        expect(b.addr).toBe(0x5a10); expect(b.size).toBe(12); expect(b.elemType).toBe('int');
        expect(b.cells.map(c => c.text)).toEqual(['10', '?', '?']);
        expect(s.snap.frames[0].vars.find(v => v.name === 'p')!.target).toBe(0x5a10);
    });
    it('marks the cell that was written, and free() marks the block freed', () => {
        const t = run(src);
        const s = t.steps.find(x => x.line === 4)!;
        expect(s.snap.heap[0].cells[0].rw).toBe('w');
        const f = t.steps.find(x => x.line === 5)!;
        expect(f.snap.heap[0].freed).toBe(true);
        expect(t.steps[t.steps.length - 1].html).toContain('All heap memory was freed');
    });
    it('a forgotten free is reported as a memory leak', () => {
        const t = run('#include <stdlib.h>\nint main(){ int *p = malloc(4); return 0; }');
        expect(t.steps[t.steps.length - 1].html).toContain('memory leak');
    });
    it('realloc moves the data', () => {
        const t = run('#include <stdlib.h>\nint main(){ int *p = malloc(8); p[0] = 5; p = realloc(p, 16); printf("%d", p[0]); return 0; }');
        expect(t.output).toBe('5'); expect(t.error).toBeUndefined();
    });
    it('each call is a frame on the stack, with the caller waiting', () => {
        const t = run('int f(int x){ int y = x + 1; return y; }\nint main(){ int r = f(4); return r; }');
        const s = t.steps.find(x => x.snap.frames.length === 2 && x.kind === 'decl')!;
        expect(s.snap.frames.map(f => f.fn)).toEqual(['f', 'main']);
        expect(s.snap.frames[0].vars.map(v => v.name)).toEqual(['x', 'y']);
    });
});

describe('C interpreter: crashes are explained, not hidden', () => {
    const err = (src: string) => run(src).error || '';
    it('NULL pointer', () => { expect(err('int main(){ int *p = 0; *p = 1; return 0; }')).toMatch(/NULL/); });
    it('a pointer that was never set holds garbage', () => { expect(err('int main(){ int *p; *p = 1; return 0; }')).toMatch(/garbage/); });
    it('heap overflow', () => { expect(err('#include <stdlib.h>\nint main(){ int *p = malloc(8); p[2] = 1; return 0; }')).toMatch(/Heap overflow/); });
    it('use after free and double free', () => {
        expect(err('#include <stdlib.h>\nint main(){ int *p = malloc(8); free(p); p[0] = 1; return 0; }')).toMatch(/Use after free/);
        expect(err('#include <stdlib.h>\nint main(){ int *p = malloc(8); free(p); free(p); return 0; }')).toMatch(/Double free/);
    });
    it('division by zero, and the crash is the last step', () => {
        const t = run('int main(){ int a = 0; int b = 5 / a; return b; }');
        expect(t.error).toMatch(/Division by zero/);
        expect(t.steps[t.steps.length - 1].kind).toBe('error');
    });
    it('an infinite loop is stopped', () => {
        const r = runC('int main(){ while(1){ } return 0; }', { maxSteps: 200 });
        expect(r.trace!.truncated).toBe(true);
    });
    it('reading something that was never set is flagged on the step', () => {
        const t = run('int main(){ int a; int b = a + 1; return b; }');
        expect(t.steps.find(s => s.line === 1 && s.kind === 'decl' && s.html.includes('never set'))).toBeDefined();
    });
});

describe('C interpreter: every DSA snippet', () => {
    const out: Record<string, RegExp> = {
        'hello-world.c': /^Hello, world!\nA C program starts at main\.\n$/,
        'hello-syntax.c': /^Name:\tUnpacked\nCourse:\tC\nQuotes: "C" and a backslash: \\\n$/,
        'var-types.c': /^age=19 price=2\.5 grade=A pi=3\.14\nan int takes 4 bytes, a char takes 1 byte\n$/,
        'var-assign.c': /^a=6 b=5 total=11\n$/,
        'op-arith.c': /17 \/ 5 = 3\n17 % 5 = 2\nwith floats: 3\.40\n$/,
        'op-compare.c': /^adult=1 canEnter=1 child=0 x=9\n$/,
        'if-grade.c': /^score 78 is grade C\n$/,
        'if-max.c': /^the largest is 31 \(odd\)\n$/,
        'loop-for.c': /^i=1 sum=1\n[\s\S]*total 15\n$/,
        'loop-while.c': /^3\.\.\. 2\.\.\. 1\.\.\. liftoff!\n4096 has 4 digits\n$/,
        'array-basic.c': /^sum=390 max=95 average=78\n$/,
        'string-basic.c': /^stack has 5 letters \(strlen says 5\)\nkcats\n$/,
        'func-basic.c': /^square=36 bigger=36\n$/,
        'func-by-value.c': /^inside addTen: x=15\nback in main: n=5\n$/,
        'ptr-basic.c': /^x=10, \*p=10\nafter \*p = 25: x=25\n$/,
        'ptr-swap.c': /^x=8 y=3\n$/,
        'ptrarr-arithmetic.c': /^10 30\nafter p\+\+: 20\n10 20 30 40 \n$/,
        'ptrarr-function.c': /^sum=6\nafter doubleAll: 2 4 6\n$/,
        'struct-basic.c': /^7 Ana 3\.5\n1: Ben \(2\.8\)\n2: Cy \(3\.9\)\n$/,
        'struct-pointer.c': /^after moveCopy: x=1\nafter movePtr: x=6\n$/,
        'dyn-malloc.c': /^sum=100\n$/,
        'dyn-realloc.c': /^5 6 7 8 \n$/,
        'll-insert.c': /^10 -> 20 -> 30 -> NULL\n$/,
        'll-search-delete.c': /^20 is at position 1\n20 is now at position -1\n$/,
        'll-reverse.c': /^1 2 3 \n3 2 1 \n$/,
        'file-write-read.c': /^read: apple\nread: banana\nread: cherry\n$/,
        'file-numbers.c': /^sum = 150\n$/,
        'file-append-count.c': /^log.txt has 3 lines\n$/,
        'adt-arraylist-pointer.c': /^10 20 30 \n20 30 \n30 is at index 1\n$/,
        'adt-arraylist-value.c': /Insert Position[\s\S]*Index: 2 Element: 4/,
        'adt-students-resize.c': /List resized to 20 elements/,
        'cursor-basic.c': /^10 20 30 \n20 30 \n99 20 30 \n$/,
        'cursor-vheap.c': /^10 -> 5 -> 15\n30 -> 25 -> 5 -> 15\n$/,
        'stack-array-malloc.c': /^S = 30, 20, 10\nTop element is 30\nPopped element is 30\nS = 20, 10\n$/,
        'stack-linkedlist.c': /^top is 30\npopped 30\npopped 20\ntop is 10\n$/,
        'queue-circular.c': /^1 3 2 5\n1 3 2 5 4\n$/,
        'queue-linkedlist.c': /^dequeued 1\ndequeued 2\ndequeued 3\n$/,
        'dict-array.c': /^205 -> Ben\n101 -> not found\ncount = 2\n$/,
        'dict-sorted.c': /^30 is at index 2\n35 is at index -1\n$/,
        'hash-open.c': /^22 found\? 1\n17 found\? 0\n$/,
        'hash-closed.c': /22 is in slot 2\n30 is in slot -1/,
        'set-bitvector.c': /^\{ 1 3 5 \}\n\{ 3 4 5 \}\n\{ 1 3 4 5 \}\n\{ 3 5 \}\n\{ 1 5 \}\n$/,
        'set-array.c': /^\{ 1 2 6 \}\n\{ 2 \}\n$/,
        'tree-bst.c': /^20 30 40 50 70 \n40 found\? 1\n65 found\? 0\n$/,
        'tree-traversals.c': /preorder:  A B D E C \ninorder:   D B E A C \npostorder: D E B C A \nheight = 3/,
        'heap-insert.c': /^10 20 40 50 30 \n$/,
        'heap-extract.c': /^10 20 30 40 50 \n$/,
        'graph-matrix-dfs.c': /^visit 0\nvisit 1\nvisit 3\nvisit 2\nvisit 4\n$/,
        'graph-bfs.c': /^visit 0\nvisit 1\nvisit 2\nvisit 3\nvisit 4\nvisit 5\n$/,
        'graph-adjlist.c': /^0: 2 1\n1: 3\n2: 3\n3:\n$/,
        'rec-factorial.c': /^4! = 24\n$/,
        'rec-fibonacci.c': /^fib\(4\) = 3\n$/,
        'rec-hanoi.c': /^(move disk \d from [ABC] to [ABC]\n){7}$/,
        'sort-bubble.c': /^1 2 3 4 5 \n$/,
        'sort-insertion.c': /^1 4 6 7 9 \n$/,
        'search-binary.c': /^25 is at index 4\n10 is at index -1\n$/
    };
    const crashes: Record<string, RegExp> = { 'adt-bug-unset-pointer.c': /garbage/, 'adt-bug-discarded-init.c': /garbage/, 'dyn-bug-use-after-free.c': /Use after free/, 'file-bug-null.c': /NULL FILE pointer/ };
    const dir = 'src/lessons/dsa/snippets/';
    for (const f of readdirSync(dir)) {
        it(f + ' runs as described', () => {
            const r = runC(readFileSync(dir + f, 'utf8'));
            expect(r.compile.ok).toBe(true);
            const t = r.trace!;
            expect(t.truncated).toBeFalsy();
            if (crashes[f]) { expect(t.error).toMatch(crashes[f]); return; }
            expect(t.error).toBeUndefined(); expect(t.exitCode).toBe(0);
            expect(out[f]).toBeDefined();
            expect(t.output).toMatch(out[f]);
        });
    }
    it('every snippet belongs to a lesson, and every lesson has an explanation and code', async () => {
        const { DSA_LESSONS } = await import('../../lessons/dsa/lessons');
        const files = readdirSync(dir).sort();
        expect(DSA_LESSONS.flatMap(l => l.snippets.map(s => s.id)).sort()).toEqual(files);
        DSA_LESSONS.forEach(l => { expect(l.intro.length).toBeGreaterThan(40); expect(l.ideas.length).toBeGreaterThan(1); l.snippets.forEach(s => { expect(s.src.length).toBeGreaterThan(50); expect(s.about.length).toBeGreaterThan(20); }); });
    });
    it('the lessons go from the easiest to the hardest, in three groups', async () => {
        const { DSA_META } = await import('../../lessons/dsa/meta');
        const names = (sub: string) => DSA_META.filter(m => m.subject === sub).map(m => m.title);
        expect(names('prog1')).toEqual(['Hello World & Syntax', 'Variables & Data Types', 'Operators', 'Conditions', 'Loops', 'Arrays & Strings', 'Functions', 'Pointers: A First Look']);
        expect(names('prog2')).toEqual(['Pointers & Arrays', 'Recursion', 'Sorting & Searching', 'Structs', 'Dynamic Memory', 'File Handling', 'ADT', 'Linked List']);
        expect(names('dsa')).toEqual(['Stack & Queue', 'Cursor-Based', 'Sets', 'Hashing', 'Dictionary', 'Trees', 'Binary Heap', 'Graphs']);
        expect(DSA_META.map(m => m.subject)).toEqual([...Array(8).fill('prog1'), ...Array(8).fill('prog2'), ...Array(8).fill('dsa')]);   // the groups follow each other
    });
});
