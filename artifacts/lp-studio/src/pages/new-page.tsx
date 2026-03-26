import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

const API_BASE = "/api";

export default function NewPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const slug = `page-${Date.now()}`;
    fetch(`${API_BASE}/lp/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Page", slug, blocks: [], status: "draft" }),
    })
      .then(r => r.json())
      .then(page => navigate(`/builder/${page.id}`, { replace: true }))
      .catch(() => navigate("/pages", { replace: true }));
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}
