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
        return;
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

        // Click on checkbox
        const checkbox = row.querySelector('.custom-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedFormProducts[prod.id] = 1;
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
    const statusVal = filterStatus.value;
    const methodVal = filterMethod.value;

    const filtered = transactions.filter(tx => {
        const matchName = tx.personName.toLowerCase().includes(searchTerm);
        const matchItem = tx.items.some(i => i.name.toLowerCase().includes(searchTerm));
        const matchSearch = matchName || matchItem;

        const matchStatus = (statusVal === 'all') || (tx.status === statusVal);
        const matchMethod = (methodVal === 'all') || (tx.method === methodVal);

        return matchSearch && matchStatus && matchMethod;
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
            revenue: 0
        };
    });

    // Calculate from transactions
    transactions.forEach(tx => {
        tx.items.forEach(item => {
            if (!statsMap[item.id]) {
                statsMap[item.id] = {
                    name: item.name,
                    price: item.price || 0,
                    totalQty: 0,
                    paidQty: 0,
                    unpaidQty: 0,
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
            <div class="prod-stat-title">${stat.name}</div>
            <div class="prod-stat-count">
                <span class="prod-stat-qty">${stat.totalQty} <small style="font-size:12px; font-weight:500;">bản</small></span>
                <span style="font-weight:700; color:var(--primary); font-size:13px;">${formatCurrency(stat.revenue)}</span>
            </div>
            <div class="prod-stat-sub">
                <span class="text-success">✅ Đã thu: ${stat.paidQty}</span> | 
                <span class="text-danger">⏳ Nợ: ${stat.unpaidQty}</span>
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

    // Export CSV
    btnExportCSV.addEventListener('click', exportToCSV);

    // Receipt Modal Close
    btnCloseReceiptModal.addEventListener('click', () => {
        modalReceipt.classList.add('hidden');
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
        showToast(`Đã đổi trạng thái cho ${tx.personName} sang: ${tx.status === 'paid' ? 'Đã đóng tiền' : 'Chưa đóng tiền'}`, 'info');
    }
};

window.startEditTransaction = function(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    editTransactionIdInput.value = tx.id;
    personNameInput.value = tx.personName;
    document.getElementById('transactionNote').value = tx.note || '';

    // Set radios
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

    receiptPrintArea.innerHTML = `
        <div style="font-family:sans-serif; color:#1e293b; line-height:1.6;">
            <div style="text-align:center; margin-bottom:20px; border-bottom:2px dashed #059669; padding-bottom:12px;">
                <h2 style="color:#059669; margin-bottom:4px;">PHIẾU THU TIỀN SẢN PHẨM</h2>
                <p style="font-size:13px; color:#64748b;">Mã phiếu: <strong>${tx.id}</strong> | Ngày: ${formatDate(tx.createdAt)}</p>
            </div>
            <div style="margin-bottom:16px;">
                <p><strong>Người nộp / Mua hàng:</strong> ${tx.personName}</p>
                <p><strong>Trạng thái:</strong> ${tx.status === 'paid' ? '✅ Đã đóng tiền' : '⏳ Chưa đóng tiền'}</p>
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
// 11. EXPORT EXCEL/CSV (WITH UTF-8 BOM)
// ==========================================
function exportToCSV() {
    if (transactions.length === 0) {
        showToast('Không có dữ liệu để xuất file!', 'danger');
        return;
    }

    let csv = '\uFEFF'; // BOM UTF-8 for Excel Vietnamese text
    csv += 'Mã Giao Dịch,Tên Người,Sản Phẩm Mua,Tổng Tiền (VNĐ),Trạng Thái,Hình Thức,Ghi Chú,Ngày Tạo\n';

    transactions.forEach(tx => {
        const prodList = tx.items.map(i => `${i.name} (x${i.qty})`).join('; ');
        const statusTxt = tx.status === 'paid' ? 'Đã đóng' : 'Chưa đóng';
        const methodTxt = tx.method === 'bank' ? 'Chuyển khoản' : 'Tiền mặt';
        const cleanNote = (tx.note || '').replace(/"/g, '""');

        csv += `"${tx.id}","${tx.personName}","${prodList}","${tx.totalAmount}","${statusTxt}","${methodTxt}","${cleanNote}","${formatDate(tx.createdAt)}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_Thu_Chi_DH25TIN03_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Đã xuất file CSV thành công!', 'success');
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
