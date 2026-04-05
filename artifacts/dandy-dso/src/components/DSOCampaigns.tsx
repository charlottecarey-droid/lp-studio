import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import DOMPurify from "dompurify";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import PaginationControls from "@/components/PaginationControls";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { List, FileText, Send, BarChart3, Trash2, Users, Search, CheckSquare, Pencil, X, Play, Check, Info, ChevronDown, ChevronUp, Bold, Italic, Link as LinkIcon, Globe, Monitor, Smartphone, Copy, Image, Columns, Type, AlignLeft, Mail } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmailWYSIWYGEditor, toEmailHTML, type EmailEditorHandle } from "@/components/EmailWYSIWYGEditor";

type Contact = {
  id: string;
  parent_company: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  title_level: string | null;
  department: string | null;
  dso_size: string | null;
  pe_firm: string | null;
  email: string | null;
};

type SavedList = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
};

type MarketingTemplate = {
  id: string;
  name: string;
  subject: string;
  html_body: string | null;
  plain_body: string | null;
  format: string;
  created_at: string;
  updated_at: string;
};

const ALL_VALUE = "__all__";
const PAGE_SIZE = 1000;

const DSOCampaigns = () => {
  const [subTab, setSubTab] = useState("lists");

  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Campaigns</h1>
        <p className="text-sm text-muted-foreground">Manage contact lists, email templates, and marketing campaigns.</p>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="lists" className="gap-1.5"><List className="w-3.5 h-3.5" />Lists</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Templates</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5"><Send className="w-3.5 h-3.5" />Campaigns</TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="lists"><ListManager /></TabsContent>
        <TabsContent value="templates"><TemplateEditor /></TabsContent>
        <TabsContent value="campaigns"><CampaignBuilder /></TabsContent>
        <TabsContent value="dashboard"><CampaignDashboard /></TabsContent>
      </Tabs>
    </div>
  );
};

/* ════════════════════════════════ List Manager ════════════════════════════════ */

const ListManager = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [companySearch, setCompanySearch] = useState("");
  const [titleLevel, setTitleLevel] = useState(ALL_VALUE);
  const [department, setDepartment] = useState(ALL_VALUE);
  const [dsoSize, setDsoSize] = useState(ALL_VALUE);
  const [peFirm, setPeFirm] = useState(ALL_VALUE);

  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [titleLevels, setTitleLevels] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [dsoSizes, setDsoSizes] = useState<string[]>([]);
  const [peFirms, setPeFirms] = useState<string[]>([]);

  // Paginated load — fetches all contacts in chunks of PAGE_SIZE
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const allRows: Contact[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data } = await supabase
          .from("target_contacts")
          .select("id, parent_company, first_name, last_name, title, title_level, department, dso_size, pe_firm, email")
          .range(from, from + PAGE_SIZE - 1);

        const chunk = (data || []) as Contact[];
        allRows.push(...chunk);
        hasMore = chunk.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      setContacts(allRows);

      const unique = (key: keyof Contact) =>
        [...new Set(allRows.map((r) => r[key]).filter(Boolean) as string[])].sort();

      setTitleLevels(unique("title_level"));
      setDepartments(unique("department"));
      setDsoSizes(unique("dso_size"));
      setPeFirms(unique("pe_firm"));
      setLoading(false);
    };
    load();
  }, []);

  const loadLists = useCallback(async () => {
    const { data: lists } = await supabase
      .from("email_lists")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: false });

    if (!lists) { setSavedLists([]); return; }

    const { data: members } = await supabase
      .from("email_list_members")
      .select("list_id");

    const countMap: Record<string, number> = {};
    (members || []).forEach((m: any) => {
      countMap[m.list_id] = (countMap[m.list_id] || 0) + 1;
    });

    setSavedLists(lists.map((l: any) => ({
      ...l,
      member_count: countMap[l.id] || 0,
    })));
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (companySearch && !c.parent_company.toLowerCase().includes(companySearch.toLowerCase())) return false;
      if (titleLevel !== ALL_VALUE && c.title_level !== titleLevel) return false;
      if (department !== ALL_VALUE && c.department !== department) return false;
      if (dsoSize !== ALL_VALUE && c.dso_size !== dsoSize) return false;
      if (peFirm !== ALL_VALUE && c.pe_firm !== peFirm) return false;
      return true;
    });
  }, [contacts, companySearch, titleLevel, department, dsoSize, peFirm]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      filtered.forEach((c) => next.delete(c.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filtered.forEach((c) => next.add(c.id));
      setSelectedIds(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleSave = async () => {
    if (!listName.trim()) { toast.error("List name is required"); return; }
    if (selectedIds.size === 0) { toast.error("Select at least one contact"); return; }

    setSaving(true);
    const { data: list, error } = await supabase
      .from("email_lists")
      .insert({ name: listName.trim(), description: listDescription.trim() || null })
      .select("id")
      .single();

    if (error || !list) { toast.error("Failed to create list"); setSaving(false); return; }

    // Insert members in batches of 500
    const ids = [...selectedIds];
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500).map((contact_id) => ({ list_id: list.id, contact_id }));
      await supabase.from("email_list_members").insert(batch);
    }

    toast.success(`List "${listName}" saved with ${selectedIds.size} contacts`);
    setListName("");
    setListDescription("");
    setSelectedIds(new Set());
    setSaving(false);
    loadLists();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("email_lists").delete().eq("id", id);
    if (error) toast.error("Failed to delete list");
    else { toast.success("List deleted"); loadLists(); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Search className="w-4 h-4" /> Filter Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Search company name…" value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <FilterSelect label="Title Level" value={titleLevel} onChange={setTitleLevel} options={titleLevels} />
              <FilterSelect label="Department" value={department} onChange={setDepartment} options={departments} />
              <FilterSelect label="DSO Size" value={dsoSize} onChange={setDsoSize} options={dsoSizes} />
              <FilterSelect label="PE Firm" value={peFirm} onChange={setPeFirm} options={peFirms} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
                of {contacts.length} contacts match
                {selectedIds.size > 0 && (
                  <> · <span className="font-semibold text-foreground">{selectedIds.size}</span> selected</>
                )}
              </p>
              <Button variant="outline" size="sm" onClick={toggleAll} className="gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                {allSelected ? "Deselect all" : `Select all ${filtered.length}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Loading contacts…</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No contacts match your filters.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Name</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Company</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => toggleOne(c.id)}>
                        <TableCell>
                          <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{c.first_name} {c.last_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.title || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.parent_company}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> Save as List
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="List name *" value={listName} onChange={(e) => setListName(e.target.value)} />
            <Input placeholder="Description (optional)" value={listDescription} onChange={(e) => setListDescription(e.target.value)} />
            <Button onClick={handleSave} disabled={saving || selectedIds.size === 0} className="w-full">
              {saving ? "Saving…" : `Save List (${selectedIds.size} contacts)`}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Saved Lists</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {savedLists.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No lists saved yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Members</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedLists.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{l.name}</p>
                        {l.description && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {new Date(l.created_at).toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{l.member_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* ════════════════════════════════ Template Editor ════════════════════════════════ */

const MERGE_VARS_SUBJECT = ["{{first_name}}", "{{last_name}}", "{{company}}"];
const MERGE_VARS_BODY = ["{{first_name}}", "{{last_name}}", "{{company}}", "{{microsite_url}}"];
const SAMPLE_VALUES: Record<string, string> = {
  "{{first_name}}": "Sarah",
  "{{last_name}}": "Johnson",
  "{{company}}": "Heartland Dental",
  "{{microsite_url}}": "https://dandy.com/hs/heartland",
};

const renderPreview = (text: string) => {
  let result = text;
  for (const [k, v] of Object.entries(SAMPLE_VALUES)) {
    result = result.split(k).join(v);
  }
  return result;
};

const insertAtCursor = (
  ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  value: string,
  currentValue: string,
  setter: (v: string) => void,
) => {
  const el = ref.current;
  if (!el) { setter(currentValue + value); return; }
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? start;
  const next = currentValue.slice(0, start) + value + currentValue.slice(end);
  setter(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + value.length;
    el.setSelectionRange(pos, pos);
  });
};

const wrapSelection = (
  ref: React.RefObject<HTMLTextAreaElement>,
  tag: string,
  currentValue: string,
  setter: (v: string) => void,
) => {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? start;
  const selected = currentValue.slice(start, end);
  if (!selected) { toast.info("Select some text first"); return; }
  const wrapped = `<${tag}>${selected}</${tag}>`;
  const next = currentValue.slice(0, start) + wrapped + currentValue.slice(end);
  setter(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + wrapped.length;
    el.setSelectionRange(pos, pos);
  });
};

const InsertLinkPopover = ({ bodyRef, body, setBody }: { bodyRef: React.RefObject<HTMLTextAreaElement>; body: string; setBody: (v: string) => void }) => {
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("https://");
  const [open, setOpen] = useState(false);

  const handleInsert = () => {
    if (!linkText.trim() || !linkUrl.trim()) { toast.error("Both fields are required"); return; }
    const html = `<a href="${linkUrl.trim()}">${linkText.trim()}</a>`;
    insertAtCursor(bodyRef, html, body, setBody);
    setLinkText("");
    setLinkUrl("https://");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs px-2">
          <LinkIcon className="w-3 h-3" /> Link
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-3" align="start">
        <div>
          <label className="text-[11px] text-muted-foreground mb-0.5 block">Link Text</label>
          <Input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="Click here" className="text-sm h-8" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-0.5 block">URL</label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" className="text-sm h-8" />
        </div>
        <Button size="sm" onClick={handleInsert} className="w-full h-7 text-xs">Insert Link</Button>
      </PopoverContent>
    </Popover>
  );
};

const DANDY_BANNER_URL = "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/dandy-email-banner.png";

const DANDY_LOGO_DARK_URL = "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/dandy-logo-dark.png";
const DANDY_LOGO_WHITE_URL = "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/dandy-logo-white.png";

const EMAIL_HEADER = `<div style="background:#ffffff;padding:24px 48px;"><img src="${DANDY_LOGO_DARK_URL}" alt="Dandy" style="height:32px;display:block;" /></div>`;
const EMAIL_DIVIDER = `<hr style="border:none;border-top:1px solid #e8e8e8;margin:0;" />`;
const ICON_FB = "https://go.meetdandy.com/rs/103-HKO-179/images/flex_em_dandy_facebook.png";
const ICON_IG = "https://go.meetdandy.com/rs/103-HKO-179/images/flex_em_dandy_instagram.png";
const ICON_TW = "https://go.meetdandy.com/rs/103-HKO-179/images/flex_em_dandy_twitter.png";
const ICON_LI = "https://go.meetdandy.com/rs/103-HKO-179/images/flex_em_dandy_linkedin.png";
const EMAIL_FOOTER = `<div style="background:#1a3a2a;padding:40px 48px;font-family:Arial,Helvetica,sans-serif;">` +
  `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr>` +
  `<td style="text-align:left;"><a href="https://www.facebook.com/meetdandy" style="display:inline-block;margin-right:10px;"><img src="${ICON_FB}" alt="Facebook" style="width:28px;height:28px;" /></a><a href="https://www.instagram.com/meet.dandy" style="display:inline-block;margin-right:10px;"><img src="${ICON_IG}" alt="Instagram" style="width:28px;height:28px;" /></a><a href="https://x.com/meet_dandy" style="display:inline-block;margin-right:10px;"><img src="${ICON_TW}" alt="Twitter" style="width:28px;height:28px;" /></a><a href="https://www.linkedin.com/company/dandyofficial/" style="display:inline-block;"><img src="${ICON_LI}" alt="LinkedIn" style="width:28px;height:28px;" /></a></td>` +
  `<td style="text-align:right;"><a href="#" style="color:#9ca89e;font-size:13px;text-decoration:underline;font-family:Arial,Helvetica,sans-serif;">Forward to a Friend</a></td>` +
  `</tr></table>` +
  `<div style="text-align:center;">` +
  `<img src="${DANDY_LOGO_WHITE_URL}" alt="Dandy" style="height:36px;display:inline-block;margin-bottom:20px;" />` +
  `<p style="font-size:13px;line-height:20px;color:#9ca89e;margin:0 0 2px;">22 Cortlandt Street, 30th Floor</p>` +
  `<p style="font-size:13px;line-height:20px;color:#9ca89e;margin:0 0 20px;">New York, NY 10007</p>` +
  `<p style="font-size:12px;line-height:18px;color:#9ca89e;margin:0 0 4px;">This email was sent to {{email}}, if you no longer want to receive emails,</p>` +
  `<p style="font-size:12px;line-height:18px;color:#9ca89e;margin:0 0 20px;"><a href="{{unsubscribe_url}}" style="color:#9ca89e;text-decoration:underline;">unsubscribe here</a>.</p>` +
  `<p style="font-size:12px;color:#9ca89e;margin:0;">&copy; ${new Date().getFullYear()} Dandy, Inc. All Rights Reserved.</p>` +
  `</div></div>`;
const EMAIL_CTA = (text: string, href = "{{microsite_url}}") => `<div style="text-align:center;padding:8px 0 32px;"><a href="${href}" style="display:inline-block;background:#1a3a2a;color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;padding:16px 32px;border-radius:4px;text-decoration:none;width:200px;text-align:center;font-family:Arial,Helvetica,sans-serif;">${text}</a></div>`;
const EMAIL_SIGNATURE = `${EMAIL_DIVIDER}<div style="padding:24px 48px;"><p style="font-size:16px;font-weight:bold;color:#1a1a1a;margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;">{{sender_name}}</p><p style="font-size:14px;color:#555555;margin:0;font-family:Arial,Helvetica,sans-serif;">Dandy DSO Partnerships</p></div>`;
const EMAIL_WRAP = (inner: string, previewText?: string) => {
  const preheader = previewText ? `<div style="display:none;font-size:1px;color:#f4f4f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}${"&zwnj;&nbsp;".repeat(80)}</div>` : "";
  return `<div style="background:#f4f4f4;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">${preheader}<div style="max-width:600px;margin:0 auto;background:#ffffff;">${inner}</div></div>`;
};

/* ── Build full email HTML from body content + chrome options ── */
const buildFullEmailHTML = (bodyContent: string, options: {
  showBanner?: boolean;
  ctaText?: string;
  ctaUrl?: string;
  showSignature?: boolean;
  previewText?: string;
}) => {
  const parts: string[] = [EMAIL_HEADER];
  if (options.showBanner) {
    parts.push(`<div style="font-size:0;line-height:0;"><img src="${DANDY_BANNER_URL}" alt="Dandy" style="width:100%;display:block;" /></div>`);
  }
  parts.push(EMAIL_DIVIDER);
  parts.push(`<div style="padding:40px 48px;">${bodyContent}</div>`);
  if (options.ctaText) {
    parts.push(EMAIL_CTA(options.ctaText, options.ctaUrl || "{{microsite_url}}"));
  }
  if (options.showSignature) {
    parts.push(EMAIL_SIGNATURE);
  }
  parts.push(EMAIL_FOOTER);
  return EMAIL_WRAP(parts.join(""), options.previewText);
};

interface StyledStarterTemplate {
  label: string;
  description: string;
  name: string;
  subject: string;
  format: "styled";
  bodyContent: string;
  ctaText: string;
  showBanner: boolean;
  showSignature: boolean;
  previewText?: string;
}

const STYLED_STARTER_TEMPLATES: StyledStarterTemplate[] = [
  {
    label: "Gift Outreach",
    description: "Gift-led intro with a claim CTA and hero image",
    name: "Gift Outreach",
    subject: "{{first_name}}, you have a gift waiting",
    format: "styled",
    showBanner: true,
    ctaText: "CLAIM YOUR GIFT",
    showSignature: false,
    previewText: "A little something from the Dandy team — claim it before it expires.",
    bodyContent: `<p style="font-size:18px;font-weight:bold;line-height:26px;color:#1a1a1a;margin:0 0 16px;">Hi {{first_name}}, your welcome gift is still waiting.</p><p style="font-size:16px;line-height:26px;color:#1a1a1a;margin:0 0 16px;">We put something together for the {{company}} team as a thank-you for exploring what Dandy can do for your practices. It only takes a moment to claim.</p><p style="font-size:16px;line-height:26px;color:#1a1a1a;margin:0;">No strings attached — just a small token from our team to yours.</p>`,
  },
  {
    label: "Case Study Share",
    description: "Share a DSO success story with a CTA to view their microsite",
    name: "Case Study — Apex Dental",
    subject: "How Apex Dental cut remake rates by 78%",
    format: "styled",
    showBanner: true,
    ctaText: "SEE THE FULL STORY",
    showSignature: true,
    previewText: "See how one DSO cut remake rates by 78% with Dandy.",
    bodyContent: `<p style="font-size:16px;line-height:26px;color:#1a1a1a;margin:0 0 16px;">Hi {{first_name}},</p><p style="font-size:16px;line-height:26px;color:#1a1a1a;margin:0 0 16px;">Apex Dental Partners struggled with inconsistent lab quality across 45+ locations. After switching to Dandy they reduced remake rates by 78% and cut average turnaround by 3 days.</p><p style="font-size:16px;line-height:26px;color:#1a1a1a;margin:0 0 16px;">I put together a <a href="{{microsite_url}}" style="color:#1a3a2a;font-weight:bold;text-decoration:underline;">personalized breakdown for {{company}}</a> showing how similar results could look at your scale.</p>`,
  },
  {
    label: "Quick Follow-Up",
    description: "Short, conversational follow-up with a connect CTA",
    name: "Quick Follow-Up",
    subject: "Following up, {{first_name}}",
    format: "styled",
    showBanner: false,
    ctaText: "LET'S CONNECT",
    showSignature: true,
    previewText: "Quick note — your personalized overview is still live.",
    bodyContent: `<p style="font-size:16px;line-height:26px;color:#1a1a1a;margin:0 0 16px;">Hi {{first_name}},</p><p style="font-size:16px;line-height:26px;color:#1a1a1a;margin:0 0 16px;">Just circling back on my previous note. I know things move fast — wanted to make sure this didn't get buried.</p><p style="font-size:16px;line-height:26px;color:#1a1a1a;margin:0 0 16px;">Your <a href="{{microsite_url}}" style="color:#1a3a2a;font-weight:bold;text-decoration:underline;">personalized overview</a> is still live if you'd like a quick look. Happy to walk through it in 15 minutes whenever works.</p>`,
  },
];

const PLAIN_STARTER_TEMPLATES = [
  {
    label: "Intro Outreach",
    description: "Short intro email introducing Dandy to a DSO",
    name: "Intro Outreach",
    subject: "{{first_name}}, a smarter lab partner for {{company}}",
    format: "plain" as const,
    body: "Hi {{first_name}},\n\nI'm reaching out because {{company}} may benefit from a modern approach to dental lab workflows. Dandy's digital platform helps DSOs like yours cut turnaround times, reduce remakes, and simplify case management across every location.\n\nI put together a brief overview tailored to {{company}} — you can view it here: {{microsite_url}}\n\nWould you be open to a quick conversation this week?\n\nBest,\nDandy DSO Partnerships",
  },
  {
    label: "Follow-Up",
    description: "Brief follow-up referencing a previous conversation",
    name: "Follow-Up",
    subject: "Following up, {{first_name}}",
    format: "plain" as const,
    body: "Hi {{first_name}},\n\nJust circling back on my previous note about how Dandy can support {{company}}'s lab workflow. I know things get busy — wanted to make sure this didn't slip through the cracks.\n\nYour personalized overview is still available: {{microsite_url}}\n\nWould a 15-minute call next week work?\n\nThanks,\nDandy DSO Partnerships",
  },
];

const InsertImagePopover = ({ bodyRef, body, setBody }: { bodyRef: React.RefObject<HTMLTextAreaElement>; body: string; setBody: (v: string) => void }) => {
  const [imgUrl, setImgUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [open, setOpen] = useState(false);

  const handleInsert = () => {
    if (!imgUrl.trim()) { toast.error("Image URL is required"); return; }
    const html = `<img src="${imgUrl.trim()}" alt="${altText.trim() || ""}" style="max-width:100%;display:block;margin:16px 0;" />`;
    insertAtCursor(bodyRef, html, body, setBody);
    setImgUrl(""); setAltText(""); setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs px-2"><Image className="w-3 h-3" /> Image</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-3" align="start">
        <div>
          <label className="text-[11px] text-muted-foreground mb-0.5 block">Image URL</label>
          <Input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://..." className="text-sm h-8" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-0.5 block">Alt Text</label>
          <Input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Describe the image" className="text-sm h-8" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleInsert} className="flex-1 h-7 text-xs">Insert</Button>
          <Button size="sm" variant="outline" onClick={() => {
            insertAtCursor(bodyRef, `<img src="${DANDY_BANNER_URL}" alt="Dandy" style="width:100%;display:block;" />`, body, setBody);
            setOpen(false);
          }} className="flex-1 h-7 text-xs">Dandy Banner</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const TemplateEditor = () => {
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [format, setFormat] = useState<"plain" | "styled">("plain");
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const editorRef = useRef<EmailEditorHandle>(null);

  // Email chrome controls (styled mode only)
  const [showBanner, setShowBanner] = useState(true);
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("{{microsite_url}}");
  const [showSignature, setShowSignature] = useState(true);
  const [previewText, setPreviewText] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [showTestPopover, setShowTestPopover] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const previewTextRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase.from("marketing_templates").select("*").order("created_at", { ascending: false });
    setTemplates((data || []).map((d: any) => ({ ...d, format: d.format || "plain" })) as MarketingTemplate[]);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Build full email for preview and saving
  const getFullStyledHTML = useCallback(() => {
    const bodyContent = editorRef.current?.getHTML() || body;
    return buildFullEmailHTML(bodyContent, { showBanner, ctaText: ctaText.trim() || undefined, ctaUrl: ctaUrl.trim() || undefined, showSignature, previewText: previewText.trim() || undefined });
  }, [body, showBanner, ctaText, ctaUrl, showSignature, previewText]);

  // Live preview HTML for styled mode
  const styledPreviewHTML = useMemo(() => {
    if (format !== "styled") return "";
    return buildFullEmailHTML(body, { showBanner, ctaText: ctaText.trim() || undefined, ctaUrl: ctaUrl.trim() || undefined, showSignature, previewText: previewText.trim() || undefined });
  }, [format, body, showBanner, ctaText, ctaUrl, showSignature, previewText]);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) { toast.error("Name and subject are required"); return; }
    setSaving(true);
    const payload: any = { name: name.trim(), subject: subject.trim(), format, updated_at: new Date().toISOString() };
    if (format === "styled") {
      payload.html_body = getFullStyledHTML(); payload.plain_body = null;
    } else { payload.plain_body = body; payload.html_body = null; }

    if (editingId) {
      const { error } = await supabase.from("marketing_templates").update(payload).eq("id", editingId);
      if (error) toast.error("Failed to update template"); else toast.success("Template updated");
    } else {
      const { data, error } = await supabase.from("marketing_templates").insert(payload).select("id").single();
      if (error) toast.error("Failed to create template");
      else {
        toast.success("Template saved");
        setEditingId(data.id);
      }
    }
    setSaving(false); loadTemplates();
  };

  const handleSendTest = async () => {
    if (!testEmail.trim() || !subject.trim()) { toast.error("Enter a test email and subject"); return; }
    setSendingTest(true);
    try {
      const payload: any = { to: testEmail.trim(), subject, format };
      if (format === "styled") {
        payload.html_body = getFullStyledHTML();
      } else {
        payload.plain_body = body;
      }
      const { data, error } = await supabase.functions.invoke("send-test-email", { body: payload });
      if (error) throw error;
      toast.success(`Test email sent to ${testEmail.trim()}`);
      setShowTestPopover(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const clearForm = () => {
    setEditingId(null); setName(""); setSubject(""); setBody(""); setFormat("plain");
    setShowBanner(true); setCtaText(""); setCtaUrl("{{microsite_url}}"); setShowSignature(true); setPreviewText("");
    editorRef.current?.setContent("");
  };

  const handleEdit = (t: MarketingTemplate) => {
    setEditingId(t.id); setName(t.name); setSubject(t.subject);
    const fmt = (t.format === "styled" ? "styled" : "plain") as "plain" | "styled";
    setFormat(fmt);
    const content = fmt === "styled" ? (t.html_body || "") : (t.plain_body || t.html_body || "");
    setBody(content);
    if (fmt === "styled") setTimeout(() => editorRef.current?.setContent(content), 50);
  };

  const handleDuplicate = (t: MarketingTemplate) => {
    setEditingId(null);
    setName(t.name + " (Copy)");
    setSubject(t.subject);
    const fmt = (t.format === "styled" ? "styled" : "plain") as "plain" | "styled";
    setFormat(fmt);
    const content = fmt === "styled" ? (t.html_body || "") : (t.plain_body || t.html_body || "");
    setBody(content);
    if (fmt === "styled") setTimeout(() => editorRef.current?.setContent(content), 50);
    toast.info("Template loaded as a copy — edit and save as new.");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("marketing_templates").delete().eq("id", id);
    if (error) toast.error("Failed to delete"); else { toast.success("Template deleted"); loadTemplates(); }
    if (editingId === id) clearForm();
  };

  const loadStarter = (starter: StyledStarterTemplate | { name: string; subject: string; body: string; label: string; format: string }) => {
    setEditingId(null); setName(starter.name); setSubject(starter.subject);
    setFormat(starter.format as "plain" | "styled");
    if ("bodyContent" in starter) {
      // Styled starter — load body content only, set chrome controls
      setBody(starter.bodyContent);
      setShowBanner(starter.showBanner);
      setCtaText(starter.ctaText);
      setShowSignature(starter.showSignature);
      setPreviewText(starter.previewText || "");
      setTimeout(() => editorRef.current?.setContent(starter.bodyContent), 50);
    } else {
      setBody(starter.body);
      if (starter.format === "styled") setTimeout(() => editorRef.current?.setContent(starter.body), 50);
    }
    toast.success(`Loaded "${starter.label}" — edit and save when ready`);
  };

  const insert2Col = () => {
    const html = `<h2>Left column</h2><p>Content here</p><hr/><h2>Right column</h2><p>Content here</p>`;
    insertAtCursor(bodyRef, html, body, setBody);
  };

  const currentStarters = format === "styled" ? STYLED_STARTER_TEMPLATES : PLAIN_STARTER_TEMPLATES;

  return (
    <div className="space-y-6">
      {/* Format toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Format:</span>
        <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 bg-muted/30">
          <button onClick={() => { if (format !== "plain") { setFormat("plain"); setBody(""); } }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${format === "plain" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <AlignLeft className="w-3.5 h-3.5" /> Plain Text
          </button>
          <button onClick={() => { if (format !== "styled") { setFormat("styled"); setBody(""); } }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${format === "styled" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Type className="w-3.5 h-3.5" /> Styled Email
          </button>
        </div>
      </div>

      {/* Starter templates */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Start from a template</h3>
        <div className={`grid grid-cols-1 gap-3 ${currentStarters.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {currentStarters.map((st) => (
            <button key={st.label} onClick={() => loadStarter(st)}
              className="group text-left border border-border rounded-lg p-4 hover:border-primary/40 hover:shadow-md transition-all duration-200 active:scale-[0.98] bg-card">
              <div className="flex items-start gap-2.5">
                <Copy className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 group-hover:text-primary transition-colors" />
                <div>
                  <p className="text-sm font-medium text-foreground">{st.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{st.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {editingId ? "Edit Template" : "New Template"}
              <Badge variant="secondary" className="text-[10px] ml-auto">{format === "styled" ? "HTML" : "Plain Text"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Template Name</label>
              <Input placeholder="e.g. Q1 DSO Outreach" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject Line</label>
              <Input ref={subjectRef} placeholder="e.g. {{first_name}}, see how Dandy saves {{company}} time" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <MergeVarButtons vars={MERGE_VARS_SUBJECT} inputRef={subjectRef} currentValue={subject} setter={setSubject} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Preview Text <span className="font-normal text-muted-foreground/60">(shown in inbox next to subject)</span></label>
              <Input ref={previewTextRef} placeholder="e.g. {{first_name}}, a quick look at how Dandy can help {{company}}" value={previewText} onChange={(e) => setPreviewText(e.target.value)} />
              <MergeVarButtons vars={MERGE_VARS_SUBJECT} inputRef={previewTextRef} currentValue={previewText} setter={setPreviewText} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Body</label>
              {format === "styled" ? (
                <EmailWYSIWYGEditor
                  ref={editorRef}
                  initialContent={body}
                  onChange={(html) => setBody(html)}
                  dandyBannerUrl={DANDY_BANNER_URL}
                />
              ) : (
                <>
                  <MergeVarButtons vars={MERGE_VARS_BODY} inputRef={bodyRef} currentValue={body} setter={setBody} />
                  <Textarea ref={bodyRef}
                    placeholder="Write your email body here…&#10;&#10;Use merge variables like {{first_name}} to personalize."
                    value={body} onChange={(e) => setBody(e.target.value)}
                    className="min-h-[300px] text-sm font-mono" />
                </>
              )}
            </div>
            {format === "styled" && (
              <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email Layout</p>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={showBanner} onChange={(e) => setShowBanner(e.target.checked)} className="rounded border-border" />
                    <span className="text-foreground">Hero Banner</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={showSignature} onChange={(e) => setShowSignature(e.target.checked)} className="rounded border-border" />
                    <span className="text-foreground">Signature Block</span>
                  </label>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA Button Text <span className="text-muted-foreground/60">(leave empty to hide)</span></label>
                  <Input placeholder="e.g. CLAIM YOUR GIFT" value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="text-sm h-8" />
                </div>
                {ctaText.trim() && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA Button URL</label>
                    <Input placeholder="{{microsite_url}}" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="text-sm h-8 font-mono" />
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? "Saving…" : editingId ? "Update Template" : "Save Template"}</Button>
              <Popover open={showTestPopover} onOpenChange={setShowTestPopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={!subject.trim() || !body} className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Send Test</Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Send a test email</p>
                    <p className="text-xs text-muted-foreground">Merge variables will be filled with sample data. Subject will be prefixed with [TEST].</p>
                    <Input placeholder="your@email.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} className="text-sm h-8" />
                    <Button onClick={handleSendTest} disabled={sendingTest || !testEmail.trim()} className="w-full gap-1.5" size="sm">
                      <Send className="w-3.5 h-3.5" /> {sendingTest ? "Sending…" : "Send Test Email"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {editingId && (
                <Button variant="secondary" onClick={clearForm} className="gap-1.5"><FileText className="w-3.5 h-3.5" /> New Template</Button>
              )}
              {(name || subject || body) && (
                <Button variant="outline" onClick={clearForm} className="gap-1.5"><X className="w-3.5 h-3.5" /> Clear</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Live Preview</CardTitle>
            <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5 bg-muted/30">
              <button onClick={() => setPreviewMode("desktop")}
                className={`p-1.5 rounded transition-colors ${previewMode === "desktop" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`} title="Desktop">
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setPreviewMode("mobile")}
                className={`p-1.5 rounded transition-colors ${previewMode === "mobile" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`} title="Mobile">
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {format === "styled" ? (
              <div className="bg-muted/40 rounded-lg p-4 min-h-[400px] overflow-auto max-h-[700px]">
                <div className={`mx-auto transition-all duration-300 ${previewMode === "mobile" ? "max-w-[375px]" : "max-w-[600px]"}`}>
                  <div className="bg-card rounded-lg overflow-hidden shadow-lg">
                    <div className="bg-muted/60 px-5 py-3 border-b border-border space-y-1">
                      <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">From:</span> Dandy DSO Partnerships &lt;partnerships@dso.meetdandy.com&gt;</p>
                      <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">To:</span> sarah.johnson@heartlanddental.com</p>
                      <p className="text-[11px]"><span className="font-medium text-foreground">Subject:</span> <span className="text-foreground font-medium">{renderPreview(subject) || "(no subject)"}</span></p>
                    </div>
                    <div className="min-h-[300px]">
                      {body ? <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderPreview(styledPreviewHTML)) }} /> : <p className="text-sm text-muted-foreground italic p-6">Start typing to see a preview…</p>}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`mx-auto transition-all duration-300 ${previewMode === "mobile" ? "max-w-[375px]" : "max-w-none"}`}>
                <div className="border border-border rounded-lg overflow-hidden shadow-lg bg-card">
                  <div className="bg-muted/60 px-5 py-3 border-b border-border space-y-1">
                    <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">From:</span> Dandy DSO Partnerships &lt;partnerships@dso.meetdandy.com&gt;</p>
                    <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">To:</span> sarah.johnson@heartlanddental.com</p>
                    <p className="text-[11px]"><span className="font-medium text-foreground">Subject:</span> <span className="text-foreground font-medium">{renderPreview(subject) || "(no subject)"}</span></p>
                  </div>
                  <div className="px-6 py-5 min-h-[300px]">
                    {body ? <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">{renderPreview(body)}</pre> : <p className="text-sm text-muted-foreground italic">Start typing to see a preview…</p>}
                  </div>
                  <div className="border-t border-border px-6 py-3 bg-muted/20">
                    <p className="text-[11px] text-muted-foreground">To unsubscribe, reply STOP to this email.</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Saved templates table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Saved Templates</CardTitle></CardHeader>
        <CardContent className="p-0">
          {templates.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No templates saved yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">{t.name}</TableCell>
                    <TableCell><Badge variant={t.format === "styled" ? "default" : "secondary"} className="text-[10px]">{t.format === "styled" ? "HTML" : "Plain"}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{t.subject}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => handleEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" title="Duplicate" onClick={() => handleDuplicate(t)}><Copy className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => handleDelete(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* ════════════════════════════════ Campaign Builder ═══════════════════════════ */

type Campaign = {
  id: string;
  name: string;
  list_id: string | null;
  template_id: string | null;
  template_b_id: string | null;
  ab_test_enabled: boolean;
  status: string;
  sender_name: string;
  sender_email: string;
  reply_to_email: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  created_at: string;
};

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sending: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  paused: "bg-orange-100 text-orange-800",
};

const CampaignBuilder = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [lists, setLists] = useState<SavedList[]>([]);
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);

  const [campaignName, setCampaignName] = useState("");
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [utmSource, setUtmSource] = useState("dandy_dso");
  const [utmMedium, setUtmMedium] = useState("email");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [senderName, setSenderName] = useState("Dandy DSO Partnerships");
  const [senderEmail, setSenderEmail] = useState("partnerships");
  const [replyToEmail, setReplyToEmail] = useState("sales@meetdandy.com");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [selectedTemplateBId, setSelectedTemplateBId] = useState("");

  // Auto-populate utm_campaign from campaign name
  useEffect(() => {
    if (campaignName) setUtmCampaign(slugify(campaignName));
  }, [campaignName]);

  // Auto-populate utm_content from template name
  useEffect(() => {
    const t = templates.find((t) => t.id === selectedTemplateId);
    if (t) setUtmContent(slugify(t.name));
  }, [selectedTemplateId, templates]);

  const loadData = useCallback(async () => {
    const [{ data: campaignData }, { data: listData }, { data: templateData }, { data: memberData }] = await Promise.all([
      supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("email_lists").select("id, name, description, created_at").order("created_at", { ascending: false }),
      supabase.from("marketing_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("email_list_members").select("list_id"),
    ]);

    setCampaigns((campaignData || []) as Campaign[]);
    setTemplates((templateData || []) as MarketingTemplate[]);

    const countMap: Record<string, number> = {};
    (memberData || []).forEach((m: any) => {
      countMap[m.list_id] = (countMap[m.list_id] || 0) + 1;
    });
    setLists((listData || []).map((l: any) => ({ ...l, member_count: countMap[l.id] || 0 })));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedList = lists.find((l) => l.id === selectedListId);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleSaveDraft = async () => {
    if (!campaignName.trim()) { toast.error("Campaign name is required"); return; }
    if (!selectedListId) { toast.error("Select a list"); return; }
    if (!selectedTemplateId) { toast.error("Select a template"); return; }

    setSaving(true);
    const { error } = await supabase.from("email_campaigns").insert({
      name: campaignName.trim(),
      list_id: selectedListId,
      template_id: selectedTemplateId,
      ab_test_enabled: abTestEnabled,
      template_b_id: abTestEnabled && selectedTemplateBId ? selectedTemplateBId : null,
      status: "draft",
      sender_name: senderName.trim() || "Dandy DSO Partnerships",
      sender_email: senderEmail.trim() || "partnerships",
      reply_to_email: replyToEmail.trim() || "sales@meetdandy.com",
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
    });

    if (error) toast.error("Failed to save campaign");
    else {
      toast.success("Campaign saved as draft");
      clearCampaignForm();
      loadData();
    }
    setSaving(false);
  };

  const handleSendNew = async () => {
    if (!campaignName.trim() || !selectedListId || !selectedTemplateId) {
      toast.error("Fill in all required fields");
      return;
    }

    setSaving(true);
    const { data: campaign, error } = await supabase.from("email_campaigns").insert({
      name: campaignName.trim(),
      list_id: selectedListId,
      template_id: selectedTemplateId,
      ab_test_enabled: abTestEnabled,
      template_b_id: abTestEnabled && selectedTemplateBId ? selectedTemplateBId : null,
      status: "sending",
      sender_name: senderName.trim() || "Dandy DSO Partnerships",
      sender_email: senderEmail.trim() || "partnerships",
      reply_to_email: replyToEmail.trim() || "sales@meetdandy.com",
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
    }).select("id").single();

    if (error || !campaign) { toast.error("Failed to create campaign"); setSaving(false); return; }

    await invokeSendCampaign(campaign.id);
    clearCampaignForm();
    setSaving(false);
    loadData();
  };

  const handleSendExisting = async (campaignId: string) => {
    setSending(campaignId);
    await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);
    await invokeSendCampaign(campaignId);
    setSending(null);
    loadData();
  };

  const invokeSendCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-marketing-campaign", {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      toast.success("Campaign is sending!");
    } catch (e: any) {
      toast.error(`Send failed: ${e.message || "Unknown error"}`);
    }
  };

  const clearCampaignForm = () => {
    setCampaignName("");
    setSelectedListId("");
    setSelectedTemplateId("");
    setAbTestEnabled(false);
    setSelectedTemplateBId("");
    setSenderName("Dandy DSO Partnerships");
    setSenderEmail("partnerships");
    setReplyToEmail("sales@meetdandy.com");
    setUtmSource("dandy_dso");
    setUtmMedium("email");
    setUtmCampaign("");
    setUtmContent("");
  };

  const getListName = (id: string | null) => lists.find((l) => l.id === id)?.name || "—";
  const getTemplateName = (id: string | null) => templates.find((t) => t.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — campaign form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Send className="w-4 h-4" /> New Campaign
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign Name</label>
                <Input placeholder="e.g. Q1 DSO Outreach" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Select List</label>
                  <Select value={selectedListId} onValueChange={setSelectedListId}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Choose a list…" /></SelectTrigger>
                    <SelectContent>
                      {lists.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name} ({l.member_count})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Template</label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Choose a template…" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} — {t.subject.slice(0, 40)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* A/B Test toggle */}
              <div className="border border-border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">A/B Test</label>
                  <button
                    type="button"
                    onClick={() => { setAbTestEnabled((v) => !v); setSelectedTemplateBId(""); }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${abTestEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${abTestEnabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {abTestEnabled && (
                  <div>
                    <label className="text-[11px] text-muted-foreground/70 mb-0.5 block">Template B (variant)</label>
                    <Select value={selectedTemplateBId} onValueChange={setSelectedTemplateBId}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Choose template B…" /></SelectTrigger>
                      <SelectContent>
                        {templates.filter((t) => t.id !== selectedTemplateId).map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name} — {t.subject.slice(0, 40)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">List will be split 50/50. Template A → first half, Template B → second half.</p>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg p-3 space-y-3">
                <label className="text-xs font-medium text-muted-foreground block">Sender Configuration</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[11px] text-muted-foreground/70 mb-0.5 block">Sender Name</label>
                    <Input placeholder="Dandy DSO Partnerships" value={senderName} onChange={(e) => setSenderName(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground/70 mb-0.5 block">Sender Email</label>
                    <div className="flex">
                      <Input placeholder="partnerships" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className="text-sm rounded-r-none" />
                      <span className="inline-flex items-center px-2.5 bg-muted text-muted-foreground text-xs border border-l-0 border-input rounded-r-md whitespace-nowrap">@dso.meetdandy.com</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground/70 mb-0.5 block">Reply-To Email</label>
                    <Input placeholder="sales@meetdandy.com" value={replyToEmail} onChange={(e) => setReplyToEmail(e.target.value)} className="text-sm" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/70">From: {senderName || "Dandy DSO Partnerships"} &lt;{senderEmail || "partnerships"}@dso.meetdandy.com&gt; · Reply-To: {replyToEmail || "sales@meetdandy.com"}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">UTM Parameters</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground/70 mb-0.5 block">utm_source</label>
                    <Input value={utmSource} onChange={(e) => setUtmSource(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground/70 mb-0.5 block">utm_medium</label>
                    <Input value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground/70 mb-0.5 block">utm_campaign</label>
                    <Input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground/70 mb-0.5 block">utm_content</label>
                    <Input value={utmContent} onChange={(e) => setUtmContent(e.target.value)} className="text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="flex-1">
                  Save as Draft
                </Button>
                <Button onClick={handleSendNew} disabled={saving} className="flex-1 gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Send Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right — summary */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Campaign Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">List</p>
              <p className="text-sm font-medium text-foreground">{selectedList?.name || "None selected"}</p>
              {selectedList && <p className="text-xs text-muted-foreground">{selectedList.member_count} recipients</p>}
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Template {abTestEnabled ? "A" : ""}</p>
              <p className="text-sm font-medium text-foreground">{selectedTemplate?.name || "None selected"}</p>
              {selectedTemplate && <p className="text-xs text-muted-foreground truncate">Subject: {selectedTemplate.subject}</p>}
            </div>
            {abTestEnabled && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Template B</p>
                <p className="text-sm font-medium text-foreground">{templates.find((t) => t.id === selectedTemplateBId)?.name || "None selected"}</p>
                {selectedTemplateBId && <p className="text-xs text-muted-foreground truncate">Subject: {templates.find((t) => t.id === selectedTemplateBId)?.subject}</p>}
              </div>
            )}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">UTMs</p>
              <div className="text-xs text-muted-foreground space-y-0.5 font-mono">
                {utmSource && <p>source={utmSource}</p>}
                {utmMedium && <p>medium={utmMedium}</p>}
                {utmCampaign && <p>campaign={utmCampaign}</p>}
                {utmContent && <p>content={utmContent}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Existing campaigns table */}
      <CampaignTable campaigns={campaigns} getListName={getListName} getTemplateName={getTemplateName} sending={sending} handleSendExisting={handleSendExisting} />
    </div>
  );
};

/* ─── Campaign Table with pagination ─── */
const CampaignTable = ({ campaigns, getListName, getTemplateName, sending, handleSendExisting }: { campaigns: Campaign[]; getListName: (id: string | null) => string; getTemplateName: (id: string | null) => string; sending: string | null; handleSendExisting: (id: string) => void }) => {
  const searchFn = useCallback((c: Campaign, q: string) => c.name.toLowerCase().includes(q), []);
  const { paged, page, setPage, pageSize, setPageSize, search, setSearch, totalPages, totalFiltered, PAGE_SIZES } = usePaginatedList(campaigns, searchFn);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">All Campaigns</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <PaginationControls
          page={page} totalPages={totalPages} totalFiltered={totalFiltered}
          pageSize={pageSize} pageSizes={PAGE_SIZES} search={search}
          onPageChange={setPage} onPageSizeChange={setPageSize} onSearchChange={setSearch}
          searchPlaceholder="Search campaigns…"
        />
        {paged.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{search ? "No matching campaigns." : "No campaigns yet."}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>List</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-sm flex items-center gap-2">
                    {c.name}
                    {c.ab_test_enabled && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">A/B</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{getListName(c.list_id)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{getTemplateName(c.template_id)}{c.ab_test_enabled && c.template_b_id ? ` / ${getTemplateName(c.template_b_id)}` : ""}</TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>
                      {c.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {c.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={sending === c.id}
                        onClick={() => handleSendExisting(c.id)}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

/* ════════════════════════════════ Campaign Dashboard ═════════════════════════ */

type CampaignSendRow = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  recipient_email: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  variant: string | null;
};

type DashboardCampaign = Campaign & {
  sends: CampaignSendRow[];
  listName: string;
  templateName: string;
};

const SEND_STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const CampaignDashboard = () => {
  const [campaigns, setCampaigns] = useState<DashboardCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contactMap, setContactMap] = useState<Record<string, { first_name: string; last_name: string; parent_company: string }>>({});

  const dashSearchFn = useCallback((c: DashboardCampaign, q: string) => c.name.toLowerCase().includes(q) || c.listName.toLowerCase().includes(q), []);
  const { paged: pagedDashCampaigns, page: dashPage, setPage: setDashPage, pageSize: dashPageSize, setPageSize: setDashPageSize, search: dashSearch, setSearch: setDashSearch, totalPages: dashTotalPages, totalFiltered: dashTotalFiltered, PAGE_SIZES: dashPAGE_SIZES } =
    usePaginatedList(campaigns, dashSearchFn);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: campData }, { data: sendData }, { data: listData }, { data: templateData }] = await Promise.all([
        supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }),
        supabase.from("email_campaign_sends").select("*"),
        supabase.from("email_lists").select("id, name"),
        supabase.from("marketing_templates").select("id, name"),
      ]);

      const listMap: Record<string, string> = {};
      (listData || []).forEach((l: any) => { listMap[l.id] = l.name; });
      const tmplMap: Record<string, string> = {};
      (templateData || []).forEach((t: any) => { tmplMap[t.id] = t.name; });

      const sendsByCampaign: Record<string, CampaignSendRow[]> = {};
      (sendData || []).forEach((s: any) => {
        if (!sendsByCampaign[s.campaign_id]) sendsByCampaign[s.campaign_id] = [];
        sendsByCampaign[s.campaign_id].push(s);
      });

      // Load contact details for send rows
      const allContactIds = [...new Set((sendData || []).map((s: any) => s.contact_id).filter(Boolean))];
      if (allContactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("target_contacts")
          .select("id, first_name, last_name, parent_company")
          .in("id", allContactIds);
        const map: Record<string, any> = {};
        (contacts || []).forEach((c: any) => { map[c.id] = c; });
        setContactMap(map);
      }

      setCampaigns((campData || []).map((c: any) => ({
        ...c,
        sends: sendsByCampaign[c.id] || [],
        listName: listMap[c.list_id] || "—",
        templateName: tmplMap[c.template_id] || "—",
      })));
      setLoading(false);
    };
    load();
  }, []);

  // Aggregate stats
  const totalSent = campaigns.filter((c) => c.status === "sent" || c.status === "sending").length;
  const allSends = campaigns.flatMap((c) => c.sends);
  const totalEmails = allSends.length;
  const totalOpened = allSends.filter((s) => s.opened_at).length;
  const totalClicked = allSends.filter((s) => s.clicked_at).length;
  const avgOpenRate = totalEmails > 0 ? ((totalOpened / totalEmails) * 100).toFixed(1) : "0.0";
  const avgClickRate = totalEmails > 0 ? ((totalClicked / totalEmails) * 100).toFixed(1) : "0.0";

  if (loading) return <div className="py-12 text-center text-muted-foreground text-sm">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 px-4 py-3 bg-muted/50 border border-border rounded-lg">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Open rates may be inflated due to email client image prefetching (e.g. Apple Mail). Click rate is the more reliable engagement signal.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Campaigns Sent" value={String(totalSent)} />
        <StatCard label="Total Emails" value={String(totalEmails)} />
        <StatCard label="Avg Open Rate" value={`${avgOpenRate}%`} />
        <StatCard label="Avg Click Rate" value={`${avgClickRate}%`} />
      </div>

      {/* Campaigns table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PaginationControls
            page={dashPage} totalPages={dashTotalPages} totalFiltered={dashTotalFiltered}
            pageSize={dashPageSize} pageSizes={dashPAGE_SIZES} search={dashSearch}
            onPageChange={setDashPage} onPageSizeChange={setDashPageSize} onSearchChange={setDashSearch}
            searchPlaceholder="Search campaigns…"
          />
          {pagedDashCampaigns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{dashSearch ? "No matching campaigns." : "No campaigns yet."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Campaign</TableHead>
                  <TableHead>List</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Sent</TableHead>
                  <TableHead className="text-center">Open %</TableHead>
                  <TableHead className="text-center">Click %</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedDashCampaigns.map((c) => {
                  const sendCount = c.sends.length;
                  const openCount = c.sends.filter((s) => s.opened_at).length;
                  const clickCount = c.sends.filter((s) => s.clicked_at).length;
                  const openRate = sendCount > 0 ? ((openCount / sendCount) * 100).toFixed(1) : "—";
                  const clickRate = sendCount > 0 ? ((clickCount / sendCount) * 100).toFixed(1) : "—";
                  const isExpanded = expandedId === c.id;

                  return (
                    <>
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      >
                        <TableCell>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          <span className="flex items-center gap-2">
                            {c.name}
                            {c.ab_test_enabled && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">A/B</span>}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.listName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.templateName}</TableCell>
                        <TableCell>
                          <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>
                            {c.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm">{sendCount}</TableCell>
                        <TableCell className="text-center text-sm">{openRate}{openRate !== "—" ? "%" : ""}</TableCell>
                        <TableCell className="text-center text-sm">{clickRate}{clickRate !== "—" ? "%" : ""}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${c.id}-detail`}>
                          <TableCell colSpan={9} className="bg-muted/20 p-0">
                            <div className="px-6 py-3">
                                {c.ab_test_enabled && c.sends.length > 0 && (() => {
                                const variantStats = (v: string) => {
                                  const rows = c.sends.filter((s) => s.variant === v);
                                  const opens = rows.filter((s) => s.opened_at).length;
                                  const clicks = rows.filter((s) => s.clicked_at).length;
                                  return { count: rows.length, opens, clicks };
                                };
                                const a = variantStats("A");
                                const b = variantStats("B");
                                return (
                                  <div className="grid grid-cols-2 gap-3 mb-3">
                                    {[{ label: "A", stats: a }, { label: "B", stats: b }].map(({ label, stats }) => (
                                      <div key={label} className={`rounded-lg border p-3 ${label === "A" ? "border-blue-200 bg-blue-50" : "border-purple-200 bg-purple-50"}`}>
                                        <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${label === "A" ? "text-blue-600" : "text-purple-600"}`}>Variant {label}</p>
                                        <div className="flex gap-4 text-sm">
                                          <span className="text-muted-foreground">Sent: <strong>{stats.count}</strong></span>
                                          <span className="text-muted-foreground">Opens: <strong>{stats.count > 0 ? ((stats.opens / stats.count) * 100).toFixed(0) : 0}%</strong></span>
                                          <span className="text-muted-foreground">Clicks: <strong>{stats.count > 0 ? ((stats.clicks / stats.count) * 100).toFixed(0) : 0}%</strong></span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                              {c.sends.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No sends recorded for this campaign.</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Recipient</TableHead>
                                      <TableHead>Email</TableHead>
                                      <TableHead>Company</TableHead>
                                      {c.ab_test_enabled && <TableHead className="text-center">Variant</TableHead>}
                                      <TableHead>Status</TableHead>
                                      <TableHead>Sent</TableHead>
                                      <TableHead className="text-center">Opened</TableHead>
                                      <TableHead className="text-center">Clicked</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {c.sends.map((s) => {
                                      const contact = s.contact_id ? contactMap[s.contact_id] : null;
                                      return (
                                        <TableRow key={s.id}>
                                          <TableCell className="text-sm">
                                            {contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "—"}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">{s.recipient_email}</TableCell>
                                          <TableCell className="text-sm text-muted-foreground">{contact?.parent_company || "—"}</TableCell>
                                          {c.ab_test_enabled && (
                                            <TableCell className="text-center">
                                              {s.variant ? (
                                                <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full ${s.variant === "A" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                                  {s.variant}
                                                </span>
                                              ) : <span className="text-muted-foreground/40">—</span>}
                                            </TableCell>
                                          )}
                                          <TableCell>
                                            <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full ${SEND_STATUS_COLORS[s.status] || "bg-muted text-muted-foreground"}`}>
                                              {s.status}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {s.sent_at ? new Date(s.sent_at).toLocaleString() : "—"}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            {s.opened_at ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground/40">—</span>}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            {s.clicked_at ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground/40">—</span>}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <CardContent className="pt-5 pb-4 px-5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </CardContent>
  </Card>
);


const MergeVarButtons = ({
  vars, inputRef, currentValue, setter,
}: {
  vars: string[];
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  currentValue: string;
  setter: (v: string) => void;
}) => (
  <div className="flex flex-wrap gap-1 mt-1">
    {vars.map((v) => (
      <button
        key={v}
        type="button"
        onClick={() => insertAtCursor(inputRef, v, currentValue, setter)}
        className="px-2 py-0.5 text-[11px] font-mono rounded bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
      >
        {v}
      </button>
    ))}
  </div>
);

/* ════════════════════════════ Filter Select Helper ═══════════════════════════ */

const FilterSelect = ({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="text-sm">
      <SelectValue placeholder={label} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={ALL_VALUE}>All {label}s</SelectItem>
      {options.map((o) => (
        <SelectItem key={o} value={o}>{o}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default DSOCampaigns;
