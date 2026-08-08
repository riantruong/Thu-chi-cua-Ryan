import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: 'AIzaSyDswoYo3Ah48DvHKcYYB8DgjK2BnBbEh1w',
    authDomain: 'quan-ly-thu-chi-cua-ryan.firebaseapp.com',
    projectId: 'quan-ly-thu-chi-cua-ryan',
    storageBucket: 'quan-ly-thu-chi-cua-ryan.firebasestorage.app',
    messagingSenderId: '1022232149668',
    appId: '1:1022232149668:web:15081932d1e77b3f9c7031',
    measurementId: 'G-BKHRJWRYL7'
};

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp);
const sharedDataRef = doc(firestoreDb, 'sharedData', 'budget');
let cloudReady = false;
let applyingCloudUpdate = false;
let cloudSaveTimer;

/**
 * Smart Payment Tracker - Javascript Logic
 * Application to track payments, product checkboxes, paid/unpaid status, and payment methods.
 */

// ==========================================
// 1. STATE & INITIALIZATIONS
// ==========================================
const STORAGE_KEY_TRANSACTIONS = 'smart_tracker_transactions_v2';
const STORAGE_KEY_PRODUCTS = 'smart_tracker_products_v2';
const STORAGE_KEY_THEME = 'smart_tracker_theme_v1';

// Default Product Catalog
const DEFAULT_PRODUCTS = [
    { id: 'p1', name: 'Tài liệu bài giảng "Tâm lý học đại cương"', price: 9000 },
    { id: 'p2', name: 'Tài liệu Cấu trúc dữ liệu', price: 11000 },
    { id: 'p3', name: 'Tài liệu Giáo trình "Tâm lý học đại cương"', price: 25000 },
    { id: 'p4', name: 'Sách Giáo trình "Kinh tế Chính trị Mác-Lênin"', price: 45000 }
];

// Sample Transactions
const SAMPLE_TRANSACTIONS = [
    {
        id: 'tx_101',
        personName: 'Nguyễn Văn An',
        items: [
            { id: 'p1', name: 'Tài liệu bài giảng "Tâm lý học đại cương"', price: 9000, qty: 1 },
            { id: 'p2', name: 'Tài liệu Cấu trúc dữ liệu', price: 11000, qty: 1 }
        ],
        totalAmount: 20000,
        docStatus: 'received',
        status: 'paid',
        method: 'bank',
        note: 'Đã chuyển khoản Vietcombank',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
        id: 'tx_102',
        personName: 'Trần Thị Bình',
        items: [
            { id: 'p4', name: 'Sách Giáo trình "Kinh tế Chính trị Mác-Lênin"', price: 45000, qty: 1 }
        ],
        totalAmount: 45000,
        docStatus: 'not_received',
        status: 'unpaid',
        method: 'bank',
        note: 'Hẹn chuyển khoản vào tối nay',
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
        id: 'tx_103',
        personName: 'Lê Hoàng Cường',
        items: [
            { id: 'p3', name: 'Tài liệu Giáo trình "Tâm lý học đại cương"', price: 25000, qty: 1 },
            { id: 'p4', name: 'Sách Giáo trình "Kinh tế Chính trị Mác-Lênin"', price: 45000, qty: 1 }
        ],
        totalAmount: 70000,
        docStatus: 'received',
        status: 'paid',
        method: 'cash',
        note: 'Đưa tiền mặt tại lớp',
        createdAt: new Date().toISOString()
    }
];

let productsCatalog = [];
let transactions = [];
let selectedFormProducts = {}; // { productId: qty }

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const transactionForm = document.getElementById('transactionForm');
const personNameInput = document.getElementById('personName');
const personSuggestions = document.getElementById('personSuggestions');
const step2Container = document.getElementById('step2Container');
const personInputHint = document.getElementById('personInputHint');
const productSelectionList = document.getElementById('productSelectionList');
const selectAllProducts = document.getElementById('selectAllProducts');
const formCalculatedTotal = document.getElementById('formCalculatedTotal');
const editTransactionIdInput = document.getElementById('editTransactionId');
const formTitle = document.getElementById('formTitle');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnSubmitForm = document.getElementById('btnSubmitForm');
const btnResetForm = document.getElementById('btnResetForm');

// Stats Elements
const statTotalAmount = document.getElementById('statTotalAmount');
const statTotalCount = document.getElementById('statTotalCount');
const statPaidAmount = document.getElementById('statPaidAmount');
const statPaidCount = document.getElementById('statPaidCount');
const statUnpaidAmount = document.getElementById('statUnpaidAmount');
const statUnpaidCount = document.getElementById('statUnpaidCount');
const statBankAmount = document.getElementById('statBankAmount');
const statCashAmount = document.getElementById('statCashAmount');
const progressPercentText = document.getElementById('progressPercentText');
const progressBarFill = document.getElementById('progressBarFill');

// List & Filters
const transactionTableBody = document.getElementById('transactionTableBody');
const recordCountBadge = document.getElementById('recordCountBadge');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const filterDocStatus = document.getElementById('filterDocStatus');
const filterStatus = document.getElementById('filterStatus');
const filterMethod = document.getElementById('filterMethod');

// Actions & Modals
const btnThemeToggle = document.getElementById('btnThemeToggle');
const themeIcon = document.getElementById('themeIcon');
const btnManageProducts = document.getElementById('btnManageProducts');
const btnQuickAddProduct = document.getElementById('btnQuickAddProduct');
const modalManageProducts = document.getElementById('modalManageProducts');
const btnCloseProductModal = document.getElementById('btnCloseProductModal');
const newProductForm = document.getElementById('newProductForm');
const catalogListContainer = document.getElementById('catalogListContainer');
const btnSampleData = document.getElementById('btnSampleData');
const btnExportCSV = document.getElementById('btnExportCSV');
const modalReceipt = document.getElementById('modalReceipt');
const btnCloseReceiptModal = document.getElementById('btnCloseReceiptModal');
const receiptPrintArea = document.getElementById('receiptPrintArea');
const toastContainer = document.getElementById('toastContainer');

// Excel Import Modal Elements
const btnImportExcel = document.getElementById('btnImportExcel');
const modalImportExcel = document.getElementById('modalImportExcel');
const btnCloseImportModal = document.getElementById('btnCloseImportModal');
const btnCancelImportModal = document.getElementById('btnCancelImportModal');
const excelDropZone = document.getElementById('excelDropZone');
const excelFileInput = document.getElementById('excelFileInput');
const browseExcelBtn = document.getElementById('browseExcelBtn');
const btnDownloadTemplate = document.getElementById('btnDownloadTemplate');
const excelPreviewContainer = document.getElementById('excelPreviewContainer');
const importFileName = document.getElementById('importFileName');
const importTotalCount = document.getElementById('importTotalCount');
const importDuplicateCount = document.getElementById('importDuplicateCount');
const importUniqueCount = document.getElementById('importUniqueCount');
const tabFilterAll = document.getElementById('tabFilterAll');
const tabFilterDup = document.getElementById('tabFilterDup');
const tabFilterUnique = document.getElementById('tabFilterUnique');
const countTabAll = document.getElementById('countTabAll');
const countTabDup = document.getElementById('countTabDup');
const countTabUnique = document.getElementById('countTabUnique');
const btnBulkSkipDup = document.getElementById('btnBulkSkipDup');
const btnBulkMergeDup = document.getElementById('btnBulkMergeDup');
const btnBulkOverwriteDup = document.getElementById('btnBulkOverwriteDup');
const btnBulkAddNewDup = document.getElementById('btnBulkAddNewDup');
const importTableBody = document.getElementById('importTableBody');
const btnConfirmImport = document.getElementById('btnConfirmImport');
const btnChangeExcelFile = document.getElementById('btnChangeExcelFile');

let parsedExcelRecords = [];
let activeImportFilter = 'all';

// ==========================================
// 3. INIT APPLICATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadProducts();
    loadTransactions();
    
    renderProductSelectionForm();
    renderTransactionsTable();
    updateDashboardStats();
    updatePersonSuggestions();

    setupEventListeners();
    toggleStep2Accordion();
    startCloudSync();
});

// ==========================================
// 4. STORAGE HELPERS
// ==========================================
function loadProducts() {
    const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (saved) {
        try {
            productsCatalog = JSON.parse(saved);
        } catch (e) {
            productsCatalog = [...DEFAULT_PRODUCTS];
        }
    } else {
        productsCatalog = [...DEFAULT_PRODUCTS];
        saveProducts();
    }
}

function saveProducts() {
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(productsCatalog));
    scheduleCloudSave();
}

function loadTransactions() {
    const saved = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    if (saved) {
        try {
            transactions = JSON.parse(saved);
        } catch (e) {
            transactions = [];
        }
    } else {
        transactions = [...SAMPLE_TRANSACTIONS];
        saveTransactions();
    }
}

function saveTransactions() {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
    scheduleCloudSave();
}

// ==========================================
// 5. CLOUD SYNCHRONIZATION
// ==========================================
function startCloudSync() {
    onSnapshot(sharedDataRef, (snapshot) => {
        cloudReady = true;

        if (!snapshot.exists()) {
            scheduleCloudSave();
            return;
        }

        const cloudData = snapshot.data();
        if (!Array.isArray(cloudData.products) || !Array.isArray(cloudData.transactions)) return;

        applyingCloudUpdate = true;
        productsCatalog = cloudData.products;
        transactions = cloudData.transactions;
        localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(productsCatalog));
        localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));

        renderProductSelectionForm();
        renderTransactionsTable();
        updateDashboardStats();
        updatePersonSuggestions();
        if (!modalManageProducts.classList.contains('hidden')) renderCatalogModalList();
        applyingCloudUpdate = false;
    }, (error) => {
        console.error('Firestore sync error:', error);
        showToast('KhÃ´ng thá»ƒ káº¿t ná»‘i Ä‘á»“ng bá»™ dá»¯ liá»‡u. Kiá»ƒm tra Cloud Firestore vÃ  quy tắc truy cáº­p.', 'danger');
    });
}

function scheduleCloudSave() {
    if (!cloudReady || applyingCloudUpdate) return;

    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(async () => {
        try {
            await setDoc(sharedDataRef, {
                products: productsCatalog,
                transactions,
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Firestore save error:', error);
            showToast('LÆ°u dá»¯ liá»‡u Ä‘á»“ng bá»™ tháº¥t báº¡i.', 'danger');
        }
    }, 350);
}

// ==========================================
// 6. FORMATTERS & UTILS
// ==========================================
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ri-checkbox-circle-fill';
    if (type === 'danger') icon = 'ri-error-warning-fill';
    if (type === 'info') icon = 'ri-information-fill';

    toast.innerHTML = `<i class="${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ==========================================
// 6. FORM & PRODUCT SELECTION RENDER
// ==========================================
function renderProductSelectionForm() {
    productSelectionList.innerHTML = '';
    
    if (productsCatalog.length === 0) {
        productSelectionList.innerHTML = `
            <div class="empty-state" style="padding: 16px;">
                <p style="font-size: 13px;">Chưa có sản phẩm nào. Hãy bấm "+ Thêm mục mới" để tạo!</p>
            </div>
        `;
        if (selectAllProducts) selectAllProducts.checked = false;
        return;
    }

    // Sync select-all checkbox state
    if (selectAllProducts) {
        const totalProds = productsCatalog.length;
        const selectedCount = productsCatalog.filter(p => selectedFormProducts[p.id] > 0).length;
        selectAllProducts.checked = totalProds > 0 && selectedCount === totalProds;
    }

    productsCatalog.forEach(prod => {
        const qty = selectedFormProducts[prod.id] || 0;
        const isSelected = qty > 0;

        const row = document.createElement('div');
        row.className = `product-item-row ${isSelected ? 'selected' : ''}`;
        row.innerHTML = `
            <div class="product-left">
                <input type="checkbox" class="custom-checkbox" data-id="${prod.id}" ${isSelected ? 'checked' : ''}>
                <div>
                    <div class="product-name-txt">${prod.name}</div>
                    <div class="product-price-txt">${formatCurrency(prod.price)}</div>
                </div>
            </div>
            <div class="qty-control">
                <button type="button" class="qty-btn btn-minus" data-id="${prod.id}">-</button>
                <span class="qty-val">${qty}</span>
                <button type="button" class="qty-btn btn-plus" data-id="${prod.id}">+</button>
            </div>
        `;

        // Click anywhere on row to toggle selection (except when clicking qty controls)
        row.addEventListener('click', (e) => {
            if (e.target.closest('.qty-control')) return;
            if (e.target.classList.contains('custom-checkbox')) return; // handled by change event

            if (selectedFormProducts[prod.id] > 0) {
                delete selectedFormProducts[prod.id];
            } else {
                selectedFormProducts[prod.id] = 1;
            }
            renderProductSelectionForm();
            calculateFormTotal();
        });

        // Click directly on checkbox
        const checkbox = row.querySelector('.custom-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedFormProducts[prod.id] = selectedFormProducts[prod.id] || 1;
            } else {
                delete selectedFormProducts[prod.id];
            }
            renderProductSelectionForm();
            calculateFormTotal();
        });

        // Plus / Minus buttons
        const btnMinus = row.querySelector('.btn-minus');
        const btnPlus = row.querySelector('.btn-plus');

        btnMinus.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedFormProducts[prod.id] > 1) {
                selectedFormProducts[prod.id] -= 1;
            } else {
                delete selectedFormProducts[prod.id];
            }
            renderProductSelectionForm();
            calculateFormTotal();
        });

        btnPlus.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!selectedFormProducts[prod.id]) {
                selectedFormProducts[prod.id] = 1;
            } else {
                selectedFormProducts[prod.id] += 1;
            }
            renderProductSelectionForm();
            calculateFormTotal();
        });

        productSelectionList.appendChild(row);
    });

    calculateFormTotal();
}

function calculateFormTotal() {
    let total = 0;
    Object.keys(selectedFormProducts).forEach(prodId => {
        const prod = productsCatalog.find(p => p.id === prodId);
        if (prod) {
            total += prod.price * selectedFormProducts[prodId];
        }
    });
    formCalculatedTotal.textContent = formatCurrency(total);
    return total;
}

// ==========================================
// 7. TRANSACTION TABLE & STATS RENDER
// ==========================================
function renderTransactionsTable() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const docStatusVal = filterDocStatus ? filterDocStatus.value : 'all';
    const statusVal = filterStatus.value;
    const methodVal = filterMethod.value;

    const filtered = transactions.filter(tx => {
        const matchName = tx.personName.toLowerCase().includes(searchTerm);
        const matchItem = tx.items.some(i => i.name.toLowerCase().includes(searchTerm));
        const matchSearch = matchName || matchItem;

        const matchDocStatus = (docStatusVal === 'all') || ((tx.docStatus || 'received') === docStatusVal);
        const matchStatus = (statusVal === 'all') || (tx.status === statusVal);
        const matchMethod = (methodVal === 'all') || (tx.method === methodVal);

        return matchSearch && matchDocStatus && matchStatus && matchMethod;
    });

    transactionTableBody.innerHTML = '';
    recordCountBadge.textContent = `${filtered.length} người`;

    if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');

        filtered.forEach((tx, index) => {
            const tr = document.createElement('tr');
            
            // Build items HTML badges
            const itemsHtml = tx.items.map(item => 
                `<span class="product-tag">${item.name} <strong>x${item.qty}</strong></span>`
            ).join('');

            // Document Receipt Badge
            const currentDocStatus = tx.docStatus || 'received';
            const docStatusBadge = currentDocStatus === 'received'
                ? `<span class="badge badge-received" title="Bấm để chuyển sang Chưa nhận tài liệu" onclick="toggleDocStatus('${tx.id}')"><i class="ri-checkbox-circle-line"></i> Đã nhận TL</span>`
                : `<span class="badge badge-warning" title="Bấm để chuyển sang Đã nhận tài liệu" onclick="toggleDocStatus('${tx.id}')"><i class="ri-time-line"></i> Chưa nhận TL (Tích đổi)</span>`;

            // Status Badge
            const statusBadge = tx.status === 'paid'
                ? `<span class="badge badge-success"><i class="ri-checkbox-circle-line"></i> Đã đóng</span>`
                : `<span class="badge badge-danger" title="Bấm để chuyển sang Đã đóng tiền" onclick="togglePaymentStatus('${tx.id}')"><i class="ri-time-line"></i> Chưa đóng (Tích đổi)</span>`;

            // Method Badge
            const methodBadge = tx.method === 'bank'
                ? `<span class="badge badge-bank"><i class="ri-bank-card-line"></i> Chuyển khoản</span>`
                : `<span class="badge badge-cash"><i class="ri-cash-line"></i> Tiền mặt</span>`;

            tr.innerHTML = `
                <td style="text-align:center;">
                    <span class="stt-badge">${index + 1}</span>
                </td>
                <td class="person-cell">
                    ${tx.personName}
                    ${tx.note ? `<small><i class="ri-chat-3-line"></i> ${tx.note}</small>` : ''}
                </td>
                <td>
                    <div class="products-badge-list">${itemsHtml}</div>
                </td>
                <td class="amount-cell">${formatCurrency(tx.totalAmount)}</td>
                <td>${docStatusBadge}</td>
                <td>${statusBadge}</td>
                <td>${methodBadge}</td>
                <td style="font-size:12px; color:var(--text-muted);">${formatDate(tx.createdAt)}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-sm btn-ghost" onclick="printReceipt('${tx.id}')" title="In phiếu thu">
                            <i class="ri-printer-line" style="color:var(--secondary)"></i>
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="startEditTransaction('${tx.id}')" title="Chỉnh sửa">
                            <i class="ri-edit-line" style="color:var(--primary)"></i>
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="deleteTransaction('${tx.id}')" title="Xóa">
                            <i class="ri-delete-bin-line" style="color:var(--danger)"></i>
                        </button>
                    </div>
                </td>
            `;

            transactionTableBody.appendChild(tr);
        });
    }
}

function updateDashboardStats() {
    let total = 0;
    let paid = 0;
    let unpaid = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let bankAmount = 0;
    let cashAmount = 0;

    transactions.forEach(tx => {
        total += tx.totalAmount;
        if (tx.status === 'paid') {
            paid += tx.totalAmount;
            paidCount++;
            if (tx.method === 'bank') bankAmount += tx.totalAmount;
            if (tx.method === 'cash') cashAmount += tx.totalAmount;
        } else {
            unpaid += tx.totalAmount;
            unpaidCount++;
        }
    });

    statTotalAmount.textContent = formatCurrency(total);
    statTotalCount.textContent = `${transactions.length} người đăng ký`;

    statPaidAmount.textContent = formatCurrency(paid);
    statPaidCount.textContent = `${paidCount} / ${transactions.length} người đã đóng`;

    statUnpaidAmount.textContent = formatCurrency(unpaid);
    statUnpaidCount.textContent = `${unpaidCount} người chưa đóng`;

    statBankAmount.textContent = formatCurrency(bankAmount);
    statCashAmount.textContent = formatCurrency(cashAmount);

    // Progress Bar
    const percent = total > 0 ? Math.round((paid / total) * 100) : 0;
    progressPercentText.textContent = `${percent}%`;
    progressBarFill.style.width = `${percent}%`;

    // Update Product Quantity Breakdown
    updateProductStatsBreakdown();
}

function updateProductStatsBreakdown() {
    const productStatsGrid = document.getElementById('productStatsGrid');
    const totalItemsSoldBadge = document.getElementById('totalItemsSoldBadge');

    if (!productStatsGrid) return;

    let overallTotalItems = 0;

    const statsMap = {};
    productsCatalog.forEach(prod => {
        statsMap[prod.id] = {
            name: prod.name,
            price: prod.price,
            totalQty: 0,
            paidQty: 0,
            unpaidQty: 0,
            receivedQty: 0,
            notReceivedQty: 0,
            revenue: 0
        };
    });

    // Calculate from transactions
    transactions.forEach(tx => {
        const isDocReceived = (tx.docStatus || 'received') === 'received';
        tx.items.forEach(item => {
            if (!statsMap[item.id]) {
                statsMap[item.id] = {
                    name: item.name,
                    price: item.price || 0,
                    totalQty: 0,
                    paidQty: 0,
                    unpaidQty: 0,
                    receivedQty: 0,
                    notReceivedQty: 0,
                    revenue: 0
                };
            }
            const stat = statsMap[item.id];
            stat.totalQty += item.qty;
            overallTotalItems += item.qty;
            stat.revenue += (item.price * item.qty);

            if (tx.status === 'paid') {
                stat.paidQty += item.qty;
            } else {
                stat.unpaidQty += item.qty;
            }

            if (isDocReceived) {
                stat.receivedQty += item.qty;
            } else {
                stat.notReceivedQty += item.qty;
            }
        });
    });

    if (totalItemsSoldBadge) {
        totalItemsSoldBadge.textContent = `${overallTotalItems} bản / cuốn đã bán`;
    }

    productStatsGrid.innerHTML = '';

    Object.values(statsMap).forEach(stat => {
        const itemCard = document.createElement('div');
        itemCard.className = 'prod-stat-item';
        itemCard.innerHTML = `
            <div class="prod-stat-left">
                <div class="prod-stat-title" title="${stat.name}">${stat.name}</div>
                <div class="prod-stat-sub">
                    <span class="text-success">✅ Đã thu: ${stat.paidQty}</span> | 
                    <span class="text-danger">⏳ Nợ: ${stat.unpaidQty}</span> |
                    <span style="color: var(--info);">📦 Đã nhận: ${stat.receivedQty}</span>
                </div>
            </div>
            <div class="prod-stat-right">
                <div class="prod-stat-qty">${stat.totalQty} <small style="font-size:11px; font-weight:500;">bản</small></div>
                <div style="font-size:11px; font-weight:700; color:var(--primary);">${formatCurrency(stat.revenue)}</div>
            </div>
        `;
        productStatsGrid.appendChild(itemCard);
    });
}

function updatePersonSuggestions() {
    personSuggestions.innerHTML = '';
    const uniqueNames = [...new Set(transactions.map(t => t.personName))];
    uniqueNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        personSuggestions.appendChild(option);
    });
}

function toggleStep2Accordion() {
    const nameVal = personNameInput.value.trim();
    if (nameVal.length > 0) {
        step2Container.classList.remove('collapsed');
        personInputHint.className = 'person-hint success';
        personInputHint.innerHTML = `<i class="ri-checkbox-circle-fill"></i> Đã nhập tên "<strong>${nameVal}</strong>"! Hãy tích chọn các mục sản phẩm bên dưới:`;
    } else {
        if (!editTransactionIdInput.value) {
            step2Container.classList.add('collapsed');
            personInputHint.className = 'person-hint';
            personInputHint.innerHTML = `<i class="ri-corner-down-right-line"></i> Nhập tên người ở trên để mở danh sách sản phẩm tích chọn`;
        }
    }
}

// ==========================================
// 8. ACTIONS & HANDLERS
// ==========================================
function setupEventListeners() {
    // Person Name Input Listener -> Auto Unfold Step 2
    personNameInput.addEventListener('input', toggleStep2Accordion);
    personNameInput.addEventListener('focus', toggleStep2Accordion);

    // Select All Checkbox Listener
    if (selectAllProducts) {
        selectAllProducts.addEventListener('change', (e) => {
            if (e.target.checked) {
                productsCatalog.forEach(prod => {
                    selectedFormProducts[prod.id] = 1;
                });
            } else {
                selectedFormProducts = {};
            }
            renderProductSelectionForm();
            calculateFormTotal();
        });
    }

    // Form Submit
    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTransactionFromForm();
    });

    // Reset Form Button
    btnResetForm.addEventListener('click', resetForm);

    // Cancel Edit Button
    btnCancelEdit.addEventListener('click', resetForm);

    // Search and Filter Events
    searchInput.addEventListener('input', renderTransactionsTable);
    if (filterDocStatus) filterDocStatus.addEventListener('change', renderTransactionsTable);
    filterStatus.addEventListener('change', renderTransactionsTable);
    filterMethod.addEventListener('change', renderTransactionsTable);

    // Dark Theme Toggle
    btnThemeToggle.addEventListener('click', toggleTheme);

    // Manage Products Modal
    btnManageProducts.addEventListener('click', () => {
        renderCatalogModalList();
        modalManageProducts.classList.remove('hidden');
    });

    btnQuickAddProduct.addEventListener('click', () => {
        renderCatalogModalList();
        modalManageProducts.classList.remove('hidden');
    });

    btnCloseProductModal.addEventListener('click', () => {
        modalManageProducts.classList.add('hidden');
    });

    newProductForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addNewCatalogProduct();
    });

    // Sample Data Reload
    btnSampleData.addEventListener('click', () => {
        if (confirm('Khôi phục lại dữ liệu mẫu dùng thử? (Dữ liệu hiện tại sẽ được cập nhật)')) {
            transactions = [...SAMPLE_TRANSACTIONS];
            productsCatalog = [...DEFAULT_PRODUCTS];
            saveTransactions();
            saveProducts();
            renderProductSelectionForm();
            renderTransactionsTable();
            updateDashboardStats();
            updatePersonSuggestions();
            showToast('Đã tải lại dữ liệu mẫu thành công!', 'info');
        }
    });

    // Export Excel/CSV
    btnExportCSV.addEventListener('click', exportToExcel);

    // Receipt Modal Close
    btnCloseReceiptModal.addEventListener('click', () => {
        modalReceipt.classList.add('hidden');
    });

    // Excel Import Event Listeners
    if (btnImportExcel) {
        btnImportExcel.addEventListener('click', () => {
            resetExcelImportState();
            modalImportExcel.classList.remove('hidden');
        });
    }

    if (btnCloseImportModal) {
        btnCloseImportModal.addEventListener('click', () => {
            modalImportExcel.classList.add('hidden');
        });
    }

    if (btnCancelImportModal) {
        btnCancelImportModal.addEventListener('click', () => {
            modalImportExcel.classList.add('hidden');
        });
    }

    if (browseExcelBtn && excelFileInput) {
        browseExcelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            excelFileInput.click();
        });
    }

    if (excelDropZone && excelFileInput) {
        excelDropZone.addEventListener('click', () => {
            excelFileInput.click();
        });

        excelDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            excelDropZone.classList.add('dragover');
        });

        excelDropZone.addEventListener('dragleave', () => {
            excelDropZone.classList.remove('dragover');
        });

        excelDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            excelDropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                parseExcelFile(e.dataTransfer.files[0]);
            }
        });

        excelFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                parseExcelFile(e.target.files[0]);
            }
        });
    }

    if (btnChangeExcelFile) {
        btnChangeExcelFile.addEventListener('click', () => {
            resetExcelImportState();
        });
    }

    if (btnDownloadTemplate) {
        btnDownloadTemplate.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadSampleExcel();
        });
    }

    if (btnConfirmImport) {
        btnConfirmImport.addEventListener('click', confirmExcelImport);
    }

    // Bulk action handlers
    if (btnBulkSkipDup) {
        btnBulkSkipDup.addEventListener('click', () => {
            parsedExcelRecords.forEach(r => {
                if (r.duplicateType !== 'none') r.action = 'skip';
            });
            renderImportPreviewTable();
            showToast('Đã chuyển tất cả dòng trùng tên thành: Bỏ qua', 'info');
        });
    }

    if (btnBulkMergeDup) {
        btnBulkMergeDup.addEventListener('click', () => {
            parsedExcelRecords.forEach(r => {
                if (r.duplicateType !== 'none') r.action = 'merge';
            });
            renderImportPreviewTable();
            showToast('Đã chuyển tất cả dòng trùng tên thành: Gộp tài liệu', 'info');
        });
    }

    if (btnBulkOverwriteDup) {
        btnBulkOverwriteDup.addEventListener('click', () => {
            parsedExcelRecords.forEach(r => {
                if (r.duplicateType !== 'none') r.action = 'overwrite';
            });
            renderImportPreviewTable();
            showToast('Đã chuyển tất cả dòng trùng tên thành: Ghi đè', 'info');
        });
    }

    if (btnBulkAddNewDup) {
        btnBulkAddNewDup.addEventListener('click', () => {
            parsedExcelRecords.forEach(r => {
                if (r.duplicateType !== 'none') r.action = 'add';
            });
            renderImportPreviewTable();
            showToast('Đã chuyển tất cả dòng trùng tên thành: Thêm mới', 'info');
        });
    }

    // Filter tabs handlers
    [tabFilterAll, tabFilterDup, tabFilterUnique].forEach(tab => {
        if (tab) {
            tab.addEventListener('click', () => {
                [tabFilterAll, tabFilterDup, tabFilterUnique].forEach(t => t && t.classList.remove('active'));
                tab.classList.add('active');
                activeImportFilter = tab.getAttribute('data-tab');
                renderImportPreviewTable();
            });
        }
    });
}

function saveTransactionFromForm() {
    const personName = personNameInput.value.trim();
    if (!personName) {
        showToast('Vui lòng nhập tên người mua / đóng tiền!', 'danger');
        return;
    }

    const selectedProductIds = Object.keys(selectedFormProducts);
    if (selectedProductIds.length === 0) {
        showToast('Vui lòng tích chọn ít nhất 1 sản phẩm mua!', 'danger');
        return;
    }

    // Build items array
    const items = selectedProductIds.map(prodId => {
        const prod = productsCatalog.find(p => p.id === prodId);
        return {
            id: prodId,
            name: prod ? prod.name : 'Sản phẩm',
            price: prod ? prod.price : 0,
            qty: selectedFormProducts[prodId]
        };
    });

    const totalAmount = calculateFormTotal();
    const docStatusRadio = document.querySelector('input[name="docStatus"]:checked');
    const docStatus = docStatusRadio ? docStatusRadio.value : 'received';
    const status = document.querySelector('input[name="paymentStatus"]:checked').value;
    const method = document.querySelector('input[name="paymentMethod"]:checked').value;
    const note = document.getElementById('transactionNote').value.trim();

    const editId = editTransactionIdInput.value;

    if (editId) {
        // Edit existing
        const index = transactions.findIndex(t => t.id === editId);
        if (index !== -1) {
            transactions[index] = {
                ...transactions[index],
                personName,
                items,
                totalAmount,
                docStatus,
                status,
                method,
                note
            };
            showToast(`Đã cập nhật giao dịch của ${personName}!`, 'success');
        }
    } else {
        // Create new
        const newTx = {
            id: 'tx_' + Date.now(),
            personName,
            items,
            totalAmount,
            docStatus,
            status,
            method,
            note,
            createdAt: new Date().toISOString()
        };
        transactions.unshift(newTx);
        showToast(`Đã lưu giao dịch mới cho ${personName}!`, 'success');
    }

    saveTransactions();
    resetForm();
    renderTransactionsTable();
    updateDashboardStats();
    updatePersonSuggestions();
}

function resetForm() {
    transactionForm.reset();
    editTransactionIdInput.value = '';
    selectedFormProducts = {};
    formTitle.textContent = 'Nhập Thu Chi Theo Người';
    btnSubmitForm.innerHTML = `<i class="ri-save-3-line"></i> Lưu Giao Dịch Thu Chi`;
    btnCancelEdit.classList.add('hidden');

    const defaultDocRadio = document.querySelector('input[name="docStatus"][value="received"]');
    if (defaultDocRadio) defaultDocRadio.checked = true;

    renderProductSelectionForm();
    toggleStep2Accordion();
}

window.togglePaymentStatus = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
        tx.status = tx.status === 'paid' ? 'unpaid' : 'paid';
        saveTransactions();
        renderTransactionsTable();
        updateDashboardStats();
        showToast(`Đã đổi trạng thái tiền cho ${tx.personName} sang: ${tx.status === 'paid' ? 'Đã đóng tiền' : 'Chưa đóng tiền'}`, 'info');
    }
};

window.toggleDocStatus = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
        tx.docStatus = (tx.docStatus || 'received') === 'received' ? 'not_received' : 'received';
        saveTransactions();
        renderTransactionsTable();
        updateDashboardStats();
        showToast(`Đã đổi trạng thái nhận tài liệu cho ${tx.personName} sang: ${tx.docStatus === 'received' ? 'Đã nhận tài liệu' : 'Chưa nhận tài liệu'}`, 'info');
    }
};

window.startEditTransaction = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    editTransactionIdInput.value = tx.id;
    personNameInput.value = tx.personName;
    document.getElementById('transactionNote').value = tx.note || '';

    // Set radios
    const docRadio = document.querySelector(`input[name="docStatus"][value="${tx.docStatus || 'received'}"]`);
    if (docRadio) docRadio.checked = true;

    const statusRadio = document.querySelector(`input[name="paymentStatus"][value="${tx.status}"]`);
    if (statusRadio) statusRadio.checked = true;

    const methodRadio = document.querySelector(`input[name="paymentMethod"][value="${tx.method}"]`);
    if (methodRadio) methodRadio.checked = true;

    // Load products selection
    selectedFormProducts = {};
    tx.items.forEach(item => {
        selectedFormProducts[item.id] = item.qty;
    });

    renderProductSelectionForm();
    toggleStep2Accordion();

    formTitle.textContent = `Chỉnh Sửa Giao Dịch: ${tx.personName}`;
    btnSubmitForm.innerHTML = `<i class="ri-check-double-line"></i> Cập Nhật Giao Dịch`;
    btnCancelEdit.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteTransaction = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    if (confirm(`Bạn có chắc chắn muốn xóa giao dịch của "${tx.personName}"?`)) {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions();
        renderTransactionsTable();
        updateDashboardStats();
        updatePersonSuggestions();
        showToast('Đã xóa giao dịch thành công.', 'danger');
    }
};

// ==========================================
// 9. PRODUCT CATALOG MANAGING
// ==========================================
function renderCatalogModalList() {
    catalogListContainer.innerHTML = '';
    if (productsCatalog.length === 0) {
        catalogListContainer.innerHTML = '<p class="text-muted" style="text-align:center;">Chưa có sản phẩm nào.</p>';
        return;
    }

    productsCatalog.forEach(prod => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'catalog-item';
        itemDiv.innerHTML = `
            <div class="catalog-info">
                <strong>${prod.name}</strong>
                <span>${formatCurrency(prod.price)}</span>
            </div>
            <button class="btn btn-sm btn-ghost" onclick="deleteCatalogProduct('${prod.id}')">
                <i class="ri-delete-bin-line" style="color:var(--danger)"></i>
            </button>
        `;
        catalogListContainer.appendChild(itemDiv);
    });
}

function addNewCatalogProduct() {
    const name = document.getElementById('newProductName').value.trim();
    const price = parseFloat(document.getElementById('newProductPrice').value);

    if (!name || isNaN(price) || price < 0) {
        showToast('Vui lòng nhập tên và giá sản phẩm hợp lệ!', 'danger');
        return;
    }

    const newProd = {
        id: 'p_' + Date.now(),
        name,
        price
    };

    productsCatalog.push(newProd);
    saveProducts();

    document.getElementById('newProductName').value = '';
    document.getElementById('newProductPrice').value = '';

    renderCatalogModalList();
    renderProductSelectionForm();
    showToast(`Đã thêm sản phẩm "${name}" vào danh mục!`, 'success');
}

window.deleteCatalogProduct = function(id) {
    const prod = productsCatalog.find(p => p.id === id);
    if (confirm(`Xóa sản phẩm "${prod ? prod.name : ''}" khỏi danh mục?`)) {
        productsCatalog = productsCatalog.filter(p => p.id !== id);
        delete selectedFormProducts[id];
        saveProducts();
        renderCatalogModalList();
        renderProductSelectionForm();
        showToast('Đã xóa sản phẩm.', 'info');
    }
};

// ==========================================
// 10. PRINT RECEIPT
// ==========================================
window.printReceipt = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const itemsRows = tx.items.map(item => `
        <tr>
            <td style="padding:8px; border-bottom:1px solid #eee;">${item.name}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${item.qty}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(item.price)}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(item.price * item.qty)}</td>
        </tr>
    `).join('');

    const isDocReceived = (tx.docStatus || 'received') === 'received';

    receiptPrintArea.innerHTML = `
        <div style="font-family:sans-serif; color:#1e293b; line-height:1.6;">
            <div style="text-align:center; margin-bottom:20px; border-bottom:2px dashed #059669; padding-bottom:12px;">
                <h2 style="color:#059669; margin-bottom:4px;">PHIẾU THU TIỀN SẢN PHẨM</h2>
                <p style="font-size:13px; color:#64748b;">Mã phiếu: <strong>${tx.id}</strong> | Ngày: ${formatDate(tx.createdAt)}</p>
            </div>
            <div style="margin-bottom:16px;">
                <p><strong>Người nộp / Mua hàng:</strong> ${tx.personName}</p>
                <p><strong>Trạng thái nhận tài liệu:</strong> ${isDocReceived ? '📦 Đã nhận tài liệu' : '⏳ Chưa nhận tài liệu'}</p>
                <p><strong>Trạng thái đóng tiền:</strong> ${tx.status === 'paid' ? '✅ Đã đóng tiền' : '⏳ Chưa đóng tiền'}</p>
                <p><strong>Hình thức thanh toán:</strong> ${tx.method === 'bank' ? '🏦 Chuyển khoản' : '💵 Tiền mặt'}</p>
                ${tx.note ? `<p><strong>Ghi chú:</strong> ${tx.note}</p>` : ''}
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:16px;">
                <thead>
                    <tr style="background:#f1f5f9; text-align:left;">
                        <th style="padding:8px;">Tên mục / Sản phẩm</th>
                        <th style="padding:8px; text-align:center;">SL</th>
                        <th style="padding:8px; text-align:right;">Đơn giá</th>
                        <th style="padding:8px; text-align:right;">Thành tiền</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>
            <div style="text-align:right; font-size:18px; margin-top:12px;">
                <strong>TỔNG TIỀN: <span style="color:#059669;">${formatCurrency(tx.totalAmount)}</span></strong>
            </div>
            <div style="margin-top:40px; display:flex; justify-content:space-between; text-align:center; font-size:13px;">
                <div>
                    <p><strong>Người nộp tiền</strong></p>
                    <p style="margin-top:40px; color:#94a3b8;">(Ký và ghi rõ họ tên)</p>
                </div>
                <div>
                    <p><strong>Người thu tiền</strong></p>
                    <p style="margin-top:40px; color:#94a3b8;">(Ký và ghi rõ họ tên)</p>
                </div>
            </div>
        </div>
    `;

    modalReceipt.classList.remove('hidden');
};

// ==========================================
// 11. EXPORT EXCEL (MATCH EXACT TABLE LAYOUT)
// ==========================================
async function exportToExcel() {
    if (transactions.length === 0) {
        showToast('Không có dữ liệu để xuất tệp Excel!', 'danger');
        return;
    }

    // Ensure XLSX library is loaded
    if (typeof XLSX === 'undefined') {
        try {
            await loadExternalScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
        } catch (e) {
            console.warn('XLSX dynamic load error:', e);
        }
    }

    // Header matching the UI table layout exactly:
    const exportRows = [
        [
            "STT",
            "TÊN NGƯỜI",
            "SẢN PHẨM TÍCH CHỌN",
            "TỔNG TIỀN",
            "NHẬN TÀI LIỆU",
            "TRẠNG THÁI ĐÓNG TIỀN",
            "HÌNH THỨC",
            "NGÀY TẠO"
        ]
    ];

    transactions.forEach((tx, idx) => {
        const prodList = tx.items.map(i => `${i.name} x${i.qty}`).join('\n');
        const totalStr = formatCurrency(tx.totalAmount);
        const docTxt = (tx.docStatus || 'received') === 'received' ? 'Đã nhận TL' : 'Chưa nhận';
        const statusTxt = tx.status === 'paid' ? 'Đã đóng' : 'Chưa đóng';
        const methodTxt = tx.method === 'bank' ? 'Chuyển khoản' : 'Tiền mặt';
        const formattedDate = formatDate(tx.createdAt);

        exportRows.push([
            idx + 1,
            tx.personName,
            prodList,
            totalStr,
            docTxt,
            statusTxt,
            methodTxt,
            formattedDate
        ]);
    });

    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet(exportRows);
        
        // Auto-set column widths for easy reading
        ws['!cols'] = [
            { wch: 6 },  // STT
            { wch: 24 }, // TÊN NGƯỜI
            { wch: 48 }, // SẢN PHẨM TÍCH CHỌN
            { wch: 16 }, // TỔNG TIỀN
            { wch: 18 }, // NHẬN TÀI LIỆU
            { wch: 22 }, // TRẠNG THÁI ĐÓNG TIỀN
            { wch: 18 }, // HÌNH THỨC
            { wch: 20 }  // NGÀY TẠO
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Thu_Chi");
        
        const fileName = `Bao_Cao_Thu_Chi_DH25TIN03_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        showToast('Đã xuất tệp Excel (.xlsx) chuẩn nhiều cột thành công!', 'success');
    } else {
        // Fallback UTF-8 BOM CSV with sep=, header directive for Excel
        let csv = '\uFEFF';
        csv += 'sep=,\n';
        csv += 'STT,TÊN NGƯỜI,SẢN PHẨM TÍCH CHỌN,TỔNG TIỀN,NHẬN TÀI LIỆU,TRẠNG THÁI ĐÓNG TIỀN,HÌNH THỨC,NGÀY TẠO\n';
        exportRows.slice(1).forEach(row => {
            const cleanProd = (row[2] || '').replace(/"/g, '""').replace(/\n/g, '; ');
            csv += `"${row[0]}","${row[1]}","${cleanProd}","${row[3]}","${row[4]}","${row[5]}","${row[6]}","${row[7]}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Bao_Cao_Thu_Chi_DH25TIN03_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Đã xuất tệp CSV chia cột thành công!', 'success');
    }
}

function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ==========================================
// 12. THEME SWITCHER
// ==========================================
function toggleTheme() {
    if (document.body.classList.contains('dark-mode')) {
        document.body.classList.remove('dark-mode');
        themeIcon.className = 'ri-moon-line';
        localStorage.setItem(STORAGE_KEY_THEME, 'light');
    } else {
        document.body.classList.add('dark-mode');
        themeIcon.className = 'ri-sun-line';
        localStorage.setItem(STORAGE_KEY_THEME, 'dark');
    }
}

function loadTheme() {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.className = 'ri-sun-line';
    }
}

// ==========================================
// 13. EXCEL FILE IMPORT & DUPLICATE RESOLUTION MODULE
// ==========================================

function normalizeNameStrict(str) {
    if (!str) return '';
    return str.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseExcelFile(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showToast('Thư viện XLSX chưa tải xong, vui lòng thử lại sau giây lát!', 'danger');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            if (!rawData || rawData.length < 2) {
                showToast('Tệp Excel không chứa dữ liệu hoặc thiếu tiêu đề!', 'danger');
                return;
            }

            processExcelData(file.name, rawData);
        } catch (err) {
            console.error('Excel parse error:', err);
            showToast('Không thể đọc tệp Excel. Vui lòng kiểm tra lại định dạng tệp!', 'danger');
        }
    };
    reader.readAsArrayBuffer(file);
}

function processExcelData(fileName, rawRows) {
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
        if (rawRows[i].some(cell => cell.toString().trim() !== '')) {
            headerRowIdx = i;
            break;
        }
    }

    const headers = rawRows[headerRowIdx].map(h => h.toString().trim().toLowerCase());
    
    let colName = -1, colItems = -1, colAmount = -1, colStatus = -1, colMethod = -1, colDocStatus = -1, colNote = -1;

    headers.forEach((h, idx) => {
        if (h.includes('họ') || h.includes('tên') || h.includes('người') || h.includes('name')) {
            if (colName === -1) colName = idx;
        } else if (h.includes('tài liệu') || h.includes('sản phẩm') || h.includes('mục') || h.includes('item') || h.includes('product')) {
            if (colItems === -1) colItems = idx;
        } else if (h.includes('tiền') || h.includes('giá') || h.includes('amount') || h.includes('price')) {
            if (colAmount === -1) colAmount = idx;
        } else if (h.includes('đóng') || h.includes('thanh toán') || h.includes('trạng thái tiền') || h.includes('status')) {
            if (colStatus === -1) colStatus = idx;
        } else if (h.includes('hình thức') || h.includes('phương thức') || h.includes('chuyển khoản') || h.includes('method')) {
            if (colMethod === -1) colMethod = idx;
        } else if (h.includes('nhận tài liệu') || h.includes('đã nhận') || h.includes('doc')) {
            if (colDocStatus === -1) colDocStatus = idx;
        } else if (h.includes('ghi chú') || h.includes('lưu ý') || h.includes('note')) {
            if (colNote === -1) colNote = idx;
        }
    });

    if (colName === -1) colName = 1;
    if (colItems === -1 && rawRows[headerRowIdx].length > 2) colItems = 2;

    const parsedRecords = [];
    const dataRows = rawRows.slice(headerRowIdx + 1);

    dataRows.forEach((row, rIdx) => {
        const rawName = row[colName] ? row[colName].toString().trim() : '';
        if (!rawName || rawName.toLowerCase() === 'họ và tên' || rawName.toLowerCase() === 'stt' || rawName.toLowerCase() === 'tên người') return;

        const itemsRawStr = colItems !== -1 && row[colItems] ? row[colItems].toString().trim() : '';
        const amountRaw = colAmount !== -1 && row[colAmount] ? parseFloat(row[colAmount].toString().replace(/[^0-9.]/g, '')) : NaN;
        const statusRawStr = colStatus !== -1 && row[colStatus] ? row[colStatus].toString().trim().toLowerCase() : '';
        const methodRawStr = colMethod !== -1 && row[colMethod] ? row[colMethod].toString().trim().toLowerCase() : '';
        const docStatusRawStr = colDocStatus !== -1 && row[colDocStatus] ? row[colDocStatus].toString().trim().toLowerCase() : '';
        const noteRawStr = colNote !== -1 && row[colNote] ? row[colNote].toString().trim() : '';

        const isPaid = statusRawStr.includes('đã') || statusRawStr.includes('xong') || statusRawStr.includes('rồi') || statusRawStr.includes('paid') || statusRawStr === '1' || statusRawStr === 'true';
        const isBank = methodRawStr.includes('ck') || methodRawStr.includes('chuyển') || methodRawStr.includes('bank') || methodRawStr.includes('thẻ');
        const isDocReceived = !(docStatusRawStr.includes('chưa') || docStatusRawStr.includes('not') || docStatusRawStr === '0' || docStatusRawStr === 'false');

        const itemsList = parseExcelItems(itemsRawStr, isNaN(amountRaw) ? 0 : amountRaw);
        const calcTotal = itemsList.reduce((sum, i) => sum + (i.price * i.qty), 0);

        parsedRecords.push({
            id: 'import_' + Date.now() + '_' + rIdx,
            rawRowIndex: rIdx + 1,
            personName: rawName,
            normalizedName: normalizeNameStrict(rawName),
            items: itemsList,
            totalAmount: isNaN(amountRaw) || amountRaw <= 0 ? calcTotal : amountRaw,
            status: isPaid ? 'paid' : 'unpaid',
            method: isBank ? 'bank' : 'cash',
            docStatus: isDocReceived ? 'received' : 'not_received',
            note: noteRawStr,
            duplicateType: 'none',
            matchedTx: null,
            matchedExcelIndices: [],
            action: 'add'
        });
    });

    if (parsedRecords.length === 0) {
        showToast('Không tìm thấy bản ghi người mua hợp lệ trong tệp Excel!', 'danger');
        return;
    }

    detectExcelDuplicates(parsedRecords);

    parsedExcelRecords = parsedRecords;

    importFileName.textContent = fileName;
    excelDropZone.classList.add('hidden');
    excelPreviewContainer.classList.remove('hidden');
    btnConfirmImport.disabled = false;

    activeImportFilter = 'all';
    renderImportPreviewTable();
}

function parseExcelItems(itemsStr, fallbackPrice) {
    if (!itemsStr) {
        const firstProd = productsCatalog[0] || { id: 'p1', name: 'Tài liệu bài giảng', price: fallbackPrice || 10000 };
        return [{
            id: firstProd.id,
            name: firstProd.name,
            price: fallbackPrice > 0 ? fallbackPrice : firstProd.price,
            qty: 1
        }];
    }

    const parts = itemsStr.split(/;|;|\n|\+|\,/g).map(s => s.trim()).filter(s => s.length > 0);
    const resultItems = [];

    parts.forEach(partStr => {
        let qty = 1;
        let cleanName = partStr;
        const qtyMatch = partStr.match(/[\(xX\s]*([0-9]+)[\)]*$/);
        if (qtyMatch && partStr.toLowerCase().includes('x')) {
            qty = parseInt(qtyMatch[1], 10) || 1;
            cleanName = partStr.replace(/[\(xX\s]*[0-9]+[\)]*$/, '').trim();
        }

        const normPart = normalizeNameStrict(cleanName);
        let catalogMatch = productsCatalog.find(p => {
            const pNorm = normalizeNameStrict(p.name);
            return pNorm === normPart || pNorm.includes(normPart) || normPart.includes(pNorm);
        });

        if (catalogMatch) {
            resultItems.push({
                id: catalogMatch.id,
                name: catalogMatch.name,
                price: catalogMatch.price,
                qty
            });
        } else {
            resultItems.push({
                id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name: cleanName || partStr,
                price: fallbackPrice > 0 && parts.length === 1 ? fallbackPrice : 10000,
                qty
            });
        }
    });

    return resultItems.length > 0 ? resultItems : [{
        id: 'p1',
        name: itemsStr,
        price: fallbackPrice > 0 ? fallbackPrice : 10000,
        qty: 1
    }];
}

function detectExcelDuplicates(records) {
    const nameMapInExcel = {};

    records.forEach((rec, idx) => {
        const norm = rec.normalizedName;

        const existingTx = transactions.find(t => normalizeNameStrict(t.personName) === norm);
        if (existingTx) {
            rec.duplicateType = 'system';
            rec.matchedTx = existingTx;
            rec.action = 'merge';
        }

        if (!nameMapInExcel[norm]) {
            nameMapInExcel[norm] = [idx];
        } else {
            nameMapInExcel[norm].push(idx);
        }
    });

    Object.keys(nameMapInExcel).forEach(norm => {
        const indices = nameMapInExcel[norm];
        if (indices.length > 1) {
            indices.forEach((recIdx, groupPos) => {
                const rec = records[recIdx];
                rec.matchedExcelIndices = indices.filter(i => i !== recIdx);

                if (rec.duplicateType === 'none') {
                    rec.duplicateType = 'excel';
                    rec.action = groupPos === 0 ? 'add' : 'merge';
                }
            });
        }
    });
}

function renderImportPreviewTable() {
    const totalCount = parsedExcelRecords.length;
    const dupCount = parsedExcelRecords.filter(r => r.duplicateType !== 'none').length;
    const uniqueCount = totalCount - dupCount;

    importTotalCount.textContent = `${totalCount} dòng dữ liệu`;
    importDuplicateCount.textContent = `${dupCount} dòng trùng tên`;
    importUniqueCount.textContent = `${uniqueCount} dòng hợp lệ`;

    countTabAll.textContent = totalCount;
    countTabDup.textContent = dupCount;
    countTabUnique.textContent = uniqueCount;

    let filteredList = parsedExcelRecords;
    if (activeImportFilter === 'dup') {
        filteredList = parsedExcelRecords.filter(r => r.duplicateType !== 'none');
    } else if (activeImportFilter === 'unique') {
        filteredList = parsedExcelRecords.filter(r => r.duplicateType === 'none');
    }

    importTableBody.innerHTML = '';

    if (filteredList.length === 0) {
        importTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">
                    Không có dòng dữ liệu nào theo bộ lọc đã chọn.
                </td>
            </tr>
        `;
        return;
    }

    filteredList.forEach((rec, displayIdx) => {
        const tr = document.createElement('tr');
        
        let rowClass = 'row-unique';
        if (rec.action === 'skip') {
            rowClass = 'row-skipped';
        } else if (rec.duplicateType !== 'none') {
            rowClass = 'row-duplicate';
        }
        tr.className = rowClass;

        const itemsStr = rec.items.map(i => `${i.name} (x${i.qty})`).join(', ');

        let dupTagHtml = `<span class="dup-tag dup-tag-ok"><i class="ri-checkbox-circle-line"></i> Hợp lệ (Tên mới)</span>`;
        let matchInfoHtml = '';

        if (rec.duplicateType === 'system') {
            const existingProds = rec.matchedTx.items.map(i => i.name).join(', ');
            dupTagHtml = `<span class="dup-tag dup-tag-system"><i class="ri-error-warning-line"></i> Trùng hệ thống</span>`;
            matchInfoHtml = `<div class="existing-match-info">Đã có bản ghi: <strong>${rec.matchedTx.personName}</strong> (${formatCurrency(rec.matchedTx.totalAmount)}) - Tài liệu: <em>${existingProds}</em></div>`;
        } else if (rec.duplicateType === 'excel') {
            dupTagHtml = `<span class="dup-tag dup-tag-excel"><i class="ri-alert-line"></i> Trùng trong Excel</span>`;
            matchInfoHtml = `<div class="existing-match-info">Xuất hiện ${rec.matchedExcelIndices.length + 1} lần trong tệp Excel này</div>`;
        }

        const docBadge = rec.docStatus === 'received' ? `<span class="badge badge-success">📦 Đã nhận</span>` : `<span class="badge badge-warning">⏳ Chưa nhận</span>`;
        const paidBadge = rec.status === 'paid' ? `<span class="badge badge-success">✅ Đã đóng</span>` : `<span class="badge badge-danger">⏳ Chưa đóng</span>`;
        const methodBadge = rec.method === 'bank' ? `<span class="badge badge-info">🏦 CK</span>` : `<span class="badge badge-info">💵 Tiền mặt</span>`;

        tr.innerHTML = `
            <td style="text-align: center; font-weight: bold;">${displayIdx + 1}</td>
            <td>
                <strong>${rec.personName}</strong>
                ${rec.note ? `<br><small style="color: var(--text-muted);"><i class="ri-file-text-line"></i> ${rec.note}</small>` : ''}
            </td>
            <td><small>${itemsStr}</small></td>
            <td><strong>${formatCurrency(rec.totalAmount)}</strong></td>
            <td>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    ${paidBadge}
                    ${docBadge}
                </div>
            </td>
            <td>
                ${dupTagHtml}
                ${matchInfoHtml}
            </td>
            <td>
                <select class="action-select" data-rec-id="${rec.id}">
                    <option value="merge" ${rec.action === 'merge' ? 'selected' : ''}>🔄 Gộp (Cộng dồn tài liệu)</option>
                    <option value="overwrite" ${rec.action === 'overwrite' ? 'selected' : ''}>✏️ Ghi đè thông tin cũ</option>
                    <option value="add" ${rec.action === 'add' ? 'selected' : ''}>➕ Thêm thành bản ghi mới</option>
                    <option value="skip" ${rec.action === 'skip' ? 'selected' : ''}>🚫 Bỏ qua dòng này</option>
                </select>
            </td>
        `;

        importTableBody.appendChild(tr);
    });

    document.querySelectorAll('.action-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const recId = e.target.getAttribute('data-rec-id');
            const newAction = e.target.value;
            const rec = parsedExcelRecords.find(r => r.id === recId);
            if (rec) {
                rec.action = newAction;
                renderImportPreviewTable();
            }
        });
    });
}

function downloadSampleExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Thư viện XLSX chưa tải xong, vui lòng thử lại sau giây lát!', 'danger');
        return;
    }

    const templateData = [
        ["STT", "Họ và tên", "Tài liệu đăng ký", "Số tiền (VNĐ)", "Trạng thái đóng tiền", "Hình thức thanh toán", "Trạng thái nhận tài liệu", "Ghi chú"],
        [1, "Nguyễn Văn An", "Tài liệu bài giảng \"Tâm lý học đại cương\"; Tài liệu Cấu trúc dữ liệu", 20000, "Đã đóng", "Chuyển khoản", "Đã nhận", "Đăng ký đợt 1"],
        [2, "Trần Thị Bình", "Sách Giáo trình \"Kinh tế Chính trị Mác-Lênin\"", 45000, "Chưa đóng", "Chuyển khoản", "Chưa nhận", "Hẹn tối CK"],
        [3, "Lê Hoàng Cường", "Tài liệu Giáo trình \"Tâm lý học đại cương\"", 25000, "Đã đóng", "Tiền mặt", "Đã nhận", "Đã thu tại lớp"],
        [4, "Nguyễn Văn An", "Sách Giáo trình \"Kinh tế Chính trị Mác-Lênin\"", 45000, "Đã đóng", "Chuyển khoản", "Chưa nhận", "Ví dụ trùng tên - Đăng ký thêm sách"],
        [5, "Phạm Quốc Bảo", "Tài liệu Cấu trúc dữ liệu", 11000, "Đã đóng", "Tiền mặt", "Đã nhận", "Học viên mới"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    ws['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 45 },
        { wch: 15 },
        { wch: 18 },
        { wch: 20 },
        { wch: 20 },
        { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Dang_Ky");
    
    XLSX.writeFile(wb, "Mau_Danh_Sach_Dang_Ky_Mua_Tai_Lieu.xlsx");
    showToast('Đã tải xuống tệp Excel mẫu standard!', 'success');
}

function confirmExcelImport() {
    if (parsedExcelRecords.length === 0) return;

    let addedCount = 0;
    let mergedCount = 0;
    let overwrittenCount = 0;
    let skippedCount = 0;

    parsedExcelRecords.forEach(rec => {
        if (rec.action === 'skip') {
            skippedCount++;
            return;
        }

        if (rec.action === 'merge') {
            let targetTx = transactions.find(t => normalizeNameStrict(t.personName) === rec.normalizedName);

            if (targetTx) {
                rec.items.forEach(newItem => {
                    const existingItem = targetTx.items.find(i => i.id === newItem.id || normalizeNameStrict(i.name) === normalizeNameStrict(newItem.name));
                    if (existingItem) {
                        existingItem.qty += newItem.qty;
                    } else {
                        targetTx.items.push({ ...newItem });
                    }
                });

                targetTx.totalAmount = targetTx.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
                
                if (rec.note) {
                    targetTx.note = targetTx.note ? `${targetTx.note} | Gộp Excel: ${rec.note}` : `Gộp Excel: ${rec.note}`;
                }

                mergedCount++;
            } else {
                addNewTransactionFromRecord(rec);
                addedCount++;
            }
        } else if (rec.action === 'overwrite') {
            let targetTxIdx = transactions.findIndex(t => normalizeNameStrict(t.personName) === rec.normalizedName);
            if (targetTxIdx !== -1) {
                transactions[targetTxIdx] = {
                    id: transactions[targetTxIdx].id,
                    personName: rec.personName,
                    items: rec.items,
                    totalAmount: rec.totalAmount,
                    docStatus: rec.docStatus,
                    status: rec.status,
                    method: rec.method,
                    note: rec.note ? `Ghi đè Excel: ${rec.note}` : transactions[targetTxIdx].note,
                    createdAt: new Date().toISOString()
                };
                overwrittenCount++;
            } else {
                addNewTransactionFromRecord(rec);
                addedCount++;
            }
        } else {
            addNewTransactionFromRecord(rec);
            addedCount++;
        }
    });

    saveTransactions();
    renderTransactionsTable();
    updateDashboardStats();
    updatePersonSuggestions();

    modalImportExcel.classList.add('hidden');
    resetExcelImportState();

    const summaryMsg = `Nhập thành công! (Thêm mới: ${addedCount}, Gộp: ${mergedCount}, Ghi đè: ${overwrittenCount}, Bỏ qua: ${skippedCount})`;
    showToast(summaryMsg, 'success');
}

function addNewTransactionFromRecord(rec) {
    const newTx = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        personName: rec.personName,
        items: rec.items,
        totalAmount: rec.totalAmount,
        docStatus: rec.docStatus,
        status: rec.status,
        method: rec.method,
        note: rec.note,
        createdAt: new Date().toISOString()
    };
    transactions.unshift(newTx);
}

function resetExcelImportState() {
    parsedExcelRecords = [];
    excelFileInput.value = '';
    excelDropZone.classList.remove('hidden');
    excelPreviewContainer.classList.add('hidden');
    btnConfirmImport.disabled = true;
}

