/* What's New entries, newest first. Items are trusted static HTML. */
export interface Release {
    version: string;           // key stored once the user has seen it
    title: string;
    blurb: string;
    tag?: { text: string; old?: boolean };
    sections: { h: string; items: string[] }[];
}

export const CHANGELOG: Release[] = [
    {
        version: 'v2.0', title: 'Version 2.0', tag: { text: 'Latest' },
        blurb: 'Simplex step by step is now Unpacked: a place to learn problem solving one step at a time.',
        sections: [
            { h: 'New', items: [
                '<b>Unpacked.</b> Solve a problem one small step at a time, with every number explained.',
                '<b>Quantitative Methods.</b> Course 1: Simplex, Graphical Method and Transportation, with saved problems.',
                '<b>Graphical Method.</b> Max or Min with two variables, from the constraint lines to the best corner.',
                '<b>Transportation Problem.</b> Starting solution, degenerate fix and MODI, step by step.',
                '<b>C Programming.</b> Course 2: 24 lessons in three sections, from Hello World to Graphs.',
                '<b>Practice.</b> Write the missing code, Check it, Visualize it, or Show solution.',
                '<b>Code visualizer.</b> Step through any C code with the call stack, the heap and pointer arrows.',
                '<b>New main page.</b> Course covers, Continue where you left off, and search (press /).',
                '<b>Works offline.</b> Open it once and it keeps working without Wi-Fi. You can install it as an app.'
            ] },
            { h: 'Improved', items: [
                '<b>Same look everywhere.</b> Top bars, lesson cards and course cards now match across courses.',
                '<b>Panels.</b> Split, join, swap and resize the panels of a lesson. Each lesson remembers its layout.',
                '<b>Memory boxes.</b> Variables are boxes with addresses, and pointer arrows grow to their target.',
                '<b>Graph tab.</b> Each test point is worked out and marked satisfied or not.',
                '<b>Code editing.</b> Tab, Shift+Tab and auto-indent in the code boxes.',
                '<b>Fits your screen.</b> Graphical and Transportation steps fit without scrolling. Scroll bars are thin.',
                '<b>Safer pages.</b> A page that fails explains why and offers reload or reset.',
                '<b>Same Simplex.</b> The maths is unchanged, and your old saved problems came along.'
            ] },
            { h: 'Bug Fixes', items: [
                '<b>Blank screen.</b> Pages no longer stay empty after an update or with damaged saved data.',
                '<b>Code editor.</b> Panels no longer shrink or jump when you press Edit code.',
                '<b>Transportation table.</b> The Demand label and long row names fit.',
                '<b>Graph tab.</b> Graphs keep their shape and nothing covers the text.',
                '<b>Calculation text.</b> Steps explain a calculation with the values from before it ran.',
                '<b>Arrows and scroll bars.</b> Neat arrowheads that point at the right box, and no stray scroll bar.',
                '<b>Course cards.</b> The Quantitative Methods picture lines up and long titles stay inside.'
            ] }
        ]
    },
    {
        version: 'v1.3.1', title: 'Version 1.3.1',
        blurb: 'Formula arrows, thinner cell borders, and more.',
        sections: [
            { h: 'Improved', items: [
                '<b>Examples list.</b> The examples now sit in an Examples list beside your problem, above Saved problems, with a Load button for each. The first two are named Max: Default and Min: Default, and Min: Default is now: minimize 45x + 24y subject to 2x + 3y &ge; 16 and 3x + 5y &ge; 25.',
                '<b>Calculation arrows.</b> In the Zj, Cj - Zj, ratio test and row-calculation steps, arrows now follow the formula one operation at a time (for example Cj to each value, then value to value, then to the result) instead of all pointing at the final answer. Each number in the formula is underlined in the colour of its arrow.',
                '<b>Matching colours.</b> Each highlighted cell now takes the colour of its arrow, and the underline on the formula uses the same colour.',
                '<b>Step-by-step highlighting.</b> A cell is outlined only after the arrow that reaches or leaves it has been drawn, and the result stays hidden until the last arrow is done. The outline also keeps its colour when it moves to the next step.',
                '<b>Thinner cell borders.</b> The highlight borders around cells are thinner and easier to read.'
            ] },
            { h: 'Bug Fixes', items: [
                '<b>Result shown too early.</b> Fixed an issue where the result of a calculation appeared before its arrows had finished drawing.',
                '<b>Highlight colours.</b> Fixed an issue where highlighted cells, the sliding outline between steps and the formula underline did not match the colour of their arrows.',
                '<b>Arrows pointing at the answer.</b> Fixed an issue where arrows pointed straight at the final answer instead of following the calculation shown in the formula.',
                '<b>Max and Min switch.</b> Fixed an issue where the problem card changed size when switching between Max and Min Procedure. Switching still keeps your numbers and only flips the &le; and &ge; symbols.',
                '<b>Min Procedure tables.</b> Fixed an issue where tables on steps that show a single table were drawn small and squashed. They now use the available space.'
            ] },
            { h: 'Phones', items: [
                '<b>Very small screens.</b> The problem form, tabs, buttons and lists now fit phones with screens as small as 4 inches (320 pixels wide), such as the iPhone 4 and 5.'
            ] }
        ]
    },
    {
        version: 'v1.3', title: 'Version 1.3', blurb: 'Arrow navigation, matching dropdowns and easier solving.',
        sections: [
            { h: 'New', items: ['<b>Arrow navigation.</b> The Back and Next buttons are now arrows. Two new buttons jump straight to the first and last step: « ‹ Step x of y › »'] },
            { h: 'Improved', items: [
                '<b>Automatic solving.</b> Just open the next tab and your problem is solved. No need to press a button first.',
                '<b>Dropdowns.</b> The example and constraint-type menus, including their option lists, now match the rest of the design, with rounded corners, a highlighted current choice and dark mode support. They work with touch, mouse and keyboard.',
                '<b>Automatic constraint symbols.</b> Switching between Max and Min Procedure now flips every ≤ to ≥ (and every ≥ to ≤) so the constraints match the typical form of each procedure. Equality constraints are left unchanged, and you can still change any symbol manually.'
            ] }
        ]
    },
    {
        version: 'v1.2.1', title: 'Version 1.2.1', blurb: 'Patch: steadier tables and a cleaner reload.',
        sections: [
            { h: 'Bug Fixes', items: [
                '<b>Min procedure tables.</b> Long values such as Big-M expressions no longer overlap neighboring cells. The cell size is chosen once for the whole problem, so cells no longer shift from step to step.',
                '<b>Reload flicker.</b> Reloading the page no longer flashes empty cards that then resize. The page appears fully built, on the step you left, without replaying the entrance animations.'
            ] }
        ]
    },
    {
        version: 'v1.2', title: 'Version 1.2', blurb: 'A What\'s New window.',
        sections: [
            { h: 'New', items: ['<b>What\'s New</b> button in the header. It opens this window, which lists the changes version by version. A red dot shows when there is something you have not seen yet.'] }
        ]
    },
    {
        version: 'v1.1', title: 'Version 1.1', blurb: 'Smoother steps, a new Tables tab, cleaner arrows and phone fixes.',
        sections: [
            { h: 'New', items: [
                '<b>Tab 3 · Tables.</b> Shows every table you have reached so far, stacked, and it grows as you step forward in tab 2. Back and Next work here too.',
                '<b>Smooth steps.</b> Steps that share the same table layout no longer reload the whole card. The blue and green boxes glide from one cell to the next, so tapping Next quickly is easy on the eyes.'
            ] },
            { h: 'Improved', items: [
                '<b>Arrows.</b> Arrowheads now point at the number they are about, follow the curve properly, and arrows into the same cell no longer pile onto one spot.',
                '<b>Arrow labels</b> keep clear of the numbers in the table.',
                '<b>Cj-Zj row</b> shows ∅ instead of black blocks.',
                '<b>Tabs 2 and 3</b> stay locked until you press Start.',
                'The <b>Start step by step</b> button is now just <b>Start</b>.'
            ] },
            { h: 'Phones', items: [
                'Back and Next are the same size and centered around the step counter.',
                'Double-tap zoom is off, so tapping Next quickly will not zoom the page. Pinch zoom still works.'
            ] }
        ]
    },
    {
        version: 'v1', title: 'Version 1', tag: { text: 'First release', old: true }, blurb: 'The first version: step-by-step Simplex with Max and Min.',
        sections: [
            { h: 'New', items: [
                'Max and Min procedures (Min uses Big-M with surplus and artificial variables), with ≤, ≥ and = constraints.',
                'Cell-by-cell steps for Zj, Cj - Zj, ratios and every cell of the new rows, with curved arrows from the numbers used to the cell being computed.',
                'Next / Back buttons, left / right arrow keys and swipe on touch screens.',
                'One-screen layout with tabs 1 · Problem and 2 · Solve; tables fit phones, tablets and desktops.',
                'Your inputs, progress and named saved problems stay in your browser, with Export / Import backup.'
            ] }
        ]
    }
];

export const LATEST_VERSION = CHANGELOG[0].version;
