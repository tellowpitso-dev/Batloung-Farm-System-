/* =====================================================================
   BATLOUNG FARM DISTRIBUTION SYSTEM
   Client-Side Application JavaScript
   Maseru, Lesotho
   ===================================================================== */

// Auto-detect API location: points to backend port 5000 if opened on a different dev port
const API_BASE = (window.location.port === '5000') ? '/api' : 'http://localhost:5000/api';

// Global Application State
const state = {
    token: localStorage.getItem('bf_token') || null,
    user: JSON.parse(localStorage.getItem('bf_user') || 'null'),
    currentRole: 'vendor',
    fruits: [],
    suppliers: [],
    vendors: [],
    orders: [],
    leafletMap: null,
    mapMarkers: [],
    mapPolylines: [],
    depotCoords: [-29.3100, 27.4800]
};

// =====================================================================
// 1. INITIALIZATION AND AUTHENTICATION
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
    loadVendorLoginCards();
});

// Load registered vendor account cards on the login page
async function loadVendorLoginCards() {
    try {
        const res = await fetch(`${API_BASE}/vendors/public`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) return;

        const section = document.getElementById('vendorQuickLoginSection');
        const container = document.getElementById('vendorLoginCards');
        if (!section || !container) return;

        section.style.display = 'block';
        container.innerHTML = data.data.map(v => `
            <button type="button" class="vendor-login-card" onclick="selectVendorCard('${v.email}')">
                <i class="fa-solid fa-store" style="color:var(--brand-sky,#38bdf8);"></i>
                <div style="flex:1;text-align:left;">
                    <strong>${v.vendor_name}</strong>
                    <span style="display:block;font-size:0.76rem;color:var(--text-muted,#64748b);">${v.location}</span>
                </div>
                <i class="fa-solid fa-chevron-right" style="font-size:0.75rem;color:var(--text-muted,#64748b);"></i>
            </button>
        `).join('');
    } catch (e) {
        // Silently fail - login still works without cards
    }
}

function selectVendorCard(email) {
    selectRole('vendor');
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
}

function selectRole(role) {
    state.currentRole = role;
    document.querySelectorAll('.role-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.role === role);
    });
    // Show vendor login cards only when vendor role is selected
    const vendorSection = document.getElementById('vendorQuickLoginSection');
    if (vendorSection) {
        vendorSection.style.display = role === 'vendor' ? 'block' : 'none';
    }
}

function fillCreds(email, password, role) {
    selectRole(role);
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = password;
}

function togglePasswordVisibility() {
    const input = document.getElementById('loginPassword');
    const eye = document.getElementById('pwdEye');
    if (input.type === 'password') {
        input.type = 'text';
        eye.className = 'fa-regular fa-eye-slash';
    } else {
        input.type = 'password';
        eye.className = 'fa-regular fa-eye';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const alertBox = document.getElementById('authAlert');
    const loginBtn = document.getElementById('loginBtn');

    alertBox.className = 'auth-alert hidden';
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role: state.currentRole })
        });

        const data = await response.json();

        if (!data.success) {
            alertBox.textContent = data.message || 'Login failed.';
            alertBox.className = 'auth-alert error';
            return;
        }

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('bf_token', data.token);
        localStorage.setItem('bf_user', JSON.stringify(data.user));

        renderAuthenticatedPortal();
    } catch (err) {
        alertBox.textContent = 'Server connection error. Make sure the Node.js backend is running on port 5000.';
        alertBox.className = 'auth-alert error';
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In to Portal';
    }
}

function handleLogout() {
    localStorage.removeItem('bf_token');
    localStorage.removeItem('bf_user');
    state.token = null;
    state.user = null;
    document.getElementById('portalView').classList.add('hidden');
    document.getElementById('authView').classList.remove('hidden');
}

function checkAuthentication() {
    if (state.token && state.user) {
        renderAuthenticatedPortal();
    } else {
        document.getElementById('authView').classList.remove('hidden');
        document.getElementById('portalView').classList.add('hidden');
    }
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
    };
}

// =====================================================================
// 2. PORTAL WORKSPACE AND TABS
// =====================================================================
function renderAuthenticatedPortal() {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('portalView').classList.remove('hidden');

    const u = state.user;
    document.getElementById('userNameLabel').textContent = u.fullName || u.vendorName || u.email;
    document.getElementById('userRoleBadge').textContent = u.role.toUpperCase();
    document.getElementById('userAvatar').textContent = (u.fullName || u.email).substring(0, 2).toUpperCase();

    const isAdmin = u.role === 'admin';
    document.getElementById('adminMenuSection').classList.toggle('hidden', !isAdmin);

    if (isAdmin) {
        document.getElementById('welcomeMessage').textContent = 'Administrator Control Centre';
    } else {
        document.getElementById('welcomeMessage').textContent = `Welcome back, ${u.fullName || u.vendorName}`;
    }

    loadCommonData();
    switchTab('dashboard');
}

function switchTab(tabId) {
    document.querySelectorAll('.content-tab').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }

    const activeBtn = Array.from(document.querySelectorAll('.nav-item')).find(btn =>
        btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)
    );
    if (activeBtn) activeBtn.classList.add('active');

    if (tabId === 'dashboard') loadDashboardData();
    if (tabId === 'livemap') initOrRefreshLiveMap();
    if (tabId === 'orders') loadOrdersTab();
    if (tabId === 'fruits') loadFruitsTab();
    if (tabId === 'suppliers') loadSuppliersTab();
    if (tabId === 'purchases') loadPurchasesTab();
    if (tabId === 'vendors') loadVendorsTab();
    if (tabId === 'reports') loadReportsTab();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// =====================================================================
// 3. COMMON DATA LOADERS
// =====================================================================
async function loadCommonData() {
    try {
        const [fruitRes, suppRes, vendRes] = await Promise.all([
            fetch(`${API_BASE}/fruits`, { headers: authHeaders() }),
            fetch(`${API_BASE}/suppliers`, { headers: authHeaders() }),
            fetch(`${API_BASE}/vendors`, { headers: authHeaders() })
        ]);

        const fruitData = await fruitRes.json();
        const suppData = await suppRes.json();
        const vendData = await vendRes.json();

        if (fruitData.success) state.fruits = fruitData.data;
        if (suppData.success) state.suppliers = suppData.data;
        if (vendData.success) state.vendors = vendData.data;
    } catch (e) {
        console.error('Failed to load catalog data:', e);
    }
}

// =====================================================================
// 4. DASHBOARD TAB
// =====================================================================
async function loadDashboardData() {
    const statsContainer = document.getElementById('statsGrid');
    statsContainer.innerHTML = '<p class="text-secondary">Loading statistics...</p>';

    try {
        const [salesRes, stockRes] = await Promise.all([
            fetch(`${API_BASE}/sales`, { headers: authHeaders() }),
            fetch(`${API_BASE}/fruits/stock/levels`, { headers: authHeaders() })
        ]);

        const salesData = await salesRes.json();
        const stockData = await stockRes.json();

        const orders = salesData.data || [];
        const stockItems = stockData.data || [];

        const isAdmin = state.user.role === 'admin';

        if (isAdmin) {
            const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
            const totalStockValue = stockItems.reduce((sum, s) => sum + parseFloat(s.estimated_stock_value || 0), 0);
            const pendingOrders = orders.filter(o => o.order_status === 'pending').length;
            const activeTransit = orders.filter(o => o.order_status === 'out_for_delivery').length;

            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon-wrapper green"><i class="fa-solid fa-money-bill-wave"></i></div>
                    <span class="stat-label">Total Sales Volume</span>
                    <span class="stat-value">LSL ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span class="stat-subtext">${orders.length} total recorded transactions</span>
                </div>
                <div class="stat-card">
                    <div class="stat-icon-wrapper blue"><i class="fa-solid fa-boxes-stacked"></i></div>
                    <span class="stat-label">Warehouse Inventory</span>
                    <span class="stat-value">LSL ${totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span class="stat-subtext">Across small, medium and large stock</span>
                </div>
                <div class="stat-card">
                    <div class="stat-icon-wrapper amber"><i class="fa-solid fa-clock"></i></div>
                    <span class="stat-label">Pending Approval</span>
                    <span class="stat-value">${pendingOrders}</span>
                    <span class="stat-subtext">Vendor orders awaiting confirmation</span>
                </div>
                <div class="stat-card">
                    <div class="stat-icon-wrapper cyan"><i class="fa-solid fa-truck-fast"></i></div>
                    <span class="stat-label">Active Transits</span>
                    <span class="stat-value">${activeTransit}</span>
                    <span class="stat-subtext">Orders on transit routes in Maseru</span>
                </div>
            `;
        } else {
            const myOrders = orders;
            const myPending = myOrders.filter(o => o.order_status === 'pending').length;
            const myReady = myOrders.filter(o => o.order_status === 'ready_for_collection' || o.order_status === 'out_for_delivery').length;
            const myBalance = parseFloat(state.user.outstandingBalance || 0);

            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon-wrapper amber"><i class="fa-solid fa-hourglass-half"></i></div>
                    <span class="stat-label">Orders Pending Confirmation</span>
                    <span class="stat-value">${myPending}</span>
                    <span class="stat-subtext">Awaiting admin or supplier review</span>
                </div>
                <div class="stat-card">
                    <div class="stat-icon-wrapper cyan"><i class="fa-solid fa-truck-ramp-box"></i></div>
                    <span class="stat-label">En Route / Ready to Collect</span>
                    <span class="stat-value">${myReady}</span>
                    <span class="stat-subtext">Live traced on delivery map</span>
                </div>
                <div class="stat-card">
                    <div class="stat-icon-wrapper red"><i class="fa-solid fa-receipt"></i></div>
                    <span class="stat-label">Outstanding Credit Balance</span>
                    <span class="stat-value">LSL ${myBalance.toFixed(2)}</span>
                    <span class="stat-subtext">Payable to Batloung Farm</span>
                </div>
                <div class="stat-card">
                    <div class="stat-icon-wrapper green"><i class="fa-solid fa-cart-check"></i></div>
                    <span class="stat-label">My Lifetime Purchases</span>
                    <span class="stat-value">${myOrders.length}</span>
                    <span class="stat-subtext">Completed retail stock orders</span>
                </div>
            `;
        }

        renderRecentOrdersTable(orders.slice(0, 6));
        renderStockSummaryTable(stockItems);
        // Update the profit calculator with live data on load
        recalculateVendorProfit();
    } catch (e) {
        console.error('Error loading dashboard:', e);
    }
}

function renderRecentOrdersTable(orders) {
    const tbody = document.getElementById('recentOrdersTbody');
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No orders recorded yet.</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => `
        <tr>
            <td><strong>#${o.sale_id}</strong></td>
            <td>${o.vendor_name}</td>
            <td>${renderStatusBadge(o.order_status)}</td>
            <td>
                <span class="metric-item dist"><i class="fa-solid fa-route"></i> ${o.distance_km || 0} km</span>
                <span class="metric-item time" style="margin-left: 0.5rem;"><i class="fa-solid fa-stopwatch"></i> ~${o.estimated_time_mins || 0} min</span>
            </td>
            <td><strong>LSL ${parseFloat(o.total_amount).toFixed(2)}</strong></td>
            <td>${renderPaymentBadge(o.payment_status)}</td>
            <td>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <button class="btn btn-sm btn-ghost" onclick="focusOrderOnMap(${o.sale_id})">
                        <i class="fa-solid fa-location-crosshairs"></i> Trace
                    </button>
                    ${(state.user && state.user.role === 'admin' && o.order_status === 'pending') ? `
                        <button class="btn btn-sm btn-primary" onclick="quickConfirmOrder(${o.sale_id})" style="margin-left:0.25rem;">
                            <i class="fa-solid fa-check"></i> Confirm
                        </button>
                    ` : ''}
                    ${(state.user && state.user.role === 'admin') ? `
                        <button class="btn btn-sm btn-batch-photo" onclick="openBatchPhotoModal(${o.sale_id})" title="Attach Real Crate Photo" style="margin-left:0.25rem;">
                            <i class="fa-solid fa-camera"></i> Batch Photo
                        </button>
                    ` : ''}
                    ${(state.user && state.user.role === 'vendor') ? `
                        <button class="btn btn-sm btn-reorder" onclick="oneClickReorder(${o.sale_id}, this)" title="Reorder Same Items" style="margin-left:0.25rem;">
                            <i class="fa-solid fa-rotate-right"></i> Reorder
                        </button>
                        ${o.batch_photo_url ? `
                            <button class="btn btn-sm btn-batch-photo" onclick="viewBatchPhoto('${o.batch_photo_url}', '${(o.batch_inspection_notes || '').replace(/'/g, "\\'")}', ${o.sale_id})" title="View Real Batch Photo" style="margin-left:0.25rem;">
                                <i class="fa-solid fa-eye"></i> View Batch
                            </button>
                        ` : ''}
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function renderStockSummaryTable(stockItems) {
    const tbody = document.getElementById('stockSummaryTbody');
    if (!stockItems || stockItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No stock data available.</td></tr>';
        return;
    }

    const fruitsMap = {};
    stockItems.forEach(item => {
        if (!fruitsMap[item.fruit_name]) {
            fruitsMap[item.fruit_name] = {};
        }
        fruitsMap[item.fruit_name][item.packaging_size] = item.available_quantity;
    });

    tbody.innerHTML = Object.keys(fruitsMap).map(fruitName => `
        <tr>
            <td><strong>${fruitName}</strong></td>
            <td>${fruitsMap[fruitName].small ?? 0} boxes</td>
            <td>${fruitsMap[fruitName].medium ?? 0} boxes</td>
            <td>${fruitsMap[fruitName].large ?? 0} boxes</td>
        </tr>
    `).join('');
}

function renderStatusBadge(status) {
    const map = {
        'pending': '<span class="badge badge-pending"><i class="fa-solid fa-hourglass-start"></i> Pending Review</span>',
        'confirmed': '<span class="badge badge-confirmed"><i class="fa-solid fa-circle-check"></i> Confirmed</span>',
        'processing': '<span class="badge badge-processing"><i class="fa-solid fa-box-archive"></i> Packing</span>',
        'out_for_delivery': '<span class="badge badge-transit"><i class="fa-solid fa-truck"></i> Being Delivered</span>',
        'ready_for_collection': '<span class="badge badge-collection"><i class="fa-solid fa-boxes-packing"></i> Ready For Collection</span>',
        'delivered': '<span class="badge badge-delivered"><i class="fa-solid fa-circle-check"></i> Delivered</span>',
        'cancelled': '<span class="badge badge-cancelled"><i class="fa-solid fa-ban"></i> Cancelled</span>'
    };
    return map[status] || `<span class="badge">${status}</span>`;
}

function renderPaymentBadge(status) {
    const map = {
        'PAID': '<span class="badge badge-paid">Paid</span>',
        'PARTIALLY_PAID': '<span class="badge badge-partial">Partial</span>',
        'UNPAID': '<span class="badge badge-unpaid">Unpaid / Credit</span>'
    };
    return map[status] || `<span class="badge">${status}</span>`;
}

// =====================================================================
// 5. LIVE LOCATION MAP WITH GPS TRACING AND DISTANCE/ETA
// =====================================================================
async function initOrRefreshLiveMap() {
    if (!state.leafletMap) {
        state.leafletMap = L.map('liveOrderMap', {
            center: state.depotCoords,
            zoom: 13,
            zoomControl: true
        });

        // Official OpenStreetMap tiles (100% free, real live map visuals, no API key required)
        const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data (c) OpenStreetMap contributors',
            maxZoom: 19
        });

        osmLayer.addTo(state.leafletMap);

        // Multiple size invalidation passes so the visual map never renders blank
        setTimeout(() => { if (state.leafletMap) state.leafletMap.invalidateSize(); }, 150);
        setTimeout(() => { if (state.leafletMap) state.leafletMap.invalidateSize(); }, 400);
        setTimeout(() => { if (state.leafletMap) state.leafletMap.invalidateSize(); }, 800);
    } else {
        setTimeout(() => { if (state.leafletMap) state.leafletMap.invalidateSize(); }, 150);
        setTimeout(() => { if (state.leafletMap) state.leafletMap.invalidateSize(); }, 400);
    }

    await refreshMapData();
}

async function refreshMapData() {
    if (!state.leafletMap) return;

    state.mapMarkers.forEach(m => m.remove());
    state.mapPolylines.forEach(p => p.remove());
    state.mapMarkers = [];
    state.mapPolylines = [];

    const depotIcon = L.divIcon({
        className: 'depot-marker-wrapper',
        html: '<div class="depot-marker-pin"><i class="fa-solid fa-warehouse"></i></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    const depotMarker = L.marker(state.depotCoords, { icon: depotIcon })
        .addTo(state.leafletMap)
        .bindPopup(`
            <div style="font-family: var(--font-main); padding: 4px;">
                <strong style="color: #059669; font-size: 0.95rem;">Batloung Farm Maseru Depot</strong>
                <p style="margin: 4px 0 0; color: #475569; font-size: 0.8rem;">Central Dispatch Hub - Maseru, Lesotho</p>
            </div>
        `);
    state.mapMarkers.push(depotMarker);

    try {
        const response = await fetch(`${API_BASE}/map/active-orders`, { headers: authHeaders() });
        const data = await response.json();

        if (!data.success) return;

        const orders = data.orders || [];
        const feedContainer = document.getElementById('mapOrdersFeed');

        if (orders.length === 0) {
            feedContainer.innerHTML = '<p class="text-secondary text-center" style="padding: 1.5rem;">No active orders on map.</p>';
            return;
        }

        feedContainer.innerHTML = '';

        orders.forEach(order => {
            if (!order.delivery_lat || !order.delivery_lng) return;

            const orderCoords = [parseFloat(order.delivery_lat), parseFloat(order.delivery_lng)];

            let pinColor = '#f59e0b';
            let pinIcon = 'fa-hourglass-half';
            if (order.order_status === 'out_for_delivery') {
                pinColor = '#06b6d4';
                pinIcon = 'fa-truck';
            } else if (order.order_status === 'ready_for_collection') {
                pinColor = '#8b5cf6';
                pinIcon = 'fa-boxes-packing';
            } else if (order.order_status === 'delivered') {
                pinColor = '#10b981';
                pinIcon = 'fa-check';
            }

            const customMarkerIcon = L.divIcon({
                className: 'order-marker-wrapper',
                html: `<div class="order-marker-pin" style="background: ${pinColor};"><i class="fa-solid ${pinIcon}"></i></div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            });

            const marker = L.marker(orderCoords, { icon: customMarkerIcon }).addTo(state.leafletMap);

            marker.bindPopup(`
                <div style="font-family: var(--font-main); min-width: 200px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <strong style="color: #0f172a; font-size: 0.9rem;">Order #${order.sale_id}</strong>
                        <span style="font-size: 0.75rem; font-weight: 700; color: ${pinColor}; text-transform: uppercase;">${order.order_status.replace(/_/g, ' ')}</span>
                    </div>
                    <p style="margin: 0; font-size: 0.8rem; color: #334155;"><strong>Vendor:</strong> ${order.vendor_name}</p>
                    <p style="margin: 2px 0; font-size: 0.78rem; color: #64748b;">${order.vendor_location}</p>
                    <div style="margin: 6px 0; padding: 6px; background: #f1f5f9; border-radius: 6px; font-size: 0.75rem;">
                        <strong>Distance:</strong> ${order.distance_km} km | <strong>ETA:</strong> ~${order.estimated_time_mins} mins
                    </div>
                    <p style="margin: 0; font-size: 0.82rem; font-weight: 700; color: #059669;">Total: LSL ${parseFloat(order.total_amount).toFixed(2)}</p>
                </div>
            `);

            state.mapMarkers.push(marker);

            const routeLine = L.polyline([state.depotCoords, orderCoords], {
                color: pinColor,
                weight: 3,
                opacity: 0.75,
                dashArray: order.order_status === 'out_for_delivery' ? '6, 8' : null
            }).addTo(state.leafletMap);

            state.mapPolylines.push(routeLine);

            const card = document.createElement('div');
            card.className = 'map-order-card';
            card.id = `feed-order-${order.sale_id}`;
            card.innerHTML = `
                <div class="map-order-top">
                    <span class="order-ref">Order #${order.sale_id}</span>
                    ${renderStatusBadge(order.order_status)}
                </div>
                <div class="order-vendor-name">${order.vendor_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${order.vendor_location}</div>
                <div class="order-metrics-pill">
                    <span class="metric-item dist"><i class="fa-solid fa-route"></i> ${order.distance_km} km</span>
                    <span class="metric-item time"><i class="fa-solid fa-stopwatch"></i> ~${order.estimated_time_mins} min transit</span>
                </div>
            `;
            card.onclick = () => {
                state.leafletMap.flyTo(orderCoords, 15, { duration: 1.2 });
                marker.openPopup();
                document.querySelectorAll('.map-order-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            };
            feedContainer.appendChild(card);
        });
    } catch (e) {
        console.error('Failed to load map data:', e);
    }
}

function focusOrderOnMap(saleId) {
    switchTab('livemap');
    setTimeout(() => {
        const targetCard = document.getElementById(`feed-order-${saleId}`);
        if (targetCard) targetCard.click();
    }, 400);
}

// =====================================================================
// 6. ORDER PLACEMENT MODAL
// =====================================================================
function openNewOrderModal() {
    const modal = document.getElementById('newOrderModal');
    modal.classList.remove('hidden');

    const isAdmin = state.user.role === 'admin';
    const vendorGroup = document.getElementById('vendorSelectGroup');
    const vendorSelect = document.getElementById('orderVendorSelect');

    vendorGroup.classList.toggle('hidden', !isAdmin);

    if (isAdmin) {
        vendorSelect.innerHTML = state.vendors.map(v => `
            <option value="${v.vendor_id}" data-lat="${v.latitude}" data-lng="${v.longitude}">
                ${v.vendor_name} (${v.location})
            </option>
        `).join('');
    }

    useDefaultVendorLocation();
    document.getElementById('orderItemsTbody').innerHTML = '';
    addOrderItemRow();
    recalculateOrderTotal();
}

function addOrderItemRow() {
    const tbody = document.getElementById('orderItemsTbody');
    const row = document.createElement('tr');

    const fruitOptions = state.fruits.map(f => `<option value="${f.fruit_id}">${f.fruit_name}</option>`).join('');

    row.innerHTML = `
        <td>
            <select class="form-control item-fruit" onchange="onFruitOrPackagingChange(this)">
                ${fruitOptions}
            </select>
        </td>
        <td>
            <select class="form-control item-size" onchange="onFruitOrPackagingChange(this)">
                <option value="small">Small Box</option>
                <option value="medium" selected>Medium Box</option>
                <option value="large">Large Box</option>
            </select>
        </td>
        <td class="item-price-cell">LSL 0.00</td>
        <td class="item-stock-cell">0 boxes</td>
        <td>
            <input type="number" min="1" value="1" class="form-control item-qty" oninput="onQuantityChange(this)">
        </td>
        <td class="item-subtotal-cell"><strong>LSL 0.00</strong></td>
        <td>
            <button type="button" class="btn btn-sm btn-ghost" onclick="removeOrderItemRow(this)">
                <i class="fa-solid fa-trash-can" style="color: var(--accent-red);"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);
    onFruitOrPackagingChange(row.querySelector('.item-fruit'));
}

function removeOrderItemRow(btn) {
    const tbody = document.getElementById('orderItemsTbody');
    if (tbody.children.length > 1) {
        btn.closest('tr').remove();
        recalculateOrderTotal();
    }
}

function onFruitOrPackagingChange(elem) {
    const row = elem.closest('tr');
    const fruitId = parseInt(row.querySelector('.item-fruit').value, 10);
    const size = row.querySelector('.item-size').value;

    const fruit = state.fruits.find(f => f.fruit_id === fruitId);
    if (!fruit) return;

    const pack = fruit.packaging.find(p => p.packaging_size === size) || { selling_price: 65, available_quantity: 0 };

    row.querySelector('.item-price-cell').textContent = `LSL ${pack.selling_price.toFixed(2)}`;
    row.querySelector('.item-price-cell').dataset.price = pack.selling_price;

    const stockCell = row.querySelector('.item-stock-cell');
    stockCell.textContent = `${pack.available_quantity} available`;
    stockCell.dataset.available = pack.available_quantity;

    if (pack.available_quantity <= 0) {
        stockCell.style.color = 'var(--accent-red)';
    } else {
        stockCell.style.color = 'var(--text-secondary)';
    }

    onQuantityChange(row.querySelector('.item-qty'));
}

function onQuantityChange(input) {
    const row = input.closest('tr');
    const qty = parseInt(input.value, 10) || 0;
    const price = parseFloat(row.querySelector('.item-price-cell').dataset.price || 0);
    const available = parseInt(row.querySelector('.item-stock-cell').dataset.available || 0, 10);

    if (qty > available) {
        input.style.borderColor = 'var(--accent-red)';
        row.querySelector('.item-stock-cell').style.color = 'var(--accent-red)';
    } else {
        input.style.borderColor = 'var(--border-color)';
        row.querySelector('.item-stock-cell').style.color = 'var(--text-secondary)';
    }

    const subtotal = qty * price;
    row.querySelector('.item-subtotal-cell').innerHTML = `<strong>LSL ${subtotal.toFixed(2)}</strong>`;
    recalculateOrderTotal();
}

function recalculateOrderTotal() {
    let total = 0;
    document.querySelectorAll('#orderItemsTbody tr').forEach(row => {
        const qty = parseInt(row.querySelector('.item-qty')?.value || 0, 10);
        const price = parseFloat(row.querySelector('.item-price-cell')?.dataset.price || 0);
        total += qty * price;
    });

    document.getElementById('orderTotalDisplay').textContent = `LSL ${total.toFixed(2)}`;
}

function onVendorSelectedForOrder() {
    const sel = document.getElementById('orderVendorSelect');
    const opt = sel.options[sel.selectedIndex];
    if (opt) {
        document.getElementById('orderLat').value = opt.dataset.lat || -29.3138;
        document.getElementById('orderLng').value = opt.dataset.lng || 27.4842;
    }
}

function useDefaultVendorLocation() {
    if (state.user.role === 'vendor') {
        document.getElementById('orderLat').value = state.user.latitude || -29.3138;
        document.getElementById('orderLng').value = state.user.longitude || 27.4842;
    } else {
        onVendorSelectedForOrder();
    }
}

function toggleDeliveryInputs() {
    const type = document.getElementById('orderDeliveryType').value;
    const picker = document.getElementById('locationPickerGroup');
    picker.style.display = type === 'delivery' ? 'block' : 'none';
}

async function submitNewOrder(e) {
    e.preventDefault();
    const alertBox = document.getElementById('orderErrorAlert');
    const submitBtn = document.getElementById('submitOrderBtn');

    alertBox.className = 'auth-alert hidden';

    const items = [];
    let hasStockShortage = false;

    document.querySelectorAll('#orderItemsTbody tr').forEach(row => {
        const fruit_id = parseInt(row.querySelector('.item-fruit').value, 10);
        const packaging_size = row.querySelector('.item-size').value;
        const quantity = parseInt(row.querySelector('.item-qty').value, 10);
        const available = parseInt(row.querySelector('.item-stock-cell').dataset.available || 0, 10);

        if (quantity > available) {
            hasStockShortage = true;
        }

        if (quantity > 0) {
            items.push({ fruit_id, packaging_size, quantity });
        }
    });

    if (items.length === 0) {
        alertBox.textContent = 'Please add at least one valid fruit item to the order.';
        alertBox.className = 'auth-alert error';
        return;
    }

    if (hasStockShortage) {
        alertBox.innerHTML = '<strong>Sale Rejected:</strong> Requested quantity exceeds available stock. In accordance with distribution rules, orders cannot be placed with insufficient stock.';
        alertBox.className = 'auth-alert error';
        return;
    }

    const payload = {
        vendor_id: state.user.role === 'admin' ? parseInt(document.getElementById('orderVendorSelect').value, 10) : state.user.vendorId,
        items,
        delivery_type: document.getElementById('orderDeliveryType').value,
        payment_method: document.getElementById('orderPaymentMethod').value,
        delivery_lat: parseFloat(document.getElementById('orderLat').value),
        delivery_lng: parseFloat(document.getElementById('orderLng').value),
        notes: document.getElementById('orderNotes').value.trim()
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const response = await fetch(`${API_BASE}/sales`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data.success) {
            alertBox.textContent = data.message || 'Order placement failed.';
            alertBox.className = 'auth-alert error';
            return;
        }

        closeModal('newOrderModal');
        await loadCommonData();
        loadDashboardData();
        switchTab('orders');
    } catch (err) {
        alertBox.textContent = 'Server communication error while placing order.';
        alertBox.className = 'auth-alert error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Order';
    }
}

// =====================================================================
// 7. ORDERS VIEW AND STATUS MANAGEMENT
// =====================================================================
async function loadOrdersTab() {
    const tbody = document.getElementById('allOrdersTbody');
    tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">Loading orders...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/sales`, { headers: authHeaders() });
        const data = await response.json();

        if (!data.success || !data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">No orders found.</td></tr>';
            return;
        }

        const isAdmin = state.user.role === 'admin';

        tbody.innerHTML = data.data.map(o => `
            <tr>
                <td><strong>#${o.sale_id}</strong></td>
                <td>${new Date(o.sale_date).toLocaleDateString()}</td>
                <td>${o.vendor_name}</td>
                <td style="max-width:200px;font-size:0.82rem;">
                    ${o.items_summary || (o.total_boxes_ordered + ' boxes, ' + o.total_items + ' lines')}
                </td>
                <td>${o.delivery_type === 'delivery' ? 'Delivery' : 'Collection'}</td>
                <td><strong>LSL ${parseFloat(o.total_amount).toFixed(2)}</strong></td>
                <td>
                    <span style="font-size:0.8rem;font-weight:600;text-transform:capitalize;">
                        ${o.payment_method || 'Cash'}
                    </span>
                </td>
                <td>${renderPaymentBadge(o.payment_status)}</td>
                <td>${renderStatusBadge(o.order_status)}</td>
                <td>
                    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                        <button class="btn btn-sm btn-ghost" onclick="focusOrderOnMap(${o.sale_id})" title="Track on Map">
                            <i class="fa-solid fa-location-dot"></i>
                        </button>
                        ${isAdmin && o.order_status === 'pending' ? `
                            <button class="btn btn-sm btn-primary" onclick="quickConfirmOrder(${o.sale_id})" title="Confirm Order">
                                <i class="fa-solid fa-check"></i> Confirm
                            </button>
                        ` : ''}
                        ${isAdmin ? `
                            <button class="btn btn-sm btn-ghost" onclick="openStatusModal(${o.sale_id}, '${o.order_status}')" title="Change Status">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn btn-sm btn-batch-photo" onclick="openBatchPhotoModal(${o.sale_id})" title="Attach Real Crate Photo">
                                <i class="fa-solid fa-camera"></i>
                            </button>
                            ${o.payment_status !== 'PAID' ? `
                                <button class="btn btn-sm btn-ghost" onclick="openPaymentModal(${o.sale_id}, '${o.vendor_name}', ${o.balance_amount})" title="Record Payment">
                                    <i class="fa-solid fa-money-bill"></i>
                                </button>
                            ` : ''}
                        ` : ''}
                        ${!isAdmin ? `
                            <button class="btn btn-sm btn-reorder" onclick="oneClickReorder(${o.sale_id}, this)" title="One-Click Reorder">
                                <i class="fa-solid fa-rotate-right"></i> Reorder
                            </button>
                            ${o.batch_photo_url ? `
                                <button class="btn btn-sm btn-batch-photo" onclick="viewBatchPhoto('${o.batch_photo_url}', '${(o.batch_inspection_notes || '').replace(/'/g, "\\'")}', ${o.sale_id})" title="View Crate Photo">
                                    <i class="fa-solid fa-eye"></i> View Batch
                                </button>
                            ` : ''}
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load orders tab:', e);
    }
}

async function quickConfirmOrder(orderId) {
    try {
        const response = await fetch(`${API_BASE}/sales/${orderId}/status`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ order_status: 'confirmed' })
        });
        const data = await response.json();
        if (data.success) {
            await loadOrdersTab();
            await loadCommonData();
            if (state.leafletMap) refreshMapData();
        } else {
            alert(data.message || 'Failed to confirm order.');
        }
    } catch (e) {
        alert('Server error confirming order.');
    }
}

function openStatusModal(orderId, currentStatus) {
    document.getElementById('statusOrderId').value = orderId;
    document.getElementById('orderStatusSelect').value = currentStatus;
    document.getElementById('statusModal').classList.remove('hidden');
}

async function submitOrderStatusUpdate(e) {
    e.preventDefault();
    const orderId = document.getElementById('statusOrderId').value;
    const status = document.getElementById('orderStatusSelect').value;

    try {
        const response = await fetch(`${API_BASE}/sales/${orderId}/status`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ order_status: status })
        });

        const data = await response.json();
        if (data.success) {
            closeModal('statusModal');
            loadOrdersTab();
            if (state.leafletMap) refreshMapData();
        } else {
            alert(data.message || 'Failed to update status.');
        }
    } catch (e) {
        alert('Server connection error.');
    }
}

function openPaymentModal(orderId, vendorName, balance) {
    document.getElementById('paymentOrderId').value = orderId;
    document.getElementById('paymentOrderSummary').textContent = `Order #${orderId} - Vendor: ${vendorName} | Outstanding: LSL ${parseFloat(balance).toFixed(2)}`;
    document.getElementById('paymentAmountInput').value = balance;
    document.getElementById('paymentModal').classList.remove('hidden');
}

async function submitPayment(e) {
    e.preventDefault();
    const orderId = document.getElementById('paymentOrderId').value;
    const amount = document.getElementById('paymentAmountInput').value;
    const method = document.getElementById('paymentMethodSelect').value;

    try {
        const response = await fetch(`${API_BASE}/sales/${orderId}/payment`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ payment_amount: amount, payment_method: method })
        });

        const data = await response.json();
        if (data.success) {
            closeModal('paymentModal');
            loadOrdersTab();
        } else {
            alert(data.message || 'Failed to post payment.');
        }
    } catch (e) {
        alert('Payment recording error.');
    }
}

// =====================================================================
// 8. FRUITS AND STOCK MANAGEMENT (Admin)
// =====================================================================
async function loadFruitsTab() {
    const tbody = document.getElementById('fruitsStockTbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading stock...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/fruits/stock/levels`, { headers: authHeaders() });
        const data = await response.json();

        if (!data.success || !data.data) return;

        tbody.innerHTML = data.data.map(item => `
            <tr>
                <td>${item.fruit_id}</td>
                <td><strong>${item.fruit_name}</strong></td>
                <td><span style="text-transform: capitalize;">${item.packaging_size} Box</span></td>
                <td>LSL ${parseFloat(item.cost_price).toFixed(2)}</td>
                <td><strong>LSL ${parseFloat(item.selling_price).toFixed(2)}</strong></td>
                <td><strong>${item.available_quantity}</strong></td>
                <td>
                    ${item.is_low_stock 
                        ? '<span class="badge badge-unpaid"><i class="fa-solid fa-triangle-exclamation"></i> Low Stock</span>' 
                        : '<span class="badge badge-paid"><i class="fa-solid fa-check"></i> Optimal</span>'}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load fruits tab:', e);
    }
}

// =====================================================================
// 9. SUPPLIERS MANAGEMENT (Admin)
// =====================================================================
async function loadSuppliersTab() {
    const tbody = document.getElementById('suppliersTbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading suppliers...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/suppliers`, { headers: authHeaders() });
        const data = await response.json();

        if (!data.success || !data.data) return;

        tbody.innerHTML = data.data.map(s => `
            <tr>
                <td>${s.supplier_id}</td>
                <td><strong>${s.business_name}</strong></td>
                <td>${s.contact_person}</td>
                <td>${s.phone}</td>
                <td><span class="badge badge-confirmed">${s.province}</span></td>
                <td>${s.address}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load suppliers:', e);
    }
}

// =====================================================================
// 10. STOCK PURCHASES TAB (Admin)
// =====================================================================
async function loadPurchasesTab() {
    const tbody = document.getElementById('purchasesTbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading purchases...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/purchases`, { headers: authHeaders() });
        const data = await response.json();

        if (!data.success || !data.data) return;

        tbody.innerHTML = data.data.map(p => `
            <tr>
                <td><strong>#${p.purchase_id}</strong></td>
                <td>${new Date(p.purchase_date).toLocaleDateString()}</td>
                <td><strong>${p.supplier_name}</strong></td>
                <td>${p.province}</td>
                <td>${p.total_boxes_received} boxes</td>
                <td><strong>LSL ${parseFloat(p.total_amount).toFixed(2)}</strong></td>
                <td>${p.notes || '-'}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load purchases:', e);
    }
}

function openNewPurchaseModal() {
    const select = document.getElementById('purchaseSupplierSelect');
    select.innerHTML = state.suppliers.map(s => `
        <option value="${s.supplier_id}">${s.business_name} (${s.province})</option>
    `).join('');

    document.getElementById('purchaseItemsTbody').innerHTML = '';
    addPurchaseItemRow();
    document.getElementById('newPurchaseModal').classList.remove('hidden');
}

function addPurchaseItemRow() {
    const tbody = document.getElementById('purchaseItemsTbody');
    const row = document.createElement('tr');

    const fruitOptions = state.fruits.map(f => `<option value="${f.fruit_id}">${f.fruit_name}</option>`).join('');

    row.innerHTML = `
        <td>
            <select class="form-control p-item-fruit">
                ${fruitOptions}
            </select>
        </td>
        <td>
            <select class="form-control p-item-size">
                <option value="small">Small Box</option>
                <option value="medium" selected>Medium Box</option>
                <option value="large">Large Box</option>
            </select>
        </td>
        <td>
            <input type="number" step="0.01" value="70.00" class="form-control p-item-cost" oninput="recalculatePurchaseTotal()">
        </td>
        <td>
            <input type="number" min="1" value="20" class="form-control p-item-qty" oninput="recalculatePurchaseTotal()">
        </td>
        <td class="p-item-subtotal"><strong>LSL 1400.00</strong></td>
        <td>
            <button type="button" class="btn btn-sm btn-ghost" onclick="this.closest('tr').remove(); recalculatePurchaseTotal();">
                <i class="fa-solid fa-trash-can" style="color: var(--accent-red);"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);
    recalculatePurchaseTotal();
}

function recalculatePurchaseTotal() {
    let total = 0;
    document.querySelectorAll('#purchaseItemsTbody tr').forEach(row => {
        const cost = parseFloat(row.querySelector('.p-item-cost')?.value || 0);
        const qty = parseInt(row.querySelector('.p-item-qty')?.value || 0, 10);
        const subtotal = cost * qty;
        row.querySelector('.p-item-subtotal').innerHTML = `<strong>LSL ${subtotal.toFixed(2)}</strong>`;
        total += subtotal;
    });

    document.getElementById('purchaseTotalDisplay').textContent = `LSL ${total.toFixed(2)}`;
}

async function submitNewPurchase(e) {
    e.preventDefault();

    const items = [];
    document.querySelectorAll('#purchaseItemsTbody tr').forEach(row => {
        items.push({
            fruit_id: parseInt(row.querySelector('.p-item-fruit').value, 10),
            packaging_size: row.querySelector('.p-item-size').value,
            unit_cost: parseFloat(row.querySelector('.p-item-cost').value),
            quantity: parseInt(row.querySelector('.p-item-qty').value, 10)
        });
    });

    if (items.length === 0) return;

    try {
        const response = await fetch(`${API_BASE}/purchases`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                supplier_id: parseInt(document.getElementById('purchaseSupplierSelect').value, 10),
                items,
                notes: document.getElementById('purchaseNotes').value.trim()
            })
        });

        const data = await response.json();
        if (data.success) {
            closeModal('newPurchaseModal');
            loadPurchasesTab();
            loadCommonData();
        } else {
            alert(data.message || 'Failed to record purchase.');
        }
    } catch (e) {
        alert('Server error recording purchase.');
    }
}

// =====================================================================
// 11. VENDORS MANAGEMENT (Admin)
// =====================================================================
async function loadVendorsTab() {
    const tbody = document.getElementById('vendorsTbody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Loading vendors...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/vendors`, { headers: authHeaders() });
        const data = await response.json();

        if (!data.success || !data.data || data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No vendors registered yet.</td></tr>';
            return;
        }

        tbody.innerHTML = data.data.map(v => `
            <tr>
                <td>${v.vendor_id}</td>
                <td><strong>${v.vendor_name}</strong><br><small style="color:var(--text-muted,#64748b);">${v.email}</small></td>
                <td>${v.phone_number}</td>
                <td>${v.location}</td>
                <td>${new Date(v.registration_date).toLocaleDateString()}</td>
                <td style="color: ${parseFloat(v.outstanding_balance) > 0 ? 'var(--accent-red,#f87171)' : 'var(--brand-primary)'};">
                    <strong>LSL ${parseFloat(v.outstanding_balance).toFixed(2)}</strong>
                </td>
                <td>${v.total_orders_placed || 0} orders</td>
                <td>
                    <button class="btn btn-sm" style="background:rgba(239,68,68,0.15);border:1px solid #ef4444;color:#ef4444;border-radius:6px;padding:0.3rem 0.6rem;cursor:pointer;" onclick="deleteVendor(${v.vendor_id}, '${v.vendor_name}')" title="Remove this vendor">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Failed to load vendors:', e);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Failed to load vendors.</td></tr>';
    }
}

async function deleteVendor(vendorId, vendorName) {
    if (!confirm(`Remove vendor "${vendorName}" and all their order records? This cannot be undone.`)) return;

    try {
        const res = await fetch(`${API_BASE}/vendors/${vendorId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.success) {
            alert(`Vendor "${vendorName}" has been removed.`);
            await loadVendorsTab();
            // Also refresh vendor login cards on login page
            await loadVendorLoginCards();
        } else {
            alert(data.message || 'Failed to delete vendor.');
        }
    } catch (e) {
        console.error('Delete vendor error:', e);
        alert('Server connection error. Please try again.');
    }
}

// =====================================================================
// 12. REPORTS TAB (Sales and Business Analytics)
// =====================================================================

// Auto-detect GPS coordinates from location name using OpenStreetMap Nominatim
async function autoGeocodeLocation() {
    const locationInput = document.getElementById('vendorLocation');
    const latInput = document.getElementById('vendorLat');
    const lngInput = document.getElementById('vendorLng');
    const statusEl = document.getElementById('geocodeStatus');
    const btn = document.getElementById('geocodeBtn');

    if (!locationInput || !locationInput.value.trim()) {
        alert('Please type a location name first, then click Find GPS.');
        return;
    }

    const query = locationInput.value.trim() + ', Maseru, Lesotho';

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Looking up GPS coordinates...'; }

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const results = await res.json();

        if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lng = parseFloat(results[0].lon);
            if (latInput) latInput.value = lat.toFixed(6);
            if (lngInput) lngInput.value = lng.toFixed(6);
            if (statusEl) statusEl.textContent = 'GPS found: ' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ' (from OpenStreetMap)';
        } else {
            // Fallback to Maseru centre if location not found
            if (latInput) latInput.value = '-29.3138';
            if (lngInput) lngInput.value = '27.4842';
            if (statusEl) statusEl.textContent = 'Location not found on the map. Using Maseru centre coordinates as a default.';
        }
    } catch (err) {
        if (statusEl) statusEl.textContent = 'Could not look up GPS. Please type the coordinates manually.';
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-location-dot"></i> Find GPS'; }
    }
}

function clearGeoResult() {
    const statusEl = document.getElementById('geocodeStatus');
    if (statusEl) statusEl.style.display = 'none';
}

async function loadReportsTab() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    document.getElementById('reportStartDate').value = firstDay;
    document.getElementById('reportEndDate').value = today;

    try {
        const r1 = await fetch(`${API_BASE}/reports/top-fruits`, { headers: authHeaders() });
        const d1 = await r1.json();
        const tbody1 = document.getElementById('reportTopFruitsTbody');

        if (d1.success && d1.data) {
            tbody1.innerHTML = d1.data.map((f, i) => `
                <tr>
                    <td><strong>#${i + 1}</strong></td>
                    <td><strong>${f.fruit_name}</strong></td>
                    <td>${f.total_boxes_sold} boxes</td>
                    <td><strong>LSL ${parseFloat(f.total_sales_revenue).toFixed(2)}</strong></td>
                </tr>
            `).join('');
        }
    } catch (e) {}

    try {
        const r3 = await fetch(`${API_BASE}/reports/top-vendor`, { headers: authHeaders() });
        const d3 = await r3.json();
        const container3 = document.getElementById('reportTopVendorCard');

        if (d3.success && d3.top_vendor) {
            const v = d3.top_vendor;
            container3.innerHTML = `
                <div style="text-align: center; padding: 1rem;">
                    <div style="font-size: 2rem; color: var(--accent-amber); margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-crown"></i>
                    </div>
                    <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">${v.vendor_name}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">${v.location} (${v.phone_number})</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                        <div>
                            <span class="stat-label">Total Boxes Ordered</span>
                            <strong style="font-size: 1.3rem; display: block; color: var(--brand-primary);">${v.total_boxes_purchased} boxes</strong>
                        </div>
                        <div>
                            <span class="stat-label">Total Turnover</span>
                            <strong style="font-size: 1.3rem; display: block; color: var(--text-primary);">LSL ${parseFloat(v.total_amount_spent).toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (e) {}

    loadRevenueReport();
}

async function loadRevenueReport() {
    const sDate = document.getElementById('reportStartDate').value;
    const eDate = document.getElementById('reportEndDate').value;

    try {
        const res = await fetch(`${API_BASE}/reports/sales-revenue?start_date=${sDate}&end_date=${eDate}`, { headers: authHeaders() });
        const data = await res.json();
        const container = document.getElementById('revenueSummaryContainer');

        if (data.success && data.summary) {
            const s = data.summary;
            container.innerHTML = `
                <div class="rev-kpi-block">
                    <span class="rev-kpi-label">Total Sales Revenue</span>
                    <div class="rev-kpi-val">LSL ${parseFloat(s.total_revenue_generated || 0).toFixed(2)}</div>
                </div>
                <div class="rev-kpi-block">
                    <span class="rev-kpi-label">Cash Collected</span>
                    <div class="rev-kpi-val" style="color: #34d399;">LSL ${parseFloat(s.total_cash_collected || 0).toFixed(2)}</div>
                </div>
                <div class="rev-kpi-block">
                    <span class="rev-kpi-label">Uncollected Credit</span>
                    <div class="rev-kpi-val" style="color: #f87171;">LSL ${parseFloat(s.total_uncollected_credit || 0).toFixed(2)}</div>
                </div>
                <div class="rev-kpi-block">
                    <span class="rev-kpi-label">Completed Orders</span>
                    <div class="rev-kpi-val" style="color: var(--accent-blue);">${s.total_sales_count || 0}</div>
                </div>
            `;
        }
    } catch (e) {}
}

// =====================================================================
// 13. MODAL CONTROLS AND DETAILS MANAGEMENT
// =====================================================================
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

// --- ADD FRUIT MODAL ---
function openNewFruitModal() {
    const form = document.getElementById('newFruitForm');
    if (form) form.reset();
    const alertBox = document.getElementById('newFruitAlert');
    if (alertBox) alertBox.classList.add('hidden');
    openModal('newFruitModal');
}

async function submitNewFruit(event) {
    event.preventDefault();
    const alertBox = document.getElementById('newFruitAlert');
    alertBox.classList.add('hidden');

    const fruit_name = document.getElementById('newFruitName').value.trim();
    const description = document.getElementById('newFruitDesc').value.trim();
    const status = document.getElementById('newFruitStatus').value;

    const pricing = {
        small: {
            cost: parseFloat(document.getElementById('priceSmallCost').value) || 0,
            sell: parseFloat(document.getElementById('priceSmallSell').value) || 0
        },
        medium: {
            cost: parseFloat(document.getElementById('priceMedCost').value) || 0,
            sell: parseFloat(document.getElementById('priceMedSell').value) || 0
        },
        large: {
            cost: parseFloat(document.getElementById('priceLargeCost').value) || 0,
            sell: parseFloat(document.getElementById('priceLargeSell').value) || 0
        }
    };

    const saveBtn = document.getElementById('saveFruitBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const response = await fetch(`${API_BASE}/fruits`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ fruit_name, description, status, pricing })
        });
        const data = await response.json();

        if (data.success) {
            closeModal('newFruitModal');
            await loadFruitsTab();
            await loadCommonData();
        } else {
            alertBox.textContent = data.message || 'Failed to save fruit.';
            alertBox.classList.remove('hidden');
        }
    } catch (err) {
        alertBox.textContent = 'Server connection error.';
        alertBox.classList.remove('hidden');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm and Save';
        }
    }
}

// --- REGISTER SUPPLIER MODAL ---
function openNewSupplierModal() {
    const form = document.getElementById('newSupplierForm');
    if (form) form.reset();
    const alertBox = document.getElementById('newSupplierAlert');
    if (alertBox) alertBox.classList.add('hidden');
    openModal('newSupplierModal');
}

async function submitNewSupplier(event) {
    event.preventDefault();
    const alertBox = document.getElementById('newSupplierAlert');
    alertBox.classList.add('hidden');

    const business_name = document.getElementById('supplierBusinessName').value.trim();
    const contact_person = document.getElementById('supplierContact').value.trim();
    const phone = document.getElementById('supplierPhone').value.trim();
    const province = document.getElementById('supplierProvince').value;
    const address = document.getElementById('supplierAddress').value.trim();

    const saveBtn = document.getElementById('saveSupplierBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const response = await fetch(`${API_BASE}/suppliers`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ business_name, contact_person, phone, province, address })
        });
        const data = await response.json();

        if (data.success) {
            closeModal('newSupplierModal');
            await loadSuppliersTab();
            await loadCommonData();
        } else {
            alertBox.textContent = data.message || 'Failed to register supplier.';
            alertBox.classList.remove('hidden');
        }
    } catch (err) {
        alertBox.textContent = 'Server connection error.';
        alertBox.classList.remove('hidden');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm and Save';
        }
    }
}

// --- REGISTER VENDOR MODAL ---
function openNewVendorModal() {
    const form = document.getElementById('newVendorForm');
    if (form) form.reset();
    const alertBox = document.getElementById('newVendorAlert');
    if (alertBox) alertBox.classList.add('hidden');
    openModal('newVendorModal');
}

async function submitNewVendor(event) {
    event.preventDefault();
    const alertBox = document.getElementById('newVendorAlert');
    alertBox.classList.add('hidden');

    const vendor_name = document.getElementById('vendorBusinessName').value.trim();
    const email = document.getElementById('vendorEmail').value.trim();
    const password = document.getElementById('vendorPassword').value;
    const phone_number = document.getElementById('vendorPhone').value.trim();
    const location = document.getElementById('vendorLocation').value.trim();
    const latitude = parseFloat(document.getElementById('vendorLat').value) || -29.3138;
    const longitude = parseFloat(document.getElementById('vendorLng').value) || 27.4842;

    const saveBtn = document.getElementById('saveVendorBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const response = await fetch(`${API_BASE}/vendors`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ vendor_name, email, password, phone_number, location, latitude, longitude })
        });
        const data = await response.json();

        if (data.success) {
            closeModal('newVendorModal');
            await loadVendorsTab();
            await loadCommonData();
            // Refresh vendor login cards so the new vendor appears on the login page
            await loadVendorLoginCards();
        } else {
            alertBox.textContent = data.message || 'Failed to register vendor.';
            alertBox.classList.remove('hidden');
        }
    } catch (err) {
        alertBox.textContent = 'Server connection error.';
        alertBox.classList.remove('hidden');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm and Save';
        }
    }
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.add('hidden');
    }
});

// =====================================================================
// 14. VENDOR PROFIT CALCULATOR
// =====================================================================
let calcDailyBoxes = 1;

function recalculateVendorProfit() {
    const sel = document.getElementById('calcFruitSelect');
    if (!sel) return;

    const opt = sel.options[sel.selectedIndex];
    const boxCost   = parseFloat(opt.dataset.cost) || 75;
    const boxKg     = parseFloat(opt.dataset.kg)   || 10;
    const fruitName = opt.dataset.fruit || 'Fruit';

    const sellPerKg = parseFloat(document.getElementById('calcSellPrice').value) || 25;
    const costPerKg = boxCost / boxKg;
    const profitPerKg = sellPerKg - costPerKg;
    const boxRevenue  = sellPerKg * boxKg;
    const boxProfit   = profitPerKg * boxKg;
    const margin      = ((profitPerKg / costPerKg) * 100);
    const dailyEarnings = boxProfit * calcDailyBoxes;

    // Update displays
    const profitKgEl = document.getElementById('calcProfitPerKgDisplay');
    if (profitKgEl) profitKgEl.textContent = `+R${profitPerKg.toFixed(2)} / kg`;

    const summaryEl = document.getElementById('calcSummaryBanner');
    if (summaryEl) summaryEl.textContent = `You bought at R${costPerKg.toFixed(2)}/kg. Sell at R${sellPerKg.toFixed(2)}/kg - You make R${profitPerKg.toFixed(2)} profit per kg.`;

    const wholesaleEl = document.getElementById('calcWholesaleCostDisplay');
    if (wholesaleEl) wholesaleEl.textContent = `R${boxCost.toFixed(2)} per box (R${costPerKg.toFixed(2)} / kg)`;

    const revenueEl = document.getElementById('calcRevenueDisplay');
    if (revenueEl) revenueEl.textContent = `R${boxRevenue.toFixed(2)} per box`;

    const boxProfitEl = document.getElementById('calcBoxProfitDisplay');
    if (boxProfitEl) boxProfitEl.textContent = `+R${boxProfit.toFixed(2)} profit / box`;

    const marginEl = document.getElementById('calcMarginDisplay');
    if (marginEl) marginEl.textContent = `+${margin.toFixed(0)}% markup`;

    const dailyEl = document.getElementById('calcDailyEarningsDisplay');
    if (dailyEl) dailyEl.textContent = `Sell ${calcDailyBoxes} box${calcDailyBoxes > 1 ? 'es' : ''} - Pocket +R${dailyEarnings.toFixed(2)} profit!`;
}

function setCalcSellingPrice(price) {
    const inp = document.getElementById('calcSellPrice');
    if (inp) inp.value = price;
    document.querySelectorAll('.pocket-pill').forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes('setCalcSellingPrice')) {
            btn.classList.toggle('active', btn.textContent.includes(`R${price}`));
        }
    });
    recalculateVendorProfit();
}

function setDailyBoxes(count, el) {
    calcDailyBoxes = count;
    document.querySelectorAll('[data-boxes]').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    recalculateVendorProfit();
}

// =====================================================================
// 15. ONE-CLICK REORDER (Vendor)
// =====================================================================
async function oneClickReorder(saleId, btnEl) {
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reordering...';
    }

    try {
        // Fetch the existing order details
        const res = await fetch(`${API_BASE}/sales/${saleId}`, { headers: authHeaders() });
        const data = await res.json();

        // getSaleById returns { success, sale, data, items } -- handle both shapes
        if (!data.success) {
            alert('Could not load past order details. Please try again.');
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Reorder';
            }
            return;
        }

        const old  = data.sale || data.data || {};
        const items = data.items || (data.data && data.data.items) || [];

        if (!items || items.length === 0) {
            alert('The past order has no items to reorder. Please place a new order manually.');
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Reorder';
            }
            return;
        }

        const payload = {
            vendor_id:      old.vendor_id,
            items: items.map(i => ({
                fruit_id:       i.fruit_id,
                packaging_size: (i.packaging_size || 'medium').toLowerCase(),
                quantity:       parseInt(i.quantity || i.quantity_boxes || 1, 10)
            })),
            payment_method: old.payment_method || 'Cash',
            payment_status: 'UNPAID',
            amount_paid:    0,
            delivery_type:  old.delivery_type  || 'delivery',
            delivery_lat:   old.delivery_lat   || -29.3138,
            delivery_lng:   old.delivery_lng   || 27.4842,
            notes: 'One-click reorder from Order #' + saleId
        };

        const createRes = await fetch(`${API_BASE}/sales`, {
            method:  'POST',
            headers: authHeaders(),
            body:    JSON.stringify(payload)
        });
        const createData = await createRes.json();

        if (createData.success) {
            const newId = createData.sale_id || (createData.data && createData.data.sale_id) || '';
            alert('Reorder placed successfully. New Order #' + newId + ' has been created and is pending confirmation.');
            await loadOrdersTab();
            await loadDashboardData();
        } else {
            alert(createData.message || 'Reorder failed. Please check that the items are still in stock.');
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Reorder';
            }
        }
    } catch (err) {
        console.error('Reorder error:', err);
        alert('Server connection error. Make sure the backend is running on port 5000.');
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Reorder';
        }
    }
}

// =====================================================================
// 16. REAL BATCH PHOTO - ADMIN ATTACH / VENDOR VIEW
// =====================================================================
function openBatchPhotoModal(saleId) {
    document.getElementById('batchPhotoSaleId').value = saleId;
    document.getElementById('batchPhotoUrl').value = '';
    document.getElementById('batchInspectionNotes').value = '';
    const preview = document.getElementById('batchPhotoPreviewContainer');
    if (preview) preview.style.display = 'none';
    document.querySelectorAll('.batch-preset-item').forEach(el => el.classList.remove('selected'));
    const alertBox = document.getElementById('batchPhotoAlert');
    if (alertBox) alertBox.className = 'auth-alert hidden';
    openModal('batchPhotoModal');
}

function selectBatchPreset(url, notes, el) {
    document.getElementById('batchPhotoUrl').value = url;
    document.getElementById('batchInspectionNotes').value = notes;
    document.querySelectorAll('.batch-preset-item').forEach(item => item.classList.remove('selected'));
    if (el) el.classList.add('selected');
    // Show preview
    const container = document.getElementById('batchPhotoPreviewContainer');
    const img = document.getElementById('batchPhotoPreviewImg');
    if (container && img) {
        img.src = url;
        container.style.display = 'block';
    }
}

function previewBatchPhotoInput() {
    const url = document.getElementById('batchPhotoUrl').value.trim();
    const container = document.getElementById('batchPhotoPreviewContainer');
    const img = document.getElementById('batchPhotoPreviewImg');
    if (!container || !img) return;
    if (url) {
        img.src = url;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

async function submitBatchPhoto(event) {
    event.preventDefault();
    const saleId = document.getElementById('batchPhotoSaleId').value;
    const url    = document.getElementById('batchPhotoUrl').value.trim();
    const notes  = document.getElementById('batchInspectionNotes').value.trim();
    const alertBox = document.getElementById('batchPhotoAlert');
    const saveBtn  = document.getElementById('saveBatchPhotoBtn');

    alertBox.className = 'auth-alert hidden';
    if (!url) {
        alertBox.textContent = 'Please enter a photo URL or select a preset.';
        alertBox.className = 'auth-alert error';
        return;
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

    try {
        const res = await fetch(`${API_BASE}/sales/${saleId}/batch-photo`, {
            method:  'PUT',
            headers: authHeaders(),
            body:    JSON.stringify({ batch_photo_url: url, batch_inspection_notes: notes })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('batchPhotoModal');
            await loadOrdersTab();
        } else {
            alertBox.textContent = data.message || 'Failed to save batch photo.';
            alertBox.className = 'auth-alert error';
        }
    } catch (err) {
        alertBox.textContent = 'Server connection error.';
        alertBox.className = 'auth-alert error';
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm and Save Batch Photo'; }
    }
}

function viewBatchPhoto(url, notes, saleId) {
    document.getElementById('viewBatchOrderTitle').textContent = 'Order #' + saleId + ' - Real Crate Inspection';
    document.getElementById('viewBatchImg').src = url;
    document.getElementById('viewBatchNotes').textContent = notes || 'No inspection notes recorded.';
    openModal('viewBatchModal');
}
