/* ================================================================
   HCL Shared Sidebar Component
   Usage: <div id="sidebar-container"></div>
          <script>initSidebar('current_page.html')</script>
   ================================================================ */

const HCL_NAV = [
    { section: 'Main' },
    { href: 'dashboard.html',       label: 'Dashboard',       icon: '📊', shortcut: '⌃M' },
    { href: 'new_booking.html',     label: 'New Booking',      icon: '➕', shortcut: '⌃B' },
    { href: 'pending_results.html', label: 'Pending Results',  icon: '🔬', shortcut: '⌃R' },
    { section: 'Management' },
    { href: 'patient_history.html', label: 'Patient History',  icon: '📁', shortcut: '⌃H' },
    { href: 'test_manager.html',    label: 'Test Catalog',     icon: '📋' },
    { href: 'inventory.html',       label: 'Inventory',        icon: '🧪', shortcut: '⌃I' },
    { href: 'analytics.html',       label: 'Analytics',        icon: '📈' },
    { section: 'System' },
    { href: 'sync_manager.html',    label: 'Sync Manager',     icon: '☁️' },
    { href: 'admin_settings.html',  label: 'Admin Settings',   icon: '⚙️' },
];

function initSidebar(activePage) {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    const labName = localStorage.getItem('labName') || 'Healthcare Clinical Lab';

    let navHtml = '';
    HCL_NAV.forEach(item => {
        if (item.section) {
            navHtml += '<div class="sidebar-section">' + item.section + '</div>';
            return;
        }
        const isActive = activePage === item.href;
        navHtml += `<li>
            <a href="${item.href}" class="${isActive ? 'active' : ''}">
                <span class="nav-icon">${item.icon}</span>
                ${item.label}
                ${item.shortcut ? `<span class="nav-shortcut">${item.shortcut}</span>` : ''}
            </a>
        </li>`;
    });

    container.className = 'sidebar';
    container.innerHTML = `
        <div class="sidebar-logo">
            <div class="logo-icon">🏥</div>
            <div>
                <h2>HCL Manager</h2>
                <div class="lab-subtitle">${labName.split(',')[0]}</div>
            </div>
        </div>
        <ul id="sidebarNav">${navHtml}</ul>
        <div class="sidebar-footer">
            <div class="sync-status">
                <div class="sync-dot" id="sidebarSyncDot"></div>
                <span id="sidebarSyncLabel">Checking...</span>
            </div>
            <button class="theme-toggle" onclick="toggleDarkMode()">
                🌙 Dark Mode <div class="toggle-pill"></div>
            </button>
            <ul style="list-style:none;padding:0;margin:4px 0 0;">
                <li><a href="login.html?clear=1" style="display:flex;align-items:center;gap:10px;padding:9px 12px;color:#ef4444;text-decoration:none;font-size:13px;font-weight:600;border-radius:6px;transition:background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.12)'" onmouseout="this.style.background=''"><span>🚪</span> Logout</a></li>
            </ul>
        </div>`;

    // Start sync monitoring
    _updateSyncStatus();
    setInterval(_updateSyncStatus, 15000);
    window.addEventListener('online', _updateSyncStatus);
    window.addEventListener('offline', _updateSyncStatus);
}

async function _updateSyncStatus() {
    const dot   = document.getElementById('sidebarSyncDot');
    const label = document.getElementById('sidebarSyncLabel');
    if (!dot || !label) return;
    if (!navigator.onLine) {
        dot.className = 'sync-dot offline';
        label.textContent = 'Offline Mode';
    } else {
        dot.className = 'sync-dot';
        label.textContent = 'Online · Synced';
    }
}
