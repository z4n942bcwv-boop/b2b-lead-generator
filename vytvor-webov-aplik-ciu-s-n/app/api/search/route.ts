import { NextResponse } from "next/server";
import { createLead } from "@/lib/lead-store";
import { services } from "@/lib/types";
import { leadSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const payload = await request.json();
  const businessType = String(payload.businessType ?? "").trim();
  const location = String(payload.location ?? "").trim();
  const service = services.includes(payload.service) ? payload.service : "webstránky";

  if (!businessType || !location) {
    return NextResponse.json({ error: "Vyplňte typ biznisu a mesto alebo región." }, { status: 400 });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    const demo = leadSchema.parse({
      company_name: `${businessType.slice(0, 1).toUpperCase()}${businessType.slice(1)} lead - ${location}`,
      industry: businessType,
      city: location,
      website: null,
      public_phone: null,
      public_email: null,
      google_maps_url: `https://www.google.com/maps/search/${encodeURIComponent(`${businessType} ${location}`)}`,
      social_url: null,
      data_source: "Google Maps search link, API kľúč zatiaľ nie je nastavený",
      contact_source: "Verejný Google Maps vyhľadávací zdroj, kontakt treba pred oslovením overiť",
      description: `Pripravený placeholder pre research: ${businessType} v lokalite ${location}.`,
      status: "new",
      desired_service: service,
      notes: "Doplniť konkrétny verejný kontakt z firemného profilu alebo importovať z CSV."
    });
    const lead = await createLead(demo);
    return NextResponse.json({ leads: [lead], mode: "demo" });
  }

  return NextResponse.json({
    error:
      "Google Places integrácia má pripravený bezpečný vstup, ale produkčné mapovanie polí treba doplniť podľa povolených Places API polí a vašej fakturácie."
  }, { status: 501 });
}
