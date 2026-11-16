import { describe, expect, it } from 'vitest';
import { runC } from './machine';

const SRC = '#include <stdio.h>\nint main() {\n    int n;\n    printf("Enter: ");\n    scanf("%d", &n);\n    printf("got %d\\n", n);\n    return 0;\n}\n';

describe('interactive input (the Code visualizer)', () => {
    it('stops at scanf when there is no input, and says so in a last step', () => {
        const t = runC(SRC, { interactive: true }).trace!;
        expect(t.waiting).toBe(true);
        const last = t.steps[t.steps.length - 1];
        expect(last.kind).toBe('wait');
        expect(last.line).toBe(5);
        expect(t.output).toBe('Enter: ');
    });
    it('a typed line is echoed, and the program carries on after it', () => {
        const t = runC(SRC, { interactive: true, input: '121\n' }).trace!;
        expect(t.waiting).toBeFalsy();
        expect(t.output).toBe('Enter: 121\ngot 121\n');
        expect(t.steps[t.steps.length - 1].kind).toBe('end');
    });
    it('asks again when the program reads more than was typed', () => {
        const two = '#include <stdio.h>\nint main() { int a, b; scanf("%d", &a); scanf("%d", &b); printf("%d", a + b); return 0; }\n';
        const t = runC(two, { interactive: true, input: '4\n' }).trace!;
        expect(t.waiting).toBe(true);
        expect(runC(two, { interactive: true, input: '4\n5\n' }).trace!.output).toBe('4\n5\n9');
    });
    it('End input (EOF): scanf returns -1 and the program goes on', () => {
        const eof = '#include <stdio.h>\nint main() { int a = 7; int r = scanf("%d", &a); printf("%d %d", r, a); return 0; }\n';
        const t = runC(eof, { interactive: true, eof: true }).trace!;
        expect(t.waiting).toBeFalsy();
        expect(t.output).toBe('-1 7');
    });
    it('not interactive (the Check of a lesson): no waiting, no echo', () => {
        const t = runC(SRC, { input: '121\n' }).trace!;
        expect(t.output).toBe('Enter: got 121\n');
        expect(runC(SRC).trace!.waiting).toBeFalsy();
    });
});
