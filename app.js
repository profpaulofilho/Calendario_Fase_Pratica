const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const weekdayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const legendItems = [
  { label: 'Dia valido de pratica', className: 'phase', color: '#12b76a' },
  { label: 'Feriado', className: 'block-holiday', color: '#f59e0b' },
  { label: 'Recesso', className: 'block-recess', color: '#ef4444' },
  { label: 'Folga administrativa', className: 'block-admin-leave', color: '#0f62fe' },
  { label: 'Acao pedagogica', className: 'block-training', color: '#8b5cf6' }
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
  setDefaultStartDate();
  renderLegend();
  renderMonthlyQuotaInputs();
  refreshBlockList();
  updateSummary();
});

function bindElements() {
  [
    'clientName', 'unitName', 'startDate', 'hoursPerDay', 'totalHours', 'calculationMode',
    'blockType', 'blockDescription', 'blockStart', 'blockEnd', 'blockList', 'monthlyQuotaContainer',
    'btnAddBlock', 'btnGenerate', 'btnReset', 'btnExport', 'btnLoadSample', 'quotaFile',
    'calendarLegend', 'calendarMount', 'reportMount', 'sumPhaseDays', 'sumHoursPerDay', 'sumTotalHours',
    'sumEndDate', 'heroTotalDias', 'heroDataFim'
  ].forEach((id) => { els[id] = document.getElementById(id); });
}

function bindEvents() {
  els.btnAddBlock.addEventListener('click', addBlock);
  els.btnGenerate.addEventListener('click', generateSchedule);
  els.btnReset.addEventListener('click', resetAll);
  els.btnExport.addEventListener('click', exportJson);
  els.btnLoadSample.addEventListener('click', loadSample);
  els.quotaFile.addEventListener('change', importQuotaFile);
  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
}

function setDefaultStartDate() {
  const now = new Date();
  els.startDate.value = fmtDate(now);
}

function renderLegend() {
  els.calendarLegend.innerHTML = legendItems.map((item) => `
    <span><i class="swatch" style="background:${item.color}"></i>${item.label}</span>
  `).join('');
}

function renderMonthlyQuotaInputs() {
  const currentYear = new Date().getFullYear();
  const months = [];
  for (let year = currentYear; year <= currentYear + 2; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      months.push(`
        <div class="quota-item">
          <label>${monthNames[month]} ${year}
            <input type="number" min="0" data-quota-key="${key}" value="${state.monthlyQuotas[key] ?? ''}" placeholder="Dias do mes" />
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
  if (!start) return alert('Informe a data inicial do bloqueio.');
  const end = els.blockEnd.value || start;
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

function refreshBlockList() {
  if (!state.blocks.length) {
    els.blockList.className = 'tag-list empty-state';
    els.blockList.textContent = 'Nenhum bloqueio cadastrado.';
    return;
  }
  els.blockList.className = 'tag-list';
  els.blockList.innerHTML = state.blocks.map((block, index) => `
    <div class="block-item">
      <div class="block-meta">
        <strong>${block.description}</strong>
        <small>${friendlyBlockType(block.type)} • ${formatDateBR(block.start)} a ${formatDateBR(block.end)}</small>
      </div>
      <button class="secondary-btn" onclick="removeBlock(${index})">Remover</button>
    </div>
  `).join('');
}
window.removeBlock = (index) => {
  state.blocks.splice(index, 1);
  refreshBlockList();
};

function generateSchedule() {
  const startDate = els.startDate.value;
  const hoursPerDay = Number(els.hoursPerDay.value || 0);
  const totalHours = Number(els.totalHours.value || 0);
  if (!startDate || hoursPerDay <= 0 || totalHours <= 0) {
    alert('Preencha inicio, horas por dia e carga horaria.');
    return;
  }

  readQuotaInputs();
  const mode = els.calculationMode.value;
  state.phaseDays = mode === 'monthly-quota'
    ? calculateByMonthlyQuota(startDate, totalHours, hoursPerDay)
    : calculateAutomatic(startDate, totalHours, hoursPerDay);

  state.endDate = state.phaseDays.length ? state.phaseDays[state.phaseDays.length - 1] : null;
  state.reportRows = buildMonthlyReport(state.phaseDays, hoursPerDay);

  renderCalendar();
  renderReport(hoursPerDay, totalHours, mode);
  updateSummary(hoursPerDay, totalHours);
}

function readQuotaInputs() {
  els.monthlyQuotaContainer.querySelectorAll('input[data-quota-key]').forEach((input) => {
    const value = input.value.trim();
    state.monthlyQuotas[input.dataset.quotaKey] = value === '' ? '' : Number(value);
  });
}

function calculateAutomatic(startDate, totalHours, hoursPerDay) {
  const requiredDays = Math.ceil(totalHours / hoursPerDay);
  const result = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  let safe = 0;
  while (result.length < requiredDays && safe < 4000) {
    if (isValidPracticeDay(cursor)) result.push(fmtDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    safe += 1;
  }
  return result;
}

function calculateByMonthlyQuota(startDate, totalHours, hoursPerDay) {
  const requiredDays = Math.ceil(totalHours / hoursPerDay);
  const result = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  let safe = 0;
  const usedByMonth = {};
  while (result.length < requiredDays && safe < 4000) {
    const key = monthKey(cursor);
    const quota = Number(state.monthlyQuotas[key] || 0);
    const used = usedByMonth[key] || 0;
    if (quota > used && isValidPracticeDay(cursor)) {
      result.push(fmtDate(cursor));
      usedByMonth[key] = used + 1;
    }
    cursor.setDate(cursor.getDate() + 1);
    safe += 1;
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
    els.calendarMount.textContent = 'Nenhum dia calculado.';
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
  const monthlyCount = state.phaseDays.filter((date) => date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;

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
    daysHtml += `<div class="${classes.join(' ')}" title="${block ? block.description : isPhase ? 'Pratica' : ''}">${day}</div>`;
  }

  return `
    <article class="month-card">
      <header>${monthNames[month]} ${year}</header>
      <div class="month-meta">Dias de pratica no mes: <strong>${monthlyCount}</strong></div>
      <div class="weekdays">${weekdayNames.map((d) => `<div>${d}</div>`).join('')}</div>
      <div class="days">${daysHtml}</div>
    </article>
  `;
}

function renderReport(hoursPerDay, totalHours, mode) {
  const client = els.clientName.value.trim() || 'Nao informado';
  const unit = els.unitName.value.trim() || 'Nao informada';
  const rows = state.reportRows.map((row) => `
    <tr>
      <td>${row.month}</td>
      <td>${row.days}</td>
      <td>${row.hours}</td>
    </tr>
  `).join('');

  els.reportMount.className = 'report-box';
  els.reportMount.innerHTML = `
    <h3>Relatorio do contrato</h3>
    <p><strong>Cliente:</strong> ${client}<br>
    <strong>Unidade:</strong> ${unit}<br>
    <strong>Modo:</strong> ${mode === 'monthly-quota' ? 'Manual por cotas mensais' : 'Automatico por dias uteis'}<br>
    <strong>Periodo:</strong> ${state.phaseDays[0] ? formatDateBR(state.phaseDays[0]) : '--'} ate ${state.endDate ? formatDateBR(state.endDate) : '--'}</p>
    <table>
      <thead><tr><th>Mes</th><th>Dias</th><th>Horas</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><strong>Total:</strong> ${state.phaseDays.length} dias / ${totalHours} horas</p>
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

function exportJson() {
  const payload = {
    clientName: els.clientName.value,
    unitName: els.unitName.value,
    startDate: els.startDate.value,
    hoursPerDay: Number(els.hoursPerDay.value || 0),
    totalHours: Number(els.totalHours.value || 0),
    calculationMode: els.calculationMode.value,
    blocks: state.blocks,
    monthlyQuotas: state.monthlyQuotas,
    phaseDays: state.phaseDays,
  };
  downloadFile('fase-pratica-config.json', JSON.stringify(payload, null, 2), 'application/json');
}

async function loadSample() {
  const response = await fetch('data/sample-calendar.json');
  const data = await response.json();
  applyImportedData(data);
}

function importQuotaFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = JSON.parse(reader.result);
    applyImportedData(data);
  };
  reader.readAsText(file, 'utf-8');
}

function applyImportedData(data) {
  state.blocks = data.blocks || [];
  state.monthlyQuotas = data.monthlyQuotas || {};
  els.clientName.value = data.clientName || '';
  els.unitName.value = data.unitName || '';
  els.startDate.value = data.startDate || els.startDate.value;
  els.hoursPerDay.value = data.hoursPerDay || 4;
  els.totalHours.value = data.totalHours || 200;
  els.calculationMode.value = data.calculationMode || 'monthly-quota';
  refreshBlockList();
  renderMonthlyQuotaInputs();
}

function resetAll() {
  state.blocks = [];
  state.monthlyQuotas = {};
  state.phaseDays = [];
  state.reportRows = [];
  state.endDate = null;
  els.clientName.value = '';
  els.unitName.value = '';
  els.hoursPerDay.value = 4;
  els.totalHours.value = 200;
  els.calculationMode.value = 'automatic';
  setDefaultStartDate();
  refreshBlockList();
  renderMonthlyQuotaInputs();
  els.calendarMount.className = 'calendar-mount empty-state';
  els.calendarMount.textContent = 'Configure os parametros e gere o calendario.';
  els.reportMount.className = 'report-box empty-state';
  els.reportMount.textContent = 'O relatorio sera exibido aqui.';
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
    training: 'Acao pedagogica',
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
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
