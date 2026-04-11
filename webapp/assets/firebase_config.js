import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where, orderBy, limit, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Exact Firebase configuration matching Desktop App
const firebaseConfig = {
    apiKey: "AIzaSyCNG8PPXxuV_BEXo9ydXpcnuFu8J3o897k",
    authDomain: "healthcare-33ed4.firebaseapp.com",
    projectId: "healthcare-33ed4",
    storageBucket: "healthcare-33ed4.firebasestorage.app",
    messagingSenderId: "1010321513051",
    appId: "1:1010321513051:web:1170990b0e440a895dbd7e",
    measurementId: "G-VSHB9YC5E2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Helper to generate unique numeric-looking IDs for offline/web consistency
const generateId = () => Math.floor(Math.random() * 90000) + 10000 + Date.now().toString().slice(-4);

// Polyfill window.api to perfectly mimic Desktop's IPC bridge and Cloud Schema
window.api = {
  login: async (creds) => {
    try {
        await signInWithEmailAndPassword(auth, creds.username === 'admin' ? 'admin@lab.local' : creds.username, creds.password);
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
  },

  getTests: async () => {
      // Pull test catalog directly from the new Firebase collection
      const snaps = await getDocs(collection(db, "tests_catalog"));
      let tests = [];
      snaps.forEach(docSnap => {
          let t = docSnap.data();
          // Fallback parsing just in case
          if (typeof t.parameters !== 'string') {
              t.parameters = JSON.stringify(t.parameters || []);
          }
          tests.push({
              id: t.id || docSnap.id,
              name: t.name,
              price: t.price,
              category: t.category,
              parameters: t.parameters
          });
      });
      return tests;
  },

  searchPatient: async (term) => {
      // Returns empty to allow creating new patient for webapp flows
      return [];
  },

  getPatientByPhone: async (phone) => {
      const q = query(collection(db, "reports"), where("contact", "==", phone), limit(1));
      const snaps = await getDocs(q);
      if(!snaps.empty) {
          const d = snaps.docs[0].data();
          return { id: snaps.docs[0].id, name: d.patient_name, phone: d.contact, age: d.age, gender: d.gender };
      }
      return null;
  },
  
  getPatientHistory: async (term) => {
      const snaps = await getDocs(collection(db, "reports"));
      let records = [];
      snaps.forEach(docSnap => {
          let p = docSnap.data();
          if (p.visits) {
              for (const [bId, v] of Object.entries(p.visits)) {
                  records.push({
                      id: bId,
                      patient_id: docSnap.id,
                      patient_name: p.patient_name,
                      contact: p.contact,
                      date: new Date(v.timestamp).toISOString(), // rough format
                      total_amount: v.total_amount,
                      status: v.status || 'Pending',
                      tests: Array.isArray(v.test_names) ? v.test_names.join(', ') : '',
                      completed: v.status === 'Completed' ? 1 : 0
                  });
              }
          }
      });
      return records.sort((a,b) => new Date(b.date) - new Date(a.date)).filter((x,i) => i < 50);
  },

  saveBookingWithRef: async (patientData, cartStr, totalAmount, discount, referredBy) => {
      const cart = JSON.parse(cartStr);
      const testNames = cart.map(c => c.name);
      const newPatientId = generateId().toString();
      const newBookingId = generateId().toString();
      
      let unitsAndRanges = {};
      cart.forEach(test => {
          if (test.parameters) {
              try {
                  const params = JSON.parse(test.parameters);
                  unitsAndRanges[test.name] = params.map(p => ({
                      name: p.name,
                      unit: p.unit,
                      normal_range: p.ref || ''
                  }));
              } catch(e) {}
          }
      });

      const strPin = "123456"; // Default PIN
      const visitData = {
          receipt_id: newBookingId,
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          timestamp: Date.now(),
          total_amount: totalAmount || 0,
          discount: discount || 0,
          status: 'Pending',
          test_names: testNames,
          units_and_ranges: unitsAndRanges,
          test_results: {},
          comments: ""
      };
      
      const payload = {
          patient_name: patientData.name || "",
          age: patientData.age ? patientData.age.toString() : "",
          gender: patientData.gender || "",
          password: strPin,
          contact: patientData.phone || "",
          [`visits.${newBookingId}`]: visitData
      };
      
      await setDoc(doc(db, "reports", newPatientId), payload, { merge: true });
      return newBookingId;
  },

  getPendingBookings: async () => {
      const snaps = await getDocs(collection(db, "reports"));
      let pending = [];
      snaps.forEach(docSnap => {
          let p = docSnap.data();
          if (p.visits) {
              for (const [bId, v] of Object.entries(p.visits)) {
                  if (v.status !== 'Completed') {
                      pending.push({
                          id: bId,
                          patient_id: docSnap.id,
                          patient_name: p.patient_name,
                          date: new Date(v.timestamp).toISOString(),
                          tests: Array.isArray(v.test_names) ? v.test_names.join(', ') : '',
                          cart: v.test_names.map((name, idx) => ({ 
                              id: idx+1, 
                              name: name,
                              parameters: JSON.stringify(v.units_and_ranges[name] ? v.units_and_ranges[name].map(u => ({name: u.name, ref: u.normal_range, unit: u.unit})) : [])
                          }))
                      });
                  }
              }
          }
      });
      return pending.sort((a,b) => new Date(b.date) - new Date(a.date));
  },

  completeResult: async (bookingId, testId, resultJson) => {
      // Find the document containing this booking ID
      const snaps = await getDocs(collection(db, "reports"));
      let targetDocId = null;
      let existingVisits = null;
      
      snaps.forEach(docSnap => {
          let visits = docSnap.data().visits;
          if (visits && visits[bookingId]) {
              targetDocId = docSnap.id;
              existingVisits = visits;
          }
      });

      if (!targetDocId) return false;

      let rData = JSON.parse(resultJson);
      let tRes = existingVisits[bookingId].test_results || {};
      
      // Update results
      Object.keys(rData).forEach(k => {
          if (k !== '_comment') tRes[k] = rData[k];
      });

      const payload = {
          [`visits.${bookingId}.test_results`]: tRes,
          [`visits.${bookingId}.comments`]: rData._comment || existingVisits[bookingId].comments,
          [`visits.${bookingId}.status`]: 'Completed'
      };

      await updateDoc(doc(db, "reports", targetDocId), payload);
      return true;
  },
  
  getBookingReport: async (bookingId) => {
      const snaps = await getDocs(collection(db, "reports"));
      let targetP = null;
      let targetV = null;
      
      snaps.forEach(docSnap => {
          let visits = docSnap.data().visits;
          if (visits && visits[bookingId]) {
              targetP = docSnap.data();
              targetV = visits[bookingId];
          }
      });
      
      if (!targetP) return null;
      
      let out = {
          patient: {
             name: targetP.patient_name,
             age: targetP.age,
             gender: targetP.gender,
             phone: targetP.contact
          },
          booking: {
             id: bookingId,
             date: targetV.date,
             referred_by: 'Self'
          },
          tests: []
      };

      if (targetV.test_names) {
          targetV.test_names.forEach(tName => {
             out.tests.push({
                 test_name: tName,
                 params_json: targetV.units_and_ranges[tName] ? JSON.stringify(targetV.units_and_ranges[tName].map(u => ({name: u.name, ref: u.normal_range, unit: u.unit}))) : "[]",
                 result_data: JSON.stringify(targetV.test_results)
             });
          });
      }
      return out;
  },

  openPrintWindow: (params) => {
      window.open('print_report.html?' + params, '_blank');
  },
  
  openReceiptWindow: (params) => {
      window.open('print_receipt.html?' + params, '_blank');
  },

  getReferralStats: async () => { return []; },
  getInventory: async () => { return []; },
  getAnalyticsData: async () => { return { revenue: 0, testCount: 0, pendingCount: 0, cashInHand: 0, topTests: [], referrals: [] }; },
  getRepeatPatientRate: async () => { return 0; },
  getTestPopularityHeatmap: async () => { return []; },
  getDues: async () => { return []; },
  recordPayment: async () => { return true; },
  getMonthlySummary: async () => { return { total: 0, tests: 0 }; },
  getLowStockItems: async () => { return []; },
  saveInventoryItem: async () => { return true; },
  adjustInventoryStock: async () => { return true; },
  deleteInventoryItem: async () => { return true; },
  getManualSyncDetails: async () => { return null; },
  updateManualSyncDetails: async () => { return true; },
  revertBooking: async () => { return true; },
  deleteBooking: async () => { return true; }
};