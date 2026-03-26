import { supabase } from "@/integrations/supabase/client";

/**
 * Save a layout config to the database (upsert by template_key).
 * Falls back to localStorage if DB fails.
 */
export async function saveLayoutDefault(templateKey: string, config: Record<string, any>): Promise<void> {
  // Always save to localStorage as a fast cache
  localStorage.setItem(templateKey, JSON.stringify(config));

  try {
    const { error } = await supabase
      .from("layout_defaults")
      .upsert(
        { template_key: templateKey, config: config as any, updated_at: new Date().toISOString() },
        { onConflict: "template_key" }
      );
    if (error) {
      console.warn("Failed to save layout to DB, localStorage used as fallback:", error.message);
    }
  } catch (e) {
    console.warn("Failed to save layout to DB:", e);
  }
}

/**
 * Load a layout config. Tries DB first, falls back to localStorage.
 */
export async function loadLayoutDefault(templateKey: string): Promise<Record<string, any> | null> {
  try {
    const { data, error } = await supabase
      .from("layout_defaults")
      .select("config")
      .eq("template_key", templateKey)
      .maybeSingle();

    if (!error && data?.config) {
      // Update localStorage cache
      localStorage.setItem(templateKey, JSON.stringify(data.config));
      return data.config as Record<string, any>;
    }
  } catch (e) {
    console.warn("Failed to load layout from DB:", e);
  }

  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(templateKey);
    if (saved) return JSON.parse(saved);
  } catch {}

  return null;
}

/**
 * Clear a saved layout default from both DB and localStorage.
 */
export async function clearLayoutDefault(templateKey: string): Promise<void> {
  localStorage.removeItem(templateKey);

  try {
    await supabase
      .from("layout_defaults")
      .delete()
      .eq("template_key", templateKey);
  } catch (e) {
    console.warn("Failed to clear layout from DB:", e);
  }
}
