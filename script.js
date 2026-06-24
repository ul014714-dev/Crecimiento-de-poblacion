// ============================================================
//  LogiSim – Lógica del Modelo de Crecimiento Poblacional
//  P(t) = K / (1 + A * e^(-r*t))
//  donde  A = (K - P0) / P0
// ============================================================

'use strict';

/* ────────────────────────────────────────
   Estado global de la simulación
──────────────────────────────────────── */
const State = {
  K:    0,          // Capacidad de carga (población total)
  P0:   0,          // Población inicial
  r:    0,          // Tasa de crecimiento intrínseco
  A:    0,          // Constante de integración
  data: [],         // [{ t, P }] — serie temporal calculada
  tMax: 0,          // Tiempo máximo de la simulación
  computed: false,  // ¿Hubo un cálculo previo?
};

/* ────────────────────────────────────────
   Elementos del DOM
──────────────────────────────────────── */
const DOM = {
  inputK:        document.getElementById('input-K'),
  inputP0:       document.getElementById('input-P0'),
  inputR:        document.getElementById('input-r'),
  btnCalc:       document.getElementById('btn-calculate'),
  toast:         document.getElementById('toast'),
  viewForm:      document.getElementById('view-form'),
  viewResults:   document.getElementById('view-results'),
  tabForm:       document.getElementById('tab-form'),
  tabResults:    document.getElementById('tab-results'),
  // Métricas
  metaK:         document.getElementById('meta-K'),
  metaP0:        document.getElementById('meta-P0'),
  metaA:         document.getElementById('meta-A'),
  metaTmax:      document.getElementById('meta-tmax'),
  // Gráfico
  canvas:        document.getElementById('chart-canvas'),
  tooltip:       document.getElementById('chart-tooltip'),
  // Tabla
  tableBody:     document.getElementById('table-body'),
};

/* ────────────────────────────────────────
   Modelo Logístico
──────────────────────────────────────── */

/**
 * P(t) = K / (1 + A * e^(-r*t))
 * @param {number} t - Tiempo
 * @param {number} K - Capacidad de carga
 * @param {number} A - Constante de integración
 * @param {number} r - Tasa de crecimiento
 * @returns {number} Población en t
 */
function logistic(t, K, A, r) {
  return K / (1 + A * Math.exp(-r * t));
}

/**
 * Calcula cuántos períodos se necesitan para llegar al 99 % de K
 * Resolviendo:  0.99·K = K / (1 + A·e^(-r·t))
 *   → t = ln(A / 0.01) / r
 */
function estimateTmax(A, r) {
  if (A <= 0 || r <= 0) return 100;
  const t = Math.log(A / 0.01) / r;
  return Math.ceil(Math.max(t, 20));
}

/**
 * Genera la serie temporal con 'steps' puntos uniformes en [0, tMax]
 */
function generateSeries(K, P0, r, steps = 200) {
  const A    = (K - P0) / P0;
  const tMax = estimateTmax(A, r);
  const dt   = tMax / steps;
  const data = [];

  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    data.push({ t, P: logistic(t, K, A, r) });
  }

  return { A, tMax, data };
}

/* ────────────────────────────────────────
   Validación
──────────────────────────────────────── */
function validate() {
  const K  = parseFloat(DOM.inputK.value);
  const P0 = parseFloat(DOM.inputP0.value);
  const r  = parseFloat(DOM.inputR.value);

  if (isNaN(K)  || K  <= 0)   return { ok: false, msg: '⚠ La población total debe ser un número positivo.' };
  if (isNaN(P0) || P0 <= 0)   return { ok: false, msg: '⚠ La población inicial debe ser un número positivo.' };
  if (P0 >= K)                 return { ok: false, msg: '⚠ La población inicial (P₀) debe ser menor que la capacidad de carga (K).' };
  if (isNaN(r)  || r  <= 0)   return { ok: false, msg: '⚠ La tasa de crecimiento debe ser un número positivo.' };
  if (r > 10)                  return { ok: false, msg: '⚠ La tasa de crecimiento parece muy alta. Usa valores entre 0.01 y 10.' };

  return { ok: true, K, P0, r };
}

/* ────────────────────────────────────────
   Toast de notificación
──────────────────────────────────────── */
let toastTimer = null;

function showToast(msg, type = 'error') {
  if (toastTimer) clearTimeout(toastTimer);
  DOM.toast.textContent = msg;
  DOM.toast.className   = `toast ${type} show`;
  toastTimer = setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, 3500);
}

/* ────────────────────────────────────────
   Pestañas de vista
──────────────────────────────────────── */
function switchView(view) {
  // 'form' | 'results'
  const isResults = view === 'results';

  DOM.viewForm.classList.toggle('active', !isResults);
  DOM.viewResults.classList.toggle('active', isResults);
  DOM.tabForm.classList.toggle('active', !isResults);
  DOM.tabResults.classList.toggle('active', isResults);
}

DOM.tabForm.addEventListener('click', () => switchView('form'));
DOM.tabResults.addEventListener('click', () => {
  if (!State.computed) {
    showToast('⚠ Primero calcula una proyección en el formulario.', 'error');
    return;
  }
  switchView('results');
});

/* ────────────────────────────────────────
   Botón Calcular
──────────────────────────────────────── */
DOM.btnCalc.addEventListener('click', () => {
  const validation = validate();
  if (!validation.ok) {
    showToast(validation.msg, 'error');
    return;
  }

  const { K, P0, r } = validation;
  const { A, tMax, data } = generateSeries(K, P0, r, 250);

  // Guardar estado global
  State.K  = K;
  State.P0 = P0;
  State.r  = r;
  State.A  = A;
  State.tMax = tMax;
  State.data = data;
  State.computed = true;

  // Actualizar métricas
  DOM.metaK.textContent    = formatNumber(K);
  DOM.metaP0.textContent   = formatNumber(P0);
  DOM.metaA.textContent    = A.toFixed(4);
  DOM.metaTmax.textContent = tMax;

  // Renderizar gráfico y tabla
  drawChart();
  buildTable();

  // Cambiar a vista de resultados
  switchView('results');
  showToast('✓ Proyección calculada con éxito.', 'success');
});

/* ────────────────────────────────────────
   Formato de números
──────────────────────────────────────── */
function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1)     + 'K';
  return Math.round(n).toLocaleString();
}

function formatFull(n) {
  return Math.round(n).toLocaleString('es-MX');
}

/* ────────────────────────────────────────
   Gráfico en Canvas (sin dependencias)
──────────────────────────────────────── */
const CHART = {
  pad: { top: 30, right: 30, bottom: 55, left: 70 },
};

function drawChart() {
  const canvas  = DOM.canvas;
  const ctx     = canvas.getContext('2d');
  const data    = State.data;
  const K       = State.K;
  const P0      = State.P0;
  const tMax    = State.tMax;

  // Ajustar resolución al DPR
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const { pad } = CHART;
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top  - pad.bottom;

  // Guardar dimensiones para tooltip
  CHART.W = W; CHART.H = H; CHART.plotW = plotW; CHART.plotH = plotH;
  CHART.dpr = dpr;

  // Limpiar
  ctx.clearRect(0, 0, W, H);

  // ── Fondo del área de trazado ──
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.beginPath();
  ctx.roundRect(pad.left, pad.top, plotW, plotH, 8);
  ctx.fill();

  // ── Rejilla horizontal ──
  const yTicks = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= yTicks; i++) {
    const y = pad.top + (plotH / yTicks) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();

    // Etiqueta eje Y
    const val = K - (K / yTicks) * i;
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font = `${11}px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatNumber(val), pad.left - 8, y);
  }

  // ── Rejilla vertical ──
  const xTicks = 8;
  for (let i = 0; i <= xTicks; i++) {
    const x = pad.left + (plotW / xTicks) * i;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();

    // Etiqueta eje X
    const t = (tMax / xTicks) * i;
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font = `${11}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(t.toFixed(1), x, pad.top + plotH + 8);
  }

  // ── Etiquetas de ejes ──
  ctx.fillStyle = 'rgba(148,163,184,0.9)';
  ctx.font = `600 12px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Tiempo (t)', pad.left + plotW / 2, H - 4);

  ctx.save();
  ctx.translate(14, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Población P(t)', 0, 0);
  ctx.restore();

  // ── Función de conversión ──
  function toX(t) { return pad.left + (t / tMax) * plotW; }
  function toY(P) { return pad.top + plotH - (P / K)  * plotH; }

  // ── Línea de capacidad K (línea punteada) ──
  ctx.strokeStyle = 'rgba(245,158,11,0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left + plotW, pad.top);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(245,158,11,0.8)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`K = ${formatNumber(K)}`, pad.left + plotW - 4, pad.top - 4);

  // ── Área rellena bajo la curva ──
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  grad.addColorStop(0, 'rgba(59,130,246,0.25)');
  grad.addColorStop(1, 'rgba(6,182,212,0.02)');

  ctx.beginPath();
  ctx.moveTo(toX(data[0].t), toY(data[0].P));
  for (let i = 1; i < data.length; i++) {
    ctx.lineTo(toX(data[i].t), toY(data[i].P));
  }
  ctx.lineTo(toX(data[data.length - 1].t), pad.top + plotH);
  ctx.lineTo(toX(data[0].t), pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // ── Curva logística principal ──
  const lineGrad = ctx.createLinearGradient(pad.left, 0, pad.left + plotW, 0);
  lineGrad.addColorStop(0, '#3b82f6');
  lineGrad.addColorStop(1, '#06b6d4');

  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap  = 'round';

  ctx.beginPath();
  ctx.moveTo(toX(data[0].t), toY(data[0].P));
  for (let i = 1; i < data.length; i++) {
    ctx.lineTo(toX(data[i].t), toY(data[i].P));
  }
  ctx.stroke();

  // ── Punto de inflexión (P = K/2) ──
  const tInfl  = Math.log(State.A) / State.r;
  const PInfl  = K / 2;
  if (tInfl >= 0 && tInfl <= tMax) {
    const xi = toX(tInfl);
    const yi = toY(PInfl);

    ctx.strokeStyle = 'rgba(139,92,246,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(xi, pad.top);
    ctx.lineTo(xi, pad.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(xi, yi, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(139,92,246,0.9)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Inflexión (t=${tInfl.toFixed(1)})`, xi + 8, yi - 4);
  }

  // ── Punto P0 ──
  const x0 = toX(0);
  const y0 = toY(P0);
  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.arc(x0, y0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(6,182,212,0.9)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`P₀ = ${formatNumber(P0)}`, x0 + 8, y0 - 4);

  // Guardar conversores para el tooltip
  CHART.toX = toX;
  CHART.toY = toY;
  CHART.fromX = (px) => ((px - pad.left) / plotW) * tMax;
}

/* ────────────────────────────────────────
   Tooltip interactivo del Canvas
──────────────────────────────────────── */
DOM.canvas.addEventListener('mousemove', (e) => {
  if (!State.computed) return;
  const rect = DOM.canvas.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  const { pad } = CHART;

  if (mx < pad.left || mx > CHART.W - pad.right ||
      my < pad.top  || my > CHART.H - pad.bottom) {
    DOM.tooltip.style.display = 'none';
    return;
  }

  const t = CHART.fromX(mx);
  if (t < 0 || t > State.tMax) { DOM.tooltip.style.display = 'none'; return; }

  const P = logistic(t, State.K, State.A, State.r);

  const tEl = DOM.tooltip;
  tEl.innerHTML = `<strong>t = ${t.toFixed(2)}</strong>&nbsp;&nbsp;P(t) = ${formatFull(P)}`;
  tEl.style.display = 'block';

  // Posición del tooltip (evitar desbordamiento)
  const tw = tEl.offsetWidth;
  const th = tEl.offsetHeight;
  let tx = mx + 14;
  let ty = my - th - 10;
  if (tx + tw > CHART.W) tx = mx - tw - 14;
  if (ty < 0)             ty = my + 14;

  tEl.style.left = tx + 'px';
  tEl.style.top  = ty + 'px';
});

DOM.canvas.addEventListener('mouseleave', () => {
  DOM.tooltip.style.display = 'none';
});

/* ────────────────────────────────────────
   Redibujar al cambiar tamaño
──────────────────────────────────────── */
let resizeTimer;
window.addEventListener('resize', () => {
  if (!State.computed) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawChart, 150);
});

/* ────────────────────────────────────────
   Tabla de datos
──────────────────────────────────────── */
function buildTable() {
  const K    = State.K;
  const body = DOM.tableBody;
  body.innerHTML = '';

  // Tomamos cada 10 puntos de la serie (≈ 25 filas)
  const step  = Math.max(1, Math.floor(State.data.length / 40));
  const rows  = State.data.filter((_, i) => i % step === 0);

  // Asegurar que el último punto siempre aparece
  const last = State.data[State.data.length - 1];
  if (rows[rows.length - 1] !== last) rows.push(last);

  rows.forEach((d, i) => {
    const pct = (d.P / K) * 100;
    const delta = i === 0 ? '—' :
      (d.P - rows[i - 1].P >= 0 ? '+' : '') +
      formatFull(d.P - rows[i - 1].P);

    const growthPhase =
      pct < 20  ? { label: 'Inicial',      color: '#3b82f6' } :
      pct < 50  ? { label: 'Exponencial',  color: '#06b6d4' } :
      pct < 80  ? { label: 'Inflexión',    color: '#8b5cf6' } :
      pct < 95  ? { label: 'Desaceleración', color: '#f59e0b' } :
                  { label: 'Saturación',   color: '#10b981' };

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.t.toFixed(2)}</td>
      <td>${formatFull(d.P)}</td>
      <td>${pct.toFixed(2)}%</td>
      <td>
        <div class="progress-cell">
          <div class="progress-bar-mini">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </td>
      <td>${delta}</td>
      <td>
        <span style="
          display:inline-flex;
          align-items:center;
          gap:5px;
          padding:2px 10px;
          border-radius:999px;
          font-size:0.72rem;
          font-weight:600;
          background:${growthPhase.color}18;
          color:${growthPhase.color};
          border:1px solid ${growthPhase.color}44;
        ">
          ${growthPhase.label}
        </span>
      </td>
    `;
    body.appendChild(tr);
  });
}

/* ────────────────────────────────────────
   Animación de entrada de tarjetas
──────────────────────────────────────── */
function animateCards() {
  const cards = document.querySelectorAll('.input-card');
  cards.forEach((card, i) => {
    card.style.opacity   = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      card.style.opacity    = '1';
      card.style.transform  = 'translateY(0)';
    }, i * 120 + 200);
  });
}

/* ────────────────────────────────────────
   Inicialización
──────────────────────────────────────── */
function init() {
  // Vista inicial: formulario
  switchView('form');
  animateCards();

  // Valores de ejemplo precargados
  DOM.inputK.value  = '1000000';
  DOM.inputP0.value = '100';
  DOM.inputR.value  = '0.3';

  // Enter en inputs dispara el cálculo
  [DOM.inputK, DOM.inputP0, DOM.inputR].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') DOM.btnCalc.click();
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
