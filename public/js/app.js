// public/js/app.js - Controlador Principal da Aplicação (Portal do Colaborador & WMS)

// Estado global da aplicação
const State = {
  appMode: 'kiosk', // 'kiosk' (Para Todos) ou 'wms' (Avançado Galpão)
  currentView: 'dashboard',
  products: [],
  kioskProducts: [],
  kioskCategory: 'ALL',
  locations: [],
  cart: [],
  pendingAdjustment: null,
  allProductsList: []
};

// ========================================================
// INICIALIZAÇÃO
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  
  // Inicia por padrão no Portal do Colaborador (Autoatendimento)
  switchAppMode('kiosk');

  // Carrega produtos para catálogo e dropdowns
  loadInitialData();

  // Atalho de teclado '/' para busca
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (State.appMode === 'kiosk') {
        const inp = document.getElementById('kiosk-search-input');
        if (inp) inp.focus();
      } else {
        navigate('lookup');
        setTimeout(() => {
          const inp = document.getElementById('lookup-input');
          if (inp) inp.focus();
        }, 100);
      }
    }
  });
});

function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function loadInitialData() {
  try {
    const products = await API.getProducts();
    State.allProductsList = products;
    State.kioskProducts = products;
    renderKioskProducts();
    loadCompanyRequisitions();
  } catch (err) {
    console.error('Erro na carga inicial:', err);
  }
}

// ========================================================
// ALTERNADOR DE MODO: PORTAL COLABORADOR vs WMS TÉCNICO
// ========================================================
function switchAppMode(mode) {
  State.appMode = mode;

  const btnKiosk = document.getElementById('mode-btn-kiosk');
  const btnWms = document.getElementById('mode-btn-wms');
  const sectionKiosk = document.getElementById('section-kiosk-mode');
  const sectionWms = document.getElementById('section-wms-mode');
  const wmsNav = document.getElementById('wms-desktop-nav');
  const viewChat = document.getElementById('view-chat');
  const btnOpenCart = document.getElementById('btn-open-cart');

  const titleText = document.getElementById('app-title-text');
  const badgeMode = document.getElementById('app-badge-mode');
  const subtitleText = document.getElementById('app-subtitle-text');
  const logoIcon = document.getElementById('main-logo-icon');

  if (mode === 'kiosk') {
    // Ativa Portal do Colaborador
    btnKiosk.className = 'mode-switch-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600 text-white shadow-sm';
    btnWms.className = 'mode-switch-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition';
    
    sectionKiosk.classList.remove('hidden');
    sectionWms.classList.add('hidden');
    wmsNav.classList.add('hidden');
    wmsNav.classList.remove('flex');
    btnOpenCart.classList.remove('hidden');

    titleText.textContent = 'Almoxarifado Express';
    badgeMode.textContent = 'Portal da Empresa';
    badgeMode.className = 'px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full uppercase tracking-wider';
    subtitleText.textContent = 'Solicite materiais e ferramentas com retirada imediata';
    
    renderKioskProducts();
  } else {
    // Ativa Modo WMS de Piso
    btnWms.className = 'mode-switch-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600 text-white shadow-sm';
    btnKiosk.className = 'mode-switch-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition';

    sectionKiosk.classList.add('hidden');
    sectionWms.classList.remove('hidden');
    wmsNav.classList.remove('hidden');
    wmsNav.classList.add('flex');

    titleText.textContent = 'WMS Armazém';
    badgeMode.textContent = 'Operações Técnicas';
    badgeMode.className = 'px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full uppercase tracking-wider';
    subtitleText.textContent = 'Controle avançado de picking, pulmão, auditoria e saldos';

    navigate(State.currentView || 'dashboard');
  }

  // Fecha chat se estiver em tela cheia ao alternar modos
  if (viewChat && !viewChat.classList.contains('hidden')) {
    viewChat.classList.add('hidden');
  }

  initIcons();
}

// ========================================================
// 1. PORTAL DO COLABORADOR: VITRINE DE MATERIAIS & KITS
// ========================================================
function setKioskCategoryFilter(category) {
  State.kioskCategory = category;

  document.querySelectorAll('.kiosk-cat-chip').forEach(btn => {
    btn.classList.remove('active');
  });

  const activeBtn = event ? event.target.closest('button') : null;
  if (activeBtn) activeBtn.classList.add('active');

  filterKioskProducts();
}

function filterKioskProducts() {
  const input = document.getElementById('kiosk-search-input');
  const term = input ? input.value.trim().toLowerCase() : '';

  let filtered = State.allProductsList || [];

  if (State.kioskCategory !== 'ALL') {
    filtered = filtered.filter(p => p.category === State.kioskCategory);
  }

  if (term) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      (p.description && p.description.toLowerCase().includes(term)) ||
      p.category.toLowerCase().includes(term)
    );
  }

  State.kioskProducts = filtered;
  renderKioskProducts();
}

function renderKioskProducts() {
  const container = document.getElementById('kiosk-products-grid');
  const countEl = document.getElementById('kiosk-item-count');
  if (!container) return;

  const items = State.kioskProducts || [];
  if (countEl) countEl.textContent = `${items.length} itens`;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center bg-slate-800/40 border border-slate-700/60 rounded-3xl p-8">
        <div class="text-4xl mb-3">🔍</div>
        <h4 class="text-base font-bold text-white">Nenhum material encontrado</h4>
        <p class="text-xs text-slate-400 mt-1">Tente pesquisar com outro termo ou limpe os filtros de categoria.</p>
        <button onclick="setKioskCategoryFilter('ALL')" class="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-semibold text-white">
          Ver Todos os Materiais
        </button>
      </div>
    `;
    initIcons();
    return;
  }

  container.innerHTML = items.map(p => {
    const isOutOfStock = p.total_quantity === 0;
    const isLowStock = p.total_quantity <= p.min_stock && !isOutOfStock;

    let stockBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ ${p.total_quantity} disponíveis</span>`;
    if (isOutOfStock) {
      stockBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">🛑 Esgotado</span>`;
    } else if (isLowStock) {
      stockBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">⚠️ Restam ${p.total_quantity}</span>`;
    }

    // Local simplificado para o funcionário leigo
    const mainLoc = p.stocks && p.stocks[0] ? p.stocks[0].code : 'Doca 1';
    const locParts = mainLoc.split('-');
    const friendlyLocation = locParts.length > 2 
      ? `Galpão ${locParts[0] || '1'} • Corredor ${locParts[1] || 'A'}` 
      : mainLoc;

    const iconEmoji = p.icon || '📦';
    const imageUrl = p.image_url || '';

    return `
      <div class="kiosk-product-card bg-slate-800/90 border border-slate-700/80 rounded-3xl overflow-hidden flex flex-col justify-between shadow-xl">
        
        <!-- Imagem / Header Visual -->
        <div class="relative h-44 w-full bg-slate-900 overflow-hidden group">
          ${imageUrl ? `
            <img src="${imageUrl}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500 opacity-90">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
          ` : `
            <div class="w-full h-full flex items-center justify-center text-5xl bg-slate-800/60">
              ${iconEmoji}
            </div>
          `}

          <div class="absolute top-3 left-3">
            <span class="px-2.5 py-0.5 rounded-lg bg-slate-900/80 backdrop-blur border border-slate-700 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
              ${p.category}
            </span>
          </div>

          <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            ${stockBadge}
          </div>
        </div>

        <!-- Conteúdo do Card -->
        <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <h3 class="font-extrabold text-sm text-white line-clamp-2 leading-snug">${p.name}</h3>
            <p class="text-xs text-slate-400 mt-1 line-clamp-2">${p.description || 'Material disponível para uso interno.'}</p>
          </div>

          <div class="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
            <div class="flex items-center gap-1 text-[11px] text-slate-300">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-emerald-400 shrink-0"></i>
              <span class="font-medium">${friendlyLocation}</span>
            </div>

            <button onclick="openWarehouseMapModal('${mainLoc}')" title="Ver no GPS do galpão" class="text-emerald-400 hover:text-emerald-300 text-[11px] font-bold flex items-center gap-0.5">
              <span>Rota</span>
              <i data-lucide="chevron-right" class="w-3 h-3"></i>
            </button>
          </div>

          <!-- Botão de Ação: Adicionar ao Carrinho -->
          <div class="pt-2">
            ${isOutOfStock ? `
              <button disabled class="w-full py-2.5 bg-slate-700/50 text-slate-500 rounded-xl text-xs font-bold cursor-not-allowed">
                Indisponível no Momento
              </button>
            ` : `
              <button 
                onclick="addToCart(${p.id})" 
                class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition"
              >
                <i data-lucide="plus" class="w-4 h-4"></i>
                <span>Adicionar à Cesta</span>
              </button>
            `}
          </div>

        </div>

      </div>
    `;
  }).join('');

  initIcons();
}

// ========================================================
// 2. KITS INTELIGENTES DE RETIRADA COM 1 CLIQUE
// ========================================================
function addSmartKit(kitType) {
  let skusToAdd = [];
  let kitName = '';

  if (kitType === 'EPI') {
    skusToAdd = ['SKU-9920', 'BOT-SEG-42'];
    kitName = 'Kit Visita à Fábrica';
  } else if (kitType === 'ELETRICA') {
    skusToAdd = ['FIT-3M-PR', 'CABO-2.5-AZ', 'DISJ-32A'];
    kitName = 'Kit Manutenção Elétrica';
  } else if (kitType === 'ORGANIZACAO') {
    skusToAdd = ['CX-ORG-30L'];
    kitName = 'Kit Organização';
  }

  let addedCount = 0;
  skusToAdd.forEach(sku => {
    const prod = State.allProductsList.find(p => p.sku === sku);
    if (prod && prod.total_quantity > 0) {
      const existing = State.cart.find(it => it.product.id === prod.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        State.cart.push({ product: prod, quantity: 1 });
      }
      addedCount++;
    }
  });

  updateCartBadge();
  toggleCartDrawer(true);
  showToast(`Itens do "${kitName}" adicionados à sua cesta!`, 'success');
}

// ========================================================
// 3. CARRINHO FLUTUANTE DE REQUISIÇÃO (DRAWER)
// ========================================================
function addToCart(productId) {
  const prod = State.allProductsList.find(p => p.id === productId);
  if (!prod) return;

  const existing = State.cart.find(it => it.product.id === productId);
  if (existing) {
    if (existing.quantity < prod.total_quantity) {
      existing.quantity += 1;
      showToast(`+1 ${prod.name} adicionado à cesta`, 'info');
    } else {
      showToast(`Limite de saldo em estoque atingido (${prod.total_quantity} un)`, 'warning');
      return;
    }
  } else {
    State.cart.push({ product: prod, quantity: 1 });
    showToast(`${prod.name} adicionado à cesta!`, 'success');
  }

  updateCartBadge();
  renderCartItems();
}

function updateCartQuantity(productId, delta) {
  const item = State.cart.find(it => it.product.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    State.cart = State.cart.filter(it => it.product.id !== productId);
  } else if (item.quantity > item.product.total_quantity) {
    item.quantity = item.product.total_quantity;
    showToast(`Quantidade limitada ao saldo disponível (${item.product.total_quantity})`, 'warning');
  }

  updateCartBadge();
  renderCartItems();
}

function updateCartBadge() {
  const count = State.cart.reduce((sum, it) => sum + it.quantity, 0);
  const badge = document.getElementById('cart-counter-badge');
  const subtitle = document.getElementById('cart-drawer-subtitle');

  if (badge) badge.textContent = count;
  if (subtitle) subtitle.textContent = `${count} ${count === 1 ? 'item' : 'itens'} na cesta`;
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');

  if (open) {
    renderCartItems();
    drawer.classList.remove('translate-x-full');
    backdrop.classList.remove('hidden');
  } else {
    drawer.classList.add('translate-x-full');
    backdrop.classList.add('hidden');
  }
}

function renderCartItems() {
  const container = document.getElementById('cart-items-container');
  if (!container) return;

  if (State.cart.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
        <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-3xl">
          🛒
        </div>
        <h4 class="font-bold text-white text-base">Sua cesta está vazia</h4>
        <p class="text-xs max-w-xs">Escolha ferramentas, fitas, luvas ou qualquer material disponível no catálogo.</p>
        <button onclick="toggleCartDrawer(false)" class="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">
          Explorar Catálogo
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = State.cart.map(it => `
    <div class="bg-slate-900 border border-slate-700/80 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md">
      <div class="flex items-center space-x-3">
        <div class="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0 overflow-hidden">
          ${it.product.image_url ? `
            <img src="${it.product.image_url}" alt="" class="w-full h-full object-cover">
          ` : (it.product.icon || '📦')}
        </div>
        <div>
          <h4 class="font-bold text-xs text-white leading-tight">${it.product.name}</h4>
          <span class="text-[10px] text-emerald-400 font-mono">${it.product.sku}</span>
          <div class="text-[10px] text-slate-400 mt-0.5">
            Retirar em: <b class="text-slate-300">${it.product.stocks && it.product.stocks[0] ? it.product.stocks[0].code : 'Doca'}</b>
          </div>
        </div>
      </div>

      <!-- Controles de Quantidade -->
      <div class="flex items-center space-x-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
        <button onclick="updateCartQuantity(${it.product.id}, -1)" class="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-200 text-xs font-bold transition">
          -
        </button>
        <span class="w-6 text-center font-bold text-xs text-white">${it.quantity}</span>
        <button onclick="updateCartQuantity(${it.product.id}, 1)" class="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-200 text-xs font-bold transition">
          +
        </button>
      </div>
    </div>
  `).join('');

  initIcons();
}

// ========================================================
// 4. SUBMISSÃO DE REQUISIÇÃO & TICKET DIGITAL
// ========================================================
async function submitRequisition() {
  if (State.cart.length === 0) {
    showToast('Adicione pelo menos um material à sua cesta.', 'warning');
    return;
  }

  const nameInput = document.getElementById('req-requester-name');
  const deptInput = document.getElementById('req-department');

  const requesterName = nameInput ? nameInput.value.trim() : '';
  const department = deptInput ? deptInput.value : 'Geral';

  if (!requesterName) {
    showToast('Por favor, informe seu nome ou matrícula para retirada.', 'warning');
    if (nameInput) nameInput.focus();
    return;
  }

  const btn = document.getElementById('btn-submit-requisition');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>Liberando materiais...</span>`;
  initIcons();

  try {
    const payload = {
      requester_name: requesterName,
      department: department,
      items: State.cart.map(it => ({
        productId: it.product.id,
        quantity: it.quantity
      }))
    };

    const res = await API.createRequisition(payload);

    // Limpa carrinho
    State.cart = [];
    updateCartBadge();
    toggleCartDrawer(false);

    // Abre modal de comprovante com os dados
    openTicketModal(res);

    // Atualiza catálogo e histórico
    await loadInitialData();
  } catch (err) {
    showToast('Erro ao processar requisição: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span>Confirmar Retirada & Gerar Comprovante</span>`;
    initIcons();
  }
}

function openTicketModal(ticketData) {
  document.getElementById('ticket-code').textContent = ticketData.code;
  document.getElementById('ticket-requester').textContent = ticketData.requester_name;
  document.getElementById('ticket-department').textContent = ticketData.department;

  const listContainer = document.getElementById('ticket-items-list');
  if (listContainer && ticketData.items) {
    listContainer.innerHTML = ticketData.items.map(it => `
      <div class="flex items-center justify-between bg-slate-800/80 p-2 rounded-lg border border-slate-700">
        <div>
          <span class="font-bold text-white">${it.name}</span>
          <span class="text-slate-400">(${it.quantity} ${it.unit || 'UN'})</span>
        </div>
        <div class="text-right">
          <span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/30">
            ${it.location || 'Doca'}
          </span>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('modal-ticket').classList.remove('hidden');
  initIcons();
}

function closeTicketModal() {
  document.getElementById('modal-ticket').classList.add('hidden');
}

async function loadCompanyRequisitions() {
  const body = document.getElementById('company-requisitions-body');
  if (!body) return;

  try {
    const reqs = await API.getRequisitions();
    if (!reqs || reqs.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-500">Nenhuma retirada recente registrada.</td></tr>';
      return;
    }

    body.innerHTML = reqs.map(r => {
      const date = new Date(r.created_at).toLocaleString('pt-BR');
      const itemsSummary = (r.items || []).map(it => `${it.quantity}x ${it.product_name}`).join(', ') || `${r.total_quantity} itens`;

      return `
        <tr class="hover:bg-slate-700/20 transition">
          <td class="py-2.5 px-3 font-mono font-bold text-emerald-400">${r.code}</td>
          <td class="py-2.5 px-3 font-semibold text-white">${r.requester_name}</td>
          <td class="py-2.5 px-3 text-slate-300">${r.department}</td>
          <td class="py-2.5 px-3 text-slate-300 max-w-xs truncate" title="${itemsSummary}">${itemsSummary}</td>
          <td class="py-2.5 px-3 text-slate-400 text-[11px]">${date}</td>
          <td class="py-2.5 px-3 text-right">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Liberado
            </span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro ao carregar requisições da empresa:', err);
  }
}

// ========================================================
// 5. NAVEGAÇÃO INTERNA DO MODO WMS
// ========================================================
function navigate(viewName) {
  if (viewName === 'chat') {
    document.getElementById('view-chat').classList.remove('hidden');
    document.getElementById('section-kiosk-mode').classList.add('hidden');
    document.getElementById('section-wms-mode').classList.add('hidden');
    initIcons();
    return;
  }

  // Se navegou para uma aba normal do WMS, garante que o modo WMS está ativo
  if (State.appMode !== 'wms') {
    switchAppMode('wms');
  }

  State.currentView = viewName;
  const views = ['dashboard', 'lookup', 'inventory', 'transfers'];

  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const navBtn = document.getElementById(`nav-${v}`);

    if (el) {
      if (v === viewName) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }

    if (navBtn) {
      if (v === viewName) {
        navBtn.classList.add('active');
      } else {
        navBtn.classList.remove('active');
      }
    }
  });

  const viewChat = document.getElementById('view-chat');
  if (viewChat) viewChat.classList.add('hidden');

  if (viewName === 'dashboard') loadDashboardData();
  if (viewName === 'lookup') performSearch();
  if (viewName === 'inventory') loadInventoryData();
  if (viewName === 'transfers') loadMovementsHistory();

  initIcons();
}

// ========================================================
// 6. DASHBOARD WMS & AUDITORIA
// ========================================================
async function loadDashboardData() {
  try {
    const data = await API.getDashboard();

    document.getElementById('kpi-skus').textContent = data.totalSkus;
    document.getElementById('kpi-total-units').textContent = data.totalQty.toLocaleString('pt-BR');
    document.getElementById('kpi-zero-stock').textContent = data.zeroStock;
    document.getElementById('kpi-critical-stock').textContent = data.criticalStock;
    document.getElementById('kpi-locations-tag').textContent = `${data.occupiedLocations} de ${data.totalLocations} posições ativas`;

    const catContainer = document.getElementById('category-distribution');
    if (catContainer && data.categoryStats) {
      catContainer.innerHTML = data.categoryStats.map(cat => `
        <div class="space-y-1">
          <div class="flex justify-between text-xs">
            <span class="font-medium text-slate-300">${cat.category} (${cat.skus} SKUs)</span>
            <span class="text-emerald-400 font-semibold">${cat.total_qty} un</span>
          </div>
          <div class="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div class="bg-emerald-500 h-1.5 rounded-full" style="width: ${Math.min(100, Math.max(10, (cat.total_qty / (data.totalQty || 1)) * 100))}%"></div>
          </div>
        </div>
      `).join('');
    }

    const mBody = document.getElementById('recent-movements-body');
    if (mBody && data.recentMovements) {
      mBody.innerHTML = data.recentMovements.map(m => {
        let badgeClass = 'bg-slate-700 text-slate-300';
        let typeLabel = m.type;
        if (m.type === 'ENTRADA') { badgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'; typeLabel = 'Entrada'; }
        if (m.type === 'TRANSFERENCIA') { badgeClass = 'bg-blue-500/20 text-blue-300 border border-blue-500/30'; typeLabel = 'Transferência'; }
        if (m.type === 'SAIDA') { badgeClass = 'bg-purple-500/20 text-purple-300 border border-purple-500/30'; typeLabel = 'Retirada'; }
        if (m.type === 'AJUSTE_INVENTARIO') { badgeClass = 'bg-amber-500/20 text-amber-300 border border-amber-500/30'; typeLabel = 'Ajuste Físico'; }

        const route = m.from_code && m.to_code ? `${m.from_code} → ${m.to_code}` : (m.to_code || m.from_code || 'Geral');
        const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return `
          <tr class="hover:bg-slate-700/20 transition">
            <td class="py-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}">${typeLabel}</span></td>
            <td class="py-2.5 font-medium text-white">${m.product_name} <span class="text-slate-400 font-mono text-[11px]">(${m.sku})</span></td>
            <td class="py-2.5 font-mono text-emerald-400 text-[11px]">${route}</td>
            <td class="py-2.5 text-right font-bold ${m.delta < 0 ? 'text-rose-400' : 'text-slate-200'}">${m.quantity} un</td>
            <td class="py-2.5 text-right text-slate-400 text-[11px]">${time}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    showToast('Erro ao carregar dados do dashboard: ' + err.message, 'error');
  }
}

function filterProductsByStatus(status) {
  navigate('lookup');
  performSearch(status);
}

// ========================================================
// 7. BUSCA WMS & LOCALIZAÇÃO ESTRUTURADA
// ========================================================
function handleSearchKeyup(event) {
  if (event.key === 'Enter') performSearch();
}

async function performSearch(overrideStatus) {
  const input = document.getElementById('lookup-input');
  const catSel = document.getElementById('lookup-category');
  const resultsContainer = document.getElementById('lookup-results');

  const q = input ? input.value.trim() : '';
  const category = catSel ? catSel.value : 'ALL';
  const status = overrideStatus || 'ALL';

  if (!resultsContainer) return;

  try {
    const products = await API.getProducts({ q, category, status });
    State.products = products;

    if (!products || products.length === 0) {
      resultsContainer.innerHTML = `
        <div class="col-span-full bg-slate-800/60 border border-slate-700/80 rounded-2xl p-8 text-center">
          <h3 class="text-base font-bold text-white">Nenhum produto localizado</h3>
          <p class="text-xs text-slate-400 mt-1">Verifique o código ou consulte as docas de recebimento.</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = products.map(prod => {
      const isMultiAddress = prod.stocks && prod.stocks.length > 1;
      const primaryLoc = prod.stocks && prod.stocks[0] ? prod.stocks[0].code : 'G1-A';

      return `
        <div class="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div class="flex items-start justify-between">
            <div>
              <span class="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">${prod.sku}</span>
              <h3 class="text-base font-bold text-white mt-1">${prod.name}</h3>
              <p class="text-xs text-slate-400">${prod.category} | Saldo: <b class="text-white">${prod.total_quantity} ${prod.unit}</b></p>
            </div>
            <button onclick="openWarehouseMapModal('${primaryLoc}')" class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1 transition">
              <i data-lucide="map" class="w-3.5 h-3.5 text-emerald-400"></i>
              <span>Mapa</span>
            </button>
          </div>

          <div class="space-y-1 text-xs">
            ${isMultiAddress ? `
              <div class="text-amber-300 font-semibold mb-1">Múltiplos Endereços:</div>
              ${prod.stocks.map(s => `
                <div class="flex justify-between bg-slate-900/60 p-2 rounded-lg font-mono">
                  <span>${s.code} (${s.type})</span>
                  <span class="text-white font-bold">${s.quantity} un</span>
                </div>
              `).join('')}
            ` : `
              <div class="bg-slate-900/80 p-2.5 rounded-xl font-mono text-xs text-emerald-400 font-bold">
                ${prod.stocks && prod.stocks[0] ? prod.stocks[0].code : 'Sem local'}
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');

    initIcons();
  } catch (err) {
    showToast('Erro na busca WMS: ' + err.message, 'error');
  }
}

// ========================================================
// 8. INVENTÁRIO WMS (CONFERÊNCIA & AJUSTE EXPLÍCITO)
// ========================================================
async function loadInventoryData() {
  const tableBody = document.getElementById('inventory-table-body');
  if (!tableBody) return;

  try {
    const items = await API.getInventory();
    if (!items || items.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" class="py-6 text-center text-slate-400">Nenhum item registrado.</td></tr>';
      return;
    }

    tableBody.innerHTML = items.map((item, idx) => `
      <tr class="hover:bg-slate-800/70 transition">
        <td class="py-3 px-3 font-mono font-bold text-emerald-400">${item.sku}</td>
        <td class="py-3 px-3 font-medium text-white">${item.product_name}</td>
        <td class="py-3 px-3 font-mono text-slate-300 text-[11px]">${item.location_code}</td>
        <td class="py-3 px-3 text-center font-bold text-slate-300">${item.system_quantity}</td>
        <td class="py-3 px-3 text-center">
          <input 
            type="number" 
            id="inv-input-${idx}" 
            value="${item.system_quantity}" 
            oninput="recalculateDivergence(${idx}, ${item.system_quantity})"
            class="w-16 bg-slate-900 border border-slate-700 rounded-lg p-1 text-center text-xs font-bold text-white"
          >
        </td>
        <td class="py-3 px-3 text-center font-bold font-mono text-xs" id="inv-delta-${idx}">
          <span class="text-slate-400">0</span>
        </td>
        <td class="py-3 px-3" id="inv-status-${idx}">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ OK</span>
        </td>
        <td class="py-3 px-3 text-right">
          <button 
            id="inv-btn-adjust-${idx}" 
            onclick="promptAdjustmentFromTable(${idx}, ${JSON.stringify(item).replace(/"/g, '&quot;')})"
            class="px-2.5 py-1 bg-slate-700 hover:bg-amber-600 hover:text-white text-slate-300 rounded-lg text-xs font-medium transition"
          >
            Ajustar
          </button>
        </td>
      </tr>
    `).join('');

    initIcons();
  } catch (err) {
    showToast('Erro ao carregar inventário: ' + err.message, 'error');
  }
}

function recalculateDivergence(idx, systemQty) {
  const input = document.getElementById(`inv-input-${idx}`);
  const deltaEl = document.getElementById(`inv-delta-${idx}`);
  const statusEl = document.getElementById(`inv-status-${idx}`);
  const btnAdjust = document.getElementById(`inv-btn-adjust-${idx}`);

  if (!input || !deltaEl || !statusEl) return;
  const counted = parseInt(input.value, 10);
  if (isNaN(counted)) return;

  const delta = counted - systemQty;
  if (delta === 0) {
    deltaEl.innerHTML = '<span class="text-slate-400">0</span>';
    statusEl.innerHTML = '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ OK</span>';
    btnAdjust.className = 'px-2.5 py-1 bg-slate-700 text-slate-300 rounded-lg text-xs font-medium';
  } else {
    const symbol = delta > 0 ? `+${delta}` : `${delta}`;
    deltaEl.innerHTML = `<span class="text-amber-400 font-bold">${symbol}</span>`;
    statusEl.innerHTML = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">⚠️ Divergência</span>`;
    btnAdjust.className = 'px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition shadow-md shadow-amber-500/20';
  }
}

function promptAdjustmentFromTable(idx, item) {
  const input = document.getElementById(`inv-input-${idx}`);
  const counted = input ? parseInt(input.value, 10) : item.system_quantity;

  openAdjustmentModal({
    stockId: item.stock_id,
    productId: item.product_id,
    productSku: item.sku,
    productName: item.product_name,
    locationId: item.location_id,
    locationCode: item.location_code,
    systemQty: item.system_quantity,
    countedQty: isNaN(counted) ? item.system_quantity : counted,
    divergence: (isNaN(counted) ? item.system_quantity : counted) - item.system_quantity
  });
}

function openAdjustmentModal(payload) {
  State.pendingAdjustment = payload;

  document.getElementById('modal-adj-product').textContent = `${payload.productName} (${payload.productSku})`;
  document.getElementById('modal-adj-location').textContent = payload.locationCode;
  document.getElementById('modal-adj-system-qty').textContent = `${payload.systemQty} un.`;
  document.getElementById('modal-adj-counted-qty').textContent = `${payload.countedQty} un.`;

  const deltaEl = document.getElementById('modal-adj-divergence');
  const delta = payload.divergence;
  deltaEl.textContent = delta > 0 ? `+${delta} un.` : `${delta} un.`;
  deltaEl.className = delta < 0 ? 'font-bold font-mono text-rose-400' : 'font-bold font-mono text-emerald-400';

  document.getElementById('modal-confirm-adjustment').classList.remove('hidden');
  initIcons();
}

function closeAdjustmentModal() {
  document.getElementById('modal-confirm-adjustment').classList.add('hidden');
  State.pendingAdjustment = null;
}

async function executeConfirmedAdjustment() {
  if (!State.pendingAdjustment) return;

  try {
    const res = await API.applyAdjustment({
      productId: State.pendingAdjustment.productId,
      locationId: State.pendingAdjustment.locationId,
      systemQty: State.pendingAdjustment.systemQty,
      countedQty: State.pendingAdjustment.countedQty,
      divergence: State.pendingAdjustment.divergence,
      operator: 'Operador Galpão',
      reason: 'Ajuste Físico Confirmado',
      confirmed: true
    });

    closeAdjustmentModal();
    showToast(res.message || 'Ajuste aplicado com sucesso!', 'success');
    loadInventoryData();
  } catch (err) {
    showToast('Erro ao aplicar ajuste: ' + err.message, 'error');
  }
}

// ========================================================
// 9. AUDITORIA DE MOVIMENTAÇÕES
// ========================================================
async function loadMovementsHistory() {
  const mBody = document.getElementById('movements-history-body');
  if (!mBody) return;

  try {
    const movements = await API.getMovements({ limit: 50 });
    if (!movements || movements.length === 0) {
      mBody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-400">Nenhum registro encontrado.</td></tr>';
      return;
    }

    mBody.innerHTML = movements.map(m => {
      let badgeClass = 'bg-slate-700 text-slate-300';
      let typeLabel = m.type;
      if (m.type === 'ENTRADA') { badgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'; typeLabel = 'Entrada'; }
      if (m.type === 'SAIDA') { badgeClass = 'bg-purple-500/20 text-purple-300 border border-purple-500/30'; typeLabel = 'Retirada'; }
      if (m.type === 'TRANSFERENCIA') { badgeClass = 'bg-blue-500/20 text-blue-300 border border-blue-500/30'; typeLabel = 'Transferência'; }
      if (m.type === 'AJUSTE_INVENTARIO') { badgeClass = 'bg-amber-500/20 text-amber-300 border border-amber-500/30'; typeLabel = 'Ajuste Físico'; }

      const dateStr = new Date(m.created_at).toLocaleString('pt-BR');
      const route = m.from_code && m.to_code ? `${m.from_code} → ${m.to_code}` : (m.to_code || m.from_code || 'Geral');

      return `
        <tr class="hover:bg-slate-800/60 transition">
          <td class="py-2.5 px-3 font-mono text-[11px] text-slate-400">${dateStr}</td>
          <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}">${typeLabel}</span></td>
          <td class="py-2.5 px-3 font-medium text-white">${m.product_name} <span class="text-slate-400 font-mono text-[11px]">(${m.sku})</span></td>
          <td class="py-2.5 px-3 font-mono text-emerald-400 text-[11px]">${route}</td>
          <td class="py-2.5 px-3 text-right font-bold ${m.delta < 0 ? 'text-rose-400' : 'text-slate-200'}">${m.quantity} ${m.unit || 'UN'}</td>
          <td class="py-2.5 px-3 text-right font-bold text-white">${m.new_quantity !== null ? m.new_quantity : '--'}</td>
          <td class="py-2.5 px-3 text-slate-400 text-[11px]">${m.operator}: ${m.reason || ''}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro movimentos:', err);
  }
}

// ========================================================
// 10. ASSISTENTE DE IA (CHAT)
// ========================================================
function clearChat() {
  const container = document.getElementById('chat-messages');
  if (container) {
    container.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">
          <i data-lucide="bot" class="w-4 h-4"></i>
        </div>
        <div class="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 max-w-xl text-xs sm:text-sm text-slate-200 shadow-md">
          <p class="font-bold text-emerald-400 mb-1">Conversa reiniciada. Como posso ajudar com os materiais ou galpão?</p>
        </div>
      </div>
    `;
    initIcons();
  }
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('chat-input');
  if (!input) return;

  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  await sendChatMessage(msg);
}

async function sendChatMessage(messageText) {
  navigate('chat');
  const container = document.getElementById('chat-messages');
  if (!container) return;

  container.insertAdjacentHTML('beforeend', `
    <div class="flex items-start justify-end space-x-3">
      <div class="bg-emerald-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-lg text-xs sm:text-sm shadow-md">
        ${escapeHtml(messageText)}
      </div>
    </div>
  `);

  const typingId = 'typing-' + Date.now();
  container.insertAdjacentHTML('beforeend', `
    <div id="${typingId}" class="flex items-start space-x-3">
      <div class="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">
        <i data-lucide="bot" class="w-4 h-4"></i>
      </div>
      <div class="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
        <i data-lucide="loader" class="w-4 h-4 animate-spin text-emerald-400"></i>
        <span>Consultando estoque no WMS...</span>
      </div>
    </div>
  `);
  initIcons();
  container.scrollTop = container.scrollHeight;

  try {
    const res = await API.sendChatMessage(messageText);
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    const formattedText = formatMarkdownToHtml(res.text);

    let actionHtml = '';
    if (res.action && res.action.type === 'CONFIRM_ADJUSTMENT') {
      const payload = res.action.payload;
      actionHtml = `
        <div class="mt-3 p-3 bg-slate-950/80 rounded-xl border border-amber-500/40 space-y-2">
          <div class="flex items-center justify-between text-xs text-amber-300 font-bold">
            <span>Ação Operacional Proposta</span>
            <span class="px-2 py-0.5 rounded bg-amber-500/20 text-[10px]">Confirmação Obrigatória</span>
          </div>
          <div class="text-[11px] text-slate-300">
            Ajustar saldo de <b class="text-white">${payload.productName}</b> no endereço <b class="text-emerald-400 font-mono">${payload.locationCode}</b> de <b>${payload.systemQty}</b> para <b class="text-amber-400">${payload.countedQty} un.</b>
          </div>
          <button 
            onclick="openAdjustmentModal(${JSON.stringify(payload).replace(/"/g, '&quot;')})"
            class="w-full mt-2 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition"
          >
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            <span>Confirmar Ajuste Agora</span>
          </button>
        </div>
      `;
    }

    container.insertAdjacentHTML('beforeend', `
      <div class="flex items-start space-x-3">
        <div class="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">
          <i data-lucide="bot" class="w-4 h-4"></i>
        </div>
        <div class="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 max-w-xl text-xs sm:text-sm text-slate-200 shadow-md space-y-2 leading-relaxed">
          ${formattedText}
          ${actionHtml}
        </div>
      </div>
    `);

    const sugContainer = document.getElementById('chat-suggestions');
    if (sugContainer) {
      if (res.suggestions && res.suggestions.length > 0) {
        sugContainer.innerHTML = res.suggestions.map(s => `
          <button onclick="sendChatMessage('${s}')" class="chat-chip">
            ${s}
          </button>
        `).join('');
      } else {
        sugContainer.innerHTML = '';
      }
    }

    initIcons();
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    showToast('Erro no assistente: ' + err.message, 'error');
  }
}

function formatMarkdownToHtml(text) {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
  html = html.replace(/`(.*?)`/g, '<code class="bg-slate-800 text-emerald-300 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');
  html = html.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  return html;
}

// ========================================================
// 11. MAPA ESQUEMÁTICO & LEITOR DE CÓDIGO DE BARRAS
// ========================================================
function openWarehouseMapModal(locationCode) {
  const modal = document.getElementById('modal-warehouse-map');
  const title = document.getElementById('map-target-title');

  title.textContent = `Endereço de Retirada: ${locationCode || 'Piso Geral'}`;

  ['A', 'B', 'C02', 'PULMAO'].forEach(cell => {
    const el = document.getElementById(`map-cell-${cell}`);
    if (el) el.classList.remove('active-target');
  });

  let target = 'B';
  if (locationCode.includes('-A-') || locationCode.includes('G1-A')) target = 'A';
  if (locationCode.includes('-B-') || locationCode.includes('G1-B')) target = 'B';
  if (locationCode.includes('C02') || locationCode.includes('C03')) target = 'C02';
  if (locationCode.includes('PULMAO')) target = 'PULMAO';

  const cellEl = document.getElementById(`map-cell-${target}`);
  if (cellEl) cellEl.classList.add('active-target');

  modal.classList.remove('hidden');
  initIcons();
}

function closeWarehouseMapModal() {
  document.getElementById('modal-warehouse-map').classList.add('hidden');
}

function openBarcodeScannerModal() {
  const modal = document.getElementById('modal-barcode');
  modal.classList.remove('hidden');
  const inp = document.getElementById('barcode-input');
  if (inp) {
    inp.value = '';
    setTimeout(() => inp.focus(), 100);
  }
  initIcons();
}

function closeBarcodeScannerModal() {
  document.getElementById('modal-barcode').classList.add('hidden');
}

function scanCode(code) {
  const inp = document.getElementById('barcode-input');
  if (inp) inp.value = code;
  handleBarcodeSubmit();
}

function playBeepSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
}

function handleBarcodeSubmit() {
  const inp = document.getElementById('barcode-input');
  if (!inp) return;
  const code = inp.value.trim();
  if (!code) return;

  playBeepSound();
  closeBarcodeScannerModal();

  if (State.appMode === 'kiosk') {
    const kInp = document.getElementById('kiosk-search-input');
    if (kInp) {
      kInp.value = code;
      filterKioskProducts();
    }
  } else {
    navigate('lookup');
    const lInp = document.getElementById('lookup-input');
    if (lInp) {
      lInp.value = code;
      performSearch();
    }
  }
}

// ========================================================
// UTILITÁRIOS: TOAST NOTIFICATIONS & SANITIZE
// ========================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const id = 'toast-' + Date.now();
  let bgClass = 'bg-slate-800 border-slate-700 text-slate-200';
  let iconName = 'info';

  if (type === 'success') {
    bgClass = 'bg-emerald-950 border-emerald-500/50 text-emerald-200';
    iconName = 'check-circle';
  } else if (type === 'error') {
    bgClass = 'bg-rose-950 border-rose-500/50 text-rose-200';
    iconName = 'alert-octagon';
  } else if (type === 'warning') {
    bgClass = 'bg-amber-950 border-amber-500/50 text-amber-200';
    iconName = 'alert-triangle';
  }

  const toastHtml = `
    <div id="${id}" class="toast-slide-in pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-2xl border shadow-xl text-xs max-w-sm ${bgClass}">
      <i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i>
      <span class="flex-1 font-medium">${escapeHtml(message)}</span>
      <button onclick="document.getElementById('${id}')?.remove()" class="opacity-60 hover:opacity-100">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHtml);
  initIcons();

  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.remove();
  }, 4000);
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
