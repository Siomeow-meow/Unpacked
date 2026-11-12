/* The cover pictures of the subjects on the main page (inline SVG, drawn on the right half of the cover band). */

/* A small graphical-method picture where everything lines up: the shaded region is the polygon under both lines,
   its corners are the axis intercepts and the point where the two lines cross, and the green dot sits on that corner. */
export function QmCover() {
    return (
        <svg className="cover" viewBox="0 0 260 150" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">
            <path d="M70 0V148H235" stroke="var(--muted)" strokeOpacity=".4" strokeWidth="1.2" fill="none" />
            <path d="M70 148V50L140.4 97.6L180 148z" fill="var(--s-qm)" fillOpacity=".3" />
            <path d="M70 50L215 148" stroke="#1c7ed6" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M70 8L180 148" stroke="#e8590c" strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="140.4" cy="97.6" r="6.5" fill="#2b8a3e" stroke="#fff" strokeWidth="1.6" />
        </svg>
    );
}

export function DsaCover() {
    return (
        <svg className="cover" viewBox="0 0 260 150" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">
            {/* stack frames */}
            <rect x="12" y="22" width="86" height="24" rx="6" fill="var(--card)" stroke="var(--s-dsa)" strokeWidth="2" />
            <text x="55" y="38" textAnchor="middle" fontFamily="ui-monospace, Consolas, monospace" fontSize="11" fontWeight="700" fill="var(--s-dsa-ink)">insertPos</text>
            <rect x="12" y="52" width="86" height="24" rx="6" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
            <text x="55" y="68" textAnchor="middle" fontFamily="ui-monospace, Consolas, monospace" fontSize="11" fontWeight="700" fill="var(--muted)">main</text>
            {/* array */}
            {[0, 1, 2, 3].map(i => (
                <g key={i}>
                    <rect x={118 + i * 34} y="22" width="34" height="26" fill={i === 3 ? 'color-mix(in srgb, var(--good) 22%, var(--card))' : 'var(--card)'} stroke={i === 3 ? 'var(--good)' : 'var(--line)'} strokeWidth={i === 3 ? 2 : 1.4} />
                    <text x={135 + i * 34} y="40" textAnchor="middle" fontFamily="ui-monospace, Consolas, monospace" fontSize="12" fontWeight="700" fill="var(--ink)">{[10, 20, 30, 30][i]}</text>
                </g>
            ))}
            <path d="M98 34q10 0 18 0" stroke="var(--s-dsa)" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M196 22q10-12 22-1" stroke="var(--good)" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M214 14l6 7-9 1" stroke="var(--good)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {/* linked list */}
            {[0, 1, 2].map(i => (
                <g key={i}>
                    <circle cx={140 + i * 46} cy="98" r="15" fill="var(--card)" stroke={i === 2 ? 'var(--s-dsa)' : 'var(--line)'} strokeWidth={i === 2 ? 2 : 1.5} />
                    {i < 2 && <path d={'M' + (156 + i * 46) + ' 98h' + 14} stroke="var(--muted)" strokeWidth="1.6" />}
                </g>
            ))}
        </svg>
    );
}
