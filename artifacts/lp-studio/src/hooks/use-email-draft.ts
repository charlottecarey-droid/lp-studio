import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "/api";

export interface Account {
  id: number;
  name: string;
}

export interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  accountId?: number;
}

export interface ResearchText {
  person: string;
  linkedin: string;
  company: string;
  site: string;
}

interface EmailDraftResult {
  subject?: string;
  body?: string;
  hasMicrosite?: boolean;
  researchUsed?: boolean;
  sources?: string[];
  hookSource?: string | null;
  emailTheme?: string | null;
  researchText?: ResearchText;
}

export function useEmailDraft(urlContactId: number | null) {
  // ── Data fetching ──────────────────────────────────────────
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);

  // ── Selection ──────────────────────────────────────────────
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(urlContactId ?? null);
  const [searchContact, setSearchContact] = useState("");
  const [searchAccount, setSearchAccount] = useState("");

  // ── Email generation ───────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hasMicrosite, setHasMicrosite] = useState(false);
  const [researchUsed, setResearchUsed] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [hookSource, setHookSource] = useState<string | null>(null);
  const [emailTheme, setEmailTheme] = useState<string | null>(null);
  const [researchText, setResearchText] = useState<ResearchText | null>(null);
  const [error, setError] = useState("");

  // ── Copy ───────────────────────────────────────────────────
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Brief ──────────────────────────────────────────────────
  const [briefLoading, setBriefLoading] = useState(false);
  const [brief, setBrief] = useState("");
  const [briefError, setBriefError] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);

  // ── Derived ────────────────────────────────────────────────
  const selectedContact = allContacts.find((c) => c.id === selectedContactId) ?? null;
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;
  const fullName = selectedContact
    ? [selectedContact.firstName, selectedContact.lastName].filter(Boolean).join(" ")
    : "";

  const filteredAccounts = (searchAccount.trim()
    ? accounts.filter((a) => a.name.toLowerCase().includes(searchAccount.toLowerCase()))
    : accounts
  ).slice().sort((a, b) => a.name.localeCompare(b.name));

  // ── Fetch accounts on mount ────────────────────────────────
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch(`${API_BASE}/sales/accounts`);
        if (res.ok) {
          const data = (await res.json()) as Account[];
          setAccounts(data);
          if (urlContactId) {
            const contactRes = await fetch(`${API_BASE}/sales/contacts/${urlContactId}`);
            if (contactRes.ok) {
              const contact = (await contactRes.json()) as Contact;
              if (contact.accountId) setSelectedAccountId(contact.accountId);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch accounts", err);
      } finally {
        setAccountsLoading(false);
      }
    }
    fetchAccounts();
  }, [urlContactId]);

  // ── Fetch contacts when account changes ────────────────────
  useEffect(() => {
    if (!selectedAccountId) { setContacts([]); return; }

    async function fetchContacts() {
      setContactsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/sales/accounts/${selectedAccountId}/contacts`);
        if (res.ok) {
          const data = (await res.json()) as Contact[];
          setContacts(data);
          setAllContacts(data);
        }
      } catch (err) {
        console.error("Failed to fetch contacts", err);
      } finally {
        setContactsLoading(false);
      }
    }
    fetchContacts();
  }, [selectedAccountId]);

  // ── Filter contacts by search ──────────────────────────────
  useEffect(() => {
    if (!searchContact.trim()) { setContacts(allContacts); return; }
    const query = searchContact.toLowerCase();
    setContacts(
      allContacts.filter(
        (c) =>
          c.firstName.toLowerCase().includes(query) ||
          c.lastName.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.title?.toLowerCase().includes(query)
      )
    );
  }, [searchContact, allContacts]);

  // ── Generate email ─────────────────────────────────────────
  const cancelRef = useRef(false);

  const generateEmail = useCallback(async () => {
    if (!selectedContactId || !selectedAccountId) return;

    cancelRef.current = false;
    setGenerating(true);
    setError("");
    setSubject("");
    setBody("");
    setSources([]);
    setHookSource(null);
    setResearchText(null);
    setBrief("");
    setBriefOpen(false);

    try {
      const res = await fetch(`${API_BASE}/sales/draft-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: selectedContactId, accountId: selectedAccountId }),
      });

      if (cancelRef.current) return;
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Failed to generate email");
      }

      const data = (await res.json()) as EmailDraftResult;

      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
      setHasMicrosite(!!data.hasMicrosite);
      setResearchUsed(!!data.researchUsed);
      setSources(data.sources ?? []);
      setHookSource(data.hookSource ?? null);
      setEmailTheme(data.emailTheme ?? null);
      setResearchText(data.researchText ?? null);
    } catch (err) {
      if (!cancelRef.current) {
        setError(err instanceof Error ? err.message : "Error generating email");
      }
    } finally {
      if (!cancelRef.current) setGenerating(false);
    }
  }, [selectedContactId, selectedAccountId]);

  // Auto-generate when contact is selected
  useEffect(() => {
    if (!selectedContactId || !selectedAccountId) return;
    generateEmail();
    return () => { cancelRef.current = true; };
  }, [selectedContactId, selectedAccountId, generateEmail]);

  // ── Generate brief ─────────────────────────────────────────
  const generateBrief = useCallback(async () => {
    if (briefLoading || !selectedContactId || !selectedAccountId) return;

    setBriefLoading(true);
    setBriefError("");
    setBrief("");
    setBriefOpen(true);

    try {
      const res = await fetch(`${API_BASE}/sales/person-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: selectedContactId, accountId: selectedAccountId, researchText }),
      });

      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Failed to generate brief");
      }

      const data = (await res.json()) as { brief?: string };
      setBrief(data.brief ?? "");
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "Error generating brief");
    } finally {
      setBriefLoading(false);
    }
  }, [briefLoading, selectedContactId, selectedAccountId, researchText]);

  // ── Copy helpers ───────────────────────────────────────────
  function copySubject() {
    navigator.clipboard.writeText(subject);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 1800);
  }

  function copyFull() {
    const currentBody = textareaRef.current?.value ?? body;
    const full = subject ? `Subject: ${subject}\n\n${currentBody}` : currentBody;
    navigator.clipboard.writeText(full);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 1800);
  }

  function openInEmailClient() {
    if (!selectedContact?.email) return;
    const currentBody = textareaRef.current?.value ?? body;
    window.location.href = `mailto:${selectedContact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(currentBody)}`;
  }

  function openInGmail() {
    if (!selectedContact?.email) return;
    const currentBody = textareaRef.current?.value ?? body;
    const params = new URLSearchParams({ view: "cm", to: selectedContact.email, su: subject, body: currentBody });
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank");
  }

  // ── Selection helpers ──────────────────────────────────────
  function selectAccount(id: number) {
    setSelectedAccountId(id);
    setSearchAccount("");
  }

  function clearAccount() {
    setSelectedAccountId(null);
    setSelectedContactId(null);
    setSearchAccount("");
  }

  function selectContact(id: number) {
    setSelectedContactId(id);
    setSearchContact("");
  }

  function clearContact() {
    setSelectedContactId(null);
    setSearchContact("");
  }

  return {
    // Data
    accounts, contacts, allContacts, filteredAccounts,
    accountsLoading, contactsLoading,

    // Selection
    selectedAccountId, selectedContactId,
    selectedAccount, selectedContact, fullName,
    searchAccount, setSearchAccount,
    searchContact, setSearchContact,
    selectAccount, clearAccount,
    selectContact, clearContact,

    // Email
    generating, subject, body, hasMicrosite, researchUsed,
    sources, sourcesOpen, setSourcesOpen,
    hookSource, emailTheme, researchText, error,
    generateEmail,
    textareaRef,

    // Copy
    copiedSubject, copiedFull,
    copySubject, copyFull,
    openInEmailClient, openInGmail,

    // Brief
    briefLoading, brief, briefError, briefOpen, setBriefOpen,
    generateBrief,
  };
}
