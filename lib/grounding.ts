export interface PubMedResult {
  pmid: string;
  title: string;
  source: string;
  pubdate: string;
  url: string;
}

export interface ClinVarResult {
  uid: string;
  title: string;
  clinical_significance: string;
  review_status: string;
  url: string;
}

export interface GroundingSource {
  tool: "pubmed" | "clinvar";
  query: string;
  results: (PubMedResult | ClinVarResult)[];
}

const NCBI_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export async function searchPubMed(query: string): Promise<PubMedResult[]> {
  try {
    const searchUrl = `${NCBI_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=4&retmode=json&sort=relevance`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    const searchData = await searchRes.json();
    const ids: string[] = searchData?.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    const summaryUrl = `${NCBI_BASE}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(8000) });
    const summaryData = await summaryRes.json();

    return ids.map((id) => {
      const doc = summaryData?.result?.[id];
      return {
        pmid: id,
        title: doc?.title ?? "Unknown title",
        source: doc?.source ?? "",
        pubdate: doc?.pubdate ?? "",
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      };
    }).filter((r) => r.title !== "Unknown title");
  } catch {
    return [];
  }
}

export async function searchClinVar(query: string): Promise<ClinVarResult[]> {
  try {
    const searchUrl = `${NCBI_BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(query)}&retmax=4&retmode=json`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    const searchData = await searchRes.json();
    const ids: string[] = searchData?.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    const summaryUrl = `${NCBI_BASE}/esummary.fcgi?db=clinvar&id=${ids.join(",")}&retmode=json`;
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(8000) });
    const summaryData = await summaryRes.json();

    const results: ClinVarResult[] = [];
    for (const id of ids) {
      const doc = summaryData?.result?.[id];
      if (!doc) continue;
      results.push({
        uid: id,
        title: doc?.title ?? doc?.variation_name ?? "Unknown variant",
        clinical_significance: doc?.clinical_significance?.description ?? "Unknown",
        review_status: doc?.clinical_significance?.review_status ?? "",
        url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${id}/`,
      });
    }
    return results;
  } catch {
    return [];
  }
}
