const CATEGORIAS = ['Alimentação','Transporte','Moradia','Saúde','Lazer','Educação','Salário','Outros'];
const CORES = ['#3b82f6','#f59e0b','#8b5cf6','#10b981','#ec4899','#06b6d4','#22c55e','#f97316'];

let transacoes = [];
let totalEntradas = 0;
let totalSaidas = 0;
let saldo = 0;

let barChart, donutChart, lineChart;

function fmt(v) {
  return 'R$ ' + v.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function iniciarGraficos() {
  const gridColor = '#1e2a3a';
  const labelColor = '#64748b';
  const defaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: {} } }
  };

  // Bar Chart
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: CATEGORIAS,
      datasets: [
        { label: 'Entradas', data: new Array(8).fill(0), backgroundColor: '#16a34a', borderRadius: 5, borderSkipped: false },
        { label: 'Saídas',   data: new Array(8).fill(0), backgroundColor: '#dc2626', borderRadius: 5, borderSkipped: false }
      ]
    },
    options: {
      ...defaults,
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 10 } } },
        y: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 10 },
          callback: v => 'R$' + v.toLocaleString('pt-BR') } }
      },
      plugins: {
        legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 14 } },
        tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) } }
      }
    }
  });

  // Donut Chart
  donutChart = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels: CATEGORIAS,
      datasets: [{ data: new Array(8).fill(0), backgroundColor: CORES, borderWidth: 2, borderColor: '#161b27', hoverOffset: 6 }]
    },
    options: {
      ...defaults,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed) } }
      }
    }
  });

  // Line Chart
  lineChart = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Saldo',
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,.12)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#161b27',
        pointBorderWidth: 2
      }]
    },
    options: {
      ...defaults,
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 10 }, maxTicksLimit: 8 } },
        y: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 10 },
          callback: v => 'R$' + v.toLocaleString('pt-BR') } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) } }
      }
    }
  });
}

function atualizarTudo() {
  // KPI cards
  document.getElementById('kpi-total').textContent    = fmt(saldo);
  document.getElementById('kpi-entradas').textContent = fmt(totalEntradas);
  document.getElementById('kpi-saidas').textContent   = fmt(totalSaidas);
  document.getElementById('kpi-count').textContent    = transacoes.length;

  // Dados por categoria
  const porCategoria = {};
  CATEGORIAS.forEach(c => porCategoria[c] = { entrada: 0, saida: 0 });
  transacoes.forEach(t => {
    if (t.tipo === 'entrada') porCategoria[t.categoria].entrada += t.valor;
    else                      porCategoria[t.categoria].saida   += t.valor;
  });

  barChart.data.datasets[0].data = CATEGORIAS.map(c => porCategoria[c].entrada);
  barChart.data.datasets[1].data = CATEGORIAS.map(c => porCategoria[c].saida);
  barChart.update();

  const saidasDados = CATEGORIAS.map(c => porCategoria[c].saida);
  donutChart.data.datasets[0].data = saidasDados;
  donutChart.update();
  atualizarLegendaDonut(saidasDados);

  // Linha — evolução do saldo
  let saldoAcc = 0;
  const labels = [];
  const dados  = [];
  transacoes.forEach((t, i) => {
    saldoAcc += t.tipo === 'entrada' ? t.valor : -t.valor;
    labels.push('#' + (i + 1));
    dados.push(parseFloat(saldoAcc.toFixed(2)));
  });
  lineChart.data.labels  = labels;
  lineChart.data.datasets[0].data = dados;
  lineChart.update();

  // Tabela
  const tbody = document.getElementById('lista');
  const vazia = document.getElementById('lista-vazia');
  tbody.innerHTML = '';
  if (transacoes.length === 0) {
    vazia.classList.add('show');
  } else {
    vazia.classList.remove('show');
    [...transacoes].reverse().forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.desc || '—'}</td>
        <td>${t.categoria}</td>
        <td><span class="badge badge-${t.tipo}">${t.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída'}</span></td>
        <td class="${t.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}">${t.tipo === 'entrada' ? '+' : '−'} ${fmt(t.valor)}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function atualizarLegendaDonut(dados) {
  const legend = document.getElementById('donut-legend');
  legend.innerHTML = '';
  const total = dados.reduce((a, b) => a + b, 0);
  if (total === 0) { legend.innerHTML = '<span style="color:#475569;font-size:12px">Nenhuma saída ainda</span>'; return; }
  CATEGORIAS.forEach((cat, i) => {
    if (dados[i] === 0) return;
    const pct = ((dados[i] / total) * 100).toFixed(1);
    const div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML = `<span class="legend-dot" style="background:${CORES[i]}"></span>${cat} ${pct}%`;
    legend.appendChild(div);
  });
}

function lerCampos() {
  const desc  = document.getElementById('desc').value.trim();
  const valor = parseFloat(document.getElementById('valor').value);
  const cat   = document.getElementById('categoria').value;
  if (!valor || valor <= 0) { alert('Informe um valor válido!'); return null; }
  return { desc, valor, categoria: cat };
}

function limparCampos() {
  document.getElementById('desc').value  = '';
  document.getElementById('valor').value = '';
}

function addEntrada() {
  const dados = lerCampos();
  if (!dados) return;
  transacoes.push({ ...dados, tipo: 'entrada' });
  totalEntradas += dados.valor;
  saldo         += dados.valor;
  limparCampos();
  atualizarTudo();
}

function addSaida() {
  const dados = lerCampos();
  if (!dados) return;
  transacoes.push({ ...dados, tipo: 'saida' });
  totalSaidas += dados.valor;
  saldo       -= dados.valor;
  limparCampos();
  atualizarTudo();
}

// Data atual no header
document.getElementById('data-atual').textContent = new Date().toLocaleDateString('pt-BR', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

iniciarGraficos();
atualizarTudo();
