import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface MenuItem {
  label: string;
  onSelect(): void;
}

interface DotsMenuProps {
  label: string;
  items: MenuItem[];
  /** Optional live-region announcement after a selection. */
  announce?: (item: MenuItem) => string | null;
}

/**
 * A three-dots menu. Keyboard reachable: the button takes focus, Enter/Space
 * opens, arrows move between items, Enter selects, Escape closes and returns
 * focus. Clicking outside closes it.
 */
export function DotsMenu({ label, items, announce }: DotsMenuProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [notice, setNotice] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[focusIdx]?.focus();
  }, [open, focusIdx]);

  function openMenu(): void {
    setFocusIdx(0);
    setOpen(true);
  }

  function closeMenu(refocus: boolean): void {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }

  function select(item: MenuItem): void {
    item.onSelect();
    if (announce) {
      const msg = announce(item);
      if (msg) setNotice(msg);
    }
    closeMenu(true);
  }

  function onButtonKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) closeMenu(true);
      else openMenu();
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenu(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === 'Tab') {
      closeMenu(false);
    }
  }

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="menu-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
      >
        ⋯
      </button>
      {open && (
        <div className="menu" role="menu" aria-label={label} onKeyDown={onMenuKeyDown}>
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              className={i === focusIdx ? 'focused' : undefined}
              onClick={() => select(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {notice}
      </span>
    </div>
  );
}
