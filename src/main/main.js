const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db/sqlite');
const firebaseSync = require('./services/firebase_sync');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/pages/login.html'));
    
}

app.whenReady().then(() => {
  try {
    db.init(); 
    firebaseSync.startSyncInterval();
  } catch (e) {
    console.log("Database or sync init error:", e.message); // Handle before install
  }
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('login', async (event, credentials) => {
    let un = credentials.username.trim();
    if (!un.includes('@')) un += '@lab.local';

    if(un === 'hcl@lab.local' && credentials.password === 'hcl123') {
        return { success: true, role: 'admin' };
    }
    return { success: false, message: 'Invalid credentials.' };
});

ipcMain.handle('getTests', async () => { return db.getTests(); });
ipcMain.handle('addTest', async (event, name, price, parameters, category) => { 
    try {
        const res = await db.addTest(name, price, parameters, category); 
        firebaseSync.syncTestCatalog(); // Fire and forget
        return res;
    } catch(e) { throw e; }
});
ipcMain.handle('updateTest', async (event, id, name, price, parameters, category) => { 
    try {
        const res = await db.updateTest(id, name, price, parameters, category); 
        firebaseSync.syncTestCatalog(); // Fire and forget
        return res;
    } catch(e) { throw e; }
});
ipcMain.handle('saveBooking', async (event, patient, tests, total, discount) => { return db.saveBooking(patient, tests, total, discount); });
ipcMain.handle('getPatientByPhone', async (ev, phone) => { return db.getPatientByPhone(phone); });
  ipcMain.handle('getPatientHistory', async (event, term) => { return db.getPatientHistory(term); });
ipcMain.handle('getPendingBookings', async () => { return db.getPendingBookings(); });
ipcMain.handle('getBookingReport', async (event, id) => { return db.getBookingReport(id); });
ipcMain.handle('getAnalyticsData', async (event, filter) => { return db.getAnalyticsData(filter); });
ipcMain.handle('completeResult', async (event, id, test_id, data) => { return db.completeResult(id, test_id, data); });
ipcMain.handle('savePdf', async (event, filename, folderName = 'HCL_Reports', options = null) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);
        const pdfOpt = options ? Object.assign({ printBackground: true }, options) : { pageSize: 'A4', printBackground: true };
        const data = await win.webContents.printToPDF(pdfOpt);
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(require('os').homedir(), 'Desktop', folderName);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filepath = path.join(dir, filename + '.pdf');
        fs.writeFileSync(filepath, data);
        return { success: true, filepath };
    } catch(e) {
        console.error(e);
        return { success: false };
    }
});






ipcMain.on('open-print-window', (event, params) => {
  const printWin = new BrowserWindow({
    width: 800,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  printWin.setMenu(null);
  printWin.loadFile(path.join(__dirname, '../renderer/pages/print_report.html'), { search: params });
});


ipcMain.on('open-receipt-window', (event, params) => {
  const receiptWin = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  receiptWin.setMenu(null);
  receiptWin.loadFile(path.join(__dirname, '../renderer/pages/print_receipt.html'), { search: params });
});

ipcMain.handle('getManualSyncDetails', async (event, patientId) => {
  return await firebaseSync.fetchManualSyncDetails(patientId);
});

ipcMain.handle('updateManualSyncDetails', async (event, patientId, updates) => {
  return await firebaseSync.updateManualSyncDetails(patientId, updates);
});

ipcMain.handle('deleteBooking', async (event, id) => {
  const result = await db.deleteBooking(id);
  if (result.success && result.patient_id) {
    await firebaseSync.deleteBookingFromCloud(result.patient_id, id);
  }
  return result;
});

ipcMain.handle('deletePatient', async (event, patientId) => {
  const result = await db.deletePatient(patientId);
  if (result.success) {
    await firebaseSync.deletePatientFromCloud(patientId);
  }
  return result;
});

ipcMain.handle('deleteTest', async (event, id) => {
  const result = await db.deleteTest(id);
  if (result.success) {
    await firebaseSync.deleteTestFromCloud(id);
  }
  return result;
});

ipcMain.handle('revertBooking', async (event, id) => {
  return await db.revertBooking(id);
});

ipcMain.handle('forceFullSync', async () => {
  return await firebaseSync.forceFullSync();
});

// ── Inventory ──────────────────────────────────────────────────
ipcMain.handle('getInventory', async () => db.getInventory());
ipcMain.handle('saveInventoryItem', async (ev, item) => db.saveInventoryItem(item));
ipcMain.handle('deleteInventoryItem', async (ev, id) => db.deleteInventoryItem(id));
ipcMain.handle('adjustInventoryStock', async (ev, id, qty) => db.adjustInventoryStock(id, qty));
ipcMain.handle('getLowStockItems', async () => db.getLowStockItems());

// ── Dues / Payments (legacy from bookings) ────────────────────
ipcMain.handle('getDues', async () => db.getDues());
ipcMain.handle('recordPayment', async (ev, booking_id, amount) => db.recordPayment(booking_id, amount));

// ── Patient Dues Ledger ─────────────────────────────────────────
ipcMain.handle('getPatientDues', async (ev, patientId) => db.getPatientDues(patientId || null));
ipcMain.handle('getPatientDuesSummary', async () => db.getPatientDuesSummary());
ipcMain.handle('addPatientDue', async (ev, data) => db.addPatientDue(data));
ipcMain.handle('payPatientDue', async (ev, due_id, amount) => db.payPatientDue(due_id, amount));
ipcMain.handle('deletePatientDue', async (ev, due_id) => db.deletePatientDue(due_id));

// ── Sync Log ───────────────────────────────────────────────────
ipcMain.handle('getSyncLog', async () => db.getSyncLog());
ipcMain.handle('clearSyncLog', async () => db.clearSyncLog());

// ── Extended Analytics ─────────────────────────────────────────
ipcMain.handle('getReferralStats', async (ev, filter) => db.getReferralStats(filter));
ipcMain.handle('getRepeatPatientRate', async (ev, filter) => db.getRepeatPatientRate(filter));
ipcMain.handle('getTestPopularityHeatmap', async (ev, days) => db.getTestPopularityHeatmap(days));
ipcMain.handle('getMonthlySummary', async (ev, year, month) => db.getMonthlySummary(year, month));

// ── Notes & Tasks ──────────────────────────────────────────────
ipcMain.handle('getNotes', async (ev, typeFilter) => db.getNotes(typeFilter));
ipcMain.handle('saveNote', async (ev, note) => db.saveNote(note));
ipcMain.handle('deleteNote', async (ev, id) => {
    const result = await db.deleteNote(id);
    if (result.success) {
      await firebaseSync.deleteNoteFromCloud(id);
    }
    return result;
});
ipcMain.handle('toggleNoteDone', async (ev, id, isDone) => db.toggleNoteDone(id, isDone));

// ── Database Backup ────────────────────────────────────────────
ipcMain.handle('backupDatabase', async () => {
  try {
    const fs = require('fs');
    const src = require('path').join(app.getPath('userData'), 'hcl_local.sqlite');
    const dir = require('path').join(require('os').homedir(), 'Desktop', 'HCL_Backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dst = require('path').join(dir, 'hcl_backup_' + ts + '.sqlite');
    fs.copyFileSync(src, dst);
    return { success: true, path: dst };
  } catch(e) { return { success: false, error: e.message }; }
});

// ── Updated saveBooking with referred_by ───────────────────────
ipcMain.handle('saveBookingWithRef', async (ev, patient, tests, total, discount, referred_by) => {
  // Pass referred_by via patient object extension
  patient.referred_by = referred_by || '';
  return db.saveBooking(patient, tests, total, discount);
});
