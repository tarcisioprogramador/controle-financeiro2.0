/* ═══════════════════════════════════════════
   FinanceFlow v2 - Zero Bug Rewrite
   All buttons functional | Bulletproof
   ═══════════════════════════════════════════ */

(function() {
'use strict';

var CATEGORIAS = [
  'Alimentação','Transporte','Moradia','Saúde',
  'Lazer','Educação','Salário','Freelance','Investimentos','Outros'
];
var CORES = [
  '#3b82f6','#f59e0b','#8b5cf6','#10b981',
  '#ec4899','#06b6d4','#22c55e','#f97316','#6366f1','#64748b'
];
var ITEMS_PER_PAGE = 10;
var STORAGE_TX = 'ff_tx';
var STORAGE_GOALS = 'ff_goals';
var STORAGE_THEME = 'ff_theme';

var transacoes = [];
var goals = [];
var currentEditId = null;
var currentPage = 1;
var barChart, donutChart, lineChart, monthlyChart;

function $(id) { return document.getElementById(id); }

// ── UTILITY ──
function fmt(v) {
  var abs = Math.abs(v);
  var s = abs.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return 'R$ ' + s;
}
function fmtSigned(v) {
  return (v < 0 ? '- ' : '') + fmt(v);
}
function fmtShort(v) {
  var prefix = v < 0 ? '-' : '';
  var abs = Math.abs(v);
  if (abs >= 1000) return prefix + 'R$ ' + (abs/1000).toFixed(1) + 'k';
  return prefix + fmt(abs);
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function parseDate(s) {
  return new Date(s + 'T12:00:00');
}
function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function val(id) {
  var el = $(id);
  return el ? el.value : '';
}
function trimVal(id) {
  return val(id).trim();
}

// ── STORAGE ──
function save() {
  try { localStorage.setItem(STORAGE_TX, JSON.stringify(transacoes)); } catch(e) {}
  try { localStorage.setItem(STORAGE_GOALS, JSON.stringify(goals)); } catch(e) {}
}
function load() {
  try {
    var d = localStorage.getItem(STORAGE_TX);
    transacoes = d ? JSON.parse(d) : [];
  } catch(e) { transacoes = []; }
  try {
    var d2 = localStorage.getItem(STORAGE_GOALS);
    goals = d2 ? JSON.parse(d2) : [];
  } catch(e) { goals = []; }
  if (!Array.isArray(transacoes)) transacoes = [];
  if (!Array.isArray(goals)) goals = [];
}

// ── TOAST ──
function toast(msg, type) {
  type = type || 'success';
  var c = $('toastContainer');
  if (!c) return;
  var el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.remove(); }, 3000);
}

// ── THEME ──
function initTheme() {
  try {
    var saved = localStorage.getItem(STORAGE_THEME);
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch(e) {}
}
function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(STORAGE_THEME, next); } catch(e) {}
  updateChartColors();
}

// ── TABS ──
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'tab-' + tab);
  });
  document.querySelectorAll('.sidebar-nav a').forEach(function(a) {
    a.classList.toggle('active', a.getAttribute('data-tab') === tab);
  });
  if (tab === 'transactions') renderTable();
  if (tab === 'goals') renderGoals();
  if (tab === 'insights') renderInsights();
}

// ── SIDEBAR (mobile) ──
function openSidebar() {
  var sb = $('sidebar');
  var ov = $('sidebarOverlay');
  var sc = $('sidebarContent');
  if (sb) sb.style.display = 'block';
  requestAnimationFrame(function() {
    if (ov) ov.classList.add('open');
    if (sc) sc.classList.add('open');
  });
}
function closeSidebar() {
  var ov = $('sidebarOverlay');
  var sc = $('sidebarContent');
  if (ov) ov.classList.remove('open');
  if (sc) sc.classList.remove('open');
}

// ════════════════════════════════
// CHARTS
// ════════════════════════════════
function cssVar(name) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch(e) { return ''; }
}

function initCharts() {
  var grid = cssVar('--chart-grid') || '#1a2540';
  var lbl = cssVar('--chart-label') || '#475569';
  var bg = cssVar('--bg-card') || '#161b27';
  var common = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 }
  };

  barChart = new Chart($('barChart'), {
    type: 'bar',
    data: {
      labels: CATEGORIAS.map(function(c) { return c.length > 8 ? c.slice(0,7)+'…' : c; }),
      datasets: [
        { label: 'Entradas', data: new Array(CATEGORIAS.length).fill(0), backgroundColor: '#22c55e', borderRadius: 6, borderSkipped: false },
        { label: 'Saídas', data: new Array(CATEGORIAS.length).fill(0), backgroundColor: '#ef4444', borderRadius: 6, borderSkipped: false }
      ]
    },
    options: Object.assign({}, common, {
      scales: {
        x: { grid: { display: false }, ticks: { color: lbl, font: { size: 10 } } },
        y: { grid: { color: grid + '44' }, ticks: { color: lbl, font: { size: 10 }, callback: function(v) { return fmtShort(v); } } }
      },
      plugins: {
        legend: { display: true, labels: { color: lbl, font: { size: 11 }, boxWidth: 12, padding: 14 } },
        tooltip: { callbacks: { label: function(ctx) { return ' ' + fmt(ctx.parsed.y); } } }
      }
    })
  });

  donutChart = new Chart($('donutChart'), {
    type: 'doughnut',
    data: {
      labels: CATEGORIAS,
      datasets: [{ data: new Array(CATEGORIAS.length).fill(0), backgroundColor: CORES, borderWidth: 2, borderColor: bg, hoverOffset: 8 }]
    },
    options: Object.assign({}, common, {
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx) { return ' ' + fmt(ctx.parsed); } } }
      }
    })
  });

  lineChart = new Chart($('lineChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Saldo', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.08)',
        fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3b82f6', pointBorderColor: bg, pointBorderWidth: 2
      }]
    },
    options: Object.assign({}, common, {
      scales: {
        x: { grid: { display: false }, ticks: { color: lbl, font: { size: 10 }, maxTicksLimit: 8 } },
        y: { grid: { color: grid + '44' }, ticks: { color: lbl, font: { size: 10 }, callback: function(v) { return fmtShort(v); } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx) { return ' ' + fmt(ctx.parsed.y); } } }
      }
    })
  });

  monthlyChart = new Chart($('monthlyChart'), {
    type: 'bar',
    data: { labels: [], datasets: [
      { label: 'Receitas', data: [], backgroundColor: '#22c55e', borderRadius: 6, borderSkipped: false },
      { label: 'Despesas', data: [], backgroundColor: '#ef4444', borderRadius: 6, borderSkipped: false }
    ]},
    options: Object.assign({}, common, {
      scales: {
        x: { grid: { display: false }, ticks: { color: lbl, font: { size: 10 } } },
        y: { grid: { color: grid + '44' }, ticks: { color: lbl, font: { size: 10 }, callback: function(v) { return fmtShort(v); } } }
      },
      plugins: {
        legend: { display: true, labels: { color: lbl, font: { size: 11 }, boxWidth: 12, padding: 14 } },
        tooltip: { callbacks: { label: function(ctx) { return ' ' + fmt(ctx.parsed.y); } } }
      }
    })
  });
}

function updateChartColors() {
  var grid = cssVar('--chart-grid') || '#1a2540';
  var lbl = cssVar('--chart-label') || '#475569';
  var bg = cssVar('--bg-card') || '#161b27';

  [barChart, lineChart, monthlyChart].forEach(function(c) {
    if (!c) return;
    c.options.scales.x.grid.color = 'transparent';
    c.options.scales.y.grid.color = grid + '44';
    c.options.scales.x.ticks.color = lbl;
    c.options.scales.y.ticks.color = lbl;
    if (c.options.plugins.legend && c.options.plugins.legend.labels) {
      c.options.plugins.legend.labels.color = lbl;
    }
  });
  if (lineChart) lineChart.data.datasets[0].pointBorderColor = bg;
  if (donutChart) donutChart.data.datasets[0].borderColor = bg;

  recalcCharts();
}

function recalcCharts() {
  var porCat = {};
  CATEGORIAS.forEach(function(c) { porCat[c] = { entrada: 0, saida: 0 }; });
  transacoes.forEach(function(t) {
    if (porCat[t.categoria]) {
      porCat[t.categoria][t.tipo === 'entrada' ? 'entrada' : 'saida'] += t.valor;
    }
  });

  barChart.data.datasets[0].data = CATEGORIAS.map(function(c) { return porCat[c].entrada; });
  barChart.data.datasets[1].data = CATEGORIAS.map(function(c) { return porCat[c].saida; });
  barChart.update('none');

  var saidasDados = CATEGORIAS.map(function(c) { return porCat[c].saida; });
  donutChart.data.datasets[0].data = saidasDados;
  donutChart.update('none');
  updateDonutLegend(saidasDados);

  var sorted = transacoes.slice().sort(function(a, b) { return a.data.localeCompare(b.data); });
  var acc = 0;
  var labels = [];
  var dados = [];
  sorted.forEach(function(t) {
    acc += t.tipo === 'entrada' ? t.valor : -t.valor;
    labels.push(formatDateShort(t.data));
    dados.push(parseFloat(acc.toFixed(2)));
  });
  lineChart.data.labels = labels;
  lineChart.data.datasets[0].data = dados;
  lineChart.update('none');

  var monthlyMap = {};
  transacoes.forEach(function(t) {
    var m = t.data.slice(0, 7);
    if (!monthlyMap[m]) monthlyMap[m] = { entrada: 0, saida: 0 };
    monthlyMap[m][t.tipo === 'entrada' ? 'entrada' : 'saida'] += t.valor;
  });
  var months = Object.keys(monthlyMap).sort().slice(-6);
  var MN = { '01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun','07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez' };
  monthlyChart.data.labels = months.map(function(m) {
    var parts = m.split('-');
    return MN[parts[1]] + '/' + parts[0].slice(2);
  });
  monthlyChart.data.datasets[0].data = months.map(function(m) { return monthlyMap[m].entrada; });
  monthlyChart.data.datasets[1].data = months.map(function(m) { return monthlyMap[m].saida; });
  monthlyChart.update('none');
}

function updateDonutLegend(dados) {
  var legend = $('donutLegend');
  if (!legend) return;
  legend.innerHTML = '';
  var total = dados.reduce(function(a, b) { return a + b; }, 0);
  if (total === 0) {
    legend.innerHTML = '<span style="color:var(--text-muted);font-size:12px">Nenhuma despesa registrada</span>';
    return;
  }
  CATEGORIAS.forEach(function(cat, i) {
    if (dados[i] === 0) return;
    var pct = ((dados[i] / total) * 100).toFixed(1);
    var div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML = '<span class="legend-dot" style="background:' + CORES[i] + '"></span>' + cat + ' ' + pct + '%';
    legend.appendChild(div);
  });
}

function formatDateShort(s) {
  var parts = s.split('-');
  return parts[2] + '/' + parts[1];
}
function formatDateFull(s) {
  var d = parseDate(s);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ════════════════════════════════
// KPIs + ALERTS
// ════════════════════════════════
function calcTotals() {
  var entradas = 0, saidas = 0;
  transacoes.forEach(function(t) {
    if (t.tipo === 'entrada') entradas += t.valor;
    else saidas += t.valor;
  });
  return { entradas: entradas, saidas: saidas, saldo: entradas - saidas };
}

function updateKPIs() {
  var t = calcTotals();
  var economia = t.entradas > 0 ? ((t.saldo / t.entradas) * 100) : 0;

  var elSaldo = $('kpiSaldo');
  var elIn = $('kpiEntradas');
  var elOut = $('kpiSaidas');
  var elEco = $('kpiEconomia');

  if (elSaldo) {
    elSaldo.textContent = fmtSigned(t.saldo);
    elSaldo.style.color = t.saldo >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if (elIn) elIn.textContent = fmt(t.entradas);
  if (elOut) elOut.textContent = fmt(t.saidas);
  if (elEco) elEco.textContent = economia.toFixed(1) + '%';
}

function updateAlerts() {
  var container = $('alertsContainer');
  if (!container) return;
  container.innerHTML = '';

  var t = calcTotals();
  var alerts = [];

  if (t.saldo < 0) {
    alerts.push({ icon: '🚨', text: 'Saldo negativo! Você está devendo ' + fmt(Math.abs(t.saldo)), type: 'danger' });
  } else if (t.entradas > 0 && t.saldo < t.entradas * 0.1) {
    alerts.push({ icon: '⚠️', text: 'Atenção: seu saldo está abaixo de 10% da receita total', type: 'warning' });
  }

  var porCat = {};
  CATEGORIAS.forEach(function(c) { porCat[c] = 0; });
  transacoes.forEach(function(t) {
    if (t.tipo === 'saida' && porCat[t.categoria] !== undefined) porCat[t.categoria] += t.valor;
  });
  var entries = Object.entries(porCat).sort(function(a, b) { return b[1] - a[1]; });
  if (entries.length > 0 && entries[0][1] > t.saidas * 0.4 && t.saidas > 0) {
    var pct = ((entries[0][1] / t.saidas) * 100).toFixed(0);
    alerts.push({ icon: '💡', text: 'Você está gastando muito com ' + entries[0][0] + ' (' + pct + '% das despesas)', type: 'info' });
  }

  if (t.saidas > 0 && t.saldo > 0) {
    var days = getDaysRange();
    var dailyBurn = t.saidas / Math.max(days, 1);
    var daysLeft = Math.floor(t.saldo / dailyBurn);
    if (daysLeft < 15) {
      alerts.push({ icon: '⏳', text: 'Seu saldo pode acabar em aproximadamente ' + daysLeft + ' dias', type: 'warning' });
    }
  }

  if (t.entradas > 0 && t.saldo > t.entradas * 0.3 && transacoes.length > 2) {
    alerts.push({ icon: '🎉', text: 'Parabéns! Você está economizando ' + ((t.saldo / t.entradas) * 100).toFixed(0) + '% da sua renda', type: 'success' });
  }

  alerts.forEach(function(a) {
    var div = document.createElement('div');
    div.className = 'alert alert-' + a.type;
    div.innerHTML = '<span>' + a.icon + '</span><span>' + a.text + '</span>';
    container.appendChild(div);
  });
}

function getDaysRange() {
  if (transacoes.length < 2) return 30;
  var sorted = transacoes.slice().sort(function(a, b) { return a.data.localeCompare(b.data); });
  var diff = (parseDate(sorted[sorted.length - 1].data) - parseDate(sorted[0].data)) / 86400000;
  return Math.max(diff, 1);
}

// ════════════════════════════════
// FORM / CRUD — ALL BUTTONS WORK
// ════════════════════════════════
function addTransaction(tipo) {
  var desc = trimVal('txDescricao');
  var valor = parseFloat(val('txValor'));
  var cat = val('txCategoria');
  var data = val('txData');
  var nota = trimVal('txNota');

  if (!desc) { toast('Informe uma descrição', 'error'); $('txDescricao').focus(); return; }
  if (!valor || valor <= 0) { toast('Informe um valor válido', 'error'); $('txValor').focus(); return; }
  if (!data) { data = todayStr(); }

  transacoes.push({ id: genId(), desc: desc, valor: valor, categoria: cat, tipo: tipo, data: data, nota: nota });
  save();
  recalcCharts();
  updateKPIs();
  updateAlerts();

  $('txDescricao').value = '';
  $('txValor').value = '';
  $('txNota').value = '';
  $('txData').value = todayStr();
  $('txDescricao').focus();

  toast(tipo === 'entrada' ? '✅ Receita adicionada!' : '✅ Despesa registrada!');
}

function deleteTransaction(id) {
  if (!confirm('Excluir esta transação?')) return;
  transacoes = transacoes.filter(function(t) { return t.id !== id; });
  save();
  recalcCharts();
  updateKPIs();
  updateAlerts();
  renderTable();
  toast('Transação excluída', 'info');
}

function openEdit(id) {
  var tx = null;
  for (var i = 0; i < transacoes.length; i++) {
    if (transacoes[i].id === id) { tx = transacoes[i]; break; }
  }
  if (!tx) return;
  currentEditId = id;
  $('editId').value = id;
  $('editDesc').value = tx.desc;
  $('editValor').value = tx.valor;
  $('editTipo').value = tx.tipo;
  $('editData').value = tx.data;
  $('editNota').value = tx.nota || '';

  var sel = $('editCategoria');
  sel.innerHTML = '';
  CATEGORIAS.forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === tx.categoria) opt.selected = true;
    sel.appendChild(opt);
  });
  $('modalOverlay').classList.add('open');
}

function closeEdit() {
  $('modalOverlay').classList.remove('open');
  currentEditId = null;
}

function saveEdit() {
  if (!currentEditId) return;
  var tx = null;
  for (var i = 0; i < transacoes.length; i++) {
    if (transacoes[i].id === currentEditId) { tx = transacoes[i]; break; }
  }
  if (!tx) return;

  var desc = trimVal('editDesc');
  var valor = parseFloat(val('editValor'));
  if (!desc) { toast('Informe uma descrição', 'error'); return; }
  if (!valor || valor <= 0) { toast('Informe um valor válido', 'error'); return; }

  tx.desc = desc;
  tx.valor = valor;
  tx.categoria = val('editCategoria');
  tx.tipo = val('editTipo');
  tx.data = val('editData') || todayStr();
  tx.nota = trimVal('editNota');
  save();
  recalcCharts();
  updateKPIs();
  updateAlerts();
  renderTable();
  closeEdit();
  toast('✅ Transação atualizada!');
}

// ════════════════════════════════
// TABLE + FILTERS + PAGINATION
// ════════════════════════════════
function getFilteredTransactions() {
  var list = transacoes.slice();
  var search = trimVal('filterSearch').toLowerCase();
  var tipo = val('filterTipo');
  var cat = val('filterCategoria');
  var dtInicio = val('filterDataInicio');
  var dtFim = val('filterDataFim');

  if (search) {
    list = list.filter(function(t) {
      return t.desc.toLowerCase().indexOf(search) !== -1 ||
             (t.nota && t.nota.toLowerCase().indexOf(search) !== -1);
    });
  }
  if (tipo) list = list.filter(function(t) { return t.tipo === tipo; });
  if (cat) list = list.filter(function(t) { return t.categoria === cat; });
  if (dtInicio) list = list.filter(function(t) { return t.data >= dtInicio; });
  if (dtFim) list = list.filter(function(t) { return t.data <= dtFim; });

  list.sort(function(a, b) { return b.data.localeCompare(a.data) || b.id.localeCompare(a.id); });
  return list;
}

function renderTable() {
  var filtered = getFilteredTransactions();
  var total = filtered.length;
  var totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  var start = (currentPage - 1) * ITEMS_PER_PAGE;
  var page = filtered.slice(start, start + ITEMS_PER_PAGE);

  var tbody = $('txTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  var emptyEl = $('txEmpty');
  if (total === 0) {
    if (emptyEl) emptyEl.classList.add('show');
  } else {
    if (emptyEl) emptyEl.classList.remove('show');
    page.forEach(function(tx) {
      var tr = document.createElement('tr');
      var tipoLabel = tx.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída';
      var tipoSign = tx.tipo === 'entrada' ? '+' : '−';
      var notaHtml = tx.nota ? '<br><small style="color:var(--text-muted)">' + escHtml(tx.nota) + '</small>' : '';

      tr.innerHTML =
        '<td style="white-space:nowrap">' + formatDateFull(tx.data) + '</td>' +
        '<td>' + escHtml(tx.desc) + notaHtml + '</td>' +
        '<td><span class="badge badge-' + tx.tipo + '">' + escHtml(tx.categoria) + '</span></td>' +
        '<td><span class="badge badge-' + tx.tipo + '">' + tipoLabel + '</span></td>' +
        '<td class="valor-' + tx.tipo + '">' + tipoSign + ' ' + fmt(tx.valor) + '</td>' +
        '<td><div class="action-btns">' +
          '<button class="action-btn" title="Editar" data-action="edit" data-id="' + tx.id + '">✏️</button>' +
          '<button class="action-btn delete" title="Excluir" data-action="delete" data-id="' + tx.id + '">🗑️</button>' +
        '</div></td>';
      tbody.appendChild(tr);
    });
  }
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  var container = $('pagination');
  if (!container) return;
  container.innerHTML = '';
  if (totalPages <= 1) return;

  var prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.textContent = '‹';
  prev.disabled = currentPage === 1;
  prev.setAttribute('data-page', 'prev');
  container.appendChild(prev);

  for (var i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && i > 2 && i < totalPages - 1 && Math.abs(i - currentPage) > 1) {
      if (i === 3 || i === totalPages - 2) {
        var dots = document.createElement('span');
        dots.textContent = '…';
        dots.style.cssText = 'padding:6px 8px;color:var(--text-muted);font-size:12px';
        container.appendChild(dots);
      }
      continue;
    }
    var btn = document.createElement('button');
    btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
    btn.textContent = i;
    btn.setAttribute('data-page', i);
    container.appendChild(btn);
  }

  var next = document.createElement('button');
  next.className = 'page-btn';
  next.textContent = '›';
  next.disabled = currentPage === totalPages;
  next.setAttribute('data-page', 'next');
  container.appendChild(next);
}

function initFilters() {
  ['filterSearch', 'filterTipo', 'filterCategoria', 'filterDataInicio', 'filterDataFim'].forEach(function(id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function() { currentPage = 1; renderTable(); });
    el.addEventListener('change', function() { currentPage = 1; renderTable(); });
  });

  var btnLimpar = $('btnLimparFiltros');
  if (btnLimpar) {
    btnLimpar.addEventListener('click', function() {
      $('filterSearch').value = '';
      $('filterTipo').value = '';
      $('filterCategoria').value = '';
      $('filterDataInicio').value = '';
      $('filterDataFim').value = '';
      currentPage = 1;
      renderTable();
      toast('Filtros limpos', 'info');
    });
  }

  var sel = $('filterCategoria');
  if (sel) {
    CATEGORIAS.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
  }
}

// ════════════════════════════════
// EXPORT TO EXCEL
// ════════════════════════════════
function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    toast('Biblioteca de exportação não carregada', 'error');
    return;
  }
  var filtered = getFilteredTransactions();
  if (filtered.length === 0) { toast('Nenhum dado para exportar', 'error'); return; }

  var data = filtered.map(function(t) {
    return {
      'Data': formatDateFull(t.data),
      'Descrição': t.desc,
      'Categoria': t.categoria,
      'Tipo': t.tipo === 'entrada' ? 'Entrada' : 'Saída',
      'Valor (R$)': t.valor,
      'Nota': t.nota || ''
    };
  });

  var t = calcTotals();
  data.push({});
  data.push({ 'Data': 'RESUMO', 'Descrição': 'Total Entradas', 'Valor (R$)': t.entradas });
  data.push({ 'Data': '', 'Descrição': 'Total Saídas', 'Valor (R$)': t.saidas });
  data.push({ 'Data': '', 'Descrição': 'Saldo', 'Valor (R$)': t.saldo });

  var ws = XLSX.utils.json_to_sheet(data);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'FinanceFlow');
  ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 25 }];

  XLSX.writeFile(wb, 'FinanceFlow_' + todayStr() + '.xlsx');
  toast('📥 Planilha exportada!');
}

// ════════════════════════════════
// GOALS
// ════════════════════════════════
function addGoal() {
  var name = trimVal('goalName');
  var target = parseFloat(val('goalTarget'));
  var deadline = val('goalDeadline');

  if (!name) { toast('Informe o nome da meta', 'error'); $('goalName').focus(); return; }
  if (!target || target <= 0) { toast('Informe um valor alvo válido', 'error'); $('goalTarget').focus(); return; }

  goals.push({ id: genId(), name: name, target: target, deadline: deadline || null, current: 0, createdAt: todayStr() });
  save();
  renderGoals();

  $('goalName').value = '';
  $('goalTarget').value = '';
  $('goalDeadline').value = '';
  toast('🎯 Meta criada!');
}

function deleteGoal(id) {
  if (!confirm('Excluir esta meta?')) return;
  goals = goals.filter(function(g) { return g.id !== id; });
  save();
  renderGoals();
  toast('Meta excluída', 'info');
}

function addToGoal(id, amount) {
  var goal = null;
  for (var i = 0; i < goals.length; i++) {
    if (goals[i].id === id) { goal = goals[i]; break; }
  }
  if (!goal) return;
  goal.current = Math.min(goal.current + amount, goal.target);
  save();
  renderGoals();
  if (goal.current >= goal.target) toast('🎉 Parabéns! Meta atingida!', 'success');
}

function renderGoals() {
  var list = $('goalsList');
  if (!list) return;
  list.innerHTML = '';

  if (goals.length === 0) {
    list.innerHTML = '<div class="goal-empty"><p>🎯 Nenhuma meta criada ainda</p><p style="margin-top:8px;font-size:13px">Crie metas para acompanhar seus objetivos financeiros</p></div>';
    return;
  }

  goals.forEach(function(g) {
    var pct = Math.min((g.current / g.target) * 100, 100);
    var daysLeft = null;
    if (g.deadline) {
      daysLeft = Math.ceil((parseDate(g.deadline) - new Date()) / 86400000);
    }
    var deadlineText = g.deadline ? '<span class="goal-deadline">Prazo: ' + formatDateFull(g.deadline) + (daysLeft !== null ? ' (' + daysLeft + ' dias)' : '') + '</span>' : '';

    var card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML =
      '<div class="goal-header">' +
        '<span class="goal-name">' + escHtml(g.name) + '</span>' +
        deadlineText +
      '</div>' +
      '<div class="goal-progress-wrap">' +
        '<div class="goal-progress-bar"><div class="goal-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="goal-info">' +
          '<span>' + fmt(g.current) + ' de ' + fmt(g.target) + '</span>' +
          '<span>' + pct.toFixed(1) + '%</span>' +
        '</div>' +
      '</div>' +
      '<div class="goal-actions">' +
        '<button class="btn btn-small btn-entrada" data-action="addgoal" data-id="' + g.id + '" data-amount="100">+ R$100</button>' +
        '<button class="btn btn-small btn-entrada" data-action="addgoal" data-id="' + g.id + '" data-amount="500">+ R$500</button>' +
        '<button class="btn btn-small btn-secondary" data-action="addgoal" data-id="' + g.id + '" data-amount="1000">+ R$1.000</button>' +
        '<button class="btn btn-small btn-saida" data-action="deletegoal" data-id="' + g.id + '">🗑️</button>' +
      '</div>';
    list.appendChild(card);
  });
}

// ════════════════════════════════
// INSIGHTS
// ════════════════════════════════
function renderInsights() {
  var list = $('insightsList');
  if (!list) return;
  list.innerHTML = '';

  var insights = generateInsights();
  if (insights.length === 0) {
    list.innerHTML = '<div class="insight-empty"><p>🧠 Adicione pelo menos 2 transações para receber insights inteligentes</p></div>';
    return;
  }
  insights.forEach(function(ins) {
    var card = document.createElement('div');
    card.className = 'insight-card';
    card.innerHTML =
      '<div class="insight-icon">' + ins.icon + '</div>' +
      '<div class="insight-content">' +
        '<div class="insight-title">' + ins.title + '</div>' +
        '<div class="insight-text">' + ins.text + '</div>' +
      '</div>';
    list.appendChild(card);
  });
}

function generateInsights() {
  var insights = [];
  if (transacoes.length < 2) return insights;

  var totalIn = 0, totalOut = 0;
  var catTotals = {};
  transacoes.forEach(function(t) {
    if (t.tipo === 'entrada') totalIn += t.valor;
    else {
      totalOut += t.valor;
      catTotals[t.categoria] = (catTotals[t.categoria] || 0) + t.valor;
    }
  });
  var saldo = totalIn - totalOut;

  var sorted = Object.entries(catTotals).sort(function(a, b) { return b[1] - a[1]; });
  if (sorted.length > 0) {
    insights.push({
      icon: '🏆',
      title: 'Maior gasto: ' + sorted[0][0],
      text: 'Você gastou ' + fmt(sorted[0][1]) + ' com ' + sorted[0][0] + ', representando ' + ((sorted[0][1]/totalOut)*100).toFixed(1) + '% do total de despesas.'
    });
  }

  var days = getDaysRange();
  var dailyAvg = totalOut / days;
  insights.push({
    icon: '📊',
    title: 'Gasto médio diário',
    text: 'Você gasta em média ' + fmt(dailyAvg) + ' por dia. Se mantiver esse ritmo, gastará ' + fmt(dailyAvg * 30) + ' neste mês.'
  });

  if (totalIn > 0) {
    var rate = ((saldo / totalIn) * 100).toFixed(1);
    var emoji = rate > 20 ? '🌟' : rate > 0 ? '👍' : '⚠️';
    insights.push({
      icon: emoji,
      title: 'Taxa de economia: ' + rate + '%',
      text: rate > 0
        ? 'Você está economizando ' + rate + '% da sua renda.'
        : 'Suas despesas estão superiores às receitas. Revise seus gastos!'
    });
  }

  if (sorted.length >= 2) {
    insights.push({
      icon: '📈',
      title: 'Top 2 categorias de gasto',
      text: sorted[0][0] + ' (' + fmt(sorted[0][1]) + ') e ' + sorted[1][0] + ' (' + fmt(sorted[1][1]) + ') somam ' + fmt(sorted[0][1]+sorted[1][1]) + ', que é ' + (((sorted[0][1]+sorted[1][1])/totalOut)*100).toFixed(1) + '% das despesas.'
    });
  }

  insights.push({
    icon: '🔄',
    title: 'Frequência de transações',
    text: 'Você registra em média ' + (transacoes.length / Math.max(days, 1)).toFixed(1) + ' transações por dia (' + transacoes.length + ' no total).'
  });

  if (totalIn > 0) {
    var ratio = (totalOut / totalIn).toFixed(2);
    insights.push({
      icon: '⚖️',
      title: 'Razão despesa/receita: ' + ratio,
      text: ratio > 1
        ? 'Para cada R$1 de receita, você gasta R$' + ratio + '. Reduza despesas!'
        : 'Para cada R$1 de receita, você gasta R$' + ratio + '. Bom equilíbrio!'
    });
  }

  var biggest = null;
  transacoes.forEach(function(t) {
    if (t.tipo === 'saida' && (!biggest || t.valor > biggest.valor)) biggest = t;
  });
  if (biggest) {
    insights.push({
      icon: '💸',
      title: 'Maior gasto individual',
      text: '"' + biggest.desc + '" (' + biggest.categoria + ') - ' + fmt(biggest.valor) + ' em ' + formatDateFull(biggest.data)
    });
  }

  return insights;
}

// ════════════════════════════════
// EVENT DELEGATION — ALL BUTTONS
// ════════════════════════════════
function initEvents() {
  // ── Theme toggle ──
  var themeBtn = $('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // ── Sidebar ──
  var menuBtn = $('menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', openSidebar);
  var sidebarClose = $('sidebarClose');
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  var sidebarOverlay = $('sidebarOverlay');
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  // ── Tabs ──
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(btn.getAttribute('data-tab')); });
  });
  document.querySelectorAll('.sidebar-nav a').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      switchTab(a.getAttribute('data-tab'));
      closeSidebar();
    });
  });

  // ── ADD ENTRADA ──
  var btnEntrada = $('btnAddEntrada');
  if (btnEntrada) {
    btnEntrada.addEventListener('click', function(e) {
      e.preventDefault();
      addTransaction('entrada');
    });
  }

  // ── ADD SAIDA ──
  var btnSaida = $('btnAddSaida');
  if (btnSaida) {
    btnSaida.addEventListener('click', function(e) {
      e.preventDefault();
      addTransaction('saida');
    });
  }

  // ── ADD GOAL ──
  var btnGoal = $('btnAddGoal');
  if (btnGoal) {
    btnGoal.addEventListener('click', function(e) {
      e.preventDefault();
      addGoal();
    });
  }

  // ── EXPORT ──
  var btnExport = $('btnExportar');
  if (btnExport) {
    btnExport.addEventListener('click', function(e) {
      e.preventDefault();
      exportToExcel();
    });
  }

  // ── EDIT MODAL ──
  var btnSaveEdit = $('btnSaveEdit');
  if (btnSaveEdit) btnSaveEdit.addEventListener('click', saveEdit);
  var btnCancelEdit = $('btnCancelEdit');
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEdit);
  var modalClose = $('modalClose');
  if (modalClose) modalClose.addEventListener('click', closeEdit);
  var modalOverlay = $('modalOverlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) closeEdit();
    });
  }

  // ── ENTER KEY ON FORM FIELDS ──
  ['txDescricao', 'txValor', 'txNota'].forEach(function(id) {
    var el = $(id);
    if (el) {
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          addTransaction('entrada');
        }
      });
    }
  });

  // ── EVENT DELEGATION: table actions, goals, pagination ──
  document.addEventListener('click', function(e) {
    var target = e.target.closest('[data-action]');
    if (!target) {
      // Check pagination
      var pageTarget = e.target.closest('[data-page]');
      if (pageTarget) {
        var pg = pageTarget.getAttribute('data-page');
        if (pg === 'prev') currentPage--;
        else if (pg === 'next') currentPage++;
        else currentPage = parseInt(pg) || 1;
        renderTable();
      }
      return;
    }

    var action = target.getAttribute('data-action');
    var id = target.getAttribute('data-id');

    switch (action) {
      case 'edit':
        openEdit(id);
        break;
      case 'delete':
        deleteTransaction(id);
        break;
      case 'addgoal':
        var amount = parseInt(target.getAttribute('data-amount')) || 0;
        addToGoal(id, amount);
        break;
      case 'deletegoal':
        deleteGoal(id);
        break;
    }
  });

  // ── KEYBOARD: Escape to close modal ──
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeEdit();
  });
}

// ════════════════════════════════
// INIT
// ════════════════════════════════
function init() {
  initTheme();
  load();
  initEvents();
  initFilters();
  initCharts();
  recalcCharts();
  updateKPIs();
  updateAlerts();

  var dateEl = $('dataAtual');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
