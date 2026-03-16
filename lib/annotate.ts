export type AnnotationClass = "pathogenic" | "vus" | "benign" | "biomarker";

export interface Annotation {
  id: string;
  start: number;
  end: number;
  text: string;
  cls: AnnotationClass;
  label: string;
}

// Well-known cancer genes / mutations
const PATHOGENIC_PATTERNS: RegExp[] = [
  /\bBRCA[12]\b/g,
  /\bTP53\b/g,
  /\bEGFR\s*(?:exon\s*\d+\s*)?(?:deletion|mutation|amplification|L858R|T790M|C797S)?\b/g,
  /\bKRAS\s*(?:G12[ACDRSV]|G13[CD])?\b/g,
  /\bALK\s*(?:fusion|rearrangement|amplification)?\b/g,
  /\bMET\s*(?:exon\s*14\s*skipping|amplification|fusion)?\b/g,
  /\bPIK3CA\b/g,
  /\bPTEN\b/g,
  /\bCDKN2A\b/g,
  /\bRB1\b/g,
  /\bAPC\b/g,
  /\bMLH1\b/g,
  /\bMSH2\b/g,
  /\bMSH6\b/g,
  /\bPMS2\b/g,
  /\bSTK11\b/g,
  /\bNF1\b/g,
  /\bFLT3\s*(?:ITD|TKD)?\b/g,
  /\bIDH[12]\b/g,
  /\bNPM1\b/g,
  /\bRET\s*(?:fusion|rearrangement)?\b/g,
  /\bNTRK[123]\s*(?:fusion)?\b/g,
  /\bROS1\s*(?:fusion|rearrangement)?\b/g,
  /\bBRAF\s*(?:V600E|V600K|fusion)?\b/g,
  /\bHER2\b|\bERBB2\b/g,
];

const VUS_PATTERNS: RegExp[] = [
  /\b(?:variant of uncertain significance|VUS)\b/gi,
  /\bATM\b/g,
  /\bCHEK2\b/g,
  /\bPALB2\b/g,
];

const BENIGN_PATTERNS: RegExp[] = [
  /\blikely benign\b/gi,
  /\bbenign variant\b/gi,
];

const BIOMARKER_PATTERNS: RegExp[] = [
  /\bTMB(?:-H|-L|\s*high|\s*low)?\b/g,
  /\bMSI(?:-H|-L|-S|\s*high|\s*low|\s*stable)?\b/g,
  /\bMMR(?:-D|\s*deficient)?\b/g,
  /\bPD-L1\s*(?:TPS\s*[\d]+%)?\b/g,
  /\bHRD\b|\bhomologous recombination deficiency\b/gi,
  /\bcirculat(?:ing)?\s*tumor\s*DNA\b|\bctDNA\b/gi,
  /\bcirculating\s*tumor\s*cells?\b|\bCTC\b/g,
];

function findMatches(
  text: string,
  patterns: RegExp[],
  cls: AnnotationClass
): Annotation[] {
  const matches: Annotation[] = [];
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({
        id: `ann-${cls}-${m.index}`,
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        cls,
        label: m[0],
      });
    }
  }
  return matches;
}

export function annotateText(text: string): Annotation[] {
  const all: Annotation[] = [
    ...findMatches(text, PATHOGENIC_PATTERNS, "pathogenic"),
    ...findMatches(text, VUS_PATTERNS, "vus"),
    ...findMatches(text, BENIGN_PATTERNS, "benign"),
    ...findMatches(text, BIOMARKER_PATTERNS, "biomarker"),
  ];

  // Sort by start position, dedupe overlapping
  all.sort((a, b) => a.start - b.start);
  const deduped: Annotation[] = [];
  let lastEnd = -1;
  for (const ann of all) {
    if (ann.start >= lastEnd) {
      deduped.push(ann);
      lastEnd = ann.end;
    }
  }
  return deduped;
}

export const CLS_STYLES: Record<AnnotationClass, string> = {
  pathogenic: "bg-red-500/20 text-red-300 border-b border-red-400 cursor-pointer hover:bg-red-500/40 transition-colors",
  vus: "bg-yellow-500/20 text-yellow-300 border-b border-yellow-400 cursor-pointer hover:bg-yellow-500/40 transition-colors",
  benign: "bg-green-500/20 text-green-300 border-b border-green-400 cursor-pointer hover:bg-green-500/40 transition-colors",
  biomarker: "bg-blue-500/20 text-blue-300 border-b border-blue-400 cursor-pointer hover:bg-blue-500/40 transition-colors",
};

export const CLS_LABELS: Record<AnnotationClass, string> = {
  pathogenic: "Pathogenic",
  vus: "VUS",
  benign: "Benign",
  biomarker: "Biomarker",
};
