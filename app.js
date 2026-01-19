const DEFAULT_BASE_URL = "https://zv9jw8m7vj.execute-api.us-east-1.amazonaws.com/prod";

const STEPS = [
  {
    id: "emit",
    title: "Emitir receta",
    kicker: "Paso 1",
    desc: "Se registra una receta y el sistema confirma recepción.",
    path: "/prescriptions/emit",
    sample: {
      doctorName: "Dr. Juan Perez",
      doctorLicense: "MED-999",
      patientName: "Maria Lopez",
      patientIdentification: "0102030405",
      issueDate: "2026-01-18T23:00:00Z",
      items: [
        { medicineName: "Amoxicilina", quantity: 2, dosage: "500mg cada 8h", notes: "Tomar con comida" }
      ]
    }
  },
  {
    id: "search",
    title: "Buscar farmacias",
    kicker: "Paso 2",
    desc: "Consulta farmacias disponibles (demo).",
    path: "/pharmacies/search",
    sample: {
      prescriptionCode: "RX-12345",
      userLocation: { latitude: -2.90055, longitude: -79.00453 },
      searchRadiusKM: 3
    }
  },
  {
    id: "check",
    title: "Consultar stock",
    kicker: "Paso 3",
    desc: "Verifica disponibilidad de medicamentos (demo).",
    path: "/stock/check",
    sample: {
      requestId: "REQ-001",
      items: [
        { medicineCode: "AMOX500", quantityRequired: 2 },
        { medicineCode: "IBU400", quantityRequired: 1 }
      ]
    }
  },
  {
    id: "redeem",
    title: "Procesar redención",
    kicker: "Paso 4",
    desc: "Procesa la entrega/dispensación (demo).",
    path: "/redemptions/process",
    sample: {
      prescriptionCode: "RX-12345",
      pharmacyId: "PH-001",
      pharmacistId: "EMP-778",
      scanTimestamp: "2026-01-18T23:10:00Z"
    }
  }
];

const $ = (id) => document.getElementById(id);

function pretty(x) {
  try { return JSON.stringify(x, null, 2); } catch { return String(x); }
}

function now() {
  return new Date().toISOString();
}

function setStatus(msg) {
  $("statusBox").textContent = msg;
}

function addLog(title, meta, bodyObj) {
  const wrap = document.createElement("div");
  wrap.className = "log-item";
  wrap.innerHTML = `
    <div class="log-top">
      <div class="log-title">${title}</div>
      <div class="log-meta">${meta}</div>
    </div>
    <div class="log-body"></div>
  `;
  wrap.querySelector(".log-body").textContent = pretty(bodyObj);
  $("log").prepend(wrap);
}

async function invokeAws(baseUrl, path, body) {
  // Llamamos a nuestro proxy en Vercel, no directo a AWS
  const resp = await fetch("/api/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl, path, body })
  });

  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || "invoke failed");
  return data; // { ok:true, awsStatus, awsBody }
}

function renderSteps() {
  const container = $("steps");
  container.innerHTML = "";

  for (const step of STEPS) {
    const el = document.createElement("div");
    el.className = "step";
    el.innerHTML = `
      <div class="kicker">${step.kicker}</div>
      <div class="name">${step.title}</div>
      <div class="desc">${step.desc}</div>
      <button class="btn btn-primary" data-step="${step.id}">Ejecutar</button>
    `;
    container.appendChild(el);
  }

  container.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-step]");
    if (!btn) return;

    const stepId = btn.getAttribute("data-step");
    const step = STEPS.find(s => s.id === stepId);
    if (!step) return;

    const baseUrl = ($("baseUrl").value || "").trim() || DEFAULT_BASE_URL;

    btn.disabled = true;
    btn.textContent = "Enviando...";

    try {
      setStatus(`Enviando solicitud: ${step.title}...`);

      addLog(
        `Solicitud enviada: ${step.title}`,
        `${now()}  |  POST ${step.path}`,
        { request: step.sample }
      );

      const result = await invokeAws(baseUrl, step.path, step.sample);

      // Interpretación simple para cliente:
      const awsStatus = result.awsStatus;
      const awsBody = result.awsBody;

      let tx = null;
      if (awsBody && typeof awsBody === "object") {
        tx = awsBody.transactionId || awsBody.transactionID || awsBody.TransactionId || null;
      }

      if (awsStatus === 202) {
        setStatus(tx
          ? `Solicitud aceptada ✅  (ID: ${tx})`
          : `Solicitud aceptada ✅`
        );
      } else {
        setStatus(`Respuesta recibida (HTTP ${awsStatus})`);
      }

      addLog(
        `Respuesta del sistema: ${step.title}`,
        `${now()}  |  HTTP ${awsStatus}`,
        { response: awsBody, awsStatus }
      );

    } catch (err) {
      setStatus(`No se pudo completar la solicitud. Intenta nuevamente.`);
      addLog(
        `Error: ${step.title}`,
        `${now()}`,
        { error: String(err) }
      );
    } finally {
      btn.disabled = false;
      btn.textContent = "Ejecutar";
    }
  });
}

function init() {
  $("baseUrl").value = DEFAULT_BASE_URL;

  $("clearLog").onclick = () => {
    $("log").innerHTML = "";
    setStatus("Selecciona una acción para comenzar.");
  };

  renderSteps();
}

init();
