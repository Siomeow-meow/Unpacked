import { describe, expect, it } from 'vitest';
import { editKey } from './codeEdit';

const key = (v: string, s: number, k: string, shift = false, e = s) => editKey(v, s, e, k, shift, false)!;

describe('Tab', () => {
    it('inserts spaces up to the next tab stop', () => {
        expect(key('', 0, 'Tab')).toEqual({ value: '    ', start: 4, end: 4 });
        expect(key('ab', 2, 'Tab')).toEqual({ value: 'ab  ', start: 4, end: 4 });
        expect(key('abcd', 4, 'Tab').value).toBe('abcd    ');
    });
    it('replaces a selection inside one line', () => {
        expect(key('int x;', 4, 'Tab', false, 5)).toEqual({ value: 'int     ;', start: 8, end: 8 });
    });
    it('indents every line of a multi-line selection and keeps it selected', () => {
        const v = 'a;\nb;\nc;';
        const r = key(v, 0, 'Tab', false, 5);          // selects "a;\nb;"
        expect(r.value).toBe('    a;\n    b;\nc;');
        expect(r.start).toBe(4); expect(r.end).toBe(13);
    });
});

describe('Shift+Tab', () => {
    it('takes one indent off the line', () => {
        expect(key('        x;', 10, 'Tab', true).value).toBe('    x;');
        expect(key('  x;', 4, 'Tab', true)).toEqual({ value: 'x;', start: 2, end: 2 });
    });
    it('does nothing to a line that has no indent', () => { expect(key('x;', 1, 'Tab', true).value).toBe('x;'); });
    it('outdents every selected line', () => {
        const r = key('    a;\n    b;\nc;', 0, 'Tab', true, 13);
        expect(r.value).toBe('a;\nb;\nc;');
    });
});

describe('Enter', () => {
    it('keeps the indentation of the line', () => {
        expect(key('    a = 1;', 10, 'Enter')).toEqual({ value: '    a = 1;\n    ', start: 15, end: 15 });
    });
    it('adds one level after an opening brace', () => {
        expect(key('int main(){', 11, 'Enter')).toEqual({ value: 'int main(){\n    ', start: 16, end: 16 });
        expect(key('    if(x){', 10, 'Enter').value).toBe('    if(x){\n        ');
    });
    it('between { and } puts the closing brace on its own line', () => {
        const r = key('int main(){}', 11, 'Enter');
        expect(r.value).toBe('int main(){\n    \n}');
        expect(r.start).toBe(16);
        expect(r.value.slice(r.start)).toBe('\n}');
    });
    it('Shift+Enter and Ctrl+Enter are left alone', () => {
        expect(editKey('a', 1, 1, 'Enter', true, false)).toBeNull();
        expect(editKey('a', 1, 1, 'Enter', false, true)).toBeNull();
    });
});

describe('closing brace', () => {
    it('steps back one indent on an empty indented line', () => {
        expect(key('    ', 4, '}')).toEqual({ value: '}', start: 1, end: 1 });
        expect(key('        ', 8, '}')).toEqual({ value: '    }', start: 5, end: 5 });
    });
    it('is a normal key after code', () => { expect(editKey('a = 1; ', 7, 7, '}', false, false)).toBeNull(); });
});

describe('other keys', () => { it('are left to the browser', () => { expect(editKey('a', 1, 1, 'x', false, false)).toBeNull(); expect(editKey('a', 1, 1, 'Tab', false, true)).toBeNull(); }); });
