import { describe, expect, it } from 'vitest';
import { runC } from './machine';

/* small C programs and what a real C compiler prints for them */
const CASES: [string, string, string, string?][] = [
    ['integer division and remainder keep the sign rules of C', 'int main(){ printf("%d %d %d %d", -7/2, -7%3, 7/-2, 7%-3); return 0; }', '-3 -1 -3 1'],
    ['bit operators', 'int main(){ printf("%d %d %d %d", 1<<4, 256>>2, 5&3, 5^3); return 0; }', '16 64 1 6'],
    ['char arithmetic', "int main(){ char c = 'a'; c = c + 1; printf(\"%c %d %c\", c, c - 'a', 'A' + 2); return 0; }", 'b 1 C'],
    ['printf widths, flags and bases', 'int main(){ printf("[%5d][%-5d][%05d][%x][%X][%o][%5.2f][%e][%%]", 42, 42, 42, 255, 255, 8, 3.14159, 1234.5); return 0; }', '[   42][42   ][00042][ff][FF][10][ 3.14][1.234500e+03][%]'],
    ['printf * width and precision', 'int main(){ printf("%*d|%.3s|%5.1f|%-*d|", 5, 42, "abcdef", 2.55, 4, 7); return 0; }', '   42|abc|  2.5|7   |'],
    ['long, unsigned and strings in printf', 'int main(){ long x = 123456789L; printf("%ld %lu %lld %s %10s|%-6s| %c", x, 5UL, 99LL, "hi", "right", "left", 65); return 0; }', '123456789 5 99 hi      right|left  | A'],
    ['switch with fall through and default', 'int main(){ int x = 2; switch(x){ case 1: printf("one"); break; case 2: printf("two"); case 3: printf("three"); break; default: printf("d"); } return 0; }', 'twothree'],
    ['switch default and no match', 'int main(){ for (int i = 0; i < 4; i++) { switch (i) { case 0: printf("a"); break; case 2: printf("c"); break; default: printf("-"); } } int n = 9; switch (n) { case 1: printf("x"); } return 0; }', 'a-c-'],
    ['switch on a char, with continue inside a loop', "int main(){ char g = 'B'; switch (g) { case 'A': printf(\"top\"); break; case 'B': case 'C': printf(\"mid\"); break; } for (int i = 0; i < 3; i++) { switch (i) { case 1: continue; } printf(\"%d\", i); } return 0; }", 'mid02'],
    ['switch with a return', 'int f(int x){ switch (x) { case 1: return 10; case 2: return 20; } return -1; } int main(){ printf("%d %d %d", f(1), f(2), f(3)); return 0; }', '10 20 -1'],
    ['do while', 'int main(){ int i = 0; do { i++; } while (i < 5); printf("%d", i); return 0; }', '5'],
    ['2D arrays', 'int main(){ int m[2][3] = {{1,2,3},{4,5,6}}; int s = 0; for(int i=0;i<2;i++) for(int j=0;j<3;j++) s += m[i][j]; printf("%d %d", s, m[1][2]); return 0; }', '21 6'],
    ['enum', 'enum Color { RED, GREEN = 5, BLUE }; int main(){ printf("%d %d %d", RED, GREEN, BLUE); return 0; }', '0 5 6'],
    ['static local keeps its value between calls', 'int f(){ static int n = 0; n++; return n; } int main(){ f(); f(); printf("%d", f()); return 0; }', '3'],
    ['static local without a value starts at 0', 'int f(){ static int n; n += 2; return n; } int main(){ f(); printf("%d", f()); return 0; }', '4'],
    ['structs are copied', 'typedef struct { int x; int y; } P; int main(){ P p = {3, 4}; P q = p; q.x = 9; printf("%d %d %d", p.x, q.x, q.y); return 0; }', '3 9 4'],
    ['macro with an argument', '#define SQR(x) ((x)*(x))\nint main(){ printf("%d", SQR(5)); return 0; }', '25'],
    ['macro with two arguments, using another macro', '#define PI 3\n#define MAX(a, b) ((a) > (b) ? (a) : (b))\n#define AREA(r) (PI * (r) * (r))\nint main(){ printf("%d %d", MAX(3, 8), AREA(2)); return 0; }', '8 12'],
    ['macro without arguments', '#define N 5\n#define PI 3.14\nint main(){ printf("%d %.2f", N * 2, PI); return 0; }', '10 3.14'],
    ['string.h', '#include <string.h>\nint main(){ char a[20] = "abc"; strcat(a, "def"); printf("%s %d %d", a, (int)strlen(a), strcmp("a","b") < 0); return 0; }', 'abcdef 6 1'],
    ['strchr and strrchr', "#include <string.h>\nint main(){ char *s = \"hello\"; char *p = strchr(s, 'l'); char *q = strrchr(s, 'l'); printf(\"%s %d %s %d\", p, (int)(p - s), q, strchr(s, 'z') == NULL); return 0; }", 'llo 2 lo 1'],
    ['strstr', '#include <string.h>\nint main(){ char *p = strstr("hello world", "wor"); printf("%s %d", p, strstr("abc", "x") == NULL); return 0; }', 'world 1'],
    ['ctype', "#include <ctype.h>\nint main(){ printf(\"%c %c %d %d %d %d\", toupper('a'), tolower('Q'), isdigit('5') != 0, isalpha('5') != 0, isspace(' ') != 0, isupper('a') != 0); return 0; }", 'A q 1 0 1 0'],
    ['math', '#include <math.h>\nint main(){ printf("%.1f %.1f %.1f %.1f %d %.1f", sqrt(16), pow(2, 10), floor(2.7), ceil(2.1), abs(-4), round(2.5)); return 0; }', '4.0 1024.0 2.0 3.0 4 3.0'],
    ['integer overflow wraps', 'int main(){ int x = 2147483647; x = x + 1; unsigned u = 0; u = u - 1; printf("%d %u", x, u); return 0; }', '-2147483648 4294967295'],
    ['float and double', 'int main(){ float f = 1.0f / 3; double d = 1.0 / 3; printf("%f %f %.10f", f, d, d); return 0; }', '0.333333 0.333333 0.3333333333'],
    ['int and float division', 'int main(){ int a = 7; float r = a / 2; float s = a / 2.0; printf("%.1f %.1f %d", r, s, (int)3.9); return 0; }', '3.0 3.5 3'],
    ['pointer arithmetic', 'int main(){ int a[4] = {1,2,3,4}; int *p = a; p += 2; printf("%d %d %d", *p, *(p-1), (int)(p - a)); return 0; }', '3 2 2'],
    ['pointer to pointer', 'int main(){ int x = 5; int *p = &x; int **pp = &p; **pp = 9; printf("%d", x); return 0; }', '9'],
    ['array of strings', 'int main(){ char *names[3] = {"Ann", "Bo", "Cy"}; for(int i=0;i<3;i++) printf("%s ", names[i]); return 0; }', 'Ann Bo Cy '],
    ['scanf of a word and a number', 'int main(){ char name[20]; int age; scanf("%s %d", name, &age); printf("%s is %d", name, age); return 0; }', 'Ann is 20', 'Ann 20'],
    ['fgets from stdin keeps the newline', 'int main(){ char line[50]; fgets(line, 50, stdin); printf("[%s]", line); return 0; }', '[hello world\n]', 'hello world\n'],
    ['getchar until EOF', "int main(){ int c, n = 0; while((c = getchar()) != EOF){ if (c == 'a') n++; } printf(\"%d\", n); return 0; }", '3', 'banana'],
    ['scanf until it fails', 'int main(){ int x, s = 0; while(scanf("%d", &x) == 1) s += x; printf("%d", s); return 0; }', '6', '1 2 3'],
    ['continue and break', 'int main(){ for(int i=0;i<10;i++){ if(i==3) continue; if(i==6) break; printf("%d", i); } return 0; }', '01245'],
    ['recursion', 'int f(int n){ return n <= 1 ? 1 : n * f(n-1); } int main(){ printf("%d", f(10)); return 0; }', '3628800'],
    ['pointer parameters', 'void sw(int *a, int *b){ int t = *a; *a = *b; *b = t; } int main(){ int x=1,y=2; sw(&x,&y); printf("%d %d", x, y); return 0; }', '2 1'],
    ['bool', '#include <stdbool.h>\nint main(){ bool b = 5 > 3; printf("%d %d", b, !b); return 0; }', '1 0'],
    ['globals', 'int g = 10; void inc(){ g++; } int main(){ inc(); inc(); printf("%d", g); return 0; }', '12'],
    ['array initialisers', 'int main(){ int a[5] = {1, 2}; int b[] = {7,8,9}; printf("%d %d %d %d", a[1], a[4], (int)(sizeof(b)/sizeof(b[0])), b[2]); return 0; }', '2 0 3 9'],
    ['compound assignment', 'int main(){ int x = 10; x += 5; x -= 3; x *= 2; x /= 4; x %= 4; x <<= 2; printf("%d", x); return 0; }', '8'],
    ['short circuit', 'int main(){ int a = 0, b = 5; int r1 = a && b++; int r2 = a || b++; printf("%d %d %d", r1, r2, b); return 0; }', '0 1 6'],
    ['sprintf', '#include <string.h>\nint main(){ char b[30]; int n = sprintf(b, "%d-%s", 5, "x"); printf("%s %d", b, n); return 0; }', '5-x 3'],
    ['octal and hex literals', 'int main(){ int a = 0xFF; int b = 010; int c = 0; printf("%d %d %d", a, b, c); return 0; }', '255 8 0'],
    ['long long shifts', 'int main(){ long long big = 1LL << 40; printf("%lld", big); return 0; }', '1099511627776'],
    ['unsigned char and signed char wrap', 'int main(){ unsigned char c = 255; c++; signed char d = 127; d++; printf("%d %d", c, d); return 0; }', '0 -128'],
    ['printf returns the number of characters', 'int main(){ int n = printf("abc"); printf(" %d", n); return 0; }', 'abc 3'],
    ['a text is a char array ending with 0', 'int main(){ char s[] = "Hi"; printf("%d %d %d", s[0], s[1], s[2]); return 0; }', '72 105 0'],
    ['a palindrome check', '#include <string.h>\nint main(){ char s[] = "level"; int i = 0, j = strlen(s) - 1, ok = 1; while(i < j){ if(s[i] != s[j]) ok = 0; i++; j--; } printf("%d", ok); return 0; }', '1'],
];

describe('C interpreter: common C programs print what a real C compiler prints', () => {
    for (const [name, src, want, input] of CASES) {
        it(name, () => {
            const r = runC('#include <stdio.h>\n' + src, { input: input || '' });
            expect(r.compile.ok, r.compile.message).toBe(true);
            expect(r.trace!.error).toBeUndefined();
            expect(r.trace!.output).toBe(want);
        });
    }
    it('a macro that uses itself is reported, not run forever', () => {
        const r = runC('#define F(x) F(x)\nint main(){ return F(1); }');
        expect(r.compile.ok).toBe(false);
    });
    it('a switch step explains which case was picked', () => {
        const t = runC('int main(){ int x = 3; switch (x) { case 3: x = 9; break; } return x; }').trace!;
        const s = t.steps.find(z => z.title.startsWith('Switch'))!;
        expect(s.html).toMatch(/case 3/);
    });
});
