"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDownToLine,
  Bot,
  Check,
  ChevronRight,
  FileUp,
  Filter,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { leadStatuses, services, type Lead, type LeadStatus, type RecommendedService } from "@/lib/types";

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

export function LeadDashboard({ initialLeads }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [selectedId, setSelectedId] = useState(initialLeads[0]?.id ?? "");
  const [filters, setFilters] = useState(emptyFilters);
  const [searchIntent, setSearchIntent] = useState({ businessType: "", location: "", service: "" });
  const [showBusinessOptions, setShowBusinessOptions] = useState(false);
  const backgroundAnalyzedIds = useRef(new Set<string>());
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selected = leads.find((lead) => lead.id === selectedId) ?? leads[0];

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
    setSelectedId(updated.id);
  }

  async function refreshLeads() {
    const response = await fetch("/api/leads");
    const data = await response.json();
    setLeads(data.leads ?? []);
    setSelectedId(data.leads?.[0]?.id ?? "");
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

  function generateAnalysis(id: string) {
    runTask(async () => {
      setMessage("Na pozadí analyzujem web, sociálne siete, verejný finančný report, VR, marketing a chatbot potenciál.");
      const response = await fetch(`/api/leads/${id}/analyze`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Analýza zlyhala.");
      patchLead(data.lead);
      setMessage("Analýza je pripravená.");
    });
  }

  useEffect(() => {
    if (!selected || selected.web_analysis || backgroundAnalyzedIds.current.has(selected.id)) {
      return;
    }

    backgroundAnalyzedIds.current.add(selected.id);
    const timer = window.setTimeout(() => {
      generateAnalysis(selected.id);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [selected]);

  function changeStatus(id: string, status: LeadStatus) {
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

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !note.trim()) return;

    runTask(async () => {
      const response = await fetch(`/api/leads/${selected.id}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Poznámka sa nepodarila pridať.");
      patchLead(data.lead);
      setNote("");
    });
  }

  function createSearchLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runTask(async () => {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(searchIntent)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Vyhľadanie zlyhalo.");
      await refreshLeads();
      setSelectedId(data.leads?.[0]?.id ?? selectedId);
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

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-line bg-panel/75 p-5 shadow-glow backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-mint/15 text-mint">
                <Bot size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">B2B Lead Analyzer</h1>
                <p className="text-sm text-slate-400">Research verejných B2B kontaktov, AI poznámky a obchodný workflow.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/export"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white/5 px-3 text-sm font-medium text-slate-100 hover:bg-white/10"
            >
              <ArrowDownToLine size={17} /> Export CSV
            </a>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-line bg-white/5 px-3 text-sm font-medium text-slate-100 hover:bg-white/10">
              <FileUp size={17} /> Import CSV
              <input className="hidden" type="file" accept=".csv,text/csv" onChange={importCsv} />
            </label>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.45fr]">
          <form onSubmit={createSearchLead} className="rounded-lg border border-line bg-panel/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Search size={17} className="text-mint" /> Lead research
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div
                className="relative"
              >
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
                className="h-10 rounded-md border border-line bg-ink/70 px-3 text-sm outline-none focus:border-mint"
                placeholder="vyberte miesto"
              />
              <select
                value={searchIntent.service}
                onChange={(event) => setSearchIntent({ ...searchIntent, service: event.target.value })}
                className="h-10 rounded-md border border-line bg-ink/70 px-3 text-sm text-slate-500 outline-none focus:border-mint"
              >
                <option value="" disabled>typ prevádzky</option>
                <option value="všetky">všetky</option>
                {services.map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </div>
            <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-mint px-3 text-sm font-semibold text-ink hover:bg-mint/90">
              <Plus size={17} /> Find / create leads
            </button>
          </form>

          <div className="rounded-lg border border-line bg-panel/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Filter size={17} className="text-amber" /> Filtre
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
          </div>
        </section>

        {message ? <div className="rounded-md border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-mint">{message}</div> : null}

        <section className="grid gap-5 xl:grid-cols-[1.25fr_.95fr]">
          <div className="overflow-hidden rounded-lg border border-line bg-panel/80">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-100">Lead table</h2>
              <span className="text-xs text-slate-400">{filteredLeads.length} z {leads.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Firma</th>
                    <th className="px-4 py-3">Mesto</th>
                    <th className="px-4 py-3">Odvetvie</th>
                    <th className="px-4 py-3">Služba</th>
                    <th className="px-4 py-3">Priorita</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Kontakt</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className={selected?.id === lead.id ? "bg-mint/5" : "hover:bg-white/[0.03]"}>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedId(lead.id)} className="text-left font-medium text-slate-100 hover:text-mint">
                          {lead.company_name}
                        </button>
                        <div className="mt-1 text-xs text-slate-500">{lead.data_source}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{lead.city}</td>
                      <td className="px-4 py-3 text-slate-300">{lead.industry}</td>
                      <td className="px-4 py-3 text-slate-300">{serviceFor(lead) || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex size-8 items-center justify-center rounded-md bg-white/5 text-sm font-semibold text-amber">{priority(lead) || "-"}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                      <td className="px-4 py-3 text-slate-300">{lead.public_phone || lead.public_email || "overiť"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedId(lead.id)} className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-white/5 hover:bg-white/10" aria-label="Otvoriť detail">
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-lg border border-line bg-panel/85 p-4 shadow-glow">
            {selected ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{selected.company_name}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <span className="inline-flex items-center gap-1"><MapPin size={14} /> {selected.city}</span>
                      <span>{selected.industry}</span>
                    </div>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>

                <div className="grid gap-2 text-sm text-slate-300">
                  <a className="hover:text-mint" href={selected.website ?? "#"} target="_blank">{selected.website ?? "Web nie je uložený"}</a>
                  <span className="inline-flex items-center gap-2"><Phone size={14} /> {selected.public_phone || selected.public_email || "Kontakt doplniť z verejného zdroja alebo CSV"}</span>
                  <span className="text-xs text-slate-500">Zdroj kontaktu: {selected.contact_source}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button disabled={isPending} onClick={() => generateAnalysis(selected.id)} className="inline-flex h-10 items-center gap-2 rounded-md bg-mint px-3 text-sm font-semibold text-ink disabled:opacity-60">
                    {isPending ? <RefreshCw className="animate-spin" size={17} /> : <Sparkles size={17} />} Generate Analysis
                  </button>
                  <select value={selected.status} onChange={(event) => changeStatus(selected.id, event.target.value as LeadStatus)} className="h-10 rounded-md border border-line bg-ink/70 px-3 text-sm">
                    {leadStatuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>

                <section className="rounded-lg border border-line bg-ink/45 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-100">Analýza webu</h3>
                  {selected.web_analysis ? (
                    <div className="grid gap-3">
                      <p className="text-sm text-slate-300">{selected.web_analysis.summary}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                        {[
                          ["Web", selected.web_analysis.has_website],
                          ["Moderný dojem", selected.web_analysis.modern_feel],
                          ["Jasné CTA", selected.web_analysis.clear_cta],
                          ["Mobil", selected.web_analysis.mobile_usable],
                          ["Cenník/menu/rezervácia", selected.web_analysis.has_pricing_menu_booking],
                          ["Kvalitné fotky", selected.web_analysis.quality_photos],
                          ["Sociálne siete", selected.web_analysis.social_presence],
                          ["Finančný report", selected.web_analysis.financial_report_available],
                          ["Má VR prehliadku", selected.web_analysis.has_vr_tour],
                          ["VR potenciál", selected.web_analysis.vr_potential],
                          ["Marketing potenciál", selected.web_analysis.marketing_potential],
                          ["Chatbot potenciál", selected.web_analysis.chatbot_potential]
                        ].map(([label, value]) => (
                          <span key={String(label)} className="inline-flex items-center gap-2 rounded-md bg-white/5 px-2 py-2">
                            {value ? <Check size={14} className="text-mint" /> : <span className="size-3 rounded-full border border-slate-600" />} {label}
                          </span>
                        ))}
                      </div>
                      <div className="grid gap-2 text-xs text-slate-400">
                        <p><span className="text-slate-500">Sociálne siete:</span> {selected.web_analysis.social_analysis}</p>
                        <p><span className="text-slate-500">Finančný report:</span> {selected.web_analysis.financial_report_note}</p>
                        <p><span className="text-slate-500">VR:</span> {selected.web_analysis.vr_tour_note}</p>
                        <p><span className="text-slate-500">Marketing:</span> {selected.web_analysis.marketing_note}</p>
                        <p><span className="text-slate-500">Chatbot:</span> {selected.web_analysis.chatbot_note}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Kliknite na Generate Analysis.</p>
                  )}
                </section>

                <section className="rounded-lg border border-line bg-ink/45 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-100">Odporúčaná ponuka</h3>
                  {selected.ai_analysis ? (
                    <div className="space-y-3 text-sm text-slate-300">
                      <p><span className="text-slate-500">Problém:</span> {selected.ai_analysis.main_problem}</p>
                      <p><span className="text-slate-500">Selling point:</span> {selected.ai_analysis.sales_angle}</p>
                      <p><span className="text-slate-500">Služba:</span> {selected.ai_analysis.recommended_service}</p>
                      <p><span className="text-slate-500">Poznámka:</span> {selected.ai_analysis.business_note}</p>
                      <div className="rounded-md border border-mint/20 bg-mint/10 p-3 text-mint">
                        {selected.ai_analysis.call_script}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">AI poznámka ešte nie je vygenerovaná.</p>
                  )}
                </section>

                <form onSubmit={addNote} className="rounded-lg border border-line bg-ink/45 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-100">Poznámky</h3>
                  <pre className="mb-3 max-h-32 whitespace-pre-wrap rounded-md bg-black/20 p-3 text-xs text-slate-400">{selected.notes || "Bez poznámok."}</pre>
                  <div className="flex gap-2">
                    <input value={note} onChange={(event) => setNote(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-line bg-ink/70 px-3 text-sm outline-none focus:border-mint" placeholder="Pridať poznámku" />
                    <button className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white/5 px-3 text-sm hover:bg-white/10">Add Note</button>
                  </div>
                </form>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Zatiaľ nie sú uložené žiadne leady.</p>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
