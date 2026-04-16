import { useState, useEffect, useRef } from "react";
import { SalesLayout } from "@/components/layout/sales-layout";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, Copy, Check, ExternalLink, Globe, ChevronDown, ChevronUp, Plus, Trash2, Eye, RefreshCw } from "lucide-react";

const API_BASE = "/api";

type Audience = "executive" | "clinical" | "practice-manager";

interface TeamMember {
  name: string;
  role: string;
  email: string;
  photo: string;
}

const AUDIENCE_LABELS: Record<Audience, string> = {
  executive: "Executive",
  clinical: "Clinical",
  "practice-manager": "Practice Manager",
};

const AUDIENCE_DESC: Record<Audience, string> = {
  executive: "Quality, consistency, and control at scale.",
  clinical: "Digital dentistry workflows and seamless clinical tools.",
  "practice-manager": "Reduce operational friction and administrative burden.",
};

export default function SalesWebOnePager() {
  const { user } = useAuth();
  const tenantId = (user as { tenantId?: number })?.tenantId ?? 1;

  const [dsoName, setDsoName] = useState("");
  const [audience, setAudience] = useState<Audience>("executive");
  const [sideImageUrl, setSideImageUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [ctaUrl, setCtaUrl] = useState("https://meetdandy.com/dso");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showTeam, setShowTeam] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ pageId: number; slug: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [viewCount, setViewCount] = useState<number | null>(null);
  const [viewsLoading, setViewsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchViewCount = async (pageId: number) => {
    setViewsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sales/web-one-pager/views/${pageId}`);
      if (res.ok) {
        const data = await res.json();
        setViewCount(data.viewCount ?? 0);
      }
    } catch {
      // silent
    } finally {
      setViewsLoading(false);
    }
  };

  useEffect(() => {
    if (result) {
      fetchViewCount(result.pageId);
      pollRef.current = setInterval(() => fetchViewCount(result.pageId), 30_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [result?.pageId]);

  const addTeamMember = () => {
    setTeamMembers((prev) => [...prev, { name: "", role: "", email: "", photo: "" }]);
    setShowTeam(true);
  };

  const updateMember = (i: number, field: keyof TeamMember, value: string) => {
    setTeamMembers((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const removeMember = (i: number) => {
    setTeamMembers((prev) => prev.filter((_, idx) => idx !== i));
  };

  const generate = async () => {
    if (!dsoName.trim()) {
      toast({ title: "Partner name required", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setResult(null);
    setViewCount(null);
    try {
      const res = await fetch(`${API_BASE}/sales/web-one-pager`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dsoName: dsoName.trim(),
          audience,
          sideImageUrl: sideImageUrl.trim() || undefined,
          phone: phone.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
          teamMembers: teamMembers.filter((m) => m.name.trim()).map((m) => ({
            name: m.name,
            role: m.role,
            email: m.email || undefined,
            photo: m.photo || undefined,
          })),
          tenantId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Failed to generate");
      }
      const data = await res.json();
      setResult(data);
      toast({ title: "One pager created!", description: "Your interactive one pager is live." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const publicUrl = result
    ? `${window.location.origin}/lp-studio/p/${result.slug}`
    : null;

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!" });
    });
  };

  const inputCls = "w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <SalesLayout>
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Interactive One Pager</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Generate a personalized landing page to send prospects instead of a PDF. The page is live immediately.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Partner Details</h2>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Partner / Prospect Name <span className="text-red-500">*</span></label>
              <input
                className={inputCls}
                placeholder="e.g. DCA, Heartland Dental"
                value={dsoName}
                onChange={(e) => setDsoName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Audience</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAudience(a)}
                    className={`text-xs px-3 py-2.5 rounded-lg border transition-all text-left ${
                      audience === a
                        ? "border-primary bg-primary/5 text-primary font-semibold"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <div className="font-medium">{AUDIENCE_LABELS[a]}</div>
                    <div className={`mt-0.5 leading-tight ${audience === a ? "text-primary/70" : "text-muted-foreground/70"}`} style={{ fontSize: 10 }}>
                      {AUDIENCE_DESC[a]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Side Image URL <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                className={inputCls}
                placeholder="https://... (jpg or png)"
                value={sideImageUrl}
                onChange={(e) => setSideImageUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">The photo that appears on the right side of the header. Use a Dandy media URL or any public image URL.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Phone Number <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                className={inputCls}
                placeholder="e.g. +1 800 555 0123"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">CTA Link</label>
              <input
                className={inputCls}
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowTeam((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
            >
              <span>Team Members <span className="text-muted-foreground font-normal">({teamMembers.length})</span></span>
              {showTeam ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showTeam && (
              <div className="px-6 pb-5 space-y-4 border-t border-border">
                <p className="text-xs text-muted-foreground pt-4">
                  Add the reps who'll be working with this prospect. If left empty, placeholder names will be used.
                </p>
                {teamMembers.map((m, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 relative border border-border rounded-lg p-3">
                    <button onClick={() => removeMember(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <input className={inputCls} placeholder="Full name" value={m.name} onChange={(e) => updateMember(i, "name", e.target.value)} />
                    <input className={inputCls} placeholder="Title / Role" value={m.role} onChange={(e) => updateMember(i, "role", e.target.value)} />
                    <input className={`${inputCls} col-span-2`} placeholder="Email (optional)" value={m.email} onChange={(e) => updateMember(i, "email", e.target.value)} />
                    <input className={`${inputCls} col-span-2`} placeholder="Photo URL (optional)" value={m.photo} onChange={(e) => updateMember(i, "photo", e.target.value)} />
                  </div>
                ))}
                <button
                  onClick={addTeamMember}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add team member
                </button>
              </div>
            )}
          </div>

          <button
            onClick={generate}
            disabled={generating || !dsoName.trim()}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                Generate Interactive One Pager
              </>
            )}
          </button>

          {result && publicUrl && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-800">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold">One pager is live</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-700">
                  <Eye className="w-3.5 h-3.5" />
                  {viewsLoading && viewCount === null ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <span>
                      {viewCount ?? 0} {viewCount === 1 ? "view" : "views"}
                    </span>
                  )}
                  <button
                    onClick={() => result && fetchViewCount(result.pageId)}
                    disabled={viewsLoading}
                    className="ml-0.5 text-green-600 hover:text-green-800 disabled:opacity-40 transition-colors"
                    title="Refresh view count"
                  >
                    <RefreshCw className={`w-3 h-3 ${viewsLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-green-600">Updates every 30 seconds automatically.</p>
              <p className="text-xs text-green-700 break-all font-mono bg-green-100 rounded px-2 py-1.5">{publicUrl}</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-white border border-green-200 text-green-800 font-medium hover:bg-green-50 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-white border border-green-200 text-green-800 font-medium hover:bg-green-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Preview
                </a>
                <a
                  href={`/pages/${result.pageId}`}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                >
                  Edit in Builder →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </SalesLayout>
  );
}
