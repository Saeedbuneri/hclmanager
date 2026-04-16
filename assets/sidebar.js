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
    { href: 'analytics.html',       label: 'Analytics',        icon: '📈', shortcut: '⌃A' }
];

function initSidebar(activePage) {
    // ── Ensure viewport meta is set ───────────────────────────────
    if (!document.querySelector('meta[name="viewport"]')) {
        const vp = document.createElement('meta');
        vp.name = 'viewport';
        vp.content = 'width=device-width, initial-scale=1, maximum-scale=1';
        document.head.appendChild(vp);
    }

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

    // ── Inject Hamburger + Overlay ────────────────────────────────
    if (!document.getElementById('hcl-hamburger')) {
        const hamburger = document.createElement('button');
        hamburger.id = 'hcl-hamburger';
        hamburger.className = 'hamburger';
        hamburger.setAttribute('aria-label', 'Open menu');
        hamburger.innerHTML = '☰';
        document.body.appendChild(hamburger);

        const overlay = document.createElement('div');
        overlay.id = 'hcl-overlay';
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);

        function openSidebar() {
            container.classList.add('open');
            overlay.classList.add('show');
            hamburger.innerHTML = '✕';
            hamburger.setAttribute('aria-label', 'Close menu');
        }
        function closeSidebar() {
            container.classList.remove('open');
            overlay.classList.remove('show');
            hamburger.innerHTML = '☰';
            hamburger.setAttribute('aria-label', 'Open menu');
        }

        hamburger.addEventListener('click', () => {
            container.classList.contains('open') ? closeSidebar() : openSidebar();
        });
        overlay.addEventListener('click', closeSidebar);

        // Close sidebar when a nav link is tapped
        container.addEventListener('click', e => {
            if (e.target.closest('a') && window.innerWidth <= 768) closeSidebar();
        });

        // Swipe-to-open: swipe right from left edge
        let touchStartX = 0;
        document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
        document.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (touchStartX < 30 && dx > 60) openSidebar();
            if (dx < -60 && container.classList.contains('open')) closeSidebar();
        }, { passive: true });
    }

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
