"use client";

import { ChangeEvent, FormEvent, useMemo, useState, useTransition } from "react";
import {
  ArrowDownToLine,
  Bot,
  ChevronDown,
  FileUp,
  MapPin,
  Phone,
  Plus,
  Search,
  Sparkles
} from "lucide-react";
import { leadStatuses, services, type Lead, type LeadStatus } from "@/lib/types";

type Props = {
  initialLeads: Lead[];
};

const emptyFilters = {
  city: "",
  industry: "",
  service: "",
  priority: "",
  status: ""
};

const businessTypeOptions = [
  "všetky",
  "hotely",
  "reštaurácie",
  "fitness centrá",
  "showroomy",
  "wellness centrá",
  "zubné kliniky",
  "realitné kancelárie",
  "autoservisy"
];

function priority(lead: Lead) {
  return lead.ai_analysis?.priority_score ?? 0;
}

function serviceFor(lead: Lead) {
  return lead.ai_analysis?.recommended_service ?? lead.desired_service ?? "";
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function LeadDashboard({ initialLeads }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [callPanelId, setCallPanelId] = useState<string | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [searchIntent, setSearchIntent] = useState({ businessType: "", location: "", service: "" });
  const [showBusinessOptions, setShowBusinessOptions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<
  { name: string; type: string; district: string; region: string; code: string }[]
>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const filterOptions = useMemo(
    () => ({
      cities: Array.from(new Set(leads.map((lead) => lead.city))).filter(Boolean),
      industries: Array.from(new Set(leads.map((lead) => lead.industry))).filter(Boolean)
    }),
    [leads]
  );

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const minPriority = filters.priority ? Number(filters.priority) : 0;
      return (
        (!filters.city || lead.city === filters.city) &&
        (!filters.industry || lead.industry === filters.industry) &&
        (!filters.service || serviceFor(lead) === filters.service) &&
        (!filters.status || lead.status === filters.status) &&
        (!minPriority || priority(lead) >= minPriority)
      );
    });
  }, [filters, leads]);

  function patchLead(updated: Lead) {
    setLeads((current) => current.map((lead) => (lead.id === updated.id ? updated : lead)));
  }

  async function refreshLeads() {
    const response = await fetch("/api/leads");
    const data = await response.json();
    setLeads(data.leads ?? []);
  }

  function runTask(task: () => Promise<void>) {
    setMessage("");
    startTransition(async () => {
      try {
        await task();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Akcia zlyhala.");
      }
    });
  }

  function createSearchLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    runTask(async () => {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessType: searchIntent.businessType || "všetky",
          location: searchIntent.location || "Slovensko",
          service: searchIntent.service || "webstránky"
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Vyhľadanie zlyhalo.");
      await refreshLeads();
      setMessage(data.mode === "demo" ? "Pridaný research placeholder. Doplňte overený verejný kontakt alebo importujte CSV." : "Leady boli pridané.");
    });
  }

  function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    runTask(async () => {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/import", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Import zlyhal.");
      await refreshLeads();
      setMessage(`Importovaných leadov: ${data.imported}. Chyby: ${data.errors?.length ?? 0}.`);
      event.target.value = "";
    });
  }

  function changeStatus(id: string, status: LeadStatus) {
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, status } : lead)));

    runTask(async () => {
      const response = await fetch(`/api/leads/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Status sa nepodarilo zmeniť.");
      patchLead(data.lead);
    });
  }

  function generateAnalysis(id: string) {
    runTask(async () => {
      setMessage("Analyzujem web, sociálne siete, VR, marketing a chatbot potenciál.");
      const response = await fetch(`/api/leads/${id}/analyze`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Analýza zlyhala.");
      patchLead(data.lead);
      setExpandedId(id);
      setMessage("Analýza je pripravená.");
    });
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-line bg-panel/75 p-5 shadow-glow backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-mint/15 text-mint">
              <Bot size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">B2B Lead Analyzer</h1>
              <p className="text-sm text-slate-400">Reporty prevádzok, verejné B2B kontakty a AI sales poznámky.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href="/api/export" className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white/5 px-3 text-sm font-medium text-slate-100 hover:bg-white/10">
              <ArrowDownToLine size={17} /> Export CSV
            </a>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-line bg-white/5 px-3 text-sm font-medium text-slate-100 hover:bg-white/10">
              <FileUp size={17} /> Import CSV
              <input className="hidden" type="file" accept=".csv,text/csv" onChange={importCsv} />
            </label>
          </div>
        </header>

        <section className="rounded-lg border border-line bg-panel/70 p-4">
          <form onSubmit={createSearchLead} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="relative">
              <input
                value={searchIntent.businessType}
                onClick={() => setShowBusinessOptions((current) => !current)}
                onChange={(event) => setSearchIntent({ ...searchIntent, businessType: event.target.value })}
                className="h-10 w-full rounded-md border border-line bg-ink/70 px-3 text-sm outline-none placeholder:text-slate-500 focus:border-mint"
                placeholder="vyberte názov biznisu"
              />
              {showBusinessOptions ? (
                <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-md border border-line bg-ink shadow-glow">
                  {businessTypeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setSearchIntent({ ...searchIntent, businessType: option });
                        setShowBusinessOptions(false);
                      }}
                      className="block h-9 w-full px-3 text-left text-sm text-slate-300 hover:bg-mint/10 hover:text-mint"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <input
              value={searchIntent.location}
              onChange={(event) => setSearchIntent({ ...searchIntent, location: event.target.value })}
              className="h-10 rounded-md border border-line bg-ink/70 px-3 text-sm outline-none placeholder:text-slate-500 focus:border-mint"
              placeholder="vyberte miesto"
            />

            <select
              value={searchIntent.service}
              onChange={(event) => setSearchIntent({ ...searchIntent, service: event.target.value })}
              className="h-10 rounded-md border border-line bg-ink/70 px-3 text-sm text-slate-300 outline-none focus:border-mint"
            >
              <option value="">typ prevádzky</option>
              <option value="všetky">všetky</option>
              {services.map((service) => (
                <option key={service}>{service}</option>
              ))}
            </select>

            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-3 text-sm font-semibold text-ink hover:bg-mint/90">
              <Plus size={17} /> Find / create leads
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-line bg-panel/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Search size={17} className="text-amber" /> Filtre
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <select className="h-10 rounded-md border border-line bg-ink/70 px-2 text-sm" value={filters.city} onChange={(event) => setFilters({ ...filters, city: event.target.value })}>
              <option value="">Mesto</option>
              {filterOptions.cities.map((city) => <option key={city}>{city}</option>)}
            </select>
            <select className="h-10 rounded-md border border-line bg-ink/70 px-2 text-sm" value={filters.industry} onChange={(event) => setFilters({ ...filters, industry: event.target.value })}>
              <option value="">Odvetvie</option>
              {filterOptions.industries.map((industry) => <option key={industry}>{industry}</option>)}
            </select>
            <select className="h-10 rounded-md border border-line bg-ink/70 px-2 text-sm" value={filters.service} onChange={(event) => setFilters({ ...filters, service: event.target.value })}>
              <option value="">Služba</option>
              {services.map((service) => <option key={service}>{service}</option>)}
            </select>
            <select className="h-10 rounded-md border border-line bg-ink/70 px-2 text-sm" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
              <option value="">Priorita</option>
              {[5, 6, 7, 8, 9].map((score) => <option key={score} value={score}>{score}+</option>)}
            </select>
            <select className="h-10 rounded-md border border-line bg-ink/70 px-2 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Status</option>
              {leadStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </section>

        {message ? <div className="rounded-md border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-mint">{message}</div> : null}

        <section className="grid gap-3">
          {filteredLeads.map((lead) => {
            const isExpanded = expandedId === lead.id;
            const hasPhone = Boolean(lead.public_phone);
            const score = priority(lead);

            return (
              <article key={lead.id} className="overflow-hidden rounded-lg border border-line bg-panel/80 shadow-glow">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                  className="grid w-full gap-3 border-0 bg-transparent p-4 text-left hover:bg-white/[0.03] lg:grid-cols-[44px_1.2fr_.75fr_.75fr_.9fr_1fr_.9fr_1fr_34px] lg:items-start"
                >
                  <span className="flex size-10 items-center justify-center rounded-md border border-mint/35 bg-mint/10 text-sm font-bold text-mint">
                    {initials(lead.company_name)}
                  </span>

                  <span>
                    <span className="block text-xs font-bold uppercase text-slate-500">Názov</span>
                    <span className="block font-semibold text-slate-100">{lead.company_name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{lead.data_source}</span>
                  </span>

                  <span>
                    <span className="block text-xs font-bold uppercase text-slate-500">Mesto</span>
                    <span className="flex items-center gap-1 text-sm text-slate-200"><MapPin size={14} /> {lead.city}</span>
                  </span>

                  <span>
                    <span className="block text-xs font-bold uppercase text-slate-500">Odvetvie</span>
                    <span className="text-sm text-slate-200">{lead.industry}</span>
                  </span>

                  <span>
                    <span className="block text-xs font-bold uppercase text-slate-500">Služba</span>
                    <span className="text-sm text-slate-200">{serviceFor(lead) || "-"}</span>
                  </span>

                  <span>
                    <span className="block text-xs font-bold uppercase text-slate-500">Priorita</span>
                    <span className="inline-flex size-9 items-center justify-center rounded-md bg-amber/10 font-bold text-amber">{score || "-"}</span>
                    <span className="mt-1 block text-xs leading-snug text-slate-400">
                      Počítaná z kvality webu, CTA, fotiek, VR potenciálu, marketingu a chatbot potreby.
                    </span>
                  </span>

                  <span onClick={(event) => event.stopPropagation()}>
                    <span className="block text-xs font-bold uppercase text-slate-500">Status</span>
                    <select value={lead.status} onChange={(event) => changeStatus(lead.id, event.target.value as LeadStatus)} className="mt-1 h-9 w-full rounded-md border border-line bg-ink/70 px-2 text-sm">
                      {leadStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </span>

                  <span onClick={(event) => event.stopPropagation()}>
                    <span className="block text-xs font-bold uppercase text-slate-500">Kontakt</span>
                    <span className="block truncate text-sm text-slate-200">{lead.public_phone || lead.public_email || "overiť"}</span>
                    <button type="button" onClick={() => setCallPanelId(callPanelId === lead.id ? null : lead.id)} className="mt-2 inline-flex h-8 items-center gap-2 rounded-md border border-mint/35 bg-mint/10 px-2 text-xs font-semibold text-mint">
                      <Phone size={14} /> hneď volať
                    </button>
                  </span>

                  <ChevronDown className={`mt-1 text-slate-500 transition ${isExpanded ? "rotate-180" : ""}`} size={20} />
                </button>

                {callPanelId === lead.id ? (
                  <div className="mx-4 mb-4 rounded-lg border border-mint/25 bg-mint/10 p-3 text-sm text-slate-300">
                    {hasPhone ? (
                      <a className="inline-flex h-9 items-center rounded-md bg-mint px-3 font-bold text-ink" href={`tel:${lead.public_phone}`}>
                        Zavolať {lead.public_phone}
                      </a>
                    ) : (
                      <span>Telefón nie je uložený. Pridaj ho iba z verejného zdroja alebo CSV, potom sa tu zobrazí priame volanie.</span>
                    )}
                  </div>
                ) : null}

                {isExpanded ? (
                  <div className="border-t border-line bg-ink/35 p-4">
                    {!lead.web_analysis && !lead.ai_analysis ? (
                      <button disabled={isPending} onClick={() => generateAnalysis(lead.id)} className="mb-4 inline-flex h-10 items-center gap-2 rounded-md bg-mint px-3 text-sm font-semibold text-ink disabled:opacity-60">
                        <Sparkles size={17} /> Spustiť analýzu
                      </button>
                    ) : null}

                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-lg border border-line bg-white/[0.04] p-3">
                        <h3 className="mb-2 text-sm font-semibold">Web</h3>
                        <p className="text-sm leading-relaxed text-slate-400">{lead.web_analysis?.summary ?? "Analýza webu ešte nie je pripravená."}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-white/[0.04] p-3">
                        <h3 className="mb-2 text-sm font-semibold">Sociálne siete</h3>
                        <p className="text-sm leading-relaxed text-slate-400">{lead.web_analysis?.social_analysis ?? "Sociálne siete treba overiť z verejných profilov alebo CSV."}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-white/[0.04] p-3">
                        <h3 className="mb-2 text-sm font-semibold">Finančný report</h3>
                        <p className="text-sm leading-relaxed text-slate-400">{lead.web_analysis?.financial_report_note ?? "Finančné údaje negenerovať. Overiť iba z verejného registra alebo dodaných dát."}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-white/[0.04] p-3">
                        <h3 className="mb-2 text-sm font-semibold">VR prehliadka</h3>
                        <p className="text-sm leading-relaxed text-slate-400">{lead.web_analysis?.vr_tour_note ?? "VR potenciál sa vyhodnotí po analýze webu."}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-white/[0.04] p-3">
                        <h3 className="mb-2 text-sm font-semibold">Marketing</h3>
                        <p className="text-sm leading-relaxed text-slate-400">{lead.web_analysis?.marketing_note ?? "Marketingové signály sa vyhodnotia po analýze."}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-white/[0.04] p-3">
                        <h3 className="mb-2 text-sm font-semibold">Chatbot</h3>
                        <p className="text-sm leading-relaxed text-slate-400">{lead.web_analysis?.chatbot_note ?? "Chatbot potenciál sa vyhodnotí podľa webu, rezervácií a otázok zákazníkov."}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-mint/20 bg-mint/10 p-3 text-sm leading-relaxed text-mint">
                      {lead.ai_analysis?.call_script ?? "Call script sa zobrazí po spustení analýzy."}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
