import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface VarInserterItem {
  token: string;
  label: string;
  description: string;
}

const CAMPAIGN_VARS: VarInserterItem[] = [
  { token: "{{company}}", label: "Company", description: "e.g. Pacific Dental Alliance" },
  { token: "{{first_name}}", label: "First name", description: "e.g. Sarah" },
  { token: "{{last_name}}", label: "Last name", description: "e.g. Johnson" },
  { token: "{{microsite_url}}", label: "Personalized URL", description: "Unique link per contact" },
  { token: "{{sender_name}}", label: "Sender name", description: "e.g. Alex at Dandy" },
];

interface Props {
  onInsert: (token: string) => void;
  /** Variables to offer. Defaults to the Dandy campaign variables. */
  variables?: VarInserterItem[];
  /** Heading shown above the list. */
  title?: string;
  /** Footnote shown below the list (omit to hide). */
  footnote?: string;
}

const DEFAULT_FOOTNOTE =
  "Variables are auto-replaced when a contact visits their personalized Campaign Page link.";

export function CampaignVarInserter({
  onInsert,
  variables = CAMPAIGN_VARS,
  title = "Campaign Variables",
  footnote = DEFAULT_FOOTNOTE,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/30 gap-1"
          title="Insert variable"
        >
          <Megaphone className="w-3 h-3" />
          Vars
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        {variables.map(({ token, label, description }) => (
          <button
            key={token}
            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex flex-col gap-0.5"
            onClick={() => {
              onInsert(token);
              setOpen(false);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{label}</span>
              <code className="text-[10px] text-violet-600 dark:text-violet-400 font-mono">{token}</code>
            </div>
            <span className="text-[10px] text-muted-foreground">{description}</span>
          </button>
        ))}
        {footnote && (
          <div className="border-t mt-1 pt-1 px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground leading-relaxed">{footnote}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
