// ===== AI Literacy Self-Check — front-end logic =====

// Toggle variant:
// - HYBRID = true  -> includes Q15 (Productivity/time-save as a 7th dimension) + AI NPS
// - HYBRID = false -> 6 dimensions only + AI NPS
const HYBRID = true;

// Endpoint/secret: prefer globals from index.html
const FLOW_URL =
  (typeof window !== "undefined" && window.FLOW_URL) ||
  "/.netlify/functions/submit"; // fallback not used for CF Worker

const FLOW_SECRET =
  (typeof window !== "undefined" && window.FLOW_SECRET) || ""; // optional header

// Build 1–5 radios (Q15 uses custom labels)
const LABELS = ["Never", "Rarely", "Sometimes", "Often", "Always"];
const TIME_LABELS = [
  "None / Hardly any",
  "Up to 15 minutes a day",
  "15–30 minutes a day",
  "30–60 minutes a day",
  "Over an hour a day",
];

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".scale").forEach((wrap, idx) => {
    const name = wrap.dataset.name || `q${idx + 1}`;
    const source = name === "q15" ? TIME_LABELS : LABELS;
    source.forEach((lab, i) => {
      const id = `${name}_${i + 1}`;
      const label = document.createElement("label");
      label.innerHTML = `<input type="radio" id="${id}" name="${name}" value="${i + 1}" required /> ${lab}`;
      wrap.appendChild(label);
    });
  });
});

// Dimension mapping
const DIMENSION_MAP_6 = {
  safe: [0, 1],
  everyday: [2, 3],
  prompting: [4, 5, 6],
  process: [7, 8],
  integration: [9, 10, 11, 12],
  sharing: [13],
};
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

  // Optional AI NPS
  let aiNps = null;
  const npsSel = form.querySelector('input[name="aiNps"]:checked');
  if (npsSel) aiNps = Number(npsSel.value);

  // Compute dimension averages
  const scoreObj = {};
  Object.keys(DIMENSION_MAP).forEach((key) => {
    scoreObj[key] = average(DIMENSION_MAP[key].map((ix) => answers[ix]));
  });
  const overall = average(answers);
  const scores = { ...scoreObj, overall };

  // Persist minimal data for results page fallback
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

  // POST (best-effort, non-blocking)
  try {
    if (FLOW_URL && typeof FLOW_URL === "string" && FLOW_URL.startsWith("http")) {
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
        toolVersion: HYBRID ? "v4-hybrid" : "v4-nps-only",
      };

      const headers = { "Content-Type": "application/json" };
      if (FLOW_SECRET) headers["x-tool-key"] = FLOW_SECRET;

      fetch(FLOW_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payloadOut),
        mode: "cors",
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}

  // Continue to results
  const p = btoa(JSON.stringify({ ...scores, hybrid: HYBRID, aiNps }));
  window.location.href = `results.html?p=${encodeURIComponent(p)}`;
});
