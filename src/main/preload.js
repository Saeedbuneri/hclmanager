const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'api', {
      login: (credentials) => ipcRenderer.invoke('login', credentials),
      getTests: () => ipcRenderer.invoke('getTests'),
      addTest: (name, price, parameters, category) => ipcRenderer.invoke('addTest', name, price, parameters, category),
      updateTest: (id, name, price, parameters, category) => ipcRenderer.invoke('updateTest', id, name, price, parameters, category),
      saveBooking: (patient, tests, total, discount) => ipcRenderer.invoke('saveBooking', patient, tests, total, discount),
      getPatientByPhone: (phone) => ipcRenderer.invoke('getPatientByPhone', phone),
      getPatientHistory: (searchTerm) => ipcRenderer.invoke('getPatientHistory', searchTerm),
      getPendingBookings: () => ipcRenderer.invoke('getPendingBookings'),
      getBookingReport: (id) => ipcRenderer.invoke('getBookingReport', id),
      getAnalyticsData: (filterType) => ipcRenderer.invoke('getAnalyticsData', filterType),
      completeResult: (booking_id, test_id, data) => ipcRenderer.invoke('completeResult', booking_id, test_id, data),
      savePdf: (filename, folderName) => ipcRenderer.invoke('savePdf', filename, folderName),
      openPrintWindow: (params) => ipcRenderer.send('open-print-window', params),
      openReceiptWindow: (params) => ipcRenderer.send('open-receipt-window', params),
      getManualSyncDetails: (patientId) => ipcRenderer.invoke('getManualSyncDetails', patientId),
      updateManualSyncDetails: (patientId, updates) => ipcRenderer.invoke('updateManualSyncDetails', patientId, updates),
      deleteBooking: (id) => ipcRenderer.invoke('deleteBooking', id),
      revertBooking: (id) => ipcRenderer.invoke('revertBooking', id),
      forceFullSync: () => ipcRenderer.invoke('forceFullSync'),
      // Inventory
      getInventory: () => ipcRenderer.invoke('getInventory'),
      saveInventoryItem: (item) => ipcRenderer.invoke('saveInventoryItem', item),
      deleteInventoryItem: (id) => ipcRenderer.invoke('deleteInventoryItem', id),
      adjustInventoryStock: (id, qty) => ipcRenderer.invoke('adjustInventoryStock', id, qty),
      getLowStockItems: () => ipcRenderer.invoke('getLowStockItems'),
      // Dues / Payments
      getDues: () => ipcRenderer.invoke('getDues'),
      recordPayment: (booking_id, amount) => ipcRenderer.invoke('recordPayment', booking_id, amount),
      // Sync Log
      getSyncLog: () => ipcRenderer.invoke('getSyncLog'),
      clearSyncLog: () => ipcRenderer.invoke('clearSyncLog'),        deletePatient: (id) => ipcRenderer.invoke('deletePatient', id),
        deleteTest: (id) => ipcRenderer.invoke('deleteTest', id),
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),      // Extended Analytics
      getReferralStats: (filter) => ipcRenderer.invoke('getReferralStats', filter),
      getRepeatPatientRate: (filter) => ipcRenderer.invoke('getRepeatPatientRate', filter),
      getTestPopularityHeatmap: (days) => ipcRenderer.invoke('getTestPopularityHeatmap', days),
      getMonthlySummary: (year, month) => ipcRenderer.invoke('getMonthlySummary', year, month),
      // DB Backup
      backupDatabase: () => ipcRenderer.invoke('backupDatabase'),
      // Booking with referral
      saveBookingWithRef: (patient, tests, total, discount, referred_by) => ipcRenderer.invoke('saveBookingWithRef', patient, tests, total, discount, referred_by),
      // Notes & Tasks
      getNotes: (typeFilter) => ipcRenderer.invoke('getNotes', typeFilter),
      saveNote: (note) => ipcRenderer.invoke('saveNote', note),
      deleteNote: (id) => ipcRenderer.invoke('deleteNote', id),
      toggleNoteDone: (id, isDone) => ipcRenderer.invoke('toggleNoteDone', id, isDone)
  }
);
