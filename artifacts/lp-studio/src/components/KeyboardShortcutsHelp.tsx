import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatShortcutKeys, isMac, type Shortcut } from "@/lib/keyboard-shortcuts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: Shortcut[];
}

export function KeyboardShortcutsHelp({ open, onOpenChange, shortcuts }: Props) {
  const mac = isMac();
  const groups = new Map<string, Shortcut[]>();
  for (const s of shortcuts) {
    const g = s.group ?? "General";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(s);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
              <ul className="space-y-1.5">
                {items.map(s => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{s.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {formatShortcutKeys(s.keys, mac).map((k, i) => (
                        <kbd
                          key={i}
                          className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded border border-border bg-muted text-[11px] font-mono text-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
