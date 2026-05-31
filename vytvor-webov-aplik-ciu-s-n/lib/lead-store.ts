import { demoLeads } from "@/lib/demo-data";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { Lead, LeadInput, LeadStatus } from "@/lib/types";

const table = "leads";
let memoryLeads: Lead[] = [...demoLeads];

function sortLeads(leads: Lead[]) {
  return [...leads].sort((a, b) => {
    const aScore = a.ai_analysis?.priority_score ?? 0;
    const bScore = b.ai_analysis?.priority_score ?? 0;
    return bScore - aScore || b.updated_at.localeCompare(a.updated_at);
  });
}

export async function listLeads() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return sortLeads(memoryLeads);
  }

  const { data, error } = await supabase.from(table).select("*").order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }

  return sortLeads((data ?? []) as Lead[]);
}

export async function getLead(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return memoryLeads.find((lead) => lead.id === id) ?? null;
  }

  const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data as Lead;
}

export async function createLead(input: LeadInput) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const now = new Date().toISOString();
    const created = {
      ...input,
      id: input.id ?? `local-${crypto.randomUUID()}`,
      web_analysis: input.web_analysis ?? null,
      ai_analysis: input.ai_analysis ?? null,
      created_at: now,
      updated_at: now
    } as Lead;
    memoryLeads = [created, ...memoryLeads];
    return created;
  }

  const { data, error } = await supabase.from(table).insert(input).select("*").single();
  if (error) {
    throw error;
  }

  return data as Lead;
}

export async function updateLead(id: string, patch: Partial<Lead>) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const existing = await getLead(id);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...patch, updated_at: new Date().toISOString() } as Lead;
    memoryLeads = memoryLeads.map((lead) => (lead.id === id ? updated : lead));
    return updated;
  }

  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select("*").single();
  if (error) {
    throw error;
  }

  return data as Lead;
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  return updateLead(id, { status });
}
