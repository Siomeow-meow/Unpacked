/* The code snippets and explanations of every DSA lesson. A new lesson = a new entry here (+ its .c files in snippets/) and in meta.ts. */
import { DSA_META } from './meta';

const raw = import.meta.glob('./snippets/*.c', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const srcOf = (file: string): string => raw['./snippets/' + file] ?? '';

export interface Snippet {
    id: string;              // the file name
    label: string;
    src: string;
    /** what this code does (trusted HTML) */
    about: string;
    /** what to look for while stepping */
    watch: string[];
    /** this snippet is meant to crash, to show a classic bug */
    crash?: boolean;
}
export interface DsaLessonDef { id: string; title: string; intro: string; ideas: string[]; snippets: Snippet[] }

const S = (id: string, label: string, about: string, watch: string[], crash = false): Snippet => ({ id, label, src: srcOf(id), about, watch, crash: crash || undefined });

const LESSONS: Record<string, { intro: string; ideas: string[]; snippets: Snippet[] }> = {
    /* ================= Programming 1 ================= */
    hello: {
        intro: 'Every C program is a list of <b>statements</b> inside <code>main</code>. When the program runs, the computer starts at the first line of <code>main</code> and does one statement at a time. <code>printf</code> prints text on the screen.',
        ideas: ['<code>#include &lt;stdio.h&gt;</code> lets the program use <code>printf</code>.', '<b>main</b> is where every program starts. <code>return 0</code> means "finished without a problem".', 'A statement ends with a <b>semicolon</b>.', '<code>\\n</code> is a new line and <code>\\t</code> is a tab. They are written with a backslash but print as a single character.'],
        snippets: [
            S('hello-world.c', 'Hello, world', 'The smallest useful C program: two <code>printf</code> lines and a <code>return</code>. Each <code>printf</code> prints one line of text.', ['The call stack holds only <b>main()</b>.', 'Each <code>printf</code> adds one line to the output.']),
            S('hello-syntax.c', 'Comments and escape codes', 'Comments (<code>/* ... */</code> and <code>// ...</code>) are ignored. Inside a string, <code>\\t</code> is a tab, <code>\\"</code> prints a quote and <code>\\\\</code> prints one backslash.', ['Comment lines are never a step: the computer skips them.', 'Compare the code with the Output to see what each escape code became.'])
        ]
    },
    variables: {
        intro: 'A <b>variable</b> is a named box in memory that holds one value of one <b>data type</b>. The type decides what the box can hold and how many bytes it takes. Every variable lives at its own address in memory.',
        ideas: ['<b>int</b> whole numbers, <b>float</b> and <b>double</b> numbers with a decimal point, <b>char</b> one character.', 'A new variable shows <b>?</b> until you give it a value.', '<code>b = a</code> <b>copies</b> the value: changing a later does not change b.', '<code>sizeof</code> tells how many bytes a type takes.'],
        snippets: [
            S('var-types.c', 'The four basic types', 'Four variables, one of each basic type, printed with the matching format codes: <code>%d</code> int, <code>%f</code> float and double, <code>%c</code> char.', ['Each declaration creates a new box on the stack.', 'A <code>char</code> is stored as a small number, but it prints as a letter.']),
            S('var-assign.c', 'Assigning and copying', '<code>int b = a;</code> copies the value of a into b. Then a changes and b does not.', ['After <code>a = a + 1</code> the old value of a is gone, but b keeps 5.', 'Green marks the box a line writes to, red the boxes it reads.'])
        ]
    },
    operators: {
        intro: '<b>Operators</b> build new values from old ones. Arithmetic works on numbers, comparisons give <b>1</b> (true) or <b>0</b> (false), and <code>&amp;&amp;</code>, <code>||</code> and <code>!</code> combine true/false values.',
        ideas: ['<code>/</code> between two ints throws the fraction away: 17 / 5 is 3.', '<code>%</code> is the <b>remainder</b>: 17 % 5 is 2.', 'Cast one side to <code>float</code> to get 3.4.', '<code>x += 3</code> means <code>x = x + 3</code>; <code>x++</code> adds one.'],
        snippets: [
            S('op-arith.c', 'Arithmetic', 'All five arithmetic operators on 17 and 5, then the same division with a <code>(float)</code> cast.', ['Watch <code>17 / 5</code> give 3, not 3.4.', '<code>%%</code> in <code>printf</code> prints one percent sign.']),
            S('op-compare.c', 'Comparing and combining', 'Comparisons store 1 or 0 in a variable. <code>&amp;&amp;</code> needs both sides true, <code>!</code> flips the value, and <code>+=</code> and <code>++</code> change a variable in place.', ['<code>adult</code> is just an int that holds 1.', 'x goes 5, 8, 9: two different ways of adding.'])
        ]
    },
    conditions: {
        intro: 'A <b>condition</b> lets the program choose. <code>if</code> tests a true/false expression; only the branch that matches runs, and the rest is skipped.',
        ideas: ['<code>else if</code> is only tested when the earlier tests were false.', 'Exactly <b>one</b> branch of an if / else if / else chain runs.', 'A common pattern: keep the best value so far in a variable and update it.', '<code>% 2 == 0</code> tests for an even number.'],
        snippets: [
            S('if-grade.c', 'if / else if / else', 'A score is tested against 90, 80 and 70 in turn. The first true test picks the grade; the others are never run.', ['Follow which test is <b>false</b> before the one that is true.', 'The code highlight jumps over the branches that are skipped.']),
            S('if-max.c', 'The largest of three', 'Start with the first number as the answer, then replace it whenever a bigger number turns up. Finally an even/odd test decides the message.', ['<code>max</code> changes only when the test is true.', '31 is odd, so the else branch prints.'])
        ]
    },
    loops: {
        intro: 'A <b>loop</b> repeats statements. <code>for</code> packs the start, the test and the step into one line. <code>while</code> tests first; <code>do ... while</code> runs the body once and tests afterwards. Each pass through the body is called an <b>iteration</b>.',
        ideas: ['<code>for(int i = 1; i &lt;= 5; i++)</code>: start at 1, repeat while i &lt;= 5, add 1 after each round.', 'An <b>accumulator</b> (like <code>sum</code>) collects a result across rounds.', 'A while loop needs something inside that eventually makes its test false.', '<code>do ... while</code> always runs at least once.'],
        snippets: [
            S('loop-for.c', 'Add 1 + 2 + 3 + 4 + 5', 'The for loop adds each i to sum and prints the running total.', ['i and sum change on every round.', 'When <code>i &lt;= 5</code> is false the loop ends and the next line runs.']),
            S('loop-while.c', 'while and do-while', 'A countdown with <code>while</code>, then a <code>do ... while</code> that counts the digits of 4096 by dividing by 10.', ['<code>n--</code> makes the test false after three rounds.', 'The do-while body runs once before its first test.'])
        ]
    },
    arrays: {
        intro: 'An <b>array</b> is several boxes of the same type side by side in memory, numbered from <b>0</b>. A <b>string</b> in C is simply an array of <code>char</code> that ends with a special character, <code>\\0</code>.',
        ideas: ['<code>scores[2]</code> is the third box (counting starts at 0).', 'A for loop is the usual way to visit every element.', 'The last character of a string is <code>\\0</code>: loops stop when they reach it.', '<code>strlen</code> counts the characters before the <code>\\0</code>.'],
        snippets: [
            S('array-basic.c', 'Sum and maximum of an array', 'Five scores stored in an array. One loop adds them up and keeps track of the largest.', ['The array shows as a row of small boxes with their indexes.', '<code>scores[i]</code> is read on every round (red).']),
            S('string-basic.c', 'A string is a char array', '<code>"stack"</code> is stored as s, t, a, c, k and a hidden <code>\\0</code>. A loop finds the length, then another loop prints it backwards.', ['The <code>while</code> stops at the <code>\\0</code>, which is why the array has 8 boxes for 5 letters.', 'The second loop counts down from len - 1 to 0.'])
        ]
    },
    functions: {
        intro: 'A <b>function</b> is a named piece of code you can call. A call creates a new <b>frame</b> on the call stack with its own variables; <code>return</code> removes the frame and hands a value back. Arguments are <b>copied</b> into the parameters.',
        ideas: ['The caller waits while the called function runs.', 'Each frame has its own variables: the same name in two functions is two different boxes.', '<b>Pass by value</b>: changing a parameter does not change the caller\'s variable.', 'A function that returns nothing is declared <code>void</code>.'],
        snippets: [
            S('func-basic.c', 'square and bigger', 'Two small functions that return a value. A new frame is created for every call and removed on <code>return</code>.', ['The call stack grows to two frames, then shrinks.', 'The returned value is stored in the variable on the left of the call.']),
            S('func-by-value.c', 'Pass by value', '<code>addTen</code> changes its own copy of the number. When it returns, <code>n</code> in main is still 5.', ['Two boxes named x and n: they never meet.', 'This is why the next lesson needs pointers.'])
        ]
    },
    pointers1: {
        intro: 'A <b>pointer</b> is a variable whose value is the <b>address</b> of another variable. <code>&amp;x</code> gives the address of x; <code>*p</code> follows the pointer to the box it points at. Drawn as a diagram, a pointer is an arrow to the box it points at.',
        ideas: ['<code>int *p = &amp;x;</code> makes p point at x.', '<code>*p = 25;</code> writes into x through the pointer.', 'Passing <code>&amp;x</code> to a function lets the function change x (no more pass by value problem).', 'In the Code visualizer, every address (like Z991) is a made-up label for a place in memory.'],
        snippets: [
            S('ptr-basic.c', 'Address and dereference', 'p holds the address of x. Reading <code>*p</code> reads x; writing <code>*p</code> writes x.', ['The arrow from p points at the box of x.', 'x changes on the line that only mentions <code>*p</code>.']),
            S('ptr-swap.c', 'Swap two variables', 'The function receives the <b>addresses</b> of x and y, so it can really change them. Compare with the pass-by-value lesson.', ['<code>a</code> and <code>b</code> point into the frame of main.', 'The values in main change while <code>swap</code> is still running.'])
        ]
    },
    /* ================= Programming 2 ================= */
    pointers: {
        intro: 'An array name is the address of its <b>first element</b>. Pointer arithmetic moves by whole elements: <code>p + 1</code> is the next int, not the next byte. That is why <code>a[i]</code> and <code>*(a + i)</code> mean the same thing, and why an array passed to a function can be changed by it.',
        ideas: ['<code>int *p = a;</code> points at <code>a[0]</code>.', '<code>*(p + 2)</code> is <code>a[2]</code>. <code>p++</code> moves p to the next element.', 'A function that receives an array really receives a <b>pointer</b>, so it changes the caller\'s array (no copy).', 'Always pass the length too: the pointer does not know where the array ends.'],
        snippets: [
            S('ptrarr-arithmetic.c', 'Pointer arithmetic', 'p starts at the first element, reads the third with <code>*(p + 2)</code>, then moves with <code>p++</code>. The last loop walks a pointer from <code>a</code> to <code>a + 4</code>.', ['Follow the arrow from p: it jumps by one box each time.', 'The loop stops when q reaches the address just after the last element.']),
            S('ptrarr-function.c', 'An array passed to a function', '<code>sum</code> only reads the array; <code>doubleAll</code> writes into it. Both receive the address of the first element and the number of elements.', ['<code>arr</code> in the frame points at the array in main.', 'The array in main changes while <code>doubleAll</code> is running.'])
        ]
    },
    structs: {
        intro: 'A <b>struct</b> groups related values (its <b>fields</b>) under one name, like a record. You reach a field with a dot (<code>s.id</code>), or with an arrow when you have a pointer (<code>p-&gt;x</code>). Structs are copied when passed by value, like any other variable.',
        ideas: ['<code>typedef struct { ... } Name;</code> lets you write <code>Name</code> instead of <code>struct ...</code>.', 'In memory, every field of a struct is its own labelled box.', 'An array of structs is a row of records.', '<code>p-&gt;x</code> is short for <code>(*p).x</code>.'],
        snippets: [
            S('struct-basic.c', 'A student record and a list of them', 'One <code>Student</code> with an id, a name and a gpa, and then an array of two students printed in a loop.', ['Each field is a box named <code>s.id</code>, <code>s.name</code>, <code>s.gpa</code>.', '<code>list[i].name</code> picks a field of one element.']),
            S('struct-pointer.c', 'By value or by pointer', '<code>moveCopy</code> changes a <b>copy</b> of the point; <code>movePtr</code> receives the address and changes the real one with <code>-&gt;</code>.', ['After <code>moveCopy</code>, x is still 1.', 'After <code>movePtr</code>, x is 6.'])
        ]
    },
    dynamic: {
        intro: 'Variables on the call stack disappear when their function returns. When you need memory that stays, or whose size is only known while the program runs, you ask the <b>heap</b> with <code>malloc</code>. Every block you reserve stays on the heap until you <code>free</code> it.',
        ideas: ['<code>malloc(n * sizeof(int))</code> reserves room for n ints and returns the address of the block.', 'The new block is <b>not set</b> (it shows ?). <code>calloc</code> sets it to 0.', '<code>realloc</code> changes the size of a block and keeps the old data.', '<code>free</code> gives the block back. A block you forget to free is a <b>memory leak</b>; using a block after free is a bug.'],
        snippets: [
            S('dyn-malloc.c', 'malloc, use and free', 'An array of 4 ints on the heap, filled in a loop, added up, and freed at the end.', ['The block appears in the heap with ? in every cell.', 'After <code>free(a)</code> the block is marked freed.']),
            S('dyn-realloc.c', 'calloc and realloc', '<code>calloc</code> starts with two zeros, then <code>realloc</code> grows the block to four ints. The old values 5 and 6 are still there.', ['The block may move to a new address: the pointer is updated with the result.', 'The two new cells start unset until the code fills them.']),
            S('dyn-bug-use-after-free.c', 'Bug · using memory after free', 'The block is freed and then read through the old pointer. In a real program this might "work" by luck; here the crash is explained.', ['The pointer still holds the old address after <code>free</code>.', 'The block is shown as freed when the crash happens.'], true)
        ]
    },
    linkedlist: {
        intro: 'A <b>linked list</b> is a chain of <b>nodes</b>. Every node holds a value and a pointer to the next node; the last node points to <code>NULL</code>. Nodes are created with <code>malloc</code>, so each one is a block on the heap, and the pointers link them into a chain.',
        ideas: ['<b>head</b> is the pointer to the first node. An empty list is <code>head == NULL</code>.', 'Insert at the front: make a node that points at the old head, and it becomes the new head.', 'To delete, make the node before it point past it, then <code>free</code> it.', 'To visit every node, follow <code>p = p-&gt;next</code> until p is <code>NULL</code>.'],
        snippets: [
            S('ll-insert.c', 'Insert at the front and print', 'Three nodes are added at the front, so the list reads 10, 20, 30. The printing loop walks from head until NULL.', ['Each <code>malloc</code> adds a block; the arrows link new to old.', 'The list is in the opposite order to the insertions.']),
            S('ll-search-delete.c', 'Search and delete a value', '<code>search</code> counts positions while it walks the list. <code>removeValue</code> keeps a <code>prev</code> pointer so it can link around the node it removes, then frees it.', ['<code>prev</code> trails one node behind <code>cur</code>.', 'After the delete, the node is freed and the chain closes the gap.']),
            S('ll-reverse.c', 'Reverse a list', 'Each node\'s <code>next</code> is turned around, one node at a time, using three pointers: <code>prev</code>, <code>head</code> and <code>next</code>.', ['Watch the arrows flip direction one by one.', 'The old first node ends up pointing at NULL.'])
        ]
    },
    adt: {
        intro: 'An <b>abstract data type (ADT)</b> is a way of storing data together with the operations that work on it. The <b>List ADT</b> stores items in order and offers <b>insert</b>, <b>delete</b>, <b>locate</b> and <b>display</b>. Here the list lives in an array inside a struct, and a <b>count</b> says how many slots are really used.',
        ideas: ['The array has a fixed size (MAX); <b>count</b> is the real length.', 'Inserting at a position means shifting the items after it one slot to the right first.', 'Deleting shifts them one slot to the left.', 'A struct passed <b>by value</b> is copied; passed <b>by pointer</b> the function changes the real one.'],
        snippets: [
            S('adt-arraylist-pointer.c', 'Array list · by pointer', 'The list is created with <code>malloc</code> and every function receives a <b>pointer</b> to it, so <code>insertPos</code> and <code>deletePos</code> change the real list. Inserting at position 1 first shifts the later items to the right to make room.', ['The stack holds only the pointer <b>L</b>; the whole list lives on the heap.', 'In <b>insertPos</b>, the loop copies elem[i - 1] into elem[i] from the end backwards.', 'After <b>free(L)</b> the block is marked freed.']),
            S('adt-arraylist-value.c', 'Array list · struct by value', 'Here the list struct is passed <b>by value</b>: each function gets its own <b>copy</b> of the whole struct (array included) and has to <b>return</b> it. <code>insertPos</code> and <code>main</code> each work on their own copy.', ['<b>L</b> in the function and <b>L</b> in main are two different copies.', 'The function returns the changed copy, and main must store it.']),
            S('adt-students-resize.c', 'Dynamic list of structs · resize', 'A list of <b>student structs</b> kept in a heap array that grows with <code>realloc</code> when it is full. This one is long: press Visualize to step through <code>insertSorted</code> and <code>resize</code>.', ['When the array is full, <b>realloc</b> moves the data to a new, bigger block.', 'The old block is freed; the pointer in the list now points at the new one.']),
            S('adt-bug-unset-pointer.c', 'Bug · a pointer that was never set', 'This is a real bug from the course files: <code>Eptr L;</code> in main is never given a block of memory, but <code>initialize(L)</code> writes through it. The pointer holds garbage, so the program crashes. Press Visualize and step to the end to see the explanation.', ['In main, <b>L</b> shows <b>?</b>: it was declared but never set.', 'The crash message explains why.'], true),
            S('adt-bug-discarded-init.c', 'Bug · the result of initialize is thrown away', 'Another real bug: <code>initialize(L)</code> returns the initialized list, but main never stores it, so <code>L</code> in main stays unset. The first <code>insertPos</code> then crashes. The fix is <code>L = initialize(L);</code>.', ['<b>initialize</b> changes its own copy of L, not main\'s.', 'Back in main, L.elemPtr is still <b>?</b>.'], true)
        ]
    },
    cursor: {
        intro: 'A <b>cursor-based list</b> is a linked list that uses <b>array indexes instead of pointers</b>. All the cells live in one array, the <b>virtual heap</b>. Every cell has an <b>elem</b> and a <b>next</b> index. Free cells are chained into an <b>avail</b> list, so <code>allocSpace</code> and <code>freeSpace</code> work like <code>malloc</code> and <code>free</code> inside the array.',
        ideas: ['<b>-1</b> plays the role of NULL.', '<b>avail</b> is the index of the first free cell.', 'allocSpace takes the first free cell; freeSpace puts a cell back at the front of the avail list.', 'The list variable <b>L</b> is just the index of the first cell.'],
        snippets: [
            S('cursor-basic.c', 'Cursor list · insertFirst and deleteFirst', 'A small virtual heap of 5 cells. <code>initialize</code> chains every cell into the avail list. <code>insertFirst</code> takes a cell from avail, fills it and links it in front of the list. <code>deleteFirst</code> unlinks the first cell and returns it to avail.', ['Watch <b>V.avail</b> move along the free chain as cells are used.', 'After deleteFirst, the freed cell becomes the new <b>avail</b> and is used again by the next insert (99 reuses it).']),
            S('cursor-vheap.c', 'Cursor list · insertFirst, insertLast, deleteElem (from the course)', 'The version from the course files, with <code>HeadSpace</code> as an array typedef inside the VHeap struct, plus insertLast and deleteElem. The functions take a <b>pointer to the list index</b> so they can change <b>L</b> itself.', ['<b>int *L</b> points back at main\'s L; <code>*L = newCell</code> changes it.', 'insertLast walks the next indexes until it finds -1.'])
        ]
    },
    stackqueue: {
        intro: 'A <b>stack</b> is last-in, first-out (<b>LIFO</b>): you <b>push</b> and <b>pop</b> at the top. A <b>queue</b> is first-in, first-out (<b>FIFO</b>): you <b>enqueue</b> at the rear and <b>dequeue</b> at the front. Both can be built on an array or on a linked list.',
        ideas: ['Stack: only the top moves. Array version keeps a <b>top</b> index; list version keeps a pointer to the first node.', 'Queue: <b>front</b> and <b>rear</b> move. A circular queue wraps around with <code>% MAX</code>.', 'A <code>Node **</code> parameter lets a function change the caller\'s pointer.'],
        snippets: [
            S('stack-array-malloc.c', 'Stack · array', 'A stack in an array inside a struct on the heap. <code>push</code> increases <b>top</b> and stores the value; <code>pop</code> decreases <b>top</b>. The popped value is still in the array, but it no longer counts.', ['<b>top</b> starts at -1 (empty).', 'pop only moves top; the old value stays in the array.']),
            S('stack-linkedlist.c', 'Stack · linked list', 'Each push <code>malloc</code>s a node and links it in front. <code>Node **top</code> is a pointer to the caller\'s pointer, so push and pop can change it. pop frees the node it removes.', ['Every push adds a block on the heap; every pop frees one.', 'The arrows show each node\'s <b>next</b> pointing to the node below it.']),
            S('queue-circular.c', 'Queue · circular array', 'A queue in an array where <b>rear</b> wraps around with <code>(rear + 1) % MAX</code>. <b>front</b> and <b>rear</b> chase each other around the array, so no space is wasted.', ['The first enqueue sets front and rear to 0.', 'The modulo makes the indexes wrap to 0 after MAX - 1.']),
            S('queue-linkedlist.c', 'Queue · linked list', 'A queue with a <b>front</b> and a <b>rear</b> pointer. enqueue adds a node after rear in constant time; dequeue removes the front node and frees it. When the queue becomes empty, both pointers must become NULL.', ['After the first enqueue, front and rear point at the same node.', 'dequeue sets <b>rear</b> to NULL when the last node leaves.'])
        ]
    },
    dictionary: {
        intro: 'A <b>dictionary</b> stores <b>key → value</b> pairs. You ask for a key and get its value back. The two simplest implementations use an array: <b>unsorted</b> (insert at the end, search one by one) or <b>sorted</b> (insert in order, search with binary search).',
        ideas: ['Unsorted: insert is fast, lookup checks every entry (linear search).', 'Sorted: insert has to shift entries, but lookup halves the range each step (binary search).', 'A struct can be copied with <code>=</code>, which is how removeKey fills the hole.'],
        snippets: [
            S('dict-array.c', 'Dictionary · unsorted array', 'Each entry is a struct with a <b>key</b> and a <b>value</b> string. <code>lookup</code> returns a pointer to the value, or NULL if the key is missing. <code>removeKey</code> overwrites the removed entry with the last one.', ['lookup returns a <b>pointer into the array</b>, not a copy.', 'Inserting key 205 again replaces its value instead of adding an entry.']),
            S('dict-sorted.c', 'Dictionary · sorted array, binary search', 'Keys are kept in order. <code>insert</code> shifts bigger keys to the right, like insertion sort. <code>search</code> keeps <b>low</b>, <b>mid</b> and <b>high</b> and throws away half of the range each time.', ['Watch low, mid and high close in on the key.', 'A missing key ends with low greater than high and returns -1.'])
        ]
    },
    hashing: {
        intro: '<b>Hashing</b> turns a key into an array slot with a <b>hash function</b> such as <code>key % SIZE</code>. Different keys can land in the same slot: that is a <b>collision</b>. <b>Open hashing</b> (separate chaining) keeps a linked list in every slot. <b>Closed hashing</b> (open addressing) looks for another free slot, for example the next one (<b>linear probing</b>).',
        ideas: ['12 % 5 = 2 and 7 % 5 = 2: same slot, a collision.', 'Open hashing never runs out of room; a long chain is slow.', 'Closed hashing can fill up, and a search stops at the first EMPTY slot.'],
        snippets: [
            S('hash-open.c', 'Open hashing · chaining', 'The table is an array of <b>Node pointers</b>. <code>insert</code> puts the new node at the front of the chain in slot <code>key % 5</code>. <code>search</code> walks that one chain.', ['12, 7 and 22 all hash to slot 2: watch the chain grow.', 'Each node is a separate block on the heap.']),
            S('hash-closed.c', 'Closed hashing · linear probing', 'The table holds the keys themselves, and -1 means EMPTY. If the slot is taken, <code>insert</code> tries <code>(h + i) % SIZE</code> for i = 1, 2, 3... and reports how many collisions it had.', ['The global <b>table</b> is shown under the stack.', '22 collides with 15 (both hash to 1) and moves to the next slot.'])
        ]
    },
    sets: {
        intro: 'A <b>set</b> is a collection with no duplicates and no order. Two common implementations: a <b>bit vector</b> (bit number x is 1 when x is in the set) and a <b>boolean array</b>. With bits, <b>union</b> is <code>|</code>, <b>intersection</b> is <code>&amp;</code>, and adding or removing an element sets or clears one bit.',
        ideas: ['<code>1 &lt;&lt; x</code> is a number with only bit x set.', 'add: <code>s | (1 &lt;&lt; x)</code>; remove: <code>s &amp; ~(1 &lt;&lt; x)</code>; contains: <code>(s &gt;&gt; x) &amp; 1</code>.', 'A boolean array uses a whole byte per element but is easier to read.'],
        snippets: [
            S('set-bitvector.c', 'Set · bit vector', 'The whole set is one <code>unsigned int</code>. The number changes as elements are added: adding 1, 3 and 5 gives 2 + 8 + 32 = 42. <code>unionSet</code> and <code>intersect</code> are a single operator.', ['After add(A, 3) the value of A grows by 8.', 'display loops over bit positions 0 to 7 and prints the ones that are set.']),
            S('set-array.c', 'Set · boolean array', 'The set is a struct holding <code>bool member[8]</code>. <code>unionSet</code> and <code>intersect</code> loop over all 8 positions and combine them with <code>||</code> and <code>&amp;&amp;</code>. Each Set is passed and returned <b>by value</b>.', ['The member array shows true or false for every possible element.', 'The result set is a new copy in the stack frame.'])
        ]
    },
    trees: {
        intro: 'A <b>binary tree</b> node has up to two children, <b>left</b> and <b>right</b>. In a <b>binary search tree (BST)</b> everything in the left subtree is smaller and everything in the right subtree is bigger, so <b>search</b> and <b>insert</b> can skip half of the tree at each step. Trees are naturally <b>recursive</b>: the call stack mirrors the path through the tree.',
        ideas: ['A NULL child means "no node there"; it is the stopping case of the recursion.', 'inorder on a BST prints the keys in sorted order.', 'preorder visits the node first, postorder last.', 'Each node is a separate block on the heap, linked by pointers.'],
        snippets: [
            S('tree-bst.c', 'BST · insert, search, inorder', 'Builds a BST from 50, 30, 70, 20, 40. <code>insert</code> walks down recursively and returns the (possibly new) root of each subtree. <code>search</code> follows left or right in a loop. <code>inorder</code> prints 20 30 40 50 70.', ['Each insert call goes one level deeper: watch the call stack.', 'The new node is linked into its parent\'s left or right pointer on the way back up.']),
            S('tree-traversals.c', 'Traversals · preorder, inorder, postorder', 'A small tree of letters built with nested <code>newNode</code> calls. The three traversals only differ in <b>when</b> the node is printed: before, between or after the two recursive calls. <code>height</code> returns the number of levels.', ['Compare the three outputs for the same tree.', 'The call stack depth is the depth of the node being visited.'])
        ]
    },
    heap: {
        intro: 'A <b>binary heap</b> is a complete binary tree kept in a plain <b>array</b>. In a <b>min-heap</b> every parent is smaller than or equal to its children, so the <b>smallest value is always at index 0</b>. There are no pointers: the node at index <b>i</b> has its parent at <b>(i - 1) / 2</b> and its children at <b>2i + 1</b> and <b>2i + 2</b>. Heaps are the engine behind <b>priority queues</b> and <b>heap sort</b>.',
        ideas: ['Insert puts the value at the end, then <b>sifts up</b> while it is smaller than its parent.', 'Extract-min takes index 0, moves the last element to the root, then <b>sifts down</b> by swapping with the smaller child.', 'Both operations walk one path of the tree, so they take about log n steps.', 'This heap has nothing to do with the memory heap that malloc uses: it is just the name of the structure.'],
        snippets: [
            S('heap-insert.c', 'Min-heap · insert and sift up', 'Inserts 50, 30, 40, 10, 20. Each value goes in at the end of the array and swaps with its parent while it is smaller. The final array is 10 20 40 50 30: index 0 is the smallest, and every parent is smaller than its children (10 &lt; 20, 40; 20 &lt; 50, 30).', ['Inserting 10 swaps twice: it climbs from index 3 to index 1 to index 0.', 'The parent of index i is (i - 1) / 2.']),
            S('heap-extract.c', 'Min-heap · extract the minimum', 'After the same five inserts, <code>extractMin</code> removes the root, moves the last element to index 0 and calls <code>siftDown</code>, which swaps with the smaller child until the heap rule holds again. Repeating it prints the values in sorted order: 10 20 30 40 50. That is the idea of heap sort.', ['siftDown is recursive: watch the call stack follow the path down the tree.', 'size shrinks by one on each extract.'])
        ]
    },
    files: {
        intro: 'A program keeps its variables only while it runs. To keep data for later, it saves it in a <b>file</b>. In C you open a file with <code>fopen</code>, which gives back a <b>FILE pointer</b> (a handle to the open file), use it to read or write, and then <code>fclose</code> it. The <b>mode</b> says what you want to do: <code>"r"</code> read, <code>"w"</code> write (a new, empty file) and <code>"a"</code> append (add at the end). Here the files live in a pretend disk inside Unpacked, so nothing on your computer is touched.',
        ideas: ['<code>fopen</code> returns <b>NULL</b> when it fails (for example, reading a file that does not exist): always check.', '<code>fprintf(fp, ...)</code> writes like printf, and <code>fputs</code> writes a string.', '<code>fgets</code> reads one line, <code>fscanf</code> reads values like scanf, and <code>fgetc</code> reads one character.', 'A read returns <b>NULL</b> or <b>EOF</b> at the end of the file, which is how a loop knows to stop.', 'Close every file you open: that is when the written text is safely saved.'],
        snippets: [
            S('file-write-read.c', 'Write a file, then read it back', 'Opens <code>notes.txt</code> with mode <code>"w"</code>, writes three lines with <code>fprintf</code> and <code>fputs</code>, closes it, opens it again with <code>"r"</code> and reads it line by line with <code>fgets</code> until it returns NULL.', ['The first fopen checks for NULL before using the file.', 'fgets keeps the newline, so the printf does not add one.']),
            S('file-numbers.c', 'Numbers in a file: fprintf and fscanf', 'Writes 10, 20, 30, 40 and 50, one per line, then reads them back with <code>fscanf</code> and adds them up. <code>fscanf</code> returns how many values it read, so the loop stops when it can read no more.', ['The loop condition is fscanf(...) == 1.', 'sum grows by one value for every successful read.']),
            S('file-append-count.c', 'Append mode and counting lines', 'Mode <code>"a"</code> adds to the end instead of emptying the file. Then <code>fgetc</code> reads the file one character at a time until <b>EOF</b>, and each <code>\\n</code> is one line.', ['After the append the file holds three lines.', 'fgetc returns an int, so it can also return EOF (-1).']),
            S('file-bug-null.c', 'Bug: using a file that did not open', 'The file <code>missing.txt</code> does not exist, so <code>fopen</code> returns NULL, but the program never checks. The next line then reads from a NULL FILE pointer and crashes.', ['fp is NULL right after fopen.', 'The fix: <code>if(fp == NULL){ ... }</code> straight after fopen.'], true)
        ]
    },
    graphs: {
        intro: 'A <b>graph</b> has <b>vertices</b> joined by <b>edges</b>. An <b>adjacency matrix</b> is a 2D array where adj[a][b] = 1 means an edge. An <b>adjacency list</b> keeps, for each vertex, a linked list of its neighbours. To visit every vertex there are two classic ways: <b>depth-first search (DFS)</b> goes as deep as possible first (recursion), <b>breadth-first search (BFS)</b> visits neighbours level by level (a queue).',
        ideas: ['visited[] stops the search from going in circles.', 'DFS uses the call stack as its "stack of vertices to come back to".', 'BFS uses an explicit queue array with front and rear.', 'The matrix uses N × N memory; the list only uses memory for edges that exist.'],
        snippets: [
            S('graph-matrix-dfs.c', 'DFS · adjacency matrix', 'The graph is stored in the global 2D array <code>adj</code>. <code>dfs(v)</code> marks v as visited, then calls itself for every unvisited neighbour. The order is 0, 1, 3, 2, 4: it goes deep before coming back.', ['The <b>visited</b> array fills up as the search goes.', 'Each recursive call adds a frame; returning is "backtracking".']),
            S('graph-bfs.c', 'BFS · adjacency matrix and a queue', 'The queue is an array with <b>front</b> and <b>rear</b>. A vertex is marked visited when it is <b>put in</b> the queue, so it is never queued twice. The order is level by level: 0, then 1 and 2, then 3 and 4, then 5.', ['Watch front and rear move through the queue array.', 'The queue holds the vertices that are waiting to be visited.']),
            S('graph-adjlist.c', 'Adjacency list · linked lists', 'An array of Node pointers, one linked list per vertex. <code>addEdge</code> puts the neighbour at the front of the list, so the neighbours print in reverse order of insertion.', ['The global <b>adj</b> array holds one pointer per vertex.', 'Each edge is one heap node.'])
        ]
    },
    recursion: {
        intro: '<b>Recursion</b> means a function calls itself on a smaller problem. Every call gets its <b>own stack frame</b> with its own copy of the parameters, so the stack grows with each call and <b>unwinds</b> when the calls return. Every recursive function needs a <b>base case</b> that stops the calls.',
        ideas: ['The base case is what makes the recursion end.', 'Frames pile up on the way down, and the results are combined on the way back up.', 'fib calls itself twice, so its calls form a tree, not a line.'],
        snippets: [
            S('rec-factorial.c', 'Factorial', 'factorial(4) = 4 × factorial(3) = 4 × 3 × factorial(2)... until n is 1. The call stack grows to four frames, then shrinks as each call returns its value to the one below.', ['Each frame has its own <b>n</b>.', 'The multiplications only happen while the stack unwinds.']),
            S('rec-fibonacci.c', 'Fibonacci', 'fib(n) = fib(n - 1) + fib(n - 2). The same small values are computed again and again, which is why this version gets slow quickly. Every call gets its own frame, so the call stack grows and shrinks as the calls go down and come back.', ['The left call fib(n - 1) goes all the way down before fib(n - 2) starts.', 'Count how many times fib(1) is called.']),
            S('rec-hanoi.c', 'Towers of Hanoi', 'To move n disks: move n - 1 disks out of the way, move the biggest one, then move the n - 1 disks on top of it. The output lists the 7 moves for 3 disks.', ['The parameters <b>from</b>, <b>to</b> and <b>via</b> swap roles in each recursive call.', 'n = 0 is the base case.'])
        ]
    },
    sorting: {
        intro: '<b>Sorting</b> puts items in order; <b>searching</b> finds one. <b>Bubble sort</b> repeatedly swaps neighbours that are out of order. <b>Insertion sort</b> grows a sorted part at the front by inserting each new item into place. <b>Binary search</b> needs a sorted array and halves the search range every step.',
        ideas: ['An array parameter is really a <b>pointer</b>: the function sorts the caller\'s array.', 'swap(&a, &b) needs pointers to change the real values.', 'Binary search: compare with the middle, then keep only the half that can contain the target.'],
        snippets: [
            S('sort-bubble.c', 'Bubble sort', 'After each pass of the inner loop the biggest remaining item has "bubbled" to the end. <code>swap</code> receives <b>pointers</b> to two array cells and exchanges what they hold.', ['In swap, a and b point into main\'s array.', 'The array in main changes while swap runs.']),
            S('sort-insertion.c', 'Insertion sort', 'Takes the next item (<b>key</b>), shifts bigger items one slot to the right, and drops the key into the gap. The part of the array before <b>i</b> is always sorted.', ['Look at <b>key</b> and <b>j</b> in the frame.', 'Items are shifted right until a smaller one is found.']),
            S('search-binary.c', 'Binary search', 'Looks at the middle element of the range [low, high] and discards the half that cannot contain the target. Searching 7 items takes at most 3 comparisons.', ['low, high and mid change every loop.', 'A missing target ends when low passes high.'])
        ]
    }
};

export const DSA_LESSONS: DsaLessonDef[] = DSA_META.map(m => ({ id: m.id, title: m.title, ...LESSONS[m.id] }));
export const dsaLesson = (id: string) => DSA_LESSONS.find(l => l.id === id);
export const allSnippets = () => DSA_LESSONS.flatMap(l => l.snippets.map(s => ({ lesson: l, snippet: s })));
export const PLAYGROUND_ID = 'visualizer';
export const PLAYGROUND_STARTER = `#include <stdio.h>

int main(){
    printf("Hello, world!\\n");
    return 0;
}
`;
