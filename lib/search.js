const TAVILY_BASE = "https://api.tavily.com";

/**
 * Search PubMed, ClinVar, cancer databases for a biomedical query.
 * Returns a formatted string of results for injection into the prompt.
 */
export async function searchLiterature(query) {
  const res = await fetch(`${TAVILY_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 4,
      include_domains: [
        "pubmed.ncbi.nlm.nih.gov",
        "ncbi.nlm.nih.gov",
        "cancer.gov",
        "clinicaltrials.gov",
        "cancergenome.nih.gov",
        "nature.com",
        "nejm.org",
      ],
    }),
  });

  if (!res.ok) {
    console.error("Tavily search failed:", res.status);
    return null;
  }

  const data = await res.json();
  const results = data.results ?? [];

  if (results.length === 0) return null;

  // Format results for prompt injection
  return results
    .map((r, i) =>
      `[${i + 1}] ${r.title}\nSource: ${r.url}\n${r.content}`
    )
    .join("\n\n---\n\n");
}

/**
 * Build a focused biomedical search query from the user's question + patient context.
 */
export function buildSearchQuery(userQuestion, findings) {
  // Extract key gene names from the question
  const genePattern = /\b(BRAF|KRAS|TP53|NRAS|PTEN|EGFR|ALK|MET|CDK|CDKN|RET|PIK3CA|ARID1A)\b/gi;
  const genesInQ = userQuestion.match(genePattern) ?? [];

  // Also pull top driver genes from extracted findings
  const driverGenes = (findings?.driverMutations ?? [])
    .slice(0, 2)
    .map((m) => m.gene);

  const genes = [...new Set([...genesInQ, ...driverGenes])].join(" ");
  const tumorType = findings?.tumorType ?? "cancer";
  const hla = (findings?.hlaAlleles ?? []).find((a) => a.includes("A*02")) ?? "";

  // Build a tight biomedical query
  return `${genes} ${hla} neoantigen vaccine ${tumorType} immunotherapy`.trim();
}
