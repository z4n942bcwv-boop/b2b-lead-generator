import { NextResponse } from "next/server";
import { generateAiAnalysis } from "@/lib/ai-analysis";
import { getLead, updateLead } from "@/lib/lead-store";
import { analyzeWebsite } from "@/lib/web-analysis";

type Params = {
  params: {
    id: string;
  };
};

export async function POST(_: Request, { params }: Params) {
  try {
    const lead = await getLead(params.id);
    if (!lead) {
      return NextResponse.json({ error: "Lead sa nenašiel." }, { status: 404 });
    }

    const webAnalysis = await analyzeWebsite(lead.website);
    const aiAnalysis = await generateAiAnalysis(lead, webAnalysis);
    const updated = await updateLead(params.id, {
      web_analysis: webAnalysis,
      ai_analysis: aiAnalysis,
      desired_service: aiAnalysis.recommended_service
    });

    return NextResponse.json({ lead: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analýza zlyhala." }, { status: 500 });
  }
}
