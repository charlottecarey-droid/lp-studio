import { supabase } from "@/integrations/supabase/client";

export type TargetContact = {
  parentCompany: string;
  firstName: string;
  lastName: string;
  title: string;
  titleLevel: string;
  department: string;
  contactRole: string;
  email: string;
  phone: string;
  linkedinUrl: string;
};

const LEVEL_ORDER: Record<string, number> = { "C Suite": 0, "VP Level": 1, "Director Level": 2 };

/**
 * Look up contacts for a company from the database.
 * Strategy: find the account's SFDC ID via company name, then pull ALL contacts
 * sharing that SFDC ID. This ensures one account = one unique SFDC ID with
 * multiple contacts underneath.
 * Falls back to company name matching if no SFDC ID is found.
 */
export async function getContactsForCompany(companyName: string): Promise<TargetContact[]> {
  if (!companyName.trim()) return [];

  const selectCols = "parent_company, first_name, last_name, title, title_level, department, contact_role, email, phone, linkedin_url, salesforce_id";

  // Step 1: Find a contact row matching the company name to discover the SFDC account ID
  let { data: seedRows } = await supabase
    .from("target_contacts")
    .select("salesforce_id")
    .ilike("parent_company", companyName.trim())
    .not("salesforce_id", "is", null)
    .limit(1);

  // Fuzzy fallback
  if (!seedRows || seedRows.length === 0) {
    ({ data: seedRows } = await supabase
      .from("target_contacts")
      .select("salesforce_id")
      .ilike("parent_company", `%${companyName.trim()}%`)
      .not("salesforce_id", "is", null)
      .limit(1));
  }

  let data: any[] | null = null;

  if (seedRows && seedRows.length > 0 && seedRows[0].salesforce_id) {
    // Step 2: Pull ALL contacts sharing this SFDC account ID
    const sfdcId = seedRows[0].salesforce_id;
    ({ data } = await supabase
      .from("target_contacts")
      .select(selectCols)
      .eq("salesforce_id", sfdcId)
      .limit(50));
  }

  // Fallback: match by company name if no SFDC ID found
  if (!data || data.length === 0) {
    ({ data } = await supabase
      .from("target_contacts")
      .select(selectCols)
      .ilike("parent_company", companyName.trim())
      .limit(50));

    if (!data || data.length === 0) {
      ({ data } = await supabase
        .from("target_contacts")
        .select(selectCols)
        .ilike("parent_company", `%${companyName.trim()}%`)
        .limit(50));
    }
  }

  if (!data) return [];

  const contacts: TargetContact[] = data.map((row: any) => ({
    parentCompany: row.parent_company || "",
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    title: row.title || "",
    titleLevel: row.title_level || "",
    department: row.department || "",
    contactRole: row.contact_role || "",
    email: row.email || "",
    phone: row.phone || "",
    linkedinUrl: row.linkedin_url || "",
  }));

  // Sort by seniority
  contacts.sort((a, b) => (LEVEL_ORDER[a.titleLevel] ?? 3) - (LEVEL_ORDER[b.titleLevel] ?? 3));

  return contacts;
}
