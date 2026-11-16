import { expect, it } from 'vitest';
import { highlightC } from './codeHighlight';

it('comments are wrapped, strings are not', () => {
    const h = highlightC('int a; // note <1>\nprintf("//x"); /* b\nc */ int d;');
    expect(h).toContain('<span class="cm">// note &lt;1&gt;</span>');
    expect(h).toContain('printf("//x");');
    expect(h).toContain('<span class="cm">/* b\nc */</span>');
});
