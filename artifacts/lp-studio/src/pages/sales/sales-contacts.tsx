import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Users, Search, Building2, Mail } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

interface Contact {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  role: string | null;
  status: string;
  createdAt: string;
  accountName?: string;
}

export default function SalesContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/sales/contacts`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.title ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All contacts across your accounts
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[64px] rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex items-center gap-4 p-6 rounded-2xl border border-dashed border-border">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {search ? "No contacts match your search" : "No contacts yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Add contacts from an account's detail page
              </p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-4 px-5 py-3.5 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                  {contact.firstName[0]}{contact.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {contact.title && <span>{contact.title}</span>}
                    {contact.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {contact.email}
                      </span>
                    )}
                  </div>
                </div>
                {contact.role && (
                  <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                    {contact.role}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(contact.createdAt), "MMM d")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SalesLayout>
  );
}
