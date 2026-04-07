const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const weekdayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const legendItems = [
  { label: 'Dia de prática', className: 'phase', color: '#16a34a' },
  { label: 'Feriado', className: 'block-holiday', color: '#f59e0b' },
  { label: 'Recesso', className: 'block-recess', color: '#ef4444' },
  { label: 'Folga administrativa', className: 'block-admin-leave', color: '#0f62fe' },
  { label: 'Ação pedagógica', className: 'block-training', color: '#8b5cf6' }
];

const state = {
  blocks: [],
  monthlyQuotas: {},
  phaseDays: [],
  reportRows: [],
  endDate: null,
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  bindElements();
  bindEvents();
  loadTheme();
  setDefaultStartDate();
  renderLegend();
  renderMonthlyQuotaInputs();
  refreshBlockList();
  updateQuotaPanelVisibility();
  updateSummary();
});

function bindElements() {
  [
    'clientName', 'unitName', 'userName', 'startDate', 'hoursPerDay', 'totalHours', 'calculationMode',
    'blockType', 'blockDescription', 'blockStart', 'blockEnd', 'blockList', 'monthlyQuotaContainer',
    'btnAddBlock', 'btnGenerate', 'btnReset', 'btnExportPdf', 'calendarLegend', 'calendarMount',
    'reportMount', 'sumPhaseDays', 'sumHoursPerDay', 'sumTotalHours', 'sumEndDate', 'heroTotalDias',
    'heroDataFim', 'themeToggle', 'quotaPanel'
  ].forEach((id) => { els[id] = document.getElementById(id); });
}

function bindEvents() {
  els.btnAddBlock.addEventListener('click', addBlock);
  els.btnGenerate.addEventListener('click', generateSchedule);
  els.btnReset.addEventListener('click', resetAll);
  els.btnExportPdf.addEventListener('click', exportPdf);
  els.calculationMode.addEventListener('change', updateQuotaPanelVisibility);
  els.themeToggle.addEventListener('click', toggleTheme);
  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
}

function loadTheme() {
  const saved = localStorage.getItem('fase-pratica-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  syncThemeButton();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('fase-pratica-theme', next);
  syncThemeButton();
}

function syncThemeButton() {
  const theme = document.documentElement.getAttribute('data-theme');
  els.themeToggle.textContent = theme === 'dark' ? '☀️ Tema claro' : '🌙 Tema escuro';
}

function setDefaultStartDate() {
  els.startDate.value = fmtDate(new Date());
}

function renderLegend() {
  els.calendarLegend.innerHTML = legendItems.map((item) => `
    <span><i class="swatch" style="background:${item.color}"></i>${item.label}</span>
  `).join('');
}

function updateQuotaPanelVisibility() {
  const monthlyMode = els.calculationMode.value === 'monthly-quota';
  els.quotaPanel.open = monthlyMode;
}

function renderMonthlyQuotaInputs() {
  const initialYear = new Date(els.startDate?.value || new Date()).getFullYear();
  const months = [];
  for (let year = initialYear; year <= initialYear + 2; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      months.push(`
        <div class="quota-item">
          <label>${monthNames[month]} ${year}
            <input type="number" min="0" data-quota-key="${key}" value="${state.monthlyQuotas[key] ?? ''}" placeholder="Dias no mês" />
          </label>
        </div>
      `);
    }
  }
  els.monthlyQuotaContainer.innerHTML = months.join('');
  els.monthlyQuotaContainer.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      const value = input.value.trim();
      state.monthlyQuotas[input.dataset.quotaKey] = value === '' ? '' : Number(value);
    });
  });
}

function addBlock() {
  const start = els.blockStart.value;
  if (!start) {
    alert('Informe a data inicial da pausa.');
    return;
  }

  const end = els.blockEnd.value || start;
  if (end < start) {
    alert('A data final não pode ser menor que a data inicial.');
    return;
  }

  state.blocks.push({
    type: els.blockType.value,
    description: els.blockDescription.value.trim() || friendlyBlockType(els.blockType.value),
    start,
    end,
  });
  state.blocks.sort((a, b) => a.start.localeCompare(b.start));
  els.blockDescription.value = '';
  els.blockStart.value = '';
  els.blockEnd.value = '';
  refreshBlockList();
}

function removeBlock(index) {
  state.blocks.splice(index, 1);
  refreshBlockList();
}

function refreshBlockList() {
  if (!state.blocks.length) {
    els.blockList.className = 'tag-list empty-state';
    els.blockList.textContent = 'Nenhuma pausa cadastrada.';
    return;
  }

  els.blockList.className = 'tag-list';
  els.blockList.innerHTML = state.blocks.map((block, index) => `
    <div class="block-item">
      <div class="block-meta">
        <strong>${escapeHtml(block.description)}</strong>
        <small>${friendlyBlockType(block.type)} • ${formatDateBR(block.start)} até ${formatDateBR(block.end)}</small>
      </div>
      <button class="secondary-btn icon-btn" type="button" data-remove-block="${index}" aria-label="Remover">✕</button>
    </div>
  `).join('');

  els.blockList.querySelectorAll('[data-remove-block]').forEach((button) => {
    button.addEventListener('click', () => removeBlock(Number(button.dataset.removeBlock)));
  });
}

function generateSchedule() {
  const startDate = els.startDate.value;
  const hoursPerDay = Number(els.hoursPerDay.value || 0);
  const totalHours = Number(els.totalHours.value || 0);
  const mode = els.calculationMode.value;

  if (!startDate) {
    alert('Informe a data de início da fase prática.');
    return;
  }
  if (hoursPerDay <= 0 || totalHours <= 0) {
    alert('Informe horas por dia e carga horária total maiores que zero.');
    return;
  }

  let phaseDays = [];
  if (mode === 'monthly-quota') {
    phaseDays = calculateMonthlyQuotaDays(startDate, totalHours, hoursPerDay);
  } else {
    phaseDays = calculateAutomaticDays(startDate, totalHours, hoursPerDay);
  }

  if (!phaseDays.length) {
    alert('Não foi possível calcular dias de prática com as regras informadas.');
    return;
  }

  state.phaseDays = phaseDays;
  state.endDate = phaseDays[phaseDays.length - 1];
  state.reportRows = buildMonthlyReport(phaseDays, hoursPerDay);

  renderCalendar();
  renderReport(hoursPerDay, totalHours, mode);
  updateSummary(hoursPerDay, totalHours);
  switchTab('calendar');
}

function calculateAutomaticDays(startDate, totalHours, hoursPerDay) {
  const requiredDays = Math.ceil(totalHours / hoursPerDay);
  const result = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  let safe = 0;

  while (result.length < requiredDays && safe < 5000) {
    if (isValidPracticeDay(cursor)) result.push(fmtDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    safe += 1;
  }
  return result;
}

function calculateMonthlyQuotaDays(startDate, totalHours, hoursPerDay) {
  const requiredDays = Math.ceil(totalHours / hoursPerDay);
  const result = [];
  const usedByMonth = {};
  const cursor = new Date(`${startDate}T00:00:00`);
  let safe = 0;

  while (result.length < requiredDays && safe < 5000) {
    const key = monthKey(cursor);
    const configured = Number(state.monthlyQuotas[key] || 0);
    const used = usedByMonth[key] || 0;

    if (configured > used && isValidPracticeDay(cursor)) {
      result.push(fmtDate(cursor));
      usedByMonth[key] = used + 1;
    }

    cursor.setDate(cursor.getDate() + 1);
    safe += 1;
  }

  const totalConfigured = Object.values(state.monthlyQuotas)
    .map((value) => Number(value || 0))
    .reduce((sum, value) => sum + value, 0);

  if (!result.length || result.length < requiredDays) {
    const requiredMessage = `São necessários ${requiredDays} dias de prática.`;
    const configuredMessage = `Você configurou ${totalConfigured} dia(s) nos meses personalizados.`;
    alert(`${requiredMessage} ${configuredMessage} Ajuste as cotas mensais e gere novamente.`);
  }

  return result;
}

function isValidPracticeDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !findBlockForDate(fmtDate(date));
}

function findBlockForDate(dateStr) {
  return state.blocks.find((block) => dateStr >= block.start && dateStr <= block.end);
}

function renderCalendar() {
  if (!state.phaseDays.length) {
    els.calendarMount.className = 'calendar-mount empty-state';
    els.calendarMount.innerHTML = 'Nenhum dia calculado.';
    return;
  }

  els.calendarMount.className = 'calendar-mount';
  const grouped = groupMonthsBetween(state.phaseDays[0], state.phaseDays[state.phaseDays.length - 1]);
  els.calendarMount.innerHTML = Object.entries(grouped).map(([year, months]) => `
    <section class="calendar-year">
      <h3>${year}</h3>
      <div class="month-grid">${months.map(renderMonthCard).join('')}</div>
    </section>
  `).join('');
}

function renderMonthCard({ year, month }) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  const startOffset = first.getDay();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthlyCount = state.phaseDays.filter((date) => date.startsWith(monthPrefix)).length;
  const configuredQuota = Number(state.monthlyQuotas[monthPrefix] || 0);

  let daysHtml = '';
  for (let i = 0; i < startOffset; i += 1) daysHtml += '<div class="day muted"></div>';

  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(year, month, day);
    const key = fmtDate(current);
    const block = findBlockForDate(key);
    const isPhase = state.phaseDays.includes(key);
    const classes = ['day'];
    if (current.getDay() === 0 || current.getDay() === 6) classes.push('weekend');
    if (isPhase) classes.push('phase');
    if (block) classes.push(`block-${block.type}`);
    const title = block ? block.description : isPhase ? 'Dia de prática' : '';
    daysHtml += `<div class="${classes.join(' ')}" title="${escapeHtml(title)}">${day}</div>`;
  }

  const metaText = els.calculationMode.value === 'monthly-quota'
    ? `Dias no mês: <strong>${monthlyCount}</strong> • previsto: <strong>${configuredQuota}</strong>`
    : `Dias no mês: <strong>${monthlyCount}</strong>`;

  return `
    <article class="month-card">
      <header>${monthNames[month]} ${year}</header>
      <div class="month-meta">${metaText}</div>
      <div class="weekdays">${weekdayNames.map((d) => `<div>${d}</div>`).join('')}</div>
      <div class="days">${daysHtml}</div>
    </article>
  `;
}

function renderReport(hoursPerDay, totalHours, mode) {
  const client = escapeHtml(els.clientName.value.trim() || 'Não informado');
  const unit = escapeHtml(els.unitName.value.trim() || 'Não informada');
  const user = escapeHtml(els.userName.value.trim() || 'Não informado');
  const rows = state.reportRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.month)}</td>
      <td>${row.days}</td>
      <td>${row.hours}</td>
    </tr>
  `).join('');
  const blocksHtml = state.blocks.length
    ? `<ul>${state.blocks.map((block) => `<li>${escapeHtml(block.description)} — ${friendlyBlockType(block.type)} (${formatDateBR(block.start)} até ${formatDateBR(block.end)})</li>`).join('')}</ul>`
    : '<p>Nenhuma pausa cadastrada.</p>';

  els.reportMount.className = 'report-box';
  els.reportMount.innerHTML = `
    <h3>Resumo do contrato</h3>
    <div class="report-meta">
      <div><strong>Aprendiz:</strong> ${user}</div>
      <div><strong>Empresa:</strong> ${client}</div>
      <div><strong>Unidade:</strong> ${unit}</div>
      <div><strong>Modo:</strong> ${mode === 'monthly-quota' ? 'Calendário personalizado por mês' : 'Automático por dias úteis'}</div>
      <div><strong>Período:</strong> ${state.phaseDays[0] ? formatDateBR(state.phaseDays[0]) : '--'} até ${state.endDate ? formatDateBR(state.endDate) : '--'}</div>
      <div><strong>Total previsto:</strong> ${state.phaseDays.length} dias / ${totalHours} horas</div>
    </div>
    <h4>Distribuição por mês</h4>
    <table>
      <thead><tr><th>Mês</th><th>Dias</th><th>Horas</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h4>Pausas cadastradas</h4>
    ${blocksHtml}
  `;
}

function updateSummary(hoursPerDay = Number(els.hoursPerDay?.value || 0), totalHours = Number(els.totalHours?.value || 0)) {
  els.sumPhaseDays.textContent = state.phaseDays.length || '--';
  els.sumHoursPerDay.textContent = hoursPerDay || '--';
  els.sumTotalHours.textContent = totalHours || '--';
  const end = state.endDate ? formatDateBR(state.endDate) : '--';
  els.sumEndDate.textContent = end;
  els.heroTotalDias.textContent = state.phaseDays.length || 0;
  els.heroDataFim.textContent = end;
}

function buildMonthlyReport(days, hoursPerDay) {
  const map = new Map();
  days.forEach((date) => {
    const key = date.slice(0, 7);
    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries()).map(([key, count]) => {
    const [year, month] = key.split('-').map(Number);
    return {
      month: `${monthNames[month - 1]} ${year}`,
      days: count,
      hours: count * hoursPerDay,
    };
  });
}

function groupMonthsBetween(start, end) {
  const output = {};
  const cursor = new Date(`${start}T00:00:00`);
  const limit = new Date(`${end}T00:00:00`);
  cursor.setDate(1);

  while (cursor <= limit) {
    const year = cursor.getFullYear();
    output[year] ||= [];
    output[year].push({ year, month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return output;
}

async function exportPdf() {
  if (!state.phaseDays.length) {
    alert('Gere o calendário antes de baixar o PDF.');
    return;
  }

  const originalText = els.btnExportPdf.textContent;
  els.btnExportPdf.disabled = true;
  els.btnExportPdf.textContent = 'Gerando PDF...';

  try {
    const printable = buildPrintableNode();
    document.body.appendChild(printable);

    const canvas = await window.html2canvas(printable, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const pageHeightInCanvas = Math.floor((usableHeight * canvasWidth) / usableWidth);

    let renderedHeight = 0;
    let pageIndex = 0;

    while (renderedHeight < canvasHeight) {
      const sliceHeight = Math.min(pageHeightInCanvas, canvasHeight - renderedHeight);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvasWidth;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, renderedHeight, canvasWidth, sliceHeight, 0, 0, canvasWidth, sliceHeight);

      if (pageIndex > 0) pdf.addPage();
      const imgData = pageCanvas.toDataURL('image/png');
      const imgHeightMm = (sliceHeight * usableWidth) / canvasWidth;
      pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, imgHeightMm, undefined, 'FAST');

      renderedHeight += sliceHeight;
      pageIndex += 1;
    }

    printable.remove();
    const safeUser = sanitizeFilePart(els.userName.value || 'aprendiz');
    const safeClient = sanitizeFilePart(els.clientName.value || 'cliente');
    pdf.save(`calendario-fase-pratica-${safeUser}-${safeClient}.pdf`);
  } catch (error) {
    console.error(error);
    alert('Não foi possível gerar o PDF.');
  } finally {
    const existing = document.getElementById('printableExportRoot');
    if (existing) existing.remove();
    els.btnExportPdf.disabled = false;
    els.btnExportPdf.textContent = originalText;
  }
}

function buildPrintableNode() {
  const root = document.createElement('div');
  root.id = 'printableExportRoot';
  root.className = 'print-root';

  const client = escapeHtml(els.clientName.value.trim() || 'Não informado');
  const unit = escapeHtml(els.unitName.value.trim() || 'Não informada');
  const user = escapeHtml(els.userName.value.trim() || 'Não informado');
  const mode = els.calculationMode.value === 'monthly-quota' ? 'Calendário personalizado por mês' : 'Automático por dias úteis';
  const periodStart = state.phaseDays[0] ? formatDateBR(state.phaseDays[0]) : '--';
  const periodEnd = state.endDate ? formatDateBR(state.endDate) : '--';
  const rows = state.reportRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.month)}</td>
      <td>${row.days}</td>
      <td>${row.hours}</td>
    </tr>
  `).join('');
  const blocksHtml = state.blocks.length
    ? `<ul>${state.blocks.map((block) => `<li>${escapeHtml(block.description)} — ${friendlyBlockType(block.type)} (${formatDateBR(block.start)} até ${formatDateBR(block.end)})</li>`).join('')}</ul>`
    : '<p>Nenhuma pausa cadastrada.</p>';

  root.innerHTML = `
    <div class="print-page print-cover">
      <div class="print-banner">
        <h1>Planejamento da Fase Prática</h1>
        <p>SENAI • Calendário do jovem aprendiz</p>
      </div>

      <div class="print-cards">
        <div class="print-card"><span>Dias de prática</span><strong>${state.phaseDays.length}</strong></div>
        <div class="print-card"><span>Carga horária</span><strong>${Number(els.totalHours.value || 0)} h</strong></div>
        <div class="print-card"><span>Data final</span><strong>${periodEnd}</strong></div>
      </div>

      <div class="print-grid">
        <section class="print-panel">
          <h2>Dados do contrato</h2>
          <p><strong>Aprendiz:</strong> ${user}</p>
          <p><strong>Empresa / Cliente:</strong> ${client}</p>
          <p><strong>Unidade SENAI:</strong> ${unit}</p>
          <p><strong>Modo de cálculo:</strong> ${mode}</p>
          <p><strong>Período:</strong> ${periodStart} até ${periodEnd}</p>
          <p><strong>Horas por dia:</strong> ${Number(els.hoursPerDay.value || 0)} h</p>
        </section>

        <section class="print-panel">
          <h2>Passo a passo de leitura</h2>
          <ol>
            <li>Confira os dados do aprendiz e da empresa.</li>
            <li>Revise a distribuição de dias por mês.</li>
            <li>Verifique as pausas cadastradas.</li>
            <li>Use o calendário completo nas próximas páginas.</li>
          </ol>
        </section>
      </div>

      <section class="print-panel">
        <h2>Resumo por mês</h2>
        <table class="print-table">
          <thead><tr><th>Mês</th><th>Dias</th><th>Horas</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>

      <section class="print-panel">
        <h2>Pausas cadastradas</h2>
        ${blocksHtml}
      </section>

      <section class="print-panel">
        <h2>Legenda</h2>
        <div class="print-legend">${legendItems.map((item) => `<span><i style="background:${item.color}"></i>${item.label}</span>`).join('')}</div>
      </section>

      <p class="print-footnote">Documento gerado automaticamente pela Calculadora de Fase Prática.</p>
    </div>

    <div class="print-page">
      <section class="print-panel">
        <h2>Calendário completo</h2>
        ${els.calendarMount.innerHTML}
      </section>
    </div>
  `;

  return root;
}

function resetAll() {
  state.blocks = [];
  state.monthlyQuotas = {};
  state.phaseDays = [];
  state.reportRows = [];
  state.endDate = null;

  els.clientName.value = '';
  els.unitName.value = '';
  els.userName.value = '';
  els.hoursPerDay.value = 4;
  els.totalHours.value = 200;
  els.calculationMode.value = 'automatic';
  setDefaultStartDate();
  refreshBlockList();
  renderMonthlyQuotaInputs();
  updateQuotaPanelVisibility();

  els.calendarMount.className = 'calendar-mount empty-state';
  els.calendarMount.innerHTML = 'Preencha os dados e clique em <strong>Gerar calendário</strong>.';
  els.reportMount.className = 'report-box empty-state';
  els.reportMount.textContent = 'O resumo do contrato será exibido aqui.';
  updateSummary();
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach((content) => content.classList.toggle('active', content.id === `tab-${tabName}`));
}

function friendlyBlockType(type) {
  return {
    holiday: 'Feriado',
    recess: 'Recesso',
    'admin-leave': 'Folga administrativa',
    training: 'Ação pedagógica',
  }[type] || type;
}

function fmtDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateBR(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function sanitizeFilePart(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
