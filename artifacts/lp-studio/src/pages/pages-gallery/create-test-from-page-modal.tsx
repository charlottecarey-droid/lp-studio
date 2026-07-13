import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Bot, FlaskConical, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE } from "./types";

export function CreateTestFromPageModal({
  page,
  onClose,
}: {
  page: { id: number; title: string; slug: string };
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const [testName, setTestName] = useState(page.title);
  const [testSlug, setTestSlug] = useState(page.slug);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState<"page" | "chatbot">("page");
  const [chatBlockId, setChatBlockId] = useState<string | null>(null);

  // The chat-bot goal is offered only when the page carries a chat-capture
  // block. Top-level scan on purpose: variant blockOverrides are applied to
  // top-level blocks only (chat-capture is a chrome block, so it can't nest).
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/lp/pages/${page.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: { blocks?: unknown } | null) => {
        if (cancelled || !data || !Array.isArray(data.blocks)) return;
        const chat = (data.blocks as Array<{ id?: unknown; type?: unknown }>).find(
          b => b && b.type === "chat-capture" && typeof b.id === "string",
        );
        setChatBlockId(chat ? (chat.id as string) : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [page.id]);

  const isBotTest = goal === "chatbot" && chatBlockId != null;

  const handleSubmit = async () => {
    if (!testName.trim() || !testSlug.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const testRes = await fetch(`${API_BASE}/lp/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: testName.trim(),
          slug: testSlug.trim(),
          testType: "ab",
          ...(isBotTest
            ? { description: "Chat bot on vs off — measures the bot's lift on leads and meetings." }
            : {}),
        }),
      });
      if (!testRes.ok) {
        const err = await testRes.json().catch(() => ({ error: "Failed to create test" }));
        throw new Error((err as { error?: string }).error ?? "Failed to create test");
      }
      const test = await testRes.json() as { id: number };

      // On any later failure, roll the whole test back so a half-configured
      // bot test never sits on the live slug splitting traffic.
      const rollback = () => fetch(`${API_BASE}/lp/tests/${test.id}`, { method: "DELETE" }).catch(() => {});

      const variantRes = await fetch(`${API_BASE}/lp/tests/${test.id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: isBotTest ? "Bot on (control)" : "Control",
          isControl: true,
          trafficWeight: 50,
          builderPageId: page.id,
        }),
      });
      if (!variantRes.ok) {
        await rollback();
        const err = await variantRes.json().catch(() => ({ error: "Failed to create variant" }));
        throw new Error((err as { error?: string }).error ?? "Failed to create variant");
      }

      if (isBotTest) {
        // Challenger = the same page with the chat block's kill switch flipped
        // via blockOverrides — no page copy, so edits to the page reach both
        // variants for the life of the test.
        const challengerRes = await fetch(`${API_BASE}/lp/tests/${test.id}/variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Bot off",
            isControl: false,
            trafficWeight: 50,
            testedBlockId: chatBlockId,
            blockOverrides: { [chatBlockId as string]: { enabled: false } },
          }),
        });
        if (!challengerRes.ok) {
          await rollback();
          const err = await challengerRes.json().catch(() => ({ error: "Failed to create variant" }));
          throw new Error((err as { error?: string }).error ?? "Failed to create variant");
        }
        // Both variants exist, so the slug is already splitting traffic —
        // mark the test running so the dashboard reflects reality.
        await fetch(`${API_BASE}/lp/tests/${test.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "running" }),
        }).catch(() => {});
      }

      navigate(`/tests/${test.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" />
            Run A/B Test on this Page
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {chatBlockId != null ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">What do you want to test?</Label>
              <button
                type="button"
                onClick={() => setGoal("page")}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${goal === "page" ? "border-primary bg-primary/5" : "border-input hover:border-muted-foreground/40"}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FlaskConical className="w-4 h-4 text-primary shrink-0" />
                  Page variants
                </span>
                <span className="block text-xs text-muted-foreground mt-1">
                  This page becomes the Control. Add challenger variants from the test detail page.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGoal("chatbot")}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${goal === "chatbot" ? "border-primary bg-primary/5" : "border-input hover:border-muted-foreground/40"}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="w-4 h-4 text-primary shrink-0" />
                  Chat bot: on vs off
                </span>
                <span className="block text-xs text-muted-foreground mt-1">
                  Half of visitors won&apos;t see the chat bot. Compare leads and meetings to
                  measure its lift. Traffic starts splitting as soon as the test is created.
                </span>
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              This page will become the <strong>Control</strong> variant. Add challenger variants from the test detail page to start testing.
            </p>
          )}
          <div>
            <Label className="text-sm font-medium">Test Name</Label>
            <Input
              className="mt-1.5"
              value={testName}
              onChange={e => setTestName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-sm font-medium">URL Slug</Label>
            <div className="flex items-center mt-1.5 gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
              <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0">/lp/</span>
              <Input
                className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
                value={testSlug}
                onChange={e => setTestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Using the same slug as your page will seamlessly route traffic through the test.</p>
          </div>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !testName.trim() || !testSlug.trim()}
            className="gap-2"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            {isCreating ? "Creating..." : isBotTest ? "Create & Start Test" : "Create Test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
