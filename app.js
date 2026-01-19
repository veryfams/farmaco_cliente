// app.js (FarmaCo | Cloud Client)
// Objetivo: UI mínima que invoca contratos REST (sin lógica de negocio).
// Nota: el llamado a AWS se hace vía /api/invoke (proxy en Vercel) para evitar CORS en el navegador.

/* =========================
   Config / Catálogo (contratos mínimos)
========================= */

const DEFAULT_BASE_URL = "https://zv9jw8m7vj.execute-api.us-east-1.amazonaws.com/prod";

const STEPS = [
  {
    key: "emit",
    stepTitle: "PASO 1",
    title: "Emitir receta",
    desc: "Se registra una receta y el sistema confirma recepción.",
    method: "POST",
    path: "/prescriptions/emit",
    exampleBody: {
      doctorName: "Dr. Juan Perez",
      doctorLicense: "MED-999",
      patientName: "Maria Lopez",
      patientIdentification: "0102030405",
      issueDate: "2026-01-18T23:00:00Z",
      items: [
        {
          medicineName: "Amoxicilina",
          quantity: 2,
          dosage: "500mg cada 8h",
          notes: "Tomar con comida"
        }
      ]
    }
  },
  {
    key: "search",
    stepTitle: "PASO 2",
    title: "Buscar farmacias",
    desc: "Consulta farmacias disponibles (demo).",
    method: "POST",
    path: "/pharmacies/search",
    exampleBody: {
      request: {
        prescriptionCode: "RX-12345",
        userLocation: {
          latitude: -2.90055,
          longitude: -79.00453
        },
        searchRadiusKM: 3
      }
    }
  },
  {
    key: "check",
    stepTitle: "PASO 3",
    title: "Consultar stock",
    desc: "Verifica disponibilidad de medicamentos (demo).",
    method: "POST",
    path: "/stock/check",
    exampleBody: {
      request: {
        requestId: "REQ-001",
        items: [
          { medicineCode: "AMOX500", quantityRequired: 2 },
          { medicineCode: "IBU400", quantityRequired: 1 }
        ]
      }
    }
  },
  {
    key: "redeem",
    stepTitle: "PASO 4",
    title: "Procesar redención",
    desc: "Procesa la entrega/dispensación (demo).",
    method: "POST",
    path: "/redemptions/process",
    exampleBody: {
      request: {
        transactionId: "tx-demo-001",
        prescriptionCode: "RX-12345",
        pharmacyId: "PHARM-01",
        items: [
          { medicineCode: "AMOX500", quantity: 2 }
        ]
      }
    }
  }
];

/* =========================
   DOM helpers
========================= */
const $ = (id) => document.getElementById(id);

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/* =========================
   UI rendering
========================= */
function renderSteps() {
  const stepsEl = $("steps");
  stepsEl.innerHTML = "";

  STEPS.forEach((s) => {
    const card = document.createElement("div");
    card.className = "step";

    card.innerHTML = `
      <div class="muted">${s.stepTitle}</div>
      <div class="step-title">${s.title}</div>
      <div class="step-desc">${s.desc}</div>
      <button class="btn btn-primary" data-action="${s.key}">Ejecutar</button>
    `;

    stepsEl.appendChild(card);
  });

  stepsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const key = btn.getAttribute("data-action");
    const step = STEPS.find(x => x.key === key);
    if (step) runStep(step);
  });
}

function setStatus(message, type = "info") {
  const box = $("statusBox");
  if (!box) return;

  // Solo estilos simples por tipo
  if (type === "ok") {
    box.style.borderColor = "rgba(15,118,110,.35)";
    box.style.background = "rgba(15,118,110,.06)";
    box.textContent = message;
    return;
  }
  if (type === "error") {
    box.style.borderColor = "rgba(220,38,38,.35)";
    box.style.background = "rgba(220,38,38,.06)";
    box.textContent = message;
    return;
  }

  box.style.borderColor = "rgba(148,163,184,.6)";
  box.style.background = "#f8fafc";
  box.textContent = message;
}

function addLogEntry(kind, title, metaRight, payloadObj) {
  const log = $("log");
  if (!log) return;

  const entry = document.createElement("div");
  entry.className = "log-entry";

  const meta = document.createElement("div");
  meta.className = "log-meta";
  meta.textContent = `${nowIso()} | ${metaRight}`;

  const h = document.createElement("div");
  h.className = "log-title";
  h.textContent = title;

  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(payloadObj, null, 2);

  entry.appendChild(h);
  entry.appendChild(meta);
  entry.appendChild(pre);

  // Insertar arriba (más reciente primero)
  log.prepend(entry);
}

function clearLog() {
  const log = $("log");
  if (log) log.innerHTML = "";
  setStatus("Selecciona una acción para comenzar.");
}

/* =========================
   Network: Proxy call (/api/invoke)
========================= */
async function invokeViaProxy(baseUrl, path, body) {
  const resp = await fetch("/api/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl, path, body })
  });

  const raw = await resp.text();
  const parsed = safeJsonParse(raw);
  return { httpStatus: resp.status, body: parsed ?? raw };
}

/* =========================
   Main action
========================= */
async function runStep(step) {
  const baseUrl = ($("baseUrl")?.value || "").trim() || DEFAULT_BASE_URL;

  // 1) Registrar solicitud enviada (evidencia cliente, sin “contratos” visibles)
  addLogEntry(
    "request",
    `Solicitud enviada: ${step.title}`,
    `${step.method} ${step.path}`,
    { request: step.exampleBody }
  );

  setStatus(`Enviando: ${step.title}...`);

  try {
    // 2) Invocar (proxy -> AWS)
    const result = await invokeViaProxy(baseUrl, step.path, step.exampleBody);

    // result.body esperado: { ok, awsStatus, awsBody } si tu proxy está como te lo dejé.
    // Si no, igual lo mostramos.

    // Normalizar visual
    let awsStatus = null;
    let awsBody = null;

    if (result && typeof result.body === "object" && result.body !== null) {
      // Proxy recomendado
      if ("awsStatus" in result.body) awsStatus = result.body.awsStatus;
      if ("awsBody" in result.body) awsBody = result.body.awsBody;
    }

    const finalStatus = awsStatus ?? result.httpStatus;
    const finalBody = awsBody ?? result.body;

    // 3) Mostrar respuesta del sistema
    addLogEntry(
      "response",
      `Respuesta del sistema: ${step.title}`,
      `HTTP ${finalStatus}`,
      { response: finalBody, awsStatus: finalStatus }
    );

    // 4) Mensaje amigable
    if (String(finalStatus).startsWith("2")) {
      setStatus("Solicitud aceptada ✅", "ok");
    } else {
      setStatus("No se pudo completar la solicitud. Intenta nuevamente.", "error");
    }
  } catch (e) {
    addLogEntry(
      "error",
      `Error: ${step.title}`,
      "NETWORK",
      { error: String(e) }
    );
    setStatus("No se pudo completar la solicitud. Intenta nuevamente.", "error");
  }
}

/* =========================
   About modal
========================= */
function initAboutModal() {
  const aboutBtn = $("aboutBtn");
  const aboutModal = $("aboutModal");
  const closeAbout = $("closeAbout");

  if (!aboutBtn || !aboutModal || !closeAbout) return;

  aboutBtn.onclick = () => aboutModal.setAttribute("aria-hidden", "false");
  closeAbout.onclick = () => aboutModal.setAttribute("aria-hidden", "true");

  aboutModal.onclick = (e) => {
    if (e.target === aboutModal) aboutModal.setAttribute("aria-hidden", "true");
  };
}

/* =========================
   Init
========================= */
function init() {
  // Base URL
  const base = $("baseUrl");
  if (base) base.value = DEFAULT_BASE_URL;

  renderSteps();

  const clearBtn = $("clearLog");
  if (clearBtn) clearBtn.onclick = clearLog;

  initAboutModal();

  setStatus("Selecciona una acción para comenzar.");
}

document.addEventListener("DOMContentLoaded", init);
