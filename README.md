# Agent for Impact

> **Built at the NVIDIA GTC Hackathon** — we had 2 hours to build something with the new NVIDIA products. This is what we shipped.

An AI-powered genomic cancer report analysis tool. Upload a patient's genomic profiling report, get instant intelligent annotations, and interactively explore findings grounded in live scientific literature.

Built with **NVIDIA Nemotron** (via OpenRouter), **PubMed**, and **ClinVar** — designed for oncologists, genetic counselors, and clinical researchers who need fast, evidence-backed interpretation of complex genomic data.

---

## What It Does

1. **Upload** a genomic report (PDF or plain text)
2. **Auto-annotate** mutations and biomarkers with color-coded highlights
3. **Analyze** with NVIDIA Nemotron 70B — streamed response, low temperature for factual precision
4. **Ground** every answer in live PubMed publications and ClinVar variant data
5. **Explore interactively** — click any mutation in chat or document to cross-highlight across both panels

---

## Demo

Upload the included [sample-genomic-report.txt](sample-genomic-report.txt) to try it out immediately. It contains a realistic NSCLC patient profile with EGFR, TP53, PTEN mutations, MET amplification, and biomarker data (TMB, MSI, PD-L1).

---

## Architecture

```
app/
├── page.tsx              # Main split-screen UI (document + chat)
├── api/
│   ├── upload/route.ts   # File ingestion, text extraction, annotation
│   └── chat/route.ts     # LLM streaming + PubMed/ClinVar grounding

components/
├── UploadZone.tsx         # File drag-drop + annotation legend
├── DocumentViewer.tsx     # Report with inline color-coded highlights
├── ChatPanel.tsx          # Streaming chat with suggested questions
└── MessageBubble.tsx      # Messages with clickable mutations + sources

lib/
├── annotate.ts            # Regex-based genomic pattern classifier
├── grounding.ts           # PubMed + ClinVar NCBI EUTILS queries
├── systemPrompt.ts        # LLM context builder
└── extractText.ts         # PDF / plaintext parser
```

---

## Annotation Classification

The annotator uses curated regex patterns to classify genomic findings:

| Color | Type | Examples |
|-------|------|---------|
| Red | **Pathogenic** | EGFR, BRCA1/2, TP53, KRAS, BRAF, HER2, ALK, RET, NTRK, PIK3CA, FLT3, IDH1/2 |
| Yellow | **VUS** (Uncertain Significance) | ATM, CHEK2, PALB2, generic VUS labels |
| Green | **Benign** | "likely benign", "benign variant" |
| Blue | **Biomarker** | TMB, MSI, MMR, PD-L1, HRD, ctDNA, CTC |

---

## Grounding

Each chat response is augmented with real-time evidence from:

- **PubMed** (NCBI EUTILS) — top publications for each detected mutation + "cancer treatment"
- **ClinVar** (NCBI EUTILS) — clinical significance and review status for variants

No additional API keys required — both are free public NCBI APIs.

Results are injected into the system prompt before the LLM generates its response, ensuring every claim can be traced to a source shown in the chat UI.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| LLM | NVIDIA Nemotron 70B via OpenRouter |
| LLM Client | OpenAI SDK (OpenRouter-compatible) |
| PDF Parsing | pdf-parse |
| Literature | NCBI EUTILS (PubMed + ClinVar) |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/Agent-for-Impact.git
cd Agent-for-Impact
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Get a free API key at [openrouter.ai](https://openrouter.ai). The app uses `nvidia/llama-3.1-nemotron-70b-instruct` by default.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Key Design Decisions

**No tool-calling** — grounding is done server-side before the LLM call. This is simpler and more reliable than function calling for retrieval-augmented generation in a medical context.

**Streaming** — the chat API streams tokens progressively so long oncology analyses feel responsive.

**Low temperature (0.2)** — reduces hallucination for clinical content. Max 1200 tokens keeps responses focused.

**Split-screen layout** — 55% document / 45% chat keeps the source report in view while discussing findings, enabling precise cross-references.

**Cross-linked highlights** — clicking a mutation in a chat message scrolls the document panel to the corresponding annotation and pulses it, and vice versa.

---

## File Support

| Format | Notes |
|--------|-------|
| `.txt` | Plain text genomic reports |
| `.md` | Markdown-formatted reports |
| `.pdf` | Extracted via `pdf-parse` (FFPE reports, lab exports) |

Maximum file size: **10 MB**

---

## Sample Report Summary

The included `sample-genomic-report.txt` represents a 58-year-old female with Stage IIIB NSCLC adenocarcinoma:

- **EGFR Exon 19 del** (42.3% VAF) → Tier 1: Osimertinib (Tagrisso)
- **TP53 p.R175H** (38.7% VAF) → Prognostic, may reduce TKI duration
- **PTEN p.R130*** (21.4% VAF) → PI3K/AKT activation, TKI resistance risk
- **ATM p.V2424G** / **CHEK2 p.I157T** → VUS; CHEK2 may be germline
- **MET Amplification** (~12 copies) → Acquired resistance mechanism
- **TMB**: 6.2 mut/Mb (Low) | **MSI**: Stable | **PD-L1**: 35% TPS

---

## License

MIT
