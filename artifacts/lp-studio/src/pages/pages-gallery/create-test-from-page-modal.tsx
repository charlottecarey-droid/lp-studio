import { useState } from "react";
import { useLocation } from "wouter";
import { FlaskConical, Loader2 } from "lucide-react";
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

  const handleSubmit = async () => {
    if (!testName.trim() || !testSlug.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const testRes = await fetch(`${API_BASE}/lp/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: testName.trim(), slug: testSlug.trim(), testType: "ab" }),
      });
      if (!testRes.ok) {
        const err = await testRes.json().catch(() => ({ error: "Failed to create test" }));
        throw new Error((err as { error?: string }).error ?? "Failed to create test");
      }
      const test = await testRes.json() as { id: number };

      const variantRes = await fetch(`${API_BASE}/lp/tests/${test.id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Control",
          isControl: true,
          trafficWeight: 50,
          builderPageId: page.id,
        }),
      });
      if (!variantRes.ok) {
        await fetch(`${API_BASE}/lp/tests/${test.id}`, { method: "DELETE" }).catch(() => {});
        const err = await variantRes.json().catch(() => ({ error: "Failed to create variant" }));
        throw new Error((err as { error?: string }).error ?? "Failed to create variant");
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
          <p className="text-sm text-muted-foreground leading-relaxed">
            This page will become the <strong>Control</strong> variant. Add challenger variants from the test detail page to start testing.
          </p>
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
            {isCreating ? "Creating..." : "Create Test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
