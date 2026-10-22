const form = document.getElementById("form");
const panel = document.getElementById("panel");
const submitBtn = document.getElementById("submit");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");

function buildPayload(f) {
  const v = (n) => f.elements[n].value;
  return {
    Female: v("gender"),
    Married: v("married"),
    Dependents: parseInt(v("dependents"), 10),
    Graduate: v("graduate"),
    Self_Employed: v("selfEmployed"),
    ApplicantIncome: parseFloat(v("income")),
    CoapplicantIncome: parseFloat(v("coincome") || "0"),
    LoanAmount: parseFloat(v("amount")),
    Term: parseInt(v("term"), 10),
    Credit: parseInt(v("credit"), 10),
    Property: v("property"),
  };
}

function validate(f) {
  const rules = {
    dependents: (x) => (Number.isInteger(x) && x >= 0) || "Enter a whole number, 0 or more.",
    income: (x) => (Number.isFinite(x) && x >= 0) || "Enter an income of 0 or more.",
    coincome: (x) => (Number.isFinite(x) && x >= 0) || "Enter 0 if there is no co-applicant.",
    credit: (x) => (Number.isInteger(x) && x >= 300 && x <= 900) || "Enter a whole-number score between 300 and 900.",
    amount: (x) => (Number.isFinite(x) && x > 0) || "Enter a loan amount greater than 0.",
  };
  let ok = true;
  for (const [name, rule] of Object.entries(rules)) {
    const raw = f.elements[name].value;
    const res = raw === "" ? "This field is required." : rule(Number(raw));
    const field = f.elements[name].closest(".field");
    const msg = field.querySelector(".err");
    msg.textContent = res === true ? "" : res;
    field.classList.toggle("invalid", res !== true);
    if (res !== true) ok = false;
  }
  if (!ok) form.querySelector(".invalid input")?.focus();
  return ok;
}

/* Turn whatever the model returns into { approved, label, probability, raw }. */
function interpret(body) {
  let label = null, prob = null, approved = null;
  const pick = (o, keys) => keys.map((k) => Object.keys(o).find((x) => x.toLowerCase() === k)).find(Boolean);

  if (body && typeof body === "object" && !Array.isArray(body)) {
    const lk = pick(body, ["prediction", "decision", "status", "loan_status", "result", "approved", "label", "outcome"]);
    if (lk) label = body[lk];
    const pk = pick(body, ["confidence_score", "probability", "confidence", "score", "approval_probability", "prob"]);
    if (pk && typeof body[pk] === "number") prob = body[pk];
  } else {
    label = body;
  }
  if (Array.isArray(label)) label = label[0];
  if (typeof label === "boolean") approved = label;
  else if (typeof label === "number") approved = label === 1;
  else if (typeof label === "string") {
    const s = label.trim().toLowerCase();
    if (/^(y|yes|1|true)$/.test(s) || (/approv/.test(s) && !/not|un|reject|den|declin/.test(s))) approved = true;
    else if (/^(n|no|0|false)$/.test(s) || /not|reject|den|declin|disapprov/.test(s)) approved = false;
  }
  if (prob != null && prob <= 1) prob = prob * 100;
  return { approved, label, probability: prob };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

function showLoading() {
  panel.className = "panel";
  panel.innerHTML = `<div class="spinner" aria-hidden="true"></div><p class="lead">Assessing application…</p>`;
}

function showResult(body, p) {
  const r = interpret(body);
  const cls = r.approved === true ? "yes" : r.approved === false ? "no" : "unknown";
  const word = r.approved === true ? "Approved" : r.approved === false ? "Not approved" : esc(typeof r.label === "string" ? r.label : "Result received");
  const meter = r.probability != null
    ? `<div class="meter"><div class="meter-top"><span>Model confidence</span><strong>${r.probability.toFixed(1)}%</strong></div>
       <div class="meter-bar"><i style="width:${Math.min(100, r.probability)}%"></i></div></div>` : "";
  panel.className = "panel";
  panel.innerHTML = `
    <div class="verdict ${cls}"><small>Decision</small><strong>${word}</strong></div>
    ${meter}
    <dl class="summary">
      <dt>Combined monthly income</dt><dd>${fmt(p.ApplicantIncome + p.CoapplicantIncome)}</dd>
      <dt>Loan amount</dt><dd>${fmt(p.LoanAmount)}</dd>
      <dt>Term</dt><dd>${p.Term / 12} years</dd>
      <dt>Credit score</dt><dd>${p.Credit}</dd>
      <dt>Property area</dt><dd>${esc(p.Property)}</dd>
    </dl>
    <details><summary>View raw response</summary><pre>${esc(JSON.stringify(body, null, 2))}</pre></details>`;
}

function showError(body) {
  let items = [];
  if (body && Array.isArray(body.detail)) {
    items = body.detail.map((d) => `${(d.loc || []).slice(1).join(" › ") || "Input"}: ${d.msg}`);
  } else if (body && body.detail) items = [String(body.detail)];
  else items = ["The service returned an unexpected response."];
  panel.className = "panel problem";
  panel.innerHTML = `<p class="lead">The assessment could not be completed.</p>
    <ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    <p class="muted" style="margin-top:12px">Check the entries and try again.</p>`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate(form)) return;
  const payload = buildPayload(form);
  submitBtn.disabled = true;
  showLoading();
  try {
    const res = await fetch("predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let out = null;
    try { out = await res.json(); } catch { /* non-JSON response */ }
    res.ok ? showResult(out, payload) : showError(out);
  } catch {
    showError({ detail: "The UI server is not reachable." });
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById("reset").addEventListener("click", () => {
  form.querySelectorAll(".field").forEach((f) => { f.classList.remove("invalid"); const m = f.querySelector(".err"); if (m) m.textContent = ""; });
  panel.className = "panel idle";
  panel.innerHTML = `<p class="lead">No assessment yet.</p><p class="muted">Complete the form and select <em>Assess application</em>. The decision appears here.</p>`;
});

async function checkHealth() {
  try {
    const r = await fetch("health");
    const ok = r.ok;
    statusEl.className = "status " + (ok ? "online" : "offline");
    statusText.textContent = ok ? "Prediction service online" : "Prediction service offline";
  } catch {
    statusEl.className = "status offline";
    statusText.textContent = "Prediction service offline";
  }
}
checkHealth();
setInterval(checkHealth, 30000);
