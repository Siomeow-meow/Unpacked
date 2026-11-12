/* Custom dropdown that matches the site (rounded list, highlighted current choice, dark mode, touch/mouse/keyboard).
   A React port of the original enhanceSelects(): same markup and CSS classes (.dd, .ddbtn, .ddlist). */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clamp } from '../lib/util';

export interface SelectOption { value: string; label: string }
interface Props {
    value: string;
    options: SelectOption[];
    onChange: (v: string) => void;
    ariaLabel?: string;
    className?: string;
}

export function Select({ value, options, onChange, ariaLabel, className }: Props) {
    const [open, setOpen] = useState(false);
    const btn = useRef<HTMLButtonElement>(null);
    const list = useRef<HTMLUListElement>(null);
    const cur = options.find(o => o.value === value);

    const close = useCallback((refocus: boolean) => {
        setOpen(false);
        if (refocus) btn.current?.focus();
    }, []);
    const pick = (v: string) => { close(true); if (v !== value) onChange(v); };

    /* place the list under (or above) the button, inside the viewport */
    useLayoutEffect(() => {
        if (!open || !list.current || !btn.current) return;
        const pop = list.current, r = btn.current.getBoundingClientRect(), pad = 8;
        pop.style.maxHeight = ''; pop.style.minWidth = r.width + 'px';
        const h = pop.offsetHeight, w = pop.offsetWidth;
        const below = innerHeight - r.bottom - pad, above = r.top - pad;
        const up = h > below && above > below;
        const room = up ? above : below;
        pop.style.maxHeight = Math.max(120, room - 4) + 'px';
        const hh = Math.min(h, Math.max(120, room - 4));
        pop.style.top = (up ? r.top - hh - 4 : r.bottom + 4) + 'px';
        pop.style.left = clamp(r.left, pad, Math.max(pad, innerWidth - w - pad)) + 'px';
        (pop.querySelector<HTMLElement>('.sel') || (pop.firstElementChild as HTMLElement | null))?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const down = (e: PointerEvent) => {
            const t = e.target as Node;
            if (!list.current?.contains(t) && !btn.current?.contains(t)) close(false);
        };
        const away = () => close(false);
        const scroll = (e: Event) => { if (!list.current?.contains(e.target as Node)) close(false); };
        document.addEventListener('pointerdown', down);
        window.addEventListener('resize', away);
        window.addEventListener('scroll', scroll, true);
        return () => {
            document.removeEventListener('pointerdown', down);
            window.removeEventListener('resize', away);
            window.removeEventListener('scroll', scroll, true);
        };
    }, [open, close]);

    const onListKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
        const items = Array.from(e.currentTarget.children) as HTMLElement[], i = items.indexOf(document.activeElement as HTMLElement);
        const go = (n: number) => { e.preventDefault(); e.stopPropagation(); items[clamp(n, 0, items.length - 1)].focus(); };
        if (e.key === 'ArrowDown') go(i + 1);
        else if (e.key === 'ArrowUp') go(i - 1);
        else if (e.key === 'Home') go(0);
        else if (e.key === 'End') go(items.length - 1);
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (i >= 0) pick(options[i].value); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
        else if (e.key === 'Tab') close(false);
    };

    return (
        <span className={'dd' + (className ? ' ' + className : '')}>
            <button type="button" ref={btn} className="ddbtn" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel || undefined}
                onClick={() => setOpen(o => !o)}
                onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); } }}>
                <span className="ddt">{cur ? cur.label : ''}</span>
            </button>
            {open && createPortal(
                <ul className="ddlist" role="listbox" ref={list} onKeyDown={onListKey}>
                    {options.map(o => (
                        <li key={o.value} role="option" tabIndex={-1} className={o.value === value ? 'sel' : undefined}
                            aria-selected={o.value === value ? true : undefined} onClick={() => pick(o.value)}>{o.label}</li>
                    ))}
                </ul>, document.body)}
        </span>
    );
}
