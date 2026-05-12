import { useState, useRef, useEffect } from "react";

const EXAMPLES = [
  {
    id: 1,
    topic: "Climate Research",
    bad: {
      label: "Vague & Broad",
      text: "Tell me about climate change.",
      issues: ["No scope or focus", "No format specified", "No audience context", "No date range"]
    },
    good: {
      label: "Specific & Scoped",
      text: "Summarize three peer-reviewed arguments for climate policy reform in developing nations, with citations from 2020–2024, in 200 words. Write for a PhD-level audience.",
      strengths: ["Specific count (3 arguments)", "Source type defined (peer-reviewed)", "Date range specified (2020–2024)", "Format & length given", "Audience stated"]
    }
  },
  {
    id: 2,
    topic: "Literature Review",
    bad: {
      label: "Vague & Broad",
      text: "Help me with my literature review on AI in education.",
      issues: ["No research question", "No scope or depth", "No output format", "No field boundaries"]
    },
    good: {
      label: "Specific & Scoped",
      text: "Identify 5 key themes from research on AI-powered personalized learning in higher education (2019–2024). For each theme, give one representative finding and a suggested search term for Semantic Scholar. Format as a numbered list.",
      strengths: ["Clear deliverable (5 themes)", "Sub-field defined (higher ed)", "Date range bounded", "Actionable output (search terms)", "Format specified (numbered list)"]
    }
  },
  {
    id: 3,
    topic: "Research Methodology",
    bad: {
      label: "Vague & Broad",
      text: "What research method should I use?",
      issues: ["No research question provided", "No field or discipline", "No constraints mentioned", "Impossible to answer well"]
    },
    good: {
      label: "Specific & Scoped",
      text: "I am studying how faculty attitudes toward AI tools change after a 6-week training program. My sample is 40 faculty members at an Indian university. Recommend the most appropriate mixed-methods research design and justify your choice in 150 words.",
      strengths: ["Research question is clear", "Sample size & context given", "Geographic/institutional context", "Method type suggested (mixed)", "Output length constrained"]
    }
  },
  {
    id: 4,
    topic: "Data Analysis",
    bad: {
      label: "Vague & Broad",
      text: "Explain data analysis for my thesis.",
      issues: ["No dataset described", "No analysis goal", "No level of detail", "Output will be generic"]
    },
    good: {
      label: "Specific & Scoped",
      text: "I have Likert-scale survey responses (1–5) from 80 postgraduate students on AI tool adoption. I want to test whether prior AI experience significantly predicts adoption willingness. Recommend the correct statistical test, state the null hypothesis, and list the SPSS steps to run it.",
      strengths: ["Data type described (Likert scale)", "Sample size given (n=80)", "Research goal explicit", "Tool specified (SPSS)", "Deliverable is actionable steps"]
    }
  }
];

const MODELS = [
  { value: "gemini-2.5-flash-lite-preview-06-17", label: "gemini-2.5-flash-lite (recommended)" },
  { value: "gemini-2.5-flash",   label: "gemini-2.5-flash"   },
  { value: "gemini-2.5-pro",     label: "gemini-2.5-pro"     },
  { value: "gemini-pro",         label: "gemini-pro (legacy)" },
  { value: "gemini-1.5-flash",   label: "gemini-1.5-flash"   },
];

// Calls our Vercel serverless function — key never touches the browser
const callGemini = async (model, prompt) => {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt })
  });
  const data = await res.json();
  if (data.error) {
    const msg = data.error;
    if (msg.toLowerCase().includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) throw new Error("QUOTA_EXCEEDED");
    if (msg.includes("API_KEY_INVALID") || msg.toLowerCase().includes("invalid"))   throw new Error("INVALID_KEY");
    if (msg.toLowerCase().includes("not found") || msg.includes("404"))             throw new Error("MODEL_NOT_FOUND");
    throw new Error(msg);
  }
  return data.text;
};

const ErrorBox = ({ type, msg }) => {
  const content = {
    quota: {
      icon: "⏱", color: "#F59E0B",
      title: "Rate Limit Reached",
      body: "The free tier quota has been temporarily exhausted.",
      fix: "Wait 1–2 minutes and try again. Free tier allows 15 requests/min."
    },
    model_not_found: {
      icon: "🔍", color: "#8B5CF6",
      title: "Model Not Available",
      body: "This model is not accessible in the current region or tier.",
      fix: "Switch to gemini-2.5-flash or gemini-pro from the model selector."
    },
    generic: {
      icon: "⚠", color: "#EF4444",
      title: "Something went wrong",
      body: msg || "An unexpected error occurred.",
      fix: "Try again or switch to a different model."
    }
  }[type] || {};
  return (
    <div style={{ background: "rgba(239,68,68,0.06)", border: `1px solid ${content.color}40`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>{content.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: content.color, marginBottom: 6 }}>{content.title}</div>
      <div style={{ fontSize: 12, color: "#C0C0D8", marginBottom: 10, lineHeight: 1.6 }}>{content.body}</div>
      <div style={{ background: "#0F0F28", borderRadius: 8, padding: "10px 12px", border: `1px solid ${content.color}30` }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: content.color, marginBottom: 3 }}>HOW TO FIX</div>
        <div style={{ fontSize: 12, color: "#9090B8", lineHeight: 1.6 }}>{content.fix}</div>
      </div>
    </div>
  );
};

export default function App() {
  const [selected, setSelected]     = useState(0);
  const [model, setModel]           = useState("gemini-2.5-flash-lite-preview-06-17");
  const [running, setRunning]       = useState(false);
  const [badResult, setBadResult]   = useState(null);
  const [goodResult, setGoodResult] = useState(null);
  const [badLoading, setBadLoading] = useState(false);
  const [goodLoading, setGoodLoading] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customBad, setCustomBad]   = useState("");
  const [customGood, setCustomGood] = useState("");
  const [timer, setTimer]           = useState(0);
  const timerRef   = useRef(null);
  const resultsRef = useRef(null);

  const ex         = EXAMPLES[selected];
  const badPrompt  = customMode ? customBad  : ex.bad.text;
  const goodPrompt = customMode ? customGood : ex.good.text;

  const runDemo = async () => {
    if (!badPrompt.trim() || !goodPrompt.trim()) return;
    setRunning(true);
    setBadResult(null); setGoodResult(null);
    setBadLoading(true); setGoodLoading(true);
    setTimer(0);
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    try {
      const [bad, good] = await Promise.all([
        callGemini(model, badPrompt).catch(e => e.message).finally(() => setBadLoading(false)),
        callGemini(model, goodPrompt).catch(e => e.message).finally(() => setGoodLoading(false))
      ]);
      setBadResult(bad);
      setGoodResult(good);
    } finally {
      setRunning(false);
      clearInterval(timerRef.current);
    }
  };

  const reset = () => { setBadResult(null); setGoodResult(null); setTimer(0); clearInterval(timerRef.current); };
  useEffect(() => { reset(); }, [selected, customMode]);
  useEffect(() => () => clearInterval(timerRef.current), []);

  const wordCount = t => t ? t.split(/\s+/).filter(Boolean).length : 0;
  const isError   = r => ["QUOTA_EXCEEDED","MODEL_NOT_FOUND"].includes(r) || (r && !r.includes(" ") && r.length < 30);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0B0B1E 0%, #120A2E 50%, #0B0B1E 100%)",
      fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
      color: "#E0E0F0", paddingBottom: 60
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(90deg, #1A0A3E, #0D0D2E)",
        borderBottom: "2px solid #8B5CF6",
        padding: "18px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 30px rgba(139,92,246,0.25)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #8B5CF6, #F59E0B)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
          }}>⚡</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>AI Prompt Live Demo</div>
            <div style={{ fontSize: 11, color: "#9090B8" }}>Good vs Bad Prompts · Powered by Gemini</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={model} onChange={e => { setModel(e.target.value); reset(); }}
            style={{
              background: "#1A1A35", border: "1px solid #2D1B69",
              borderRadius: 8, color: "#A78BFA", fontSize: 12,
              padding: "6px 10px", cursor: "pointer", outline: "none", fontWeight: 600
            }}>
            {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button onClick={() => { setCustomMode(false); reset(); }}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: !customMode ? "#8B5CF6" : "#1E1E3A",
              color: !customMode ? "#fff" : "#9090B8",
              fontSize: 12, fontWeight: 600, transition: "all 0.2s"
            }}>Preset Examples</button>
          <button onClick={() => { setCustomMode(true); reset(); }}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: customMode ? "#F59E0B" : "#1E1E3A",
              color: customMode ? "#0B0B1E" : "#9090B8",
              fontSize: 12, fontWeight: 600, transition: "all 0.2s"
            }}>Custom Prompts</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 0" }}>

        {/* Topic Selector */}
        {!customMode && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#9090B8", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Choose a Topic</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {EXAMPLES.map((e, i) => (
                <button key={e.id} onClick={() => setSelected(i)}
                  style={{
                    padding: "10px 20px", borderRadius: 10,
                    border: `1.5px solid ${i === selected ? "#8B5CF6" : "#2D1B69"}`,
                    background: i === selected ? "rgba(139,92,246,0.18)" : "#1A1A35",
                    color: i === selected ? "#A78BFA" : "#9090B8",
                    fontSize: 13, fontWeight: i === selected ? 700 : 500,
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: i === selected ? "0 0 16px rgba(139,92,246,0.25)" : "none"
                  }}>
                  {e.topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 22 }}>
          {/* Bad */}
          <div style={{ background: "#1A1A35", border: "1.5px solid rgba(239,68,68,0.4)", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(239,68,68,0.1)" }}>
            <div style={{ background: "linear-gradient(90deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05))", borderBottom: "1px solid rgba(239,68,68,0.25)", padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>❌</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#EF4444" }}>Weak Prompt</div>
                  {!customMode && <div style={{ fontSize: 11, color: "#9090B8" }}>{ex.bad.label}</div>}
                </div>
              </div>
            </div>
            <div style={{ padding: "18px 20px" }}>
              {customMode ? (
                <textarea value={customBad} onChange={e => setCustomBad(e.target.value)}
                  placeholder="Type a vague, broad prompt here..."
                  style={{ width: "100%", minHeight: 100, background: "#0F0F28", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#E0E0F0", fontSize: 14, padding: "12px 14px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
              ) : (
                <div style={{ background: "#0F0F28", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(239,68,68,0.2)", fontSize: 14, color: "#E0E0F0", lineHeight: 1.6, fontStyle: "italic" }}>
                  "{ex.bad.text}"
                </div>
              )}
              {!customMode && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: "#9090B8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Why it fails</div>
                  {ex.bad.issues.map((issue, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#EF4444", marginBottom: 4 }}>
                      <span style={{ opacity: 0.7 }}>✗</span> {issue}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Good */}
          <div style={{ background: "#1A1A35", border: "1.5px solid rgba(16,185,129,0.4)", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(16,185,129,0.1)" }}>
            <div style={{ background: "linear-gradient(90deg,rgba(16,185,129,0.15),rgba(16,185,129,0.05))", borderBottom: "1px solid rgba(16,185,129,0.25)", padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>Strong Prompt</div>
                  {!customMode && <div style={{ fontSize: 11, color: "#9090B8" }}>{ex.good.label}</div>}
                </div>
              </div>
            </div>
            <div style={{ padding: "18px 20px" }}>
              {customMode ? (
                <textarea value={customGood} onChange={e => setCustomGood(e.target.value)}
                  placeholder="Type a specific, well-scoped prompt here..."
                  style={{ width: "100%", minHeight: 100, background: "#0F0F28", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, color: "#E0E0F0", fontSize: 14, padding: "12px 14px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
              ) : (
                <div style={{ background: "#0F0F28", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(16,185,129,0.2)", fontSize: 14, color: "#E0E0F0", lineHeight: 1.6, fontStyle: "italic" }}>
                  "{ex.good.text}"
                </div>
              )}
              {!customMode && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: "#9090B8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Why it works</div>
                  {ex.good.strengths.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#10B981", marginBottom: 4 }}>
                      <span style={{ opacity: 0.7 }}>✓</span> {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Run Button */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32, gap: 12, alignItems: "center" }}>
          {(badResult || goodResult) && (
            <button onClick={reset}
              style={{ padding: "14px 28px", borderRadius: 12, border: "1.5px solid #2D1B69", background: "#1A1A35", color: "#9090B8", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Reset
            </button>
          )}
          <button onClick={runDemo} disabled={running || (customMode && (!customBad.trim() || !customGood.trim()))}
            style={{
              padding: "16px 48px", borderRadius: 12,
              background: running ? "linear-gradient(135deg,#4B2A8A,#6B3A1A)" : "linear-gradient(135deg,#8B5CF6,#F59E0B)",
              border: "none", color: running ? "#9090B8" : "#fff",
              fontSize: 16, fontWeight: 700,
              cursor: running ? "not-allowed" : "pointer",
              boxShadow: running ? "none" : "0 6px 30px rgba(139,92,246,0.4)",
              transition: "all 0.3s", display: "flex", alignItems: "center", gap: 10
            }}>
            {running
              ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Calling Gemini... {timer}s</>
              : (badResult || goodResult) ? <>⚡ Run Again</> : <>⚡ Run Live Demo</>}
          </button>
        </div>

        {/* Results */}
        {(badLoading || goodLoading || badResult || goodResult) && (
          <div ref={resultsRef}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg,transparent,#2D1B69)" }} />
              <div style={{ fontSize: 12, color: "#9090B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Live Responses from Gemini
              </div>
              <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg,#2D1B69,transparent)" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {[
                { loading: badLoading, result: badResult, label: "❌ Response to Weak Prompt", color: "239,68,68", textColor: "#EF4444" },
                { loading: goodLoading, result: goodResult, label: "✅ Response to Strong Prompt", color: "16,185,129", textColor: "#10B981" }
              ].map(({ loading, result, label, color, textColor }, idx) => (
                <div key={idx} style={{ background: "#1A1A35", border: `1.5px solid rgba(${color},0.3)`, borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ background: `rgba(${color},0.08)`, borderBottom: `1px solid rgba(${color},0.2)`, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{label}</div>
                    {result && !isError(result) && <div style={{ fontSize: 11, color: "#9090B8" }}>{wordCount(result)} words</div>}
                  </div>
                  <div style={{ padding: "18px 20px" }}>
                    {loading ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[80, 95, 65, 90, 75].map((w, i) => (
                          <div key={i} style={{ height: 12, borderRadius: 6, width: `${w}%`, background: `linear-gradient(90deg,#1E1E3A,rgba(${color},0.15),#1E1E3A)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                        ))}
                        <div style={{ fontSize: 12, color: "#9090B8", marginTop: 4, fontStyle: "italic" }}>Waiting for Gemini...</div>
                      </div>
                    ) : result === "QUOTA_EXCEEDED" ? <ErrorBox type="quota" />
                      : result === "MODEL_NOT_FOUND" ? <ErrorBox type="model_not_found" />
                      : result ? <div style={{ fontSize: 13, color: "#C0C0D8", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{result}</div>
                      : null}
                  </div>
                </div>
              ))}
            </div>

            {/* Comparison stats */}
            {(() => {
              const ok = r => r && !["QUOTA_EXCEEDED","MODEL_NOT_FOUND"].includes(r);
              return ok(badResult) && ok(goodResult) && (
                <div style={{ marginTop: 18, background: "#1A1A35", border: "1.5px solid #2D1B69", borderRadius: 14, padding: "16px 24px", display: "flex", gap: 28, justifyContent: "center", flexWrap: "wrap" }}>
                  {[
                    { label: "Weak prompt response",              value: `${wordCount(badResult)} words`,                                                         color: "#EF4444" },
                    { label: "Strong prompt response",             value: `${wordCount(goodResult)} words`,                                                        color: "#10B981" },
                    { label: "Extra detail from strong prompt",    value: `+${Math.max(0, wordCount(goodResult) - wordCount(badResult))} words`,                   color: "#8B5CF6" },
                  ].map((stat, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: 11, color: "#9090B8", marginTop: 3 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Cheat Sheet */}
        <div style={{ marginTop: 32, background: "#1A1A35", border: "1.5px solid #2D1B69", borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#A78BFA", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            🎓 Prompt Engineering Cheat Sheet
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { icon: "🎯", t: "Be Specific",         d: "State exactly what you want — topic, depth, scope" },
              { icon: "📏", t: "Set Constraints",      d: "Length (200 words), count (3 examples), format (list)" },
              { icon: "👥", t: "Define Audience",      d: "PhD-level, undergraduate, policy-maker, student" },
              { icon: "📅", t: "Bound the Date Range", d: "Specify years: 2019–2024, recent 5 years, post-2020" },
              { icon: "📋", t: "Request a Format",     d: "Numbered list, table, bullet points, outline, 150 words" },
              { icon: "🔍", t: "Add Context",          d: "Sample size, field, institution, or methodology" },
            ].map((tip, i) => (
              <div key={i} style={{ background: "#0F0F28", borderRadius: 10, padding: "13px 15px", border: "1px solid #2D1B69" }}>
                <div style={{ fontSize: 18, marginBottom: 5 }}>{tip.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#E0E0F0", marginBottom: 3 }}>{tip.t}</div>
                <div style={{ fontSize: 11, color: "#9090B8", lineHeight: 1.5 }}>{tip.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        button:hover:not(:disabled) { filter: brightness(1.1); }
        textarea:focus, select:focus { outline: none; border-color: #8B5CF6 !important; }
      `}</style>
    </div>
  );
}
