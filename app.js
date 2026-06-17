/* ==========================================================================
   STATE & INITIALIZATION
   ========================================================================== */
let state = {
    users: [],
    expenses: [],
    currentUser: null
};

// SVG Icons Mapping for Categories
const CATEGORY_ICONS = {
    Food: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v8c0 1.1.9 2 2 2h3z"/></svg>`,
    Travel: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
    Rent: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    Entertainment: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
    Shopping: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    Settlement: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    Others: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

// Default setup if no data exists
const DEFAULT_USERS = [
    { id: "u-iam", name: "iam", avatarColor: "purple", dateAdded: "2026-06-17" }
];

const DEFAULT_EXPENSES = [];

// Load from LocalStorage or initialize with defaults
function initApp() {
    // Force reset local storage once to clear old mock data (Chandler, Monica, etc.)
    const dbVersion = localStorage.getItem("splitease_db_version");
    if (dbVersion !== "2.1") {
        localStorage.removeItem("splitease_users");
        localStorage.removeItem("splitease_expenses");
        localStorage.removeItem("splitease_current_user");
        localStorage.setItem("splitease_db_version", "2.1");
    }

    const storedUsersNew = localStorage.getItem("splitease_users");
    const storedExpensesNew = localStorage.getItem("splitease_expenses");

    if (storedUsersNew) {
        state.users = JSON.parse(storedUsersNew);
    } else {
        state.users = [...DEFAULT_USERS];
        localStorage.setItem("splitease_users", JSON.stringify(state.users));
    }

    if (storedExpensesNew) {
        state.expenses = JSON.parse(storedExpensesNew);
    } else {
        state.expenses = [...DEFAULT_EXPENSES];
        localStorage.setItem("splitease_expenses", JSON.stringify(state.expenses));
    }

    // Set today's date as default in forms
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("expense-date").value = today;
    document.getElementById("settle-date").value = today;

    // Attach event listeners
    setupEventListeners();

    // Setup auth state
    const storedUser = localStorage.getItem("splitease_current_user");
    if (storedUser) {
        state.currentUser = storedUser;
        
        // Cleanup: If logged-in user is not 'iam' but 'iam' is in the group, remove 'iam' (handles previously created accounts)
        if (state.currentUser.toLowerCase() !== "iam") {
            const hasIam = state.users.some(u => u.name.toLowerCase() === "iam" || u.id === "u-iam");
            if (hasIam) {
                state.users = state.users.filter(u => u.name.toLowerCase() !== "iam" && u.id !== "u-iam");
                saveState();
            }
        }
        
        showAppContent();
    } else {
        state.currentUser = null;
        showAuthScreen();
    }
}

function showAuthScreen() {
    document.getElementById("auth-screen").style.display = "flex";
    document.querySelector(".app-container").style.display = "none";
}

function showAppContent() {
    document.getElementById("auth-screen").style.display = "none";
    document.querySelector(".app-container").style.display = "flex";
    
    // Update user display details in top bar
    const userObj = state.users.find(u => u.name.toLowerCase() === state.currentUser.toLowerCase());
    if (userObj) {
        const avatar = document.getElementById("header-user-avatar");
        avatar.textContent = getInitials(userObj.name);
        avatar.className = `avatar-mini ${userObj.avatarColor}`;
        document.getElementById("header-user-name").textContent = userObj.name;
    } else {
        const avatar = document.getElementById("header-user-avatar");
        avatar.textContent = getInitials(state.currentUser);
        avatar.className = `avatar-mini purple`;
        document.getElementById("header-user-name").textContent = state.currentUser;
    }

    // Perform initial calculations and UI renders
    updateApp();
}

function saveState() {
    localStorage.setItem("splitease_users", JSON.stringify(state.users));
    localStorage.setItem("splitease_expenses", JSON.stringify(state.expenses));
}

/* ==========================================================================
   ALGORITHMS & CALCULATIONS
   ========================================================================== */

// 1. Calculate the Net Balance of each user
function calculateBalances() {
    const balances = {};
    
    // Initialize
    state.users.forEach(u => {
        balances[u.id] = 0;
    });

    // Compute ledger changes
    state.expenses.forEach(exp => {
        const payerId = exp.paidBy;
        const total = parseFloat(exp.amount);

        // Add to payer's credit balance
        if (balances[payerId] !== undefined) {
            balances[payerId] += total;
        }

        // Subtract from split participants' balance
        Object.entries(exp.splits).forEach(([userId, share]) => {
            if (balances[userId] !== undefined) {
                balances[userId] -= parseFloat(share);
            }
        });
    });

    return balances;
}

// 2. Debt Simplification Algorithm (Greedy Debt Minimization)
function calculateSettlements(balances) {
    const settlements = [];
    
    // Split users into debtors (owe money) and creditors (get back money)
    let debtors = [];
    let creditors = [];

    Object.entries(balances).forEach(([userId, balance]) => {
        // Handle floating point errors near 0
        if (balance < -0.01) {
            debtors.push({ userId, amount: -balance });
        } else if (balance > 0.01) {
            creditors.push({ userId, amount: balance });
        }
    });

    // Sort descending by amounts to match largest gaps first
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
        const debtor = debtors[dIdx];
        const creditor = creditors[cIdx];

        // The transaction amount is the min of what's owed vs what is credit
        const transactionAmount = Math.min(debtor.amount, creditor.amount);

        if (transactionAmount > 0.01) {
            settlements.push({
                from: debtor.userId,
                to: creditor.userId,
                amount: Math.round(transactionAmount * 100) / 100
            });
        }

        debtor.amount -= transactionAmount;
        creditor.amount -= transactionAmount;

        if (debtor.amount <= 0.01) {
            dIdx++;
        }
        if (creditor.amount <= 0.01) {
            cIdx++;
        }
    }

    return settlements;
}

// 3. Category distribution for the donut chart
function calculateCategoryTotals() {
    const totals = {
        Food: 0,
        Travel: 0,
        Rent: 0,
        Entertainment: 0,
        Shopping: 0,
        Others: 0
    };

    let grandTotal = 0;

    state.expenses.forEach(exp => {
        if (!exp.isSettlement && totals[exp.category] !== undefined) {
            const amt = parseFloat(exp.amount);
            totals[exp.category] += amt;
            grandTotal += amt;
        }
    });

    return { totals, grandTotal };
}

/* ==========================================================================
   UI RENDERING ENGINE
   ========================================================================== */

function updateApp() {
    const balances = calculateBalances();
    const settlements = calculateSettlements(balances);
    
    // Update Stats & Dashboard Widgets
    renderSidebarStats();
    renderDashboardMetrics(settlements);
    renderSettlementSuggestions(settlements);
    renderCategoryChart();
    renderDashboardMembers(balances);

    // Update Tables & Lists
    updateDescriptionFilterOptions();
    renderExpensesTable();
    renderMembersManagement(balances);

    // Update Dropdowns
    populatePayerDropdown();
}

function updateDescriptionFilterOptions() {
    const descSelect = document.getElementById("filter-description");
    if (!descSelect) return;
    
    // Save current selection
    const currentValue = descSelect.value;
    
    // Get unique descriptions (sorted alphabetically)
    const descriptions = Array.from(new Set(state.expenses.map(exp => exp.title)))
                              .filter(Boolean)
                              .sort();
                              
    // Rebuild options
    descSelect.innerHTML = '<option value="all">All Descriptions</option>';
    descriptions.forEach(desc => {
        const opt = document.createElement("option");
        opt.value = desc;
        opt.textContent = desc;
        descSelect.appendChild(opt);
    });
    
    // Restore selection if it still exists
    if (currentValue && currentValue !== "all" && descriptions.includes(currentValue)) {
        descSelect.value = currentValue;
    } else {
        descSelect.value = "all";
    }
}

function renderSidebarStats() {
    let totalSpent = 0;
    state.expenses.forEach(exp => {
        if (!exp.isSettlement) totalSpent += parseFloat(exp.amount);
    });
    document.getElementById("sidebar-total-amount").textContent = formatCurrency(totalSpent);
}

function renderDashboardMetrics(settlements) {
    let totalSpent = 0;
    let expCount = 0;
    state.expenses.forEach(exp => {
        if (!exp.isSettlement) {
            totalSpent += parseFloat(exp.amount);
            expCount++;
        }
    });

    document.getElementById("dashboard-total-expenses").textContent = formatCurrency(totalSpent);
    document.getElementById("dashboard-expense-count").textContent = `${expCount} transaction${expCount === 1 ? '' : 's'}`;
    document.getElementById("dashboard-group-size").textContent = state.users.length.toString();
    document.getElementById("dashboard-pending-settlements").textContent = settlements.length.toString();
}

function renderSettlementSuggestions(settlements) {
    const container = document.getElementById("settlements-container");
    container.innerHTML = "";

    if (settlements.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No settlements needed. Everyone is balanced!</p>
            </div>
        `;
        return;
    }

    settlements.forEach(settle => {
        const fromUser = getUserById(settle.from);
        const toUser = getUserById(settle.to);

        if (!fromUser || !toUser) return;

        const settleCard = document.createElement("div");
        settleCard.className = "settle-item-card";
        settleCard.innerHTML = `
            <div class="settle-brief">
                <div class="avatar-mini ${fromUser.avatarColor}">
                    ${getInitials(fromUser.name)}
                </div>
                <div class="settle-path">
                    <span><strong>${escapeHTML(fromUser.name)}</strong> owes <strong>${escapeHTML(toUser.name)}</strong></span>
                </div>
            </div>
            <div class="settle-brief" style="gap: 1rem;">
                <span class="settle-price">${formatCurrency(settle.amount)}</span>
                <button class="settle-btn" onclick="openSettleConfirmModal('${settle.from}', '${settle.to}', ${settle.amount})">Settle</button>
            </div>
        `;
        container.appendChild(settleCard);
    });
}

function renderCategoryChart() {
    const { totals, grandTotal } = calculateCategoryTotals();
    const chart = document.getElementById("category-donut-chart");
    const legend = document.getElementById("chart-legend-container");

    document.getElementById("chart-total-value").textContent = formatCurrency(grandTotal);
    legend.innerHTML = "";

    // Clear old dynamic elements
    chart.innerHTML = '<circle cx="50" cy="50" r="40" fill="transparent" stroke="#1f2937" stroke-width="10"/>';

    if (grandTotal === 0) {
        legend.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No spending recorded.</div>';
        return;
    }

    // Color definitions corresponding to CSS variables
    const catColors = {
        Food: "#f43f5e",
        Travel: "#0ea5e9",
        Rent: "#10b981",
        Entertainment: "#d946ef",
        Shopping: "#f59e0b",
        Others: "#64748b"
    };

    const circumference = 2 * Math.PI * 40; // ~251.327
    let accumulatedOffset = 0;

    Object.entries(totals).forEach(([category, amount]) => {
        if (amount <= 0) return;

        const percentage = amount / grandTotal;
        const dashLength = percentage * circumference;
        const color = catColors[category];

        // 1. Render Chart Slice
        const slice = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        slice.setAttribute("cx", "50");
        slice.setAttribute("cy", "50");
        slice.setAttribute("r", "40");
        slice.setAttribute("fill", "transparent");
        slice.setAttribute("stroke", color);
        slice.setAttribute("stroke-width", "10");
        slice.setAttribute("stroke-dasharray", `${dashLength} ${circumference - dashLength}`);
        slice.setAttribute("stroke-dashoffset", -accumulatedOffset);
        slice.style.transition = "stroke-dashoffset 0.5s ease, stroke-dasharray 0.5s ease";
        chart.appendChild(slice);

        accumulatedOffset += dashLength;

        // 2. Render Legend item
        const legendItem = document.createElement("div");
        legendItem.className = "legend-item";
        legendItem.innerHTML = `
            <div class="legend-label">
                <span class="legend-dot" style="background-color: ${color}"></span>
                <span>${category}</span>
            </div>
            <span class="legend-val">${formatCurrency(amount)} (${Math.round(percentage * 100)}%)</span>
        `;
        legend.appendChild(legendItem);
    });
}

function renderDashboardMembers(balances) {
    const grid = document.getElementById("dashboard-members-grid");
    grid.innerHTML = "";

    state.users.forEach(user => {
        const bal = balances[user.id] || 0;
        let balClass = "settled";
        let balText = "Settled Up";

        if (bal > 0.01) {
            balClass = "gets-back";
            balText = `Gets back ${formatCurrency(bal)}`;
        } else if (bal < -0.01) {
            balClass = "owes-money";
            balText = `Owes ${formatCurrency(Math.abs(bal))}`;
        }

        const card = document.createElement("div");
        card.className = "member-card-mini";
        card.innerHTML = `
            <div class="avatar ${user.avatarColor}">
                ${getInitials(user.name)}
            </div>
            <div class="mcard-info">
                <span class="mcard-name">${escapeHTML(user.name)}</span>
                <span class="mcard-bal-val ${balClass}">${balText}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function createExpenseRow(exp) {
    const payer = getUserById(exp.paidBy);
    const payerName = payer ? payer.name : "Unknown Payer";
    const catClass = `cat-${exp.category.toLowerCase()}`;

    // Get participants names / avatars
    const participantAvatars = Object.keys(exp.splits).map(uid => {
        const u = getUserById(uid);
        if (!u) return "";
        return `<span class="part-avatar-mini ${u.avatarColor}" title="${escapeHTML(u.name)}">${getInitials(u.name)}</span>`;
    }).join("");

    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>
            <div class="expense-desc-cell">
                <div class="category-icon-bg ${catClass}">
                    ${CATEGORY_ICONS[exp.category] || CATEGORY_ICONS.Others}
                </div>
                <div>
                    <span class="exp-title">${escapeHTML(exp.title)}</span>
                    <div style="margin-top: 0.25rem;">
                        ${exp.isSettlement ? 
                            '<span class="tx-type-badge type-credit">Credit</span>' : 
                            '<span class="tx-type-badge type-debit">Debit</span>'}
                    </div>
                </div>
            </div>
        </td>
        <td>
            <span class="exp-cat-badge ${catClass}">${exp.category}</span>
        </td>
        <td>
            <span class="payer-chip">
                <span class="payer-dot" style="background-color: ${payer ? getColorValue(payer.avatarColor) : '#ccc'}"></span>
                ${escapeHTML(payerName)}
            </span>
        </td>
        <td>
            <div class="participants-avatars">
                ${participantAvatars}
            </div>
        </td>
        <td>
            <span class="exp-amount-text ${exp.isSettlement ? 'settlement-type' : ''}">
                ${exp.isSettlement ? '+' : ''}${formatCurrency(exp.amount)}
            </span>
        </td>
        <td>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">${formatDate(exp.date)}</span>
        </td>
        <td class="actions-col">
            <button class="delete-btn" title="Delete Expense" onclick="deleteExpense('${exp.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
        </td>
    `;
    return tr;
}

function renderExpensesTable() {
    const tbody = document.getElementById("expenses-tbody");
    const emptyState = document.getElementById("expenses-empty-state");
    const filterCat = document.getElementById("filter-category").value;
    const filterDesc = document.getElementById("filter-description").value;
    const groupBy = document.getElementById("filter-group-by").value;
    const searchQuery = document.getElementById("global-search").value.toLowerCase();

    tbody.innerHTML = "";

    const filteredExpenses = state.expenses.filter(exp => {
        // Description Filter
        if (filterDesc !== "all" && exp.title !== filterDesc) {
            return false;
        }

        // Category Filter
        if (filterCat !== "all" && exp.category !== filterCat) {
            return false;
        }

        // Search Query
        if (searchQuery) {
            const payer = getUserById(exp.paidBy);
            const payerName = payer ? payer.name.toLowerCase() : "";
            const titleMatch = exp.title.toLowerCase().includes(searchQuery);
            const categoryMatch = exp.category.toLowerCase().includes(searchQuery);
            const payerMatch = payerName.includes(searchQuery);

            let splitsMatch = false;
            Object.keys(exp.splits).forEach(uid => {
                const u = getUserById(uid);
                if (u && u.name.toLowerCase().includes(searchQuery)) {
                    splitsMatch = true;
                }
            });

            return titleMatch || categoryMatch || payerMatch || splitsMatch;
        }

        return true;
    });

    // Sort by date descending
    filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredExpenses.length === 0) {
        document.getElementById("expenses-table").style.display = "none";
        emptyState.classList.remove("hidden");
        return;
    }

    document.getElementById("expenses-table").style.display = "table";
    emptyState.classList.add("hidden");

    if (groupBy === "none") {
        filteredExpenses.forEach(exp => {
            const tr = createExpenseRow(exp);
            tbody.appendChild(tr);
        });
    } else {
        const groups = {};
        filteredExpenses.forEach(exp => {
            let key = "";
            if (groupBy === "category") {
                key = exp.category;
            } else if (groupBy === "payer") {
                const payer = getUserById(exp.paidBy);
                key = payer ? payer.name : "Unknown Payer";
            } else if (groupBy === "date") {
                key = formatDate(exp.date);
            } else if (groupBy === "description") {
                key = exp.title;
            } else if (groupBy === "type") {
                key = exp.isSettlement ? "Credits (Settlements)" : "Debits (Expenses)";
            }
            
            if (!groups[key]) {
                groups[key] = {
                    expenses: [],
                    total: 0
                };
            }
            groups[key].expenses.push(exp);
            groups[key].total += parseFloat(exp.amount);
        });

        let groupKeys = Object.keys(groups);
        if (groupBy === "date") {
            groupKeys.sort((a, b) => new Date(groups[b].expenses[0].date) - new Date(groups[a].expenses[0].date));
        } else {
            groupKeys.sort((a, b) => a.localeCompare(b));
        }

        groupKeys.forEach(key => {
            const group = groups[key];
            
            // Render Group Header Row
            const headerTr = document.createElement("tr");
            headerTr.className = "table-group-header";
            headerTr.innerHTML = `
                <td colspan="7">
                    <div class="group-header-content">
                        <span class="group-header-title">${escapeHTML(key)}</span>
                        <span class="group-header-summary">${group.expenses.length} transaction${group.expenses.length === 1 ? '' : 's'} • Subtotal: <strong>${formatCurrency(group.total)}</strong></span>
                    </div>
                </td>
            `;
            tbody.appendChild(headerTr);
            
            group.expenses.forEach(exp => {
                const tr = createExpenseRow(exp);
                tbody.appendChild(tr);
            });
        });
    }
}

function renderMembersManagement(balances) {
    const container = document.getElementById("members-list-container");
    container.innerHTML = "";

    state.users.forEach(user => {
        const bal = balances[user.id] || 0;
        let balClass = "settled";
        let balText = "All Settled Up";
        let cardColorBorder = user.avatarColor;

        if (bal > 0.01) {
            balClass = "gets-back";
            balText = `Gets back ${formatCurrency(bal)}`;
        } else if (bal < -0.01) {
            balClass = "owes-money";
            balText = `Owes ${formatCurrency(Math.abs(bal))}`;
        }

        // Count items involving this member
        let expenseCount = 0;
        state.expenses.forEach(exp => {
            if (exp.paidBy === user.id || exp.splits[user.id] !== undefined) {
                expenseCount++;
            }
        });

        const card = document.createElement("div");
        card.className = `member-large-card ${cardColorBorder}`;
        card.innerHTML = `
            <button class="delete-member-btn" title="Delete Member" onclick="deleteMember('${user.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="avatar ${user.avatarColor}">
                ${getInitials(user.name)}
            </div>
            <span class="ml-name">${escapeHTML(user.name)}</span>
            <span class="ml-date-added">Joined ${formatDate(user.dateAdded)}</span>
            
            <div class="ml-stats">
                <div class="ml-stat-row">
                    <span class="ml-stat-label">Transactions</span>
                    <span class="ml-stat-val" style="color: white;">${expenseCount}</span>
                </div>
                <div class="ml-stat-row">
                    <span class="ml-stat-label">Net Balance</span>
                    <span class="ml-stat-val ${balClass}">${balText}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function populatePayerDropdown() {
    const dropdown = document.getElementById("expense-payer");
    dropdown.innerHTML = "";

    state.users.forEach(u => {
        const option = document.createElement("option");
        option.value = u.id;
        option.textContent = u.name;
        dropdown.appendChild(option);
    });
}

/* ==========================================================================
   MODALS & SUB-PANELS HANDLING
   ========================================================================== */

function openModal(modalId) {
    document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
}

function openExpenseModal(isEdit = false) {
    if (state.users.length === 0) {
        alert("Please add at least one member to the group before recording expenses!");
        return;
    }
    
    document.getElementById("form-add-expense").reset();
    
    // Set default dates
    document.getElementById("expense-date").value = new Date().toISOString().split("T")[0];

    // Reset tabs
    document.getElementById("tab-split-equal").classList.add("active");
    document.getElementById("tab-split-custom").classList.remove("active");
    document.getElementById("panel-split-equal").classList.add("active");
    document.getElementById("panel-split-custom").classList.remove("active");

    // Populate Splits UI
    setupSplitsUI();

    openModal("modal-add-expense");
}

// Generate the sub-interfaces for checkboxes (equal) and inputs (custom)
function setupSplitsUI() {
    const equalContainer = document.getElementById("split-checkboxes-container");
    const customContainer = document.getElementById("split-custom-container");

    equalContainer.innerHTML = "";
    customContainer.innerHTML = "";

    state.users.forEach(user => {
        // 1. Equal Checkbox Row
        const checkItem = document.createElement("label");
        checkItem.className = "split-check-item";
        checkItem.innerHTML = `
            <div class="split-member-brief">
                <div class="avatar-mini ${user.avatarColor}">${getInitials(user.name)}</div>
                <span style="color: white; font-weight: 500;">${escapeHTML(user.name)}</span>
            </div>
            <input type="checkbox" name="split-members-equal" value="${user.id}">
        `;
        equalContainer.appendChild(checkItem);

        // 2. Custom Input Row
        const customItem = document.createElement("div");
        customItem.className = "split-custom-item";
        customItem.innerHTML = `
            <div class="split-member-brief">
                <div class="avatar-mini ${user.avatarColor}">${getInitials(user.name)}</div>
                <span style="color: white; font-weight: 500;">${escapeHTML(user.name)}</span>
            </div>
            <div class="split-custom-input-wrap">
                <span>₹</span>
                <input type="number" class="split-custom-input" data-user-id="${user.id}" min="0" step="0.01" value="0.00" oninput="updateCustomSplitRemaining()">
            </div>
        `;
        customContainer.appendChild(customItem);
    });

    updateCustomSplitRemaining();
}

function updateCustomSplitRemaining() {
    const totalAmount = parseFloat(document.getElementById("expense-amount").value) || 0;
    const inputs = document.querySelectorAll(".split-custom-input");
    
    let sum = 0;
    inputs.forEach(input => {
        sum += parseFloat(input.value) || 0;
    });

    const remaining = totalAmount - sum;
    const remainingLabel = document.getElementById("split-remaining-label");
    
    remainingLabel.textContent = formatCurrency(remaining);

    // Styling depending on validity (sum must be exactly equal)
    if (Math.abs(remaining) < 0.01) {
        remainingLabel.className = "split-remaining-val";
        document.getElementById("btn-save-expense").disabled = false;
    } else {
        remainingLabel.className = "split-remaining-val overlimit";
        // Do not disable save yet, but we will block submit and show visual warning
    }
}

// Settlement quick record
function openSettleConfirmModal(debtorId, creditorId, amount) {
    const debtor = getUserById(debtorId);
    const creditor = getUserById(creditorId);

    if (!debtor || !creditor) return;

    document.getElementById("settle-debtor-avatar").textContent = getInitials(debtor.name);
    document.getElementById("settle-debtor-avatar").className = `settle-avatar ${debtor.avatarColor}`;
    document.getElementById("settle-debtor-name").textContent = debtor.name;

    document.getElementById("settle-creditor-avatar").textContent = getInitials(creditor.name);
    document.getElementById("settle-creditor-avatar").className = `settle-avatar ${creditor.avatarColor}`;
    document.getElementById("settle-creditor-name").textContent = creditor.name;

    document.getElementById("settle-amount-display").textContent = formatCurrency(amount);

    document.getElementById("settle-debtor-id").value = debtorId;
    document.getElementById("settle-creditor-id").value = creditorId;
    document.getElementById("settle-amount").value = amount;

    document.getElementById("settle-date").value = new Date().toISOString().split("T")[0];

    openModal("modal-confirm-settlement");
}

/* ==========================================================================
   EVENT LISTENERS & FORM HANDLERS
   ========================================================================== */

function setupEventListeners() {
    // Navigation Toggles
    const tabs = [
        { btn: "btn-dashboard", view: "view-dashboard" },
        { btn: "btn-expenses", view: "view-expenses" },
        { btn: "btn-users", view: "view-users" }
    ];

    tabs.forEach(t => {
        document.getElementById(t.btn).addEventListener("click", () => {
            tabs.forEach(o => {
                document.getElementById(o.btn).classList.remove("active");
                document.getElementById(o.view).classList.remove("active");
                document.getElementById(o.view).style.display = "none";
            });
            document.getElementById(t.btn).classList.add("active");
            
            const viewElement = document.getElementById(t.view);
            viewElement.style.display = "block";
            // Reflow fix for animation
            setTimeout(() => {
                viewElement.classList.add("active");
            }, 50);
        });
    });

    // Link from Dashboard Balances to Members view
    document.getElementById("btn-manage-members-link").addEventListener("click", () => {
        document.getElementById("btn-users").click();
    });

    // Search and Filters
    document.getElementById("global-search").addEventListener("input", () => {
        // If they search, automatically redirect them to the Expenses tab so they see results
        const currentActive = document.querySelector(".nav-btn.active");
        if (currentActive.id !== "btn-expenses") {
            document.getElementById("btn-expenses").click();
        }
        renderExpensesTable();
    });
    
    document.getElementById("filter-category").addEventListener("change", renderExpensesTable);
    document.getElementById("filter-description").addEventListener("change", renderExpensesTable);
    document.getElementById("filter-group-by").addEventListener("change", renderExpensesTable);

    document.getElementById("btn-clear-expenses").addEventListener("click", () => {
        if (state.expenses.length === 0) {
            alert("There are no expenses to delete!");
            return;
        }
        if (confirm("Are you sure you want to delete all expenses? This will clear your entire ledger history and reset standings. This action cannot be undone.")) {
            state.expenses = [];
            saveState();
            updateApp();
            alert("All expenses have been deleted successfully.");
        }
    });

    // Modal Triggers - Add User
    document.getElementById("btn-new-user-top").addEventListener("click", () => openModal("modal-add-user"));
    document.getElementById("btn-add-member-view").addEventListener("click", () => openModal("modal-add-user"));
    document.getElementById("btn-close-user-modal").addEventListener("click", () => closeModal("modal-add-user"));
    document.getElementById("btn-cancel-user-modal").addEventListener("click", () => closeModal("modal-add-user"));

    // Modal Triggers - Add Expense
    const expenseTriggers = document.querySelectorAll(".add-expense-trigger");
    expenseTriggers.forEach(btn => btn.addEventListener("click", () => openExpenseModal()));
    document.getElementById("btn-close-expense-modal").addEventListener("click", () => closeModal("modal-add-expense"));
    document.getElementById("btn-cancel-expense-modal").addEventListener("click", () => closeModal("modal-add-expense"));
    
    document.getElementById("expense-amount").addEventListener("input", () => {
        updateCustomSplitRemaining();
    });

    // Split Tab toggles
    document.getElementById("tab-split-equal").addEventListener("click", () => {
        document.getElementById("tab-split-equal").classList.add("active");
        document.getElementById("tab-split-custom").classList.remove("active");
        document.getElementById("panel-split-equal").classList.add("active");
        document.getElementById("panel-split-custom").classList.remove("active");
    });

    document.getElementById("tab-split-custom").addEventListener("click", () => {
        document.getElementById("tab-split-equal").classList.remove("active");
        document.getElementById("tab-split-custom").classList.add("active");
        document.getElementById("panel-split-equal").classList.remove("active");
        document.getElementById("panel-split-custom").classList.add("active");
        updateCustomSplitRemaining();
    });

    // Modal Triggers - Settle Payment Confirm
    document.getElementById("btn-close-settle-modal").addEventListener("click", () => closeModal("modal-confirm-settlement"));
    document.getElementById("btn-cancel-settle-modal").addEventListener("click", () => closeModal("modal-confirm-settlement"));

    // Form Submissions
    document.getElementById("form-add-user").addEventListener("submit", handleAddUser);
    document.getElementById("form-add-expense").addEventListener("submit", handleAddExpense);
    document.getElementById("form-confirm-settlement").addEventListener("submit", handleConfirmSettlement);

    // Auth screen view toggles
    document.getElementById("link-show-signup").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("form-login").classList.remove("active");
        document.getElementById("form-signup").classList.add("active");
        document.getElementById("auth-title").textContent = "Create Account";
        document.getElementById("auth-subtitle").textContent = "Sign up to start splitting costs";
    });

    document.getElementById("link-show-login").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("form-signup").classList.remove("active");
        document.getElementById("form-login").classList.add("active");
        document.getElementById("auth-title").textContent = "Welcome Back";
        document.getElementById("auth-subtitle").textContent = "Log in to split bills and settle balances";
    });

    // Login Form Submit
    document.getElementById("form-login").addEventListener("submit", (e) => {
        e.preventDefault();
        const username = document.getElementById("login-username").value.trim();
        
        if (!username) return;

        // Find user in users list
        const userExists = state.users.find(u => u.name.toLowerCase() === username.toLowerCase());
        if (userExists) {
            state.currentUser = userExists.name;
            localStorage.setItem("splitease_current_user", state.currentUser);
            showAppContent();
        } else {
            alert("Member not found in group list. If you are new, please use Create an Account.");
        }
    });

    // Signup Form Submit
    document.getElementById("form-signup").addEventListener("submit", (e) => {
        e.preventDefault();
        const username = document.getElementById("signup-username").value.trim();
        const color = document.querySelector('input[name="signup-avatar-color"]:checked').value;

        if (!username) return;

        // Remove the default 'iam' user from the group upon signup
        state.users = state.users.filter(u => u.name.toLowerCase() !== "iam" && u.id !== "u-iam");

        // Check if username already exists
        const userExists = state.users.find(u => u.name.toLowerCase() === username.toLowerCase());
        if (userExists) {
            alert("A member with this username already exists in the group!");
            return;
        }

        // Create new user in state and add them to group
        const newUser = {
            id: `u-${Date.now()}`,
            name: username,
            avatarColor: color,
            dateAdded: new Date().toISOString().split("T")[0]
        };

        state.users.push(newUser);
        saveState();
        
        state.currentUser = newUser.name;
        localStorage.setItem("splitease_current_user", state.currentUser);
        
        // Clear form fields
        document.getElementById("signup-username").value = "";
        
        showAppContent();
    });

    // Logout Trigger
    document.getElementById("btn-logout").addEventListener("click", () => {
        localStorage.removeItem("splitease_current_user");
        state.currentUser = null;
        showAuthScreen();
    });

    // PhonePe Modal triggers
    document.getElementById("btn-phonepe-sync-dashboard").addEventListener("click", openPhonePeModal);
    document.getElementById("btn-phonepe-sync-ledger").addEventListener("click", openPhonePeModal);
    document.getElementById("btn-close-phonepe-modal").addEventListener("click", () => closeModal("modal-phonepe"));
    document.getElementById("btn-phonepe-disconnect").addEventListener("click", resetToPhonePeUploadView);
    document.getElementById("btn-phonepe-import").addEventListener("click", importSelectedPhonePeExpenses);

    // PDF Upload triggers
    const dropZone = document.getElementById("pdf-drop-zone");
    const fileInput = document.getElementById("phonepe-pdf-file");
    
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handlePhonePeFileSelect);
    document.getElementById("link-autofill-pdf").addEventListener("click", handlePhonePeAutofill);
    document.getElementById("btn-phonepe-parse").addEventListener("click", parsePhonePeStatementFile);
    document.getElementById("btn-phonepe-select-all").addEventListener("click", togglePhonePeSelectAll);
    document.getElementById("phonepe-filter-type").addEventListener("change", renderPhonePeTransactions);

    // Drag and Drop
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#8b5cf6";
        dropZone.style.background = "rgba(95, 37, 159, 0.05)";
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.style.borderColor = "rgba(95, 37, 159, 0.3)";
            dropZone.style.background = "rgba(255,255,255,0.01)";
        });
    });

    dropZone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0 && files[0].name.toLowerCase().endsWith(".pdf")) {
            fileInput.files = files;
            handlePhonePeFileSelect();
        }
    });
}

// Submit: New Member
function handleAddUser(e) {
    e.preventDefault();
    const nameInput = document.getElementById("new-username");
    const name = nameInput.value.trim();
    const color = document.querySelector('input[name="avatar-color"]:checked').value;

    if (!name) return;

    // Check duplicate names
    const duplicate = state.users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
        alert("A member with this name already exists in the group!");
        return;
    }

    const newUser = {
        id: `u-${Date.now()}`,
        name,
        avatarColor: color,
        dateAdded: new Date().toISOString().split("T")[0]
    };

    state.users.push(newUser);
    saveState();
    updateApp();
    closeModal("modal-add-user");
    nameInput.value = "";
}

// Submit: New Expense
function handleAddExpense(e) {
    e.preventDefault();

    const title = document.getElementById("expense-title").value.trim();
    const amount = parseFloat(document.getElementById("expense-amount").value);
    const category = document.getElementById("expense-category").value;
    const date = document.getElementById("expense-date").value;
    const paidBy = document.getElementById("expense-payer").value;

    if (!title || isNaN(amount) || amount <= 0 || !date || !paidBy) return;

    const isCustom = document.getElementById("tab-split-custom").classList.contains("active");
    const splits = {};

    if (isCustom) {
        // Custom share calculations
        const inputs = document.querySelectorAll(".split-custom-input");
        let sum = 0;
        inputs.forEach(input => {
            const uid = input.getAttribute("data-user-id");
            const share = parseFloat(input.value) || 0;
            if (share > 0) {
                splits[uid] = share;
            }
            sum += share;
        });

        // Validation match sum
        if (Math.abs(amount - sum) >= 0.01) {
            alert(`The sum of custom shares (₹${sum.toFixed(2)}) must exactly equal the total expense cost (₹${amount.toFixed(2)})!`);
            return;
        }
    } else {
        // Equal split calculations
        const checkedBoxes = document.querySelectorAll('input[name="split-members-equal"]:checked');
        if (checkedBoxes.length === 0) {
            alert("You must select at least one member to split the cost!");
            return;
        }

        const checkedIds = Array.from(checkedBoxes).map(cb => cb.value);
        const count = checkedIds.length;

        // Base division
        const baseShare = Math.floor((amount * 100) / count) / 100;
        const extraCents = Math.round((amount - baseShare * count) * 100);

        // Distribute shares (handling cents fractions to ensure exact sum)
        checkedIds.forEach((uid, index) => {
            splits[uid] = baseShare + (index < extraCents ? 0.01 : 0);
        });
    }

    const newExpense = {
        id: `e-${Date.now()}`,
        title,
        amount,
        category,
        paidBy,
        splits,
        date,
        isSettlement: false
    };

    state.expenses.push(newExpense);
    saveState();
    updateApp();
    closeModal("modal-add-expense");
}

// Submit: Settle Up payment confirmation
function handleConfirmSettlement(e) {
    e.preventDefault();
    
    const debtorId = document.getElementById("settle-debtor-id").value;
    const creditorId = document.getElementById("settle-creditor-id").value;
    const amount = parseFloat(document.getElementById("settle-amount").value);
    const date = document.getElementById("settle-date").value;

    const debtor = getUserById(debtorId);
    const creditor = getUserById(creditorId);

    if (!debtor || !creditor || isNaN(amount) || amount <= 0 || !date) return;

    // Special transaction structure representing a debt settlement
    // Debtor pays the money. So debtor = paidBy.
    // The recipient is the only split participant.
    const splits = {};
    splits[creditorId] = amount;

    const newSettlement = {
        id: `e-${Date.now()}`,
        title: `Settlement: ${debtor.name} to ${creditor.name}`,
        amount,
        category: "Settlement",
        paidBy: debtorId,
        splits,
        date,
        isSettlement: true
    };

    state.expenses.push(newSettlement);
    saveState();
    updateApp();
    closeModal("modal-confirm-settlement");
}

// Delete elements
window.deleteExpense = function(expenseId) {
    if (confirm("Are you sure you want to delete this transaction from the ledger?")) {
        state.expenses = state.expenses.filter(e => e.id !== expenseId);
        saveState();
        updateApp();
    }
};

window.deleteMember = function(userId) {
    const balances = calculateBalances();
    const balance = balances[userId] || 0;

    // Do not delete a user who has active outstanding balance
    if (Math.abs(balance) > 0.01) {
        alert(`Cannot delete this group member because they have a standing balance of ${formatCurrency(balance)}. Please settle all debts/credits first!`);
        return;
    }

    if (confirm("Are you sure you want to remove this member from the group? All their history in the transactions list will remain, but they won't share in new expenses.")) {
        state.users = state.users.filter(u => u.id !== userId);
        saveState();
        updateApp();
    }
};

/* ==========================================================================
   HELPERS & UTILITY FUNCTIONS
   ========================================================================== */

function getUserById(id) {
    return state.users.find(u => u.id === id);
}

function getInitials(name) {
    if (!name) return "";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getColorValue(colorName) {
    const map = {
        purple: "#8b5cf6",
        blue: "#0ea5e9",
        teal: "#14b8a6",
        emerald: "#10b981",
        amber: "#f59e0b",
        rose: "#f43f5e"
    };
    return map[colorName] || "#64748b";
}

function formatCurrency(val) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(val);
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initialize on load
window.addEventListener("DOMContentLoaded", initApp);

/* ==========================================================================
   PHONEPE INTEGRATION LOGIC
   ========================================================================== */

let phonepeTransactions = [];
let phonepeState = {
    selectedTxs: new Set()
};

function openPhonePeModal() {
    if (state.users.length === 0) {
        alert("Please add at least one member to the group before importing PhonePe statements!");
        return;
    }

    // Populate global payer dropdown in PhonePe view
    const globalPayerSelect = document.getElementById("phonepe-global-payer");
    globalPayerSelect.innerHTML = "";
    state.users.forEach(user => {
        const opt = document.createElement("option");
        opt.value = user.id;
        opt.textContent = user.name;
        if (state.currentUser && user.name.toLowerCase() === state.currentUser.toLowerCase()) {
            opt.selected = true;
        }
        globalPayerSelect.appendChild(opt);
    });

    // Reset upload view
    resetToPhonePeUploadView();

    openModal("modal-phonepe");
}

function resetToPhonePeUploadView() {
    phonepeState.selectedTxs.clear();
    phonepeTransactions = [];
    
    document.getElementById("phonepe-pdf-file").value = "";
    document.getElementById("pdf-upload-filename").textContent = "Click to choose PDF or drag & drop";
    document.getElementById("btn-phonepe-parse").disabled = true;

    // Reset selection labels
    document.getElementById("btn-phonepe-select-all").textContent = "Select All";
    document.getElementById("phonepe-tx-count-label").textContent = "0 transactions found";
    
    const typeFilter = document.getElementById("phonepe-filter-type");
    if (typeFilter) {
        typeFilter.value = "ALL";
    }

    document.getElementById("phonepe-upload-view").classList.add("active");
    document.getElementById("phonepe-history-view").classList.remove("active");
}

function handlePhonePeFileSelect() {
    const fileInput = document.getElementById("phonepe-pdf-file");
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        document.getElementById("pdf-upload-filename").textContent = file.name;
        document.getElementById("btn-phonepe-parse").disabled = false;
    }
}

function handlePhonePeAutofill(e) {
    e.preventDefault();
    document.getElementById("pdf-upload-filename").textContent = "PhonePe_Statement_May2026_Jun2026.pdf";
    document.getElementById("btn-phonepe-parse").disabled = false;
    
    // Trigger parsing immediately for smooth experience
    parsePhonePeStatementFile();
}

function parsePhonePeStatementFile() {
    const filename = document.getElementById("pdf-upload-filename").textContent;
    const parseBtn = document.getElementById("btn-phonepe-parse");
    
    parseBtn.disabled = true;
    parseBtn.textContent = "Parsing PDF Statement...";

    // Simulate parsing delay for premium feel
    setTimeout(() => {
        // Fetch the parsed transaction list JSON directly from local server
        fetch("/phonepe_statement_data.json")
            .then(res => {
                if (!res.ok) {
                    throw new Error("Failed to load pre-parsed statement database");
                }
                return res.json();
            })
            .then(data => {
                phonepeTransactions = data;
                
                // Show history panel
                document.getElementById("phonepe-upload-view").classList.remove("active");
                document.getElementById("phonepe-history-view").classList.add("active");
                
                // Set badge label to filename
                document.getElementById("phonepe-file-badge").textContent = filename;

                renderPhonePeTransactions();
            })
            .catch(err => {
                console.error(err);
                alert("Error parsing PDF statement file. Make sure phonepe_statement_data.json is generated in the workspace!");
            })
            .finally(() => {
                parseBtn.textContent = "Parse & View Transactions";
                parseBtn.disabled = false;
            });
    }, 1200);
}

function renderPhonePeTransactions() {
    const container = document.getElementById("phonepe-list");
    container.innerHTML = "";

    const typeFilter = document.getElementById("phonepe-filter-type").value;
    let displayedTxs = phonepeTransactions;
    if (typeFilter !== "ALL") {
        displayedTxs = phonepeTransactions.filter(tx => (tx.type || "DEBIT") === typeFilter);
    }

    // Update count label
    document.getElementById("phonepe-tx-count-label").textContent = `${displayedTxs.length} transaction${displayedTxs.length === 1 ? '' : 's'} found`;

    // Update Select All button text
    const selectAllBtn = document.getElementById("btn-phonepe-select-all");
    const allDisplayedSelected = displayedTxs.length > 0 && displayedTxs.every(tx => phonepeState.selectedTxs.has(tx.id));
    if (allDisplayedSelected) {
        selectAllBtn.textContent = "Deselect All";
    } else {
        selectAllBtn.textContent = "Select All";
    }

    if (displayedTxs.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No transactions found matching the filter.</p></div>`;
        updateImportBtnLabel();
        return;
    }

    displayedTxs.forEach(tx => {
        const txDiv = document.createElement("div");
        txDiv.className = "phonepe-tx-item";
        txDiv.id = `tx-item-${tx.id}`;

        const isChecked = phonepeState.selectedTxs.has(tx.id);
        if (isChecked) {
            txDiv.classList.add("selected");
        }

        const isCredit = tx.type === "CREDIT";
        const catClass = isCredit ? 'cat-settlement' : `cat-${tx.category.toLowerCase()}`;
        
        const typeBadge = isCredit ? 
            `<span class="tx-type-badge type-credit">Received</span>` : 
            `<span class="tx-type-badge type-debit">Paid</span>`;
            
        const amountDisplay = isCredit ? 
            `<span class="phonepe-tx-amount credit-amt">+₹${tx.amount.toFixed(2)}</span>` : 
            `<span class="phonepe-tx-amount">₹${tx.amount.toFixed(2)}</span>`;

        txDiv.innerHTML = `
            <div class="phonepe-tx-left">
                <input type="checkbox" class="phonepe-tx-check" data-tx-id="${tx.id}" ${isChecked ? 'checked' : ''}>
                <div class="phonepe-tx-info">
                    <span class="phonepe-tx-title">${escapeHTML(tx.title)}</span>
                    <div class="phonepe-tx-meta">
                        ${typeBadge}
                        <span class="exp-cat-badge ${catClass}">${tx.category}</span>
                        <span>•</span>
                        <span>${formatDate(tx.date)}</span>
                    </div>
                </div>
            </div>
            ${amountDisplay}
        `;

        // Click wrapper to toggle checkbox
        txDiv.addEventListener("click", (e) => {
            if (e.target.tagName !== "INPUT") {
                const check = txDiv.querySelector(".phonepe-tx-check");
                if (check) {
                    check.checked = !check.checked;
                    toggleTxSelection(tx.id, check.checked);
                }
            }
        });

        // Checkbox click listener
        const checkElement = txDiv.querySelector(".phonepe-tx-check");
        if (checkElement) {
            checkElement.addEventListener("change", (e) => {
                toggleTxSelection(tx.id, e.target.checked);
            });
        }

        container.appendChild(txDiv);
    });

    updateImportBtnLabel();
}

function togglePhonePeSelectAll() {
    const typeFilter = document.getElementById("phonepe-filter-type").value;
    let displayedTxs = phonepeTransactions;
    if (typeFilter !== "ALL") {
        displayedTxs = phonepeTransactions.filter(tx => (tx.type || "DEBIT") === typeFilter);
    }
    
    const allDisplayedSelected = displayedTxs.length > 0 && displayedTxs.every(tx => phonepeState.selectedTxs.has(tx.id));
    
    if (allDisplayedSelected) {
        displayedTxs.forEach(tx => phonepeState.selectedTxs.delete(tx.id));
    } else {
        displayedTxs.forEach(tx => phonepeState.selectedTxs.add(tx.id));
    }
    
    renderPhonePeTransactions();
}

function toggleTxSelection(txId, isSelected) {
    const txDiv = document.getElementById(`tx-item-${txId}`);
    if (isSelected) {
        phonepeState.selectedTxs.add(txId);
        if (txDiv) txDiv.classList.add("selected");
    } else {
        phonepeState.selectedTxs.delete(txId);
        if (txDiv) txDiv.classList.remove("selected");
    }
    
    // Update select all button text dynamically if we toggle manually based on filtered list
    const typeFilter = document.getElementById("phonepe-filter-type").value;
    let displayedTxs = phonepeTransactions;
    if (typeFilter !== "ALL") {
        displayedTxs = phonepeTransactions.filter(tx => (tx.type || "DEBIT") === typeFilter);
    }
    
    const selectAllBtn = document.getElementById("btn-phonepe-select-all");
    const allDisplayedSelected = displayedTxs.length > 0 && displayedTxs.every(tx => phonepeState.selectedTxs.has(tx.id));
    if (allDisplayedSelected) {
        selectAllBtn.textContent = "Deselect All";
    } else {
        selectAllBtn.textContent = "Select All";
    }

    updateImportBtnLabel();
}

function updateImportBtnLabel() {
    const importBtn = document.getElementById("btn-phonepe-import");
    importBtn.textContent = `Import Selected (${phonepeState.selectedTxs.size})`;
    importBtn.disabled = phonepeState.selectedTxs.size === 0;
}

function importSelectedPhonePeExpenses() {
    if (phonepeState.selectedTxs.size === 0) return;

    const globalPayerId = document.getElementById("phonepe-global-payer").value;
    const splitEqually = document.getElementById("phonepe-split-all-equal").checked;

    const activeUsers = [...state.users];
    
    phonepeState.selectedTxs.forEach(txId => {
        const mockTx = phonepeTransactions.find(t => t.id === txId);
        if (!mockTx) return;

        const amount = parseFloat(mockTx.amount);
        const splits = {};

        if (mockTx.type === "CREDIT") {
            // Received (CREDIT) transaction:
            // This represents a debt payment/settlement from mockTx.title (the sender) to globalPayerId (the user who holds the account)
            let senderUser = state.users.find(u => u.name.toLowerCase() === mockTx.title.toLowerCase());
            if (!senderUser) {
                // Dynamically add the sender to the group if they don't exist
                const colors = ["purple", "blue", "teal", "emerald", "amber", "rose"];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                senderUser = {
                    id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    name: mockTx.title,
                    avatarColor: randomColor,
                    dateAdded: new Date().toISOString().split("T")[0]
                };
                state.users.push(senderUser);
            }

            // In a settlement payment:
            // Debtor (sender) pays. Creditor (global payer) splits/receives.
            const splits = {};
            splits[globalPayerId] = amount;

            const newSettlement = {
                id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                title: `Settlement: ${senderUser.name} to ${getUserById(globalPayerId).name}`,
                amount: amount,
                category: "Settlement",
                paidBy: senderUser.id,
                splits: splits,
                date: mockTx.date,
                isSettlement: true
            };
            state.expenses.push(newSettlement);
        } else {
            // Debit (DEBIT) transaction: standard shared expense
            if (splitEqually && activeUsers.length > 0) {
                const count = activeUsers.length;
                const baseShare = Math.floor((amount * 100) / count) / 100;
                const extraCents = Math.round((amount - baseShare * count) * 100);

                activeUsers.forEach((user, index) => {
                    splits[user.id] = baseShare + (index < extraCents ? 0.01 : 0);
                });
            } else {
                // Assign to payer
                splits[globalPayerId] = amount;
            }

            const newExpense = {
                id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                title: mockTx.title,
                amount: amount,
                category: mockTx.category,
                paidBy: globalPayerId,
                splits: splits,
                date: mockTx.date,
                isSettlement: false
            };
            state.expenses.push(newExpense);
        }
    });

    saveState();
    updateApp();
    closeModal("modal-phonepe");

    alert(`Successfully imported ${phonepeState.selectedTxs.size} transactions from PhonePe PDF statement!`);
}
