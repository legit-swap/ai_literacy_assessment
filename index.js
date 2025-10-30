// ===== AI Literacy Self-Check — front-end logic =====

// Toggle variant:
// - HYBRID = true  -> includes Q15 (Productivity pulse as a 7th dimension) + AI NPS
// - HYBRID = false -> 6 dimensions only + AI NPS
const HYBRID = true;

// Endpoint/secret:
// If you're using a Netlify Function, you can leave FLOW_URL as the relative path below.
// If you prefer an absolute URL, set window.FLOW_URL in HTML or replace the string.
const FLOW_URL =
  (typeof window !== "undefined" && window.FLOW_URL) ||
  "/.netlify/functions/submit"; // works on the same Netlify site

const FLOW_SECRET =
  (typeof window !== "undefined" && window.FLOW_SECRET) || ""; // optional header

// Build 1–5 Likert radios for each .scale block
const LABELS = ["Never", "Rarely", "Sometimes", "Often", "Always"];
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".scale").forEach((wrap, idx) => {
    const name = wrap.dataset.name || `q${idx + 1}`;
    LABELS.forEach((lab, i) => {
      const id = `${name}_${i + 1}`;
      const label = document.createElement("label");
      label.innerHTML = `<input type="radio" id="${id}" name="${name}" value="${i + 1}" required /> ${lab}`;
      wrap.appendChild(label);
    });
  });
});

// Dimension mapping: indices into the answers array (0-based)
const DIMENSION_MAP_6 = {
  safe: [0, 1],
  everyday: [2, 3],
  prompting: [4, 5, 6],
  process: [7, 8],
  integration: [9, 10, 11, 12],
  sharing: [13],
};
// With Q15 as a separate 7th dimension
const DIMENSION_MAP_7 = {
  safe: [0, 1],
  everyday: [2, 3],
  prompting: [4, 5, 6],
  process: [7, 8],
  integration: [9, 10, 11, 12],
  sharing: [13],
  productivity: [14],
};
const DIMENSION_MAP = HYBRID ? DIMENSION_MAP_7 : DIMENSION_MAP_6;

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Form submit
const form = document.getElementById("quiz-form");
form.addEventListener("submit", (e) => {
  e.preventDefault();

  // Required: Business Unit
  const buSel = document.getElementById("businessUnit");
  const bu = buSel ? buSel.value : "";
  if (!bu) {
    alert("Please pick your Business Unit.");
    return;
  }

  // Collect answers q1..q14 (+ q15 if HYBRID)
  const maxQ = HYBRID ? 15 : 14;
  const answers = [];
  for (let i = 1; i <= maxQ; i++) {
    const val = form.querySelector(`input[name="q${i}"]:checked`);
    if (!val) {
      alert(`Please answer question ${i}.`);
      return;
    }
    answers.push(Number(val.value));
  }

  // Optional: AI NPS (five-point scale, not part of the average score)
  let aiNps = null;
  const npsSel = form.querySelector('input[name="aiNps"]:checked');
  if (npsSel) {
    aiNps = Number(npsSel.value);
  }

  // Compute dimension averages
  const scoreObj = {};
  Object.keys(DIMENSION_MAP).forEach((key) => {
    scoreObj[key] = average(DIMENSION_MAP[key].map((ix) => answers[ix]));
  });
  const overall = average(answers);
  const scores = { ...scoreObj, overall };

  // Persist minimal data to localStorage for results page fallback
  try {
    localStorage.setItem(
      "aiQuizResult",
      JSON.stringify({
        timestamp: new Date().toISOString(),
        businessUnit: bu,
        answers,
        aiNps,
        hybrid: HYBRID,
      })
    );
  } catch {}

  // Try to POST (best-effort, non-blocking)
  try {
    // Accept both absolute and relative URLs
    if (FLOW_URL && typeof FLOW_URL === "string" && FLOW_URL.trim().length > 0) {
      const payloadOut = {
        timestamp: new Date().toISOString(),
        businessUnit: bu,
        overall,
        safe: scores.safe,
        everyday: scores.everyday,
        prompting: scores.prompting,
        process: scores.process,
        integration: scores.integration,
        sharing: scores.sharing,
        ...(HYBRID ? { productivity: scores.productivity } : {}),
        aiNps,
        toolVersion: HYBRID ? "v3-hybrid" : "v3-nps-only",
      };

      const headers = { "Content-Type": "application/json" };
      if (FLOW_SECRET) headers["x-tool-key"] = FLOW_SECRET;

      fetch(FLOW_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payloadOut),
        // same-origin works for relative paths; absolute will use CORS
        mode: FLOW_URL.startsWith("http") ? "cors" : "same-origin",
        keepalive: true,
      }).catch(() => {});
    }
  } catch (e) {
    // ignore network errors so UX proceeds to results
  }

  // Continue to results (pass scores via URL for immediate render)
  const p = btoa(JSON.stringify({ ...scores, hybrid: HYBRID, aiNps }));
  window.location.href = `results.html?p=${encodeURIComponent(p)}`;
});
