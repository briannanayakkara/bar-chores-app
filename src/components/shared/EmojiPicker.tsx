import { useState, useRef, useEffect } from 'react';
import EmojiPickerReact, { Theme } from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';

interface Props {
  value: string;
  onChange: (emoji: string) => void;
}

export default function EmojiPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleSelect(emojiData: EmojiClickData) {
    onChange(emojiData.emoji);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary flex items-center justify-between min-h-[38px]"
      >
        <span className="text-xl">{value || '😀'}</span>
        <span className="text-xs text-slate-400">{value ? 'Change' : 'Pick'}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0">
          <EmojiPickerReact
            onEmojiClick={handleSelect}
            theme={Theme.DARK}
            searchPlaceholder="Search emoji..."
            width={300}
            height={400}
          />
        </div>
      )}
    </div>
  );
}
