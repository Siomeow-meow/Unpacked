/* The row of chips above the step card (objective + constraints) with the ✎ Edit button. */
export interface Chip { text: string; obj?: boolean }

export function SummaryChips({ chips, hidden, onEdit }: { chips: Chip[]; hidden: boolean; onEdit: () => void }) {
    return (
        <div className="summary" id="summary" hidden={hidden}>
            <div className="chips" id="chips">
                {chips.map((c, i) => <span key={i} className={'chip' + (c.obj ? ' obj' : '')}>{c.text}</span>)}
            </div>
            <button className="btn small" id="editBtn" type="button" onClick={onEdit}>✎ Edit</button>
        </div>
    );
}
