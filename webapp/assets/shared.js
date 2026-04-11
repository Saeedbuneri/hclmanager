/* ================================================================
   HCL Shared Utilities — Toast, Dark Mode, Shortcuts, Errors
   Include in every page BEFORE page-specific scripts
   ================================================================ */

// ── Toast Notification System ─────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
    if (!document.getElementById('toast-container')) {
        const c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
    }
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML =
        '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
        '<span class="toast-msg">' + message + '</span>' +
        '<button class="toast-close" onclick="this.parentElement.remove()">×</button>';
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    }, duration);
    return toast;
}

// ── Dark / Light Mode ─────────────────────────────────────────
function initDarkMode() {
    const saved = localStorage.getItem('hcl_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
}
function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('hcl_theme', next);
}

// ── Global Error Handler ──────────────────────────────────────
function initErrorHandling() {
    window.onerror = function(msg, src, line, col, err) {
        console.error('[HCL Error]', { msg, src, line, col });
        return false;
    };
    window.onunhandledrejection = function(event) {
        console.error('[HCL Unhandled Promise]', event.reason);
        if (event.reason && typeof event.reason.message === 'string') {
            showToast('An unexpected error occurred.', 'error');
        }
    };
}

// ── Keyboard Shortcuts ────────────────────────────────────────
function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            const map = {
                b: 'new_booking.html', r: 'pending_results.html',
                h: 'patient_history.html', m: 'dashboard.html',
                i: 'inventory.html'
            };
            if (map[e.key]) {
                e.preventDefault();
                // Only navigate if not in an input field
                if (!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
                    window.location.href = map[e.key];
                }
            }
        }
    });
}

// ── Enter-key form navigation (shared helper) ─────────────────
function initEnterNavigation() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
            const focusable = Array.from(
                document.querySelectorAll('input:not([type=hidden]), select, textarea')
            ).filter(el => !el.disabled && el.offsetParent !== null && !el.closest('.modal-overlay:not(.open)'));
            const idx = focusable.indexOf(document.activeElement);
            if (idx > -1 && idx + 1 < focusable.length) {
                e.preventDefault();
                focusable[idx + 1].focus();
            }
        }
    });
}

// ── Page Title Badge ──────────────────────────────────────────
function setTitleBadge(count, prefix) {
    document.title = count ? '(' + count + ') ' + (prefix || 'HCL') : (prefix || 'HCL Manager');
}

// ── Copy to Clipboard ─────────────────────────────────────────
function copyText(text, label) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast((label || text) + ' copied!', 'success', 2000));
    }
}

// ── FORMAT helpers ────────────────────────────────────────────
function fmtDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtCurrency(n) {
    return 'Rs ' + (parseFloat(n) || 0).toLocaleString();
}
function timeSince(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    return h < 1 ? 'Just now' : h < 24 ? h + 'h ago' : Math.floor(h / 24) + 'd ago';
}

// ── Init on DOM Ready ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    initDarkMode();
    initErrorHandling();
    initKeyboardShortcuts();
});
