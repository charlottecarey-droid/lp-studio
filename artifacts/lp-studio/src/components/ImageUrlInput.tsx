import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const BASE = "https://images.unsplash.com/photo-";
const img = (id: string, label: string) => ({
  label,
  url:   `${BASE}${id}?q=80&w=1400&h=900&fit=crop`,
  thumb: `${BASE}${id}?q=60&w=240&h=156&fit=crop`,
});

const PRESETS: Record<string, { label: string; url: string; thumb: string }[]> = {
  Dental: [
    img("1576091160399-112ba8d25d1d", "Intraoral scanner"),
    img("1559757175-0eb30cd8c063",    "Clinical exam"),
    img("1629909613654-28e377c37b09", "Dental chair"),
    img("1588776814546-daab30f310ce", "Procedure close-up"),
    img("1606811842-d8d9b06b3f75",    "Consultation"),
    img("1609840112855-cdc3260b1a1d", "Dental X-ray"),
    img("1517120026405-4b07f59ba4b1", "Patient smile"),
    img("1607613009820-a29f7bb81c04", "Panoramic scan"),
  ],
  Lab: [
    img("1576086213369-97a306d36557", "Lab bench"),
    img("1581093450021-4a7360e9a6b5", "Manufacturing floor"),
    img("1532187863486-abf9dbad1b69", "Microscope"),
    img("1507413245164-6160d8298b31", "Research bench"),
    img("1518152006812-edab29b069ac", "Precision tools"),
    img("1609557927087-f9cf8e88de18", "Dental lab work"),
    img("1563203369-26f2e547a7b8",    "3D printing"),
    img("1614027164847-1b28cfe1df89", "Milling machine"),
  ],
  Technology: [
    img("1551288049-bebda4e38f71", "Data dashboard"),
    img("1460925895917-afdab827c52f", "Analytics laptop"),
    img("1504868584819-f8e8b4b6d7e3", "Digital interface"),
    img("1558494949-ef010cbdcc31", "Server room"),
    img("1518186285589-2f7649de83e0", "Data visualization"),
    img("1677442135703-1787eea5ce01", "AI neural network"),
    img("1555066931-4365d14bab8c",    "Code on screen"),
    img("1620712943543-bcc4688e7485", "AI chip"),
  ],
  People: [
    img("1582750433449-648ed127bb54", "Doctor team"),
    img("1573496359142-b8d87734a5a2", "Professional woman"),
    img("1519085360753-af0119f7cbe7", "Business executive"),
    img("1522071820081-009f0129c71c", "Team collaboration"),
    img("1600880292203-757bb62b4baf", "Handshake"),
    img("1494790108377-be9c29b29330", "Smiling professional"),
    img("1560250097-0b93528c311a",    "Confident leader"),
    img("1573497019940-1c28c88b4f3e", "Medical professional"),
  ],
  Spaces: [
    img("1629909615184-f4d0ee2c0e3f", "Modern clinic"),
    img("1586773860383-dab8a884a479", "Clean interior"),
    img("1497366754035-f200968a6e72", "Modern office"),
    img("1497366811353-6870744d04b2", "Conference room"),
    img("1631049307264-da0ec9d70304", "Dental waiting room"),
    img("1618221195710-dd6b41faaea6", "Minimalist space"),
  ],
};

const CATEGORIES = Object.keys(PRESETS);

interface ImageUrlInputProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  className?: string;
}

export function ImageUrlInput({
  value,
  onChange,
  placeholder = "https://images.unsplash.com/…",
  className,
}: ImageUrlInputProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(CATEGORIES[0]);
  const [imgError, setImgError] = useState(false);
  const [customUrl, setCustomUrl] = useState("");

  const hasPreview = !!value && value.startsWith("http");

  const pick = (url: string) => {
    onChange(url);
    setImgError(false);
    setOpen(false);
  };

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          <Input
            value={value}
            onChange={e => { onChange(e.target.value); setImgError(false); }}
            placeholder={placeholder}
            className={`flex-1 text-xs font-mono ${className ?? ""}`}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="flex-shrink-0 h-9 px-2.5 gap-1 text-xs"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Pick
          </Button>
        </div>

        {hasPreview && !imgError && (
          <div className="relative w-full h-16 rounded overflow-hidden bg-slate-100 group">
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            <button
              type="button"
              onClick={() => { onChange(""); setImgError(false); }}
              className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}
        {hasPreview && imgError && (
          <p className="text-[10px] text-red-400">Could not load image preview</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-sm font-semibold">Pick an Image</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1.5 px-5 pt-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setTab(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  tab === cat
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2 px-5 py-3 max-h-[340px] overflow-y-auto">
            {PRESETS[tab].map(preset => (
              <button
                key={preset.url}
                type="button"
                onClick={() => pick(preset.url)}
                className="group relative rounded-md overflow-hidden border-2 border-transparent hover:border-slate-900 transition-all focus:outline-none focus:border-slate-900"
              >
                <img
                  src={preset.thumb}
                  alt={preset.label}
                  className="w-full h-20 object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-[9px] text-white leading-tight truncate">{preset.label}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-5 py-3 border-t bg-slate-50">
            <span className="text-xs text-muted-foreground flex-shrink-0">Custom URL:</span>
            <Input
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              placeholder="https://…"
              className="flex-1 h-7 text-xs font-mono"
              onKeyDown={e => {
                if (e.key === "Enter" && customUrl.startsWith("http")) {
                  pick(customUrl);
                  setCustomUrl("");
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              disabled={!customUrl.startsWith("http")}
              onClick={() => { pick(customUrl); setCustomUrl(""); }}
            >
              Use
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
