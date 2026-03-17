"use client";
import { useState, useRef, useEffect, useCallback } from "react";

// ── Sample patient ─────────────────────────────────────────────────────────
const SAMPLE_DOC = `Patient ID: MEL-001
Tumor Type: Skin Cutaneous Melanoma (SKCM)
Stage: III (T3N1M0)
Tumor Mutational Burden: 47.3 mut/Mb (HIGH)
MSI Status: MSS
Mutational Signature: UV (SBS7)
WES: hg38, purity 0.78, ploidy 2.1

HLA: HLA-A*02:01, HLA-A*24:02, HLA-B*07:02, HLA-B*44:03, HLA-C*07:01, HLA-C*05:01

Somatic mutations:
BRAF V600E  chr7:140,753,336  A>T  VAF 0.78  DRIVER hotspot
TP53 R248W  chr17:7,674,220   C>T  VAF 0.62  DRIVER TSG
CDKN2A del  chr9:21,971,047   HomDel  VAF 1.00  DRIVER TSG
NRAS Q61R   chr1:114,713,908  C>T  VAF 0.31  LIKELY DRIVER
PTEN R130Q  chr10:89,692,905  G>A  VAF 0.44  LIKELY DRIVER
ARID1A R1781* chr1:26,772,683 C>T  VAF 0.22  PASSENGER
DNMT3A R882H  chr2:25,234,373 G>A  VAF 0.18  PASSENGER
TTN R14785C   chr2:178,641,101 T>C VAF 0.15  PASSENGER

Biomarkers:
- BRAF V600E targetable: vemurafenib, dabrafenib+trametinib
- HLA-A*02:01: optimal neoantigen binding context
- TMB top quartile for SKCM — strong neoantigen load expected
- UV mutational signature (SBS7): C>T transitions at PyPy dinucleotides`;

// ── Helpers ────────────────────────────────────────────────────────────────
const S = {
  // Layout
  app: { display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" },
  main: { display:"flex", flex:1, overflow:"hidden" },

  // Sidebar
  sidebar: { width:224, flexShrink:0, borderRight:"1px solid #e5e3db", display:"flex", flexDirection:"column", overflow:"hidden", background:"#fff" },
  sideTop: { padding:"14px 16px 12px", borderBottom:"1px solid #e5e3db" },
  sideBody: { flex:1, overflowY:"auto", padding:"12px 16px" },
  sideFoot: { padding:"12px", borderTop:"1px solid #e5e3db", display:"flex", flexDirection:"column", gap:8 },
  sectionLabel: { fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", color:"#888780", marginBottom:6 },

  // Chat area
  chatArea: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  messages: { flex:1, overflowY:"auto", padding:"20px 24px" },
  inputRow: { padding:"12px 16px", borderTop:"1px solid #e5e3db", display:"flex", gap:8, background:"#fff" },
  input: { flex:1, padding:"10px 14px", borderRadius:8, border:"1px solid #d3d1c7", background:"#f8f7f4", color:"#1a1a18", fontSize:13, outline:"none", fontFamily:"inherit", resize:"none" },
  sendBtn: (active) => ({ padding:"10px 20px", borderRadius:8, border:"none", background: active ? "#534AB7" : "#e5e3db", color: active ? "#EEEDFE" : "#888780", fontSize:13, fontWeight:500, cursor: active ? "pointer" : "default", whiteSpace:"nowrap", transition:"all .15s" }),

  // Upload screen
  uploadScreen: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40, gap:20 },
  dropZone: (drag) => ({ width:"100%", maxWidth:440, border:`2px dashed ${drag ? "#534AB7" : "#d3d1c7"}`, borderRadius:14, padding:"40px 28px", textAlign:"center", cursor:"pointer", background: drag ? "#EEEDFE20" : "#fff", transition:"all .15s" }),

  // Buttons
  primaryBtn: { width:"100%", padding:"9px 0", borderRadius:8, border:"none", background:"#534AB7", color:"#EEEDFE", fontSize:12, fontWeight:500, cursor:"pointer" },
  ghostBtn: { width:"100%", padding:"7px 0", borderRadius:7, border:"1px solid #e5e3db", background:"transparent", color:"#888780", fontSize:11, cursor:"pointer" },
};

function Badge({ color, label }) {
  const map = {
    red:    ["#FCEBEB","#A32D2D","#F7C1C1"],
    amber:  ["#FAEEDA","#854F0B","#FAC775"],
    green:  ["#EAF3DE","#3B6D11","#C0DD97"],
    blue:   ["#E6F1FB","#185FA5","#B5D4F4"],
    purple: ["#EEEDFE","#534AB7","#CECBF6"],
    teal:   ["#E1F5EE","#0F6E56","#9FE1CB"],
    gray:   ["#F1EFE8","#5F5E5A","#D3D1C7"],
  };
  const [bg, fg, br] = map[color] || map.gray;
  return (
    <span style={{ display:"inline-block", padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:600, background:bg, color:fg, border:`1px solid ${br}`, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function Spinner() {
  return <div style={{ width:12, height:12, border:"2px solid #CECBF6", borderTopColor:"#534AB7", borderRadius:"50%", animation:"spin .6s linear infinite" }} />;
}

function Dot({ delay = 0 }) {
  return <div style={{ width:6, height:6, borderRadius:3, background:"#b4b2a9", animation:`pulse 1s ease-in-out ${delay}s infinite` }} />;
}

// ── Findings sidebar ───────────────────────────────────────────────────────
function FindingsPanel({ findings, loading, onNewPatient, onGenBrief, briefLoading }) {
  if (loading) {
    return (
      <div style={{ padding:"20px 16px", display:"flex", alignItems:"center", gap:8, color:"#888780", fontSize:12 }}>
        <Spinner /> Extracting findings…
      </div>
    );
  }
  if (!findings) return null;

  const drivers = findings.driverMutations || [];
  const passengers = findings.passengerMutations || [];

  return (
    <>
      <div style={S.sideTop}>
        <div style={{ fontSize:10, color:"#888780", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Patient</div>
        <div style={{ fontSize:13, fontWeight:600, color:"#1a1a18", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {findings.patientId || "—"}
        </div>
        <div style={{ fontSize:11, color:"#5f5e5a", marginBottom:10 }}>{findings.tumorType || "—"}</div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {findings.tmbLevel === "High" && <Badge color="red" label="High TMB" />}
          {findings.tmbLevel === "Medium" && <Badge color="amber" label="Medium TMB" />}
          {findings.msiStatus === "MSI-H" && <Badge color="amber" label="MSI-H" />}
          {findings.msiStatus === "MSS" && <Badge color="green" label="MSS" />}
          {findings.stage && <Badge color="blue" label={`Stage ${findings.stage}`} />}
        </div>
      </div>

      <div style={S.sideBody}>
        {findings.tmb && (
          <div style={{ marginBottom:14 }}>
            <div style={S.sectionLabel}>TMB</div>
            <div style={{ fontSize:14, fontWeight:600, fontFamily:"monospace", color:"#1a1a18" }}>{findings.tmb}</div>
            {findings.mutationalSignature && (
              <div style={{ fontSize:11, color:"#888780", marginTop:2 }}>{findings.mutationalSignature}</div>
            )}
          </div>
        )}

        {(findings.hlaAlleles || []).length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={S.sectionLabel}>HLA alleles</div>
            {findings.hlaAlleles.map((a, i) => (
              <div key={i} style={{ fontSize:11, fontFamily:"monospace", padding:"3px 0", borderBottom:"1px solid #f1efe8", color: a.includes("A*02") ? "#185FA5" : "#5f5e5a", fontWeight: a.includes("A*02") || a.includes("B*07") ? 600 : 400 }}>
                {a}
              </div>
            ))}
          </div>
        )}

        {drivers.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={S.sectionLabel}>Driver mutations</div>
            {drivers.map((m, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #f1efe8", gap:4 }}>
                <div>
                  <span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12, color:"#1a1a18" }}>{m.gene} </span>
                  <span style={{ fontSize:11, color:"#5f5e5a" }}>{m.change}</span>
                </div>
                <div style={{ display:"flex", gap:4, alignItems:"center", flexShrink:0 }}>
                  {m.vaf && <span style={{ fontSize:10, color:"#888780", fontFamily:"monospace" }}>{m.vaf}</span>}
                  <Badge color="red" label="Driver" />
                </div>
              </div>
            ))}
          </div>
        )}

        {passengers.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={S.sectionLabel}>Other variants</div>
            {passengers.slice(0, 5).map((m, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderBottom:"1px solid #f1efe8", gap:4 }}>
                <div>
                  <span style={{ fontFamily:"monospace", fontSize:12, color:"#1a1a18" }}>{m.gene} </span>
                  <span style={{ fontSize:11, color:"#888780" }}>{m.change}</span>
                </div>
                {m.vaf && <span style={{ fontSize:10, color:"#888780", fontFamily:"monospace", flexShrink:0 }}>{m.vaf}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.sideFoot}>
        <button
          style={{ ...S.primaryBtn, display:"flex", alignItems:"center", justifyContent:"center", gap:6, opacity: briefLoading ? 0.7 : 1 }}
          onClick={onGenBrief}
          disabled={briefLoading}
        >
          {briefLoading ? <><Spinner /> Generating…</> : "Generate vaccine brief"}
        </button>
        <button style={S.ghostBtn} onClick={onNewPatient}>New patient</button>
      </div>
    </>
  );
}

// ── Vaccine brief view ─────────────────────────────────────────────────────
function BriefView({ brief, onClose }) {
  const priorityColor = (p) => p === "High" ? "red" : p === "Medium" ? "amber" : "green";

  return (
    <div style={{ borderTop:"1px solid #e5e3db", background:"#fafaf8", padding:"16px 20px", maxHeight:340, overflowY:"auto", animation:"fadeUp .3s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:"#1a1a18", marginBottom:4 }}>Vaccine design brief</div>
          <div style={{ fontSize:12, color:"#5f5e5a", lineHeight:1.65, maxWidth:560 }}>{brief.summary}</div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#888780", fontSize:22, lineHeight:1, padding:0, marginLeft:12, flexShrink:0 }}>×</button>
      </div>

      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:14 }}>
        {brief.strategy && <Badge color="purple" label={brief.strategy} />}
        {brief.delivery && <Badge color="blue" label={brief.delivery} />}
        {brief.combination && <Badge color="teal" label={brief.combination} />}
      </div>

      {(brief.neoantigens || []).length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:600, color:"#888780", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Neoantigen candidates</div>
          <div style={{ border:"1px solid #e5e3db", borderRadius:8, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead>
                <tr style={{ background:"#f8f7f4" }}>
                  {["Peptide","Source","HLA","IC50 (nM)","Binding","Priority"].map(h => (
                    <th key={h} style={{ padding:"6px 8px", textAlign:"left", fontWeight:600, color:"#888780", borderBottom:"1px solid #e5e3db", fontSize:10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brief.neoantigens.map((n, i) => (
                  <tr key={i} style={{ borderBottom:"1px solid #f1efe8" }}>
                    <td style={{ padding:"6px 8px", fontFamily:"monospace", fontWeight:600, color:"#1a1a18" }}>{n.peptide}</td>
                    <td style={{ padding:"6px 8px", color:"#5f5e5a" }}>{n.source}</td>
                    <td style={{ padding:"6px 8px", fontFamily:"monospace", color:"#5f5e5a", fontSize:10 }}>{n.hla}</td>
                    <td style={{ padding:"6px 8px", fontFamily:"monospace", color:"#5f5e5a" }}>{n.ic50 ?? "—"}</td>
                    <td style={{ padding:"6px 8px" }}><Badge color={n.binding === "Strong" ? "blue" : "amber"} label={n.binding} /></td>
                    <td style={{ padding:"6px 8px" }}><Badge color={priorityColor(n.priority)} label={n.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
        {[["Adjuvant", brief.adjuvant], ["Timeline", brief.timeline], ["Combination therapy", brief.combination], ["Clinical trials", brief.clinicalTrials]].filter(([,v]) => v).map(([k,v]) => (
          <div key={k} style={{ padding:"9px 12px", background:"#fff", borderRadius:7, border:"1px solid #e5e3db" }}>
            <div style={{ fontSize:10, color:"#888780", textTransform:"uppercase", letterSpacing:".05em", marginBottom:3 }}>{k}</div>
            <div style={{ fontSize:12, fontWeight:500, color:"#1a1a18", lineHeight:1.4 }}>{v}</div>
          </div>
        ))}
      </div>

      {brief.rationale && (
        <div style={{ padding:"10px 12px", background:"#fff", borderRadius:7, border:"1px solid #e5e3db", fontSize:12, color:"#5f5e5a", lineHeight:1.65 }}>
          <span style={{ fontWeight:600, color:"#1a1a18" }}>Rationale: </span>{brief.rationale}
        </div>
      )}
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === "user";

  if (msg.type === "searching") {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, animation:"fadeUp .3s ease" }}>
        <div style={{ width:6, height:6, borderRadius:3, background:"#378ADD", animation:"pulse 1s ease-in-out infinite" }} />
        <span style={{ fontSize:12, color:"#888780", fontStyle:"italic" }}>
          Searching PubMed · ClinVar for "{msg.query}"…
        </span>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection: isUser ? "row-reverse" : "row", gap:10, marginBottom:18, animation:"fadeUp .25s ease" }}>
      {!isUser && (
        <div style={{ width:28, height:28, borderRadius:7, flexShrink:0, background:"#EEEDFE", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#534AB7", marginTop:2 }}>V</div>
      )}
      <div style={{
        maxWidth:"78%",
        padding:"11px 15px",
        borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
        background: isUser ? "#534AB7" : "#fff",
        color: isUser ? "#EEEDFE" : "#1a1a18",
        fontSize:13,
        lineHeight:1.75,
        border: isUser ? "none" : "1px solid #e5e3db",
        whiteSpace:"pre-wrap",
        wordBreak:"break-word",
      }}>
        {msg.content}
      </div>
    </div>
  );
}

// ── Upload screen ──────────────────────────────────────────────────────────
function UploadScreen({ onLoad }) {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  async function readFile(file) {
    const text = await file.text();
    onLoad(text, file.name);
  }

  return (
    <div style={S.uploadScreen}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:26, fontWeight:700, letterSpacing:"-.03em", color:"#1a1a18", marginBottom:6 }}>VaxAgent</div>
        <div style={{ fontSize:13, color:"#888780" }}>AI co-pilot for personalized cancer vaccine design</div>
        <div style={{ fontSize:11, color:"#b4b2a9", marginTop:4 }}>Powered by NVIDIA Nemotron · Grounded via PubMed MCP search</div>
      </div>

      <div
        style={S.dropZone(drag)}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
        onClick={() => fileRef.current?.click()}
      >
        <div style={{ fontSize:32, marginBottom:10, color:"#d3d1c7" }}>↑</div>
        <div style={{ fontSize:14, fontWeight:600, color:"#1a1a18", marginBottom:6 }}>Drop genomic report here</div>
        <div style={{ fontSize:12, color:"#888780" }}>VCF · TXT · TSV · or click to browse</div>
        <input ref={fileRef} type="file" accept=".txt,.vcf,.tsv,.csv" style={{ display:"none" }} onChange={e => { if (e.target.files[0]) readFile(e.target.files[0]); }} />
      </div>

      <div style={{ fontSize:11, color:"#b4b2a9" }}>or</div>

      <button
        style={{ padding:"11px 28px", borderRadius:9, border:"1px solid #e5e3db", background:"#fff", color:"#1a1a18", fontSize:13, fontWeight:600, cursor:"pointer" }}
        onClick={() => onLoad(SAMPLE_DOC, "MEL-001 · Melanoma")}
      >
        Use sample patient — MEL-001 · Melanoma
      </button>
    </div>
  );
}

// ── Main app ───────────────────────────────────────────────────────────────
export default function VaxAgentApp() {
  const [screen, setScreen] = useState("upload");
  const [doc, setDoc] = useState("");
  const [docName, setDocName] = useState("");
  const [findings, setFindings] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [streamMsg, setStreamMsg] = useState("");     // in-progress streamed reply
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, streamMsg]);

  // ── Load document ──────────────────────────────────────────────────────
  async function handleLoad(text, name) {
    setDoc(text);
    setDocName(name);
    setScreen("chat");
    setMessages([{
      role: "assistant",
      content: `Genomic report loaded for **${name}**.\n\nKey picture:\n• Extracting structured findings now — watch the sidebar\n• Ask me anything about mutations, neoantigens, or HLA binding\n• When ready, hit "Generate vaccine brief" for a full design summary`,
    }]);

    // Extract findings
    setExtracting(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: text }),
      });
      const { findings } = await res.json();
      setFindings(findings);
    } catch (e) {
      console.error("Extraction failed:", e);
    }
    setExtracting(false);
  }

  // ── Send message with streaming ────────────────────────────────────────
  const send = useCallback(async () => {
    if (!input.trim() || busy) return;
    const userText = input.trim();
    setInput("");
    setBusy(true);

    const userMsg = { role: "user", content: userText };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMsgs, doc, findings }),
      });

      if (!res.ok) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let searched = false;
      let searchQuery = null;
      let searchMsgAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (raw === "[DONE]") continue;
          try {
            const parsed = JSON.parse(raw);

            // Our metadata event
            if (parsed.type === "meta") {
              searched = parsed.searched;
              searchQuery = parsed.query;
              if (searched && !searchMsgAdded) {
                setMessages(p => [...p, { type:"searching", query: searchQuery }]);
                searchMsgAdded = true;
              }
              continue;
            }

            // OpenRouter streaming delta
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              setStreamMsg(fullText);
            }
          } catch { /* skip malformed */ }
        }
      }

      // Commit the full streamed reply
      setStreamMsg("");
      setMessages(p => [
        ...p.filter(m => m.type !== "searching"),
        { role:"assistant", content: fullText }
      ]);
    } catch (e) {
      setStreamMsg("");
      setMessages(p => [...p.filter(m => m.type !== "searching"), { role:"assistant", content:`Error: ${e.message}` }]);
    }

    setBusy(false);
  }, [input, busy, messages, doc, findings]);

  // ── Generate brief ─────────────────────────────────────────────────────
  async function genBrief() {
    setBriefLoading(true);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc }),
      });
      const { brief } = await res.json();
      setBrief(brief);
    } catch (e) {
      console.error("Brief failed:", e);
    }
    setBriefLoading(false);
  }

  // ── Upload screen ──────────────────────────────────────────────────────
  if (screen === "upload") {
    return (
      <div style={S.app}>
        <UploadScreen onLoad={handleLoad} />
      </div>
    );
  }

  // ── Chat screen ────────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      {/* Header */}
      <div style={{ padding:"0 20px", height:48, borderBottom:"1px solid #e5e3db", display:"flex", alignItems:"center", gap:12, background:"#fff", flexShrink:0 }}>
        <div style={{ fontSize:15, fontWeight:700, letterSpacing:"-.02em", color:"#1a1a18" }}>VaxAgent</div>
        <div style={{ width:1, height:18, background:"#e5e3db" }} />
        <div style={{ fontSize:12, color:"#888780", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{docName}</div>
        <div style={{ marginLeft:"auto", display:"flex", gap:5 }}>
          <Badge color="purple" label="Nemotron 70B" />
          <Badge color="blue" label="MCP Search" />
        </div>
      </div>

      <div style={S.main}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          {screen === "chat" && (
            <FindingsPanel
              findings={findings}
              loading={extracting}
              onNewPatient={() => { setScreen("upload"); setFindings(null); setMessages([]); setBrief(null); setDoc(""); }}
              onGenBrief={genBrief}
              briefLoading={briefLoading}
            />
          )}
        </div>

        {/* Chat */}
        <div style={S.chatArea}>
          <div style={S.messages}>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}

            {/* Streaming message */}
            {streamMsg && (
              <div style={{ display:"flex", gap:10, marginBottom:18, animation:"fadeUp .25s ease" }}>
                <div style={{ width:28, height:28, borderRadius:7, flexShrink:0, background:"#EEEDFE", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#534AB7", marginTop:2 }}>V</div>
                <div style={{ maxWidth:"78%", padding:"11px 15px", borderRadius:"12px 12px 12px 2px", background:"#fff", color:"#1a1a18", fontSize:13, lineHeight:1.75, border:"1px solid #e5e3db", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                  {streamMsg}
                  <span style={{ display:"inline-block", width:2, height:14, background:"#534AB7", marginLeft:2, verticalAlign:"middle", animation:"pulse .7s ease-in-out infinite" }} />
                </div>
              </div>
            )}

            {/* Typing dots */}
            {busy && !streamMsg && !messages.find(m => m.type === "searching") && (
              <div style={{ display:"flex", gap:5, padding:"8px 0", marginLeft:38 }}>
                <Dot delay={0} /><Dot delay={0.15} /><Dot delay={0.3} />
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Vaccine brief */}
          {brief && <BriefView brief={brief} onClose={() => setBrief(null)} />}

          {/* Input */}
          <div style={S.inputRow}>
            <textarea
              style={{ ...S.input, height:42, lineHeight:"1.5" }}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about mutations, neoantigen candidacy, HLA binding, vaccine strategy…"
              rows={1}
            />
            <button style={S.sendBtn(!busy && input.trim())} onClick={send} disabled={busy || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
