import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Globe, Loader2, Mail, Search, Send, SquarePen, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { copyEmailPreview, buildOutreachEmail, buildGmailComposeUrl, buildMailtoUrl } from "@/lib/email-preview";
import { fetchBrandConfig } from "@/lib/brand-config";
import { useOptionalBrandConfig } from "@/context/BrandConfigContext";
import { toast } from "@/hooks/use-toast";
import { initials } from "@/pages/sales/sales-pages-shared";

const API_BASE = "/api";

export type ComposeTarget = "gmail" | "mail";

export interface EpContact {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
  title?: string | null;
  accountName?: string | null;
}

export interface EmailPreviewHotlink {
  hotlinkId: number;
  token: string;
  contactId: number;
  contactName?: string;
  contactEmail?: string | null;
}

/** The page the modal is open for. `plainUrl` is supplied by the caller
 *  because the public URL rules differ per screen (microsite domain vs tenant
 *  host vs the admin origin). */
export interface EmailPreviewPage {
  pageId: number;
  pageTitle: string;
  plainUrl: string;
  hotlinks: EmailPreviewHotlink[];
}

export interface OutreachTemplates { subject?: string; intro?: string }

/** Workspace mail client (Settings → Email → Sending). Unset = gmail. */
export function useMailClient(): ComposeTarget {
  const ctx = useOptionalBrandConfig();
  return ctx?.brand?.salesConsole?.outreachMailClient === "default" ? "mail" : "gmail";
}

/**
 * Workspace outreach templates (Settings → Email → Sending). Three tiers:
 * this workspace's copy → the platform default a superadmin set → the built-in
 * constants (applied inside buildOutreachEmail when both come back blank).
 * Both fetches fail soft for the same reason — a missing template must never
 * cost a rep their draft.
 *
 * Lazy by design: the surfaces that only show compose buttons (account and
 * contact detail) would otherwise re-fetch the brand config on every view for
 * a draft the rep may never open. `load()` is awaited before a draft is built,
 * so the first click still gets the real template rather than the fallback.
 * Pass `prefetch` where the templates are certain to be needed (the modal).
 */
export function useOutreachTemplates(prefetch = false) {
  const [templates, setTemplates] = useState<OutreachTemplates | undefined>();
  const pending = useRef<Promise<OutreachTemplates> | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(() => {
    if (!pending.current) {
      pending.current = Promise.all([
        fetchBrandConfig().catch(() => null),
        fetch(`${API_BASE}/lp/outreach-defaults`)
          .then(r => (r.ok ? r.json() as Promise<OutreachTemplates> : null))
          .catch(() => null),
      ]).then(([brand, platform]) => {
        const sc = brand?.salesConsole;
        const next: OutreachTemplates = {
          subject: (sc?.outreachSubject ?? "").trim() || platform?.subject || undefined,
          intro: (sc?.outreachIntro ?? "").trim() || platform?.intro || undefined,
        };
        if (mounted.current) setTemplates(next);
        return next;
      });
    }
    return pending.current;
  }, []);

  useEffect(() => { if (prefetch) void load(); }, [prefetch, load]);

  return { templates, load };
}

export type OutreachSource = ReturnType<typeof useOutreachTemplates>;

/**
 * Copy the rich image+link card, and optionally open a prefilled composer.
 *
 * The two halves are deliberately decoupled: a clipboard write can fail for
 * reasons that have nothing to do with the draft (denied permission, the tab
 * losing focus mid-capture). When the rep asked for Gmail, that must NOT
 * swallow the compose window — the compose body always carries the URL, so an
 * un-pasted send is still a working email.
 */
export function useEmailPreviewCopy(outreach: OutreachSource) {
  /** "plain" or `contact:${id}` or a token — which option is copying / copied. */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function openComposerFor(
    pageUrl: string,
    opts: {
      target: ComposeTarget;
      to?: string | null;
      firstName?: string | null;
      title?: string | null;
      copied: boolean;
    },
  ) {
    // Awaited, not read off state: on a surface that doesn't prefetch, the
    // very first draft would otherwise fall back to the built-in copy.
    const templates = await outreach.load().catch(() => undefined);
    const { subject, body } = buildOutreachEmail({
      firstName: opts.firstName,
      pageTitle: opts.title,
      url: pageUrl,
      subjectTemplate: templates?.subject,
      introTemplate: templates?.intro,
    });
    const label = opts.target === "gmail" ? "Gmail" : "Your email app";
    if (opts.target === "gmail") {
      window.open(buildGmailComposeUrl({ to: opts.to, subject, body }), "_blank", "noopener,noreferrer");
    } else {
      // mailto: hands off to the OS default client — navigate rather than
      // window.open so we don't leave an orphaned blank tab behind.
      window.location.href = buildMailtoUrl({ to: opts.to, subject, body });
    }
    toast(
      opts.copied
        ? {
            title: `${label} opened — paste the card`,
            description: "The preview is on your clipboard: click into the message body and press ⌘V.",
          }
        : {
            // The draft is still worth having: the body carries the link.
            title: `${label} opened without the card`,
            description: "The preview couldn't reach your clipboard, but the link is already in the message.",
          },
    );
  }

  async function copyPreview(args: {
    key: string;
    pageId: number;
    pageUrl: string;
    title?: string | null;
    compose?: { target: ComposeTarget; to?: string | null; firstName?: string | null };
  }): Promise<void> {
    if (busyKey !== null) return;
    const { key, pageId, pageUrl, title, compose } = args;
    setBusyKey(key);
    try {
      let result: Awaited<ReturnType<typeof copyEmailPreview>> | null = null;
      try {
        result = await copyEmailPreview({ pageId, pageUrl, title });
      } catch (err) {
        console.error("Copy email preview error:", err);
        if (!compose) throw err;
      }
      if (result) {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 2500);
      }
      if (compose) await openComposerFor(pageUrl, { ...compose, title, copied: result !== null });
      else if (result === "link-only") {
        toast({
          title: "Copied the link instead",
          description: "Couldn't build the image preview, so the plain link is on your clipboard.",
        });
      }
    } catch (err) {
      console.error("Copy email preview error:", err);
      toast({ title: "Couldn't copy", description: "Nothing made it to your clipboard — try again.", variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  }

  return { busyKey, copiedKey, setBusyKey, setCopiedKey, copyPreview, openComposerFor };
}

/**
 * ONE "open a draft" button, next to the copy control.
 *
 * This used to render a Gmail button AND a mail-app button on every row. Two
 * problems: a workspace uses one client, not both, and the mail-app icon was an
 * envelope sitting immediately beside the copy-email-preview button — which is
 * also an envelope. So the client is a workspace setting (Settings → Email →
 * Sending) and the icons are deliberately distinct from each other and from
 * that envelope: a paper plane for Gmail, a compose pen for everything else.
 *
 * Per-hotlink rows (page drill-down, contacts) can't offer a link-type choice —
 * the contact is already fixed — but they should still be able to get a draft.
 */
export function ComposeButtons({
  disabled,
  name,
  email,
  onCompose,
  variant = "icon",
}: {
  disabled: boolean;
  name?: string | null;
  email?: string | null;
  onCompose: (target: ComposeTarget) => void;
  variant?: "icon" | "row";
}) {
  const target = useMailClient();
  const who = name || email || "this contact";
  const noEmail = !email ? " (no email on file — the draft opens empty)" : "";
  const label = target === "gmail" ? "Gmail" : "your email app";
  const title = `Copy the card and open a draft to ${who} in ${label}${noEmail}`;
  const aria = `Open a draft to ${who} in ${label}`;
  const Icon = target === "gmail" ? Send : SquarePen;

  if (variant === "row") {
    return (
      <button
        disabled={disabled}
        title={title}
        aria-label={aria}
        onClick={() => onCompose(target)}
        className="pr-3 pl-2 py-2 shrink-0 text-muted-foreground/50 hover:text-primary disabled:opacity-60"
      >
        <Icon className="w-3.5 h-3.5" />
      </button>
    );
  }
  return (
    <Button
      variant="ghost" size="icon" className="h-7 w-7 shrink-0"
      disabled={disabled}
      title={title}
      aria-label={aria}
      onClick={() => onCompose(target)}
    >
      <Icon className="w-3.5 h-3.5" />
    </Button>
  );
}

/**
 * "Copy email preview" — rich image+link clipboard snippet (Userled-style
 * email embed). The modal makes the rep pick the destination explicitly — the
 * plain page URL, or a personalized /p/ link for a chosen contact — because
 * silently linking to the first hotlink attributed every visit to whichever
 * contact happened to be first.
 *
 * Lives here rather than in sales-pages.tsx so every surface with an envelope
 * button opens the same thing.
 */
export function EmailPreviewModal({
  page,
  onClose,
  hotlinkBase,
  onHotlinkCreated,
}: {
  page: EmailPreviewPage | null;
  onClose: () => void;
  /** Origin for personalized /p/ links. Defaults to the current origin. */
  hotlinkBase?: string;
  /** Fired when a link is minted on the fly, so the caller can refresh its own row. */
  onHotlinkCreated?: (pageId: number, hotlink: EmailPreviewHotlink) => void;
}) {
  const [search, setSearch] = useState("");
  const [allContacts, setAllContacts] = useState<EpContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  /** Links minted inside the modal this session, merged onto page.hotlinks so
   *  the row appears immediately without the caller having to feed props back. */
  const [created, setCreated] = useState<EmailPreviewHotlink[]>([]);

  const outreach = useOutreachTemplates(!!page);
  const mailClient = useMailClient();
  const { busyKey, copiedKey, setBusyKey, setCopiedKey, copyPreview, openComposerFor } = useEmailPreviewCopy(outreach);

  const pageId = page?.pageId ?? null;
  useEffect(() => {
    // Reset per-page: a stale search or "Copied" tick from the last page is wrong.
    setSearch("");
    setCreated([]);
    setCopiedKey(null);
  }, [pageId, setCopiedKey]);

  // Contact search runs on the SERVER. It used to pull the first page of
  // contacts and filter them in the browser, so anyone outside that window was
  // unfindable — on a tenant with thousands of contacts that reads as "search
  // only matches some people". Debounced so typing doesn't spam the endpoint.
  useEffect(() => {
    const q = search.trim();
    if (!page || q.length < 2) {
      setAllContacts([]);
      setContactsLoading(false);
      return;
    }
    setContactsLoading(true);
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`${API_BASE}/sales/contacts?search=${encodeURIComponent(q)}&limit=50`)
        .then(r => (r.ok ? r.json() : []))
        .then(data => {
          if (cancelled) return;
          setAllContacts(Array.isArray(data) ? data : data.data ?? []);
        })
        .catch(err => { if (!cancelled) console.error("Contact search failed:", err); })
        .finally(() => { if (!cancelled) setContactsLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, page]);

  const base = hotlinkBase ?? window.location.origin;

  /** Copy the preview linked to a personalized /p/ link for this contact,
   *  reusing the page's existing hotlink or creating one on the fly. */
  async function copyPersonalizedPreview(row: EmailPreviewPage, contact: EpContact, target?: ComposeTarget) {
    if (busyKey !== null) return;
    const key = `contact:${contact.id}`;
    setBusyKey(key);
    try {
      let entry = [...row.hotlinks, ...created].find(hl => hl.contactId === contact.id);
      if (!entry) {
        const res = await fetch(`${API_BASE}/sales/hotlinks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: contact.id, pageId: row.pageId }),
        });
        if (!res.ok) throw new Error(`Hotlink create failed (${res.status})`);
        const createdRow = (await res.json()) as { id: number; token: string };
        entry = {
          hotlinkId: createdRow.id,
          token: createdRow.token,
          contactId: contact.id,
          contactName: [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim(),
          contactEmail: contact.email ?? null,
        };
        const appended = entry;
        setCreated(prev => [...prev, appended]);
        onHotlinkCreated?.(row.pageId, appended);
      }
      const personalizedUrl = `${base}/p/${entry.token}`;
      // Same rule as copyPreview: a clipboard failure must not cost the rep the
      // draft, which already carries the link in its body. The hotlink above is
      // created either way, so the link stays valid.
      let result: Awaited<ReturnType<typeof copyEmailPreview>> | null = null;
      try {
        result = await copyEmailPreview({ pageId: row.pageId, pageUrl: personalizedUrl, title: row.pageTitle });
      } catch (err) {
        console.error("Copy email preview error:", err);
        if (!target) throw err;
      }
      if (result) {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 2500);
      }
      if (target) {
        await openComposerFor(personalizedUrl, {
          target,
          to: contact.email,
          firstName: contact.firstName,
          title: row.pageTitle,
          copied: result !== null,
        });
      } else if (result === "link-only") {
        toast({
          title: "Copied the link instead",
          description: "Couldn't build the image preview, so the plain link is on your clipboard.",
        });
      }
    } catch (err) {
      console.error("Personalized email preview error:", err);
      toast({ title: "Couldn't create the personalized link", description: "Nothing was copied — try again.", variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Dialog open={!!page} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Copy email preview
          </DialogTitle>
          <DialogDescription>
            Puts a linked screenshot of <span className="font-medium text-foreground">"{page?.pageTitle}"</span> on your clipboard to paste into an email. Choose where the link should point.
          </DialogDescription>
        </DialogHeader>

        {page && (() => {
          const row = page;
          const hotlinks = [...row.hotlinks, ...created];
          const plainUrl = row.plainUrl;
          const q = search.trim();
          const linkedIds = new Set(hotlinks.map(hl => hl.contactId));
          // Server-filtered already (name / email / account name).
          const matches = q.length >= 2 ? allContacts : [];
          return (
            <div className="flex flex-col gap-4 pt-2">
              {/* Plain page link — anonymous visits */}
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 flex items-center gap-3">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground">Plain page link</div>
                  <div className="text-[11px] text-muted-foreground truncate">{plainUrl}</div>
                </div>
                <Button
                  size="sm" variant="outline" className="h-7 px-2.5 text-[11px] shrink-0"
                  disabled={busyKey !== null}
                  onClick={() => void copyPreview({ key: "plain", pageId: row.pageId, pageUrl: plainUrl, title: row.pageTitle })}
                >
                  {busyKey === "plain"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : copiedKey === "plain"
                      ? <><Check className="w-3 h-3 mr-1 text-emerald-500" />Copied</>
                      : <><Copy className="w-3 h-3 mr-1" />Copy</>}
                </Button>
                {/* One draft button, per the workspace's mail client — same
                    rule as the contact rows below. */}
                <Button
                  size="sm" variant="outline" className="h-7 w-7 p-0 shrink-0"
                  disabled={busyKey !== null}
                  title={`Copy the card and open a draft in ${mailClient === "gmail" ? "Gmail" : "your email app"} (no recipient — it's the plain link)`}
                  aria-label="Open a draft with the plain page link"
                  onClick={() => void copyPreview({ key: "plain", pageId: row.pageId, pageUrl: plainUrl, title: row.pageTitle, compose: { target: mailClient } })}
                >
                  {mailClient === "gmail" ? <Send className="w-3 h-3" /> : <SquarePen className="w-3 h-3" />}
                </Button>
              </div>

              {/* Personalized link — attributed visits */}
              <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground">Personalized link — visits are attributed to the contact</span>
                </div>
                <div className="px-3 py-2 border-b border-border/50">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search contacts by name, email, or account…"
                      className="w-full pl-6 pr-6 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      autoFocus
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {q === "" ? (
                  hotlinks.length > 0 ? (
                    <>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Already has a link</p>
                      <div className="max-h-52 overflow-y-auto divide-y divide-border/40">
                        {hotlinks.map(hl => {
                          const key = `contact:${hl.contactId}`;
                          const name = hl.contactName || "Contact";
                          const url = `${base}/p/${hl.token}`;
                          // The address rides on the hotlink itself. It used to
                          // be looked up in the loaded contact list, which
                          // silently produced an empty "To:" for any contact
                          // outside that window.
                          const contactEmail =
                            hl.contactEmail ?? allContacts.find(c => c.id === hl.contactId)?.email ?? null;
                          return (
                            <div key={hl.hotlinkId} className="flex items-center hover:bg-muted/60 transition-colors">
                              <button
                                disabled={busyKey !== null}
                                onClick={() => void copyPreview({ key, pageId: row.pageId, pageUrl: url, title: row.pageTitle })}
                                className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-left disabled:opacity-60"
                              >
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                                  {initials(name)}
                                </div>
                                <span className="flex-1 min-w-0 text-xs text-foreground truncate">{name}</span>
                                {busyKey === key
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                                  : copiedKey === key
                                    ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    : <Copy className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
                              </button>
                              <ComposeButtons
                                variant="row"
                                disabled={busyKey !== null}
                                name={name}
                                email={contactEmail}
                                onCompose={target => void copyPreview({
                                  key, pageId: row.pageId, pageUrl: url, title: row.pageTitle,
                                  compose: { target, to: contactEmail, firstName: name },
                                })}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground px-3 py-3">Type at least 2 characters to find a contact — a unique tracked link is created for them.</p>
                  )
                ) : contactsLoading ? (
                  <div className="p-3 flex flex-col gap-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-5 w-full rounded" />)}
                  </div>
                ) : matches.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-3">No contacts match "{q}".</p>
                ) : (
                  <div className="max-h-52 overflow-y-auto divide-y divide-border/40">
                    {matches.map(c => {
                      const key = `contact:${c.id}`;
                      const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.email || "Contact";
                      const hasLink = linkedIds.has(c.id);
                      return (
                        <div key={c.id} className="flex items-center hover:bg-muted/60 transition-colors">
                          <button
                            disabled={busyKey !== null}
                            onClick={() => void copyPersonalizedPreview(row, c)}
                            className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-left disabled:opacity-60"
                          >
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                              {initials(name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-foreground truncate">{name}</div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {[c.title, c.accountName].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                            {hasLink && (
                              <span className="text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">Has link</span>
                            )}
                            {busyKey === key
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                              : copiedKey === key
                                ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                : <Copy className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
                          </button>
                          <ComposeButtons
                            variant="row"
                            disabled={busyKey !== null}
                            name={name}
                            email={c.email}
                            onCompose={target => void copyPersonalizedPreview(row, c, target)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
