/* The colours behind the code editors: comments are drawn lighter (HTML for a layer under the transparent textarea).
   Strings and characters are skipped over, so a "//" inside a string is not a comment. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function highlightC(src: string): string {
    let out = '', i = 0, plain = 0;
    const flush = (to: number) => { if (to > plain) out += esc(src.slice(plain, to)); };
    while (i < src.length) {
        const c = src[i], d = src[i + 1];
        if (c === '/' && d === '/') {
            let j = i; while (j < src.length && src[j] !== '\n') j++;
            flush(i); out += '<span class="cm">' + esc(src.slice(i, j)) + '</span>'; i = plain = j; continue;
        }
        if (c === '/' && d === '*') {
            let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2;
            flush(i); out += '<span class="cm">' + esc(src.slice(i, j)) + '</span>'; i = plain = j; continue;
        }
        if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < src.length && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
            i = Math.min(j + 1, src.length); continue;
        }
        i++;
    }
    flush(src.length);
    return out + '\n';      // the last line keeps its height, as in the textarea
}
