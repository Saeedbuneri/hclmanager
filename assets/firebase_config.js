import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where, orderBy, limit, getDoc, serverTimestamp, deleteDoc, deleteField, enableMultiTabIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// Enable Offline Persistence for slow networks
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Persistence failed: Multiple tabs open");
    } else if (err.code == 'unimplemented') {
        console.warn("Persistence failed: Browser doesn't support it");
    }
});

const auth = getAuth(app);

// Helper to generate unique numeric-looking IDs for offline/web consistency
const generateId = () => Math.floor(Math.random() * 90000) + 10000 + Date.now().toString().slice(-4);

const ensureAuth = () => {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async user => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                if (localStorage.getItem('isLoggedIn') === 'true') {
                    try {
                        const creds = await signInWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123');
                        resolve(creds.user);
                    } catch(e) {
                         localStorage.removeItem('isLoggedIn');
                         window.location.href = 'login.html';
                         reject(e);
                    }
                } else {
                    localStorage.removeItem('isLoggedIn');
                    if(!window.location.pathname.includes('login.html')) {
                        window.location.href = 'login.html';
                    }
                    reject(new Error("User not authenticated"));
                }
            }
        }, reject);
    });
};

// Polyfill window.api to perfectly mimic Desktop's IPC bridge and Cloud Schema
window.api = {
  login: async (creds) => {
    try {
        let un = creds.username.trim();
        if (!un.includes('@')) un += '@lab.local';
        await signInWithEmailAndPassword(auth, un, creds.password);
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
  },

  getTests: async () => {
      await ensureAuth();
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
      await ensureAuth();
      const q = query(collection(db, "reports"), where("contact", "==", phone), limit(1));
      const snaps = await getDocs(q);
      if(!snaps.empty) {
          const d = snaps.docs[0].data();
          return { id: snaps.docs[0].id, name: d.patient_name, phone: d.contact, age: d.age, gender: d.gender };
      }
      return null;
  },
  
  getPatientHistory: async (term) => {
      await ensureAuth();
      const snaps = await getDocs(collection(db, "reports"));
      let records = [];
      snaps.forEach(docSnap => {
          let p = docSnap.data();
          if (!p.visits) p.visits = {};
          
          // Re-map literal string keys from the old sync bug into the proper visits object
          Object.keys(p).forEach(k => {
              if (k.startsWith('visits.')) {
                  const bId = k.substring(7); // remove 'visits.'
                  p.visits[bId] = p[k];
              }
          });

          if (Object.keys(p.visits).length > 0) {
              for (const [bId, v] of Object.entries(p.visits)) {
                  let testsArr = [];
                  if (v.test_names) {
                      testsArr = v.test_names.map((tName, idx) => {
                          let params = v.units_and_ranges && v.units_and_ranges[tName] ? v.units_and_ranges[tName] : [];
                          let completed = 0;
                          let pDataObj = {};
                          let hasData = false;
                          
                          params.forEach(param => {
                              if (v.test_results && v.test_results[param.name] !== undefined) {
                                  pDataObj[param.name] = v.test_results[param.name];
                                  hasData = true;
                              }
                          });
                          
                          if (hasData) completed = 1;

                          return {
                              test_id: idx + 1,
                              test_name: tName,
                              completed: completed,
                              parameters: JSON.stringify(params.map(u => ({name: u.name, ref: u.normal_range, unit: u.unit, type: u.type}))),
                              parameter_data: hasData ? JSON.stringify(pDataObj) : null
                          };
                      });
                  }

                  records.push({
                      id: bId,
                      patient_id: docSnap.id,
                      patient_name: p.patient_name || 'Unknown',
                      contact: p.contact || '',
                      // PIN is stored at patient doc root as 'password', NOT inside the visit
                      pin: p.password || '123456',
                      date: v.timestamp ? new Date(v.timestamp).toISOString() : new Date().toISOString(),
                      total_amount: v.total_amount,
                      discount: v.discount || 0,
                      status: v.status || 'Pending',
                      tests: Array.isArray(v.test_names) ? v.test_names.join(', ') : '',
                      tests_json: JSON.stringify(testsArr),
                      completed: v.status === 'Completed' ? 1 : 0
                  });
              }
          }
      });
      
      let t = term ? term.toLowerCase() : '';
      if (t && t !== 'all_patients' && t.indexOf('visits:') === -1) {
          records = records.filter(r => (r.patient_name || '').toLowerCase().includes(t) || (r.patient_id || '').toLowerCase().includes(t) || (r.contact || '').includes(t));
      } else if (t.startsWith('visits:')) {
          let pId = t.split(':')[1];
          records = records.filter(r => (r.patient_id || '').toLowerCase() === pId);
      }
      
      return records.sort((a,b) => new Date(b.date) - new Date(a.date)).filter((x,i) => i < 50);
  },

  saveBookingWithRef: async (patientData, cartStr, totalAmount, discount, referredBy) => {
      await ensureAuth();
      const cart = typeof cartStr === 'string' ? JSON.parse(cartStr) : cartStr;
      const testNames = cart.map(c => c.name);
      const newPatientId = patientData.id || ('HCL' + Math.floor(100000 + Math.random() * 900000));
      const newBookingId = generateId().toString();
      
      let unitsAndRanges = {};
      cart.forEach(test => {
          if (test.parameters) {
              try {
                  const params = JSON.parse(test.parameters);
                  unitsAndRanges[test.name] = params.map(p => ({
                      name: p.name,
                      unit: p.unit,
                      type: p.type || 'number',
                      normal_range: p.ref || ''
                  }));
              } catch(e) {}
          }
      });

      const strPin = patientData.pin ? patientData.pin.toString().padStart(6, '0') : "123456";

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
          visits: {
              [newBookingId]: visitData
          }
      };
      
      await setDoc(doc(db, "reports", newPatientId), payload, { merge: true });
      return newBookingId;
  },

  getPendingBookings: async () => {
      await ensureAuth();
      const snaps = await getDocs(collection(db, "reports"));
      let pending = [];
      snaps.forEach(docSnap => {
          let p = docSnap.data();
          if (p.visits) {
              for (const [bId, v] of Object.entries(p.visits)) {
                  if (v.status !== 'Completed') {
                      let testsArr = [];
                      if (v.test_names) {
                          testsArr = v.test_names.map((tName, idx) => {
                              let params = v.units_and_ranges && v.units_and_ranges[tName] ? v.units_and_ranges[tName] : [];
                              let completed = 0;
                              let pDataObj = {};
                              let hasData = false;
                              
                              params.forEach(param => {
                                  if (v.test_results && v.test_results[param.name] !== undefined) {
                                      pDataObj[param.name] = v.test_results[param.name];
                                      hasData = true;
                                  }
                              });
                              
                              if (hasData) completed = 1;

                              return {
                                  test_id: idx + 1,
                                  test_name: tName,
                                  completed: completed,
                                  parameters: JSON.stringify(params.map(u => ({name: u.name, ref: u.normal_range, unit: u.unit, type: u.type}))),
                                  parameter_data: hasData ? JSON.stringify(pDataObj) : null
                              };
                          });
                      }

                      pending.push({
                          id: bId,
                          patient_id: docSnap.id,
                          patient_name: p.patient_name || 'Unknown',
                          date: v.timestamp ? new Date(v.timestamp).toISOString() : new Date().toISOString(),
                          tests_json: JSON.stringify(testsArr),
                          gender: p.gender || '',
                          age: p.age || ''
                      });
                  }
              }
          }
      });
      return pending.sort((a,b) => new Date(b.date) - new Date(a.date));
  },

  completeResult: async (bookingId, testId, resultJson) => {
      await ensureAuth();
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

let rData = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
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
      await ensureAuth();
      const snaps = await getDocs(collection(db, "reports"));
      let targetP = null;
      let targetV = null;
      let targetPatientId = null;
      
      snaps.forEach(docSnap => {
          let p = docSnap.data();
          if (!p.visits) p.visits = {};
          
          Object.keys(p).forEach(k => {
              if (k.startsWith('visits.')) {
                  const bId = k.substring(7);
                  p.visits[bId] = p[k];
              }
          });

          if (p.visits && p.visits[bookingId]) {
              targetP = p;
              targetV = p.visits[bookingId];
              targetPatientId = docSnap.id;
          }
      });
      
      if (!targetP || !targetV) return null;

      // Build results array in the shape print_report.html expects:
      // { test_name, parameters (JSON string), parameter_data (JSON string), completed, test_id, comment }
      const results = [];
      if (targetV.test_names) {
          targetV.test_names.forEach((tName, idx) => {
              const paramsArr = (targetV.units_and_ranges && targetV.units_and_ranges[tName]) || [];
              // Convert to the schema print_report.html expects: { name, ref, unit }
              const paramsMapped = paramsArr.map(u => ({
                  name: u.name,
                  ref: u.normal_range || u.ref || '',
                  unit: u.unit || ''
              }));

              // Extract per-test results from the shared test_results map
              const pDataObj = {};
              let hasData = false;
              paramsArr.forEach(param => {
                  const val = targetV.test_results && targetV.test_results[param.name];
                  if (val !== undefined && val !== '') {
                      pDataObj[param.name] = val;
                      hasData = true;
                  }
              });

              results.push({
                  test_id: idx + 1,
                  test_name: tName,
                  completed: hasData ? 1 : 0,
                  parameters: JSON.stringify(paramsMapped),
                  parameter_data: hasData ? JSON.stringify(pDataObj) : null,
                  comment: targetV.comments || ''
              });
          });
      }

      return {
          // booking object matches what print_report.html reads
          booking: {
              patient_id: targetPatientId,
              patient_name: targetP.patient_name || '',
              date: targetV.timestamp ? new Date(targetV.timestamp).toISOString() : targetV.date,
              gender: targetP.gender || '',
              age: targetP.age || '',
              pin: targetP.password || '123456',
              referred_by: targetV.referred_by || 'Self'
          },
          results
      };
  },

  openPrintWindow: (params) => {
      window.open('print_report.html?' + params, '_blank');
  },
  
  openReceiptWindow: (params) => {
      window.open('print_receipt.html?' + params, '_blank');
  },

  getReferralStats: async () => { return []; },
  getInventory: async () => { return []; },
  getAnalyticsData: async (filterType = 'all') => {
      await ensureAuth();
      const snaps = await getDocs(collection(db, "reports"));

      // ── Build time range ──────────────────────────────────────
      const now = new Date();
      let startTime = 0;
      let endTime   = Infinity;

      const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

      if      (filterType === 'today')      { startTime = startOfDay(now); }
      else if (filterType === 'yesterday')  { startTime = startOfDay(now) - 86400000; endTime = startOfDay(now); }
      else if (filterType === '7days')      { startTime = now.getTime() - 7  * 86400000; }
      else if (filterType === '30days')     { startTime = now.getTime() - 30 * 86400000; }
      else if (filterType === 'this_month') { startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); }
      else if (filterType === 'last_month') {
          startTime = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
          endTime   = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      }
      else if (filterType === '90days')     { startTime = now.getTime() - 90 * 86400000; }
      else if (filterType === '6months')    { startTime = now.getTime() - 180 * 86400000; }
      else if (filterType === '1year')      { startTime = now.getTime() - 365 * 86400000; }

      // ── Accumulators (mirrors desktop SQLite getAnalyticsData) ─
      let totalRevenue    = 0; // total_amount - discount  (net billed)
      let totalVisits     = 0;
      let pendingCount    = 0;
      let todayRevenue    = 0;
      let todayVisits     = 0;
      const todayStart    = startOfDay(now);

      const topTestsMap   = {};   // test_name → count
      const dailyMap      = {};   // 'YYYY-MM-DD' → { revenue, visits }
      const statusMap     = {};   // status → count
      const genderMap     = {};   // gender → Set of patient_ids
      const categoryMap   = {};   // category (from test name prefix) → revenue

      // ── Collect test catalog prices for category lookup ───────
      let catalogCache = {};
      try {
          const catSnaps = await getDocs(collection(db, "tests_catalog"));
          catSnaps.forEach(d => { catalogCache[d.data().name] = d.data().category || 'General'; });
      } catch(_) {}

      snaps.forEach(docSnap => {
          const raw = docSnap.data();
          const patientId = docSnap.id;
          const gender    = (raw.gender || 'Unknown').trim() || 'Unknown';

          // ── Unpack legacy flat-key schema ( visits.XXXXX → nested ) ──
          const visits = Object.assign({}, raw.visits || {});
          Object.keys(raw).forEach(k => {
              if (k.startsWith('visits.')) {
                  const bId = k.substring(7);
                  if (!visits[bId]) visits[bId] = raw[k];
              }
          });

          if (!Object.keys(visits).length) return;

          for (const [bId, v] of Object.entries(visits)) {
              const t = v.timestamp || 0;
              if (t < startTime || t >= endTime) continue;

              const gross    = Number(v.total_amount || 0);
              const discount = Number(v.discount     || 0);
              const net      = Math.max(0, gross - discount);
              const status   = v.status || 'Pending';
              const day      = new Date(t).toISOString().split('T')[0];

              totalVisits++;
              totalRevenue += net;
              if (status !== 'Completed') pendingCount++;

              statusMap[status] = (statusMap[status] || 0) + 1;

              if (!dailyMap[day]) dailyMap[day] = { revenue: 0, visits: 0 };
              dailyMap[day].revenue += net;
              dailyMap[day].visits++;

              if (!genderMap[gender]) genderMap[gender] = new Set();
              genderMap[gender].add(patientId);

              if (v.test_names && Array.isArray(v.test_names)) {
                  const perTestShare = v.test_names.length > 0 ? net / v.test_names.length : 0;
                  v.test_names.forEach(tName => {
                      topTestsMap[tName] = (topTestsMap[tName] || 0) + 1;
                      const cat = catalogCache[tName] || 'General';
                      categoryMap[cat] = (categoryMap[cat] || 0) + perTestShare;
                  });
              }

              if (t >= todayStart) {
                  todayRevenue += net;
                  todayVisits++;
              }
          }
      });

      // ── Shape output to match desktop analytics structure ─────
      const overview = {
          total_revenue   : Math.round(totalRevenue),
          total_collected : Math.round(totalRevenue), // no partial payments on web
          total_outstanding: 0,
          total_visits    : totalVisits,
          today_revenue   : Math.round(todayRevenue),
          today_visits    : todayVisits,
          total_expenses  : 0,
          net_profit      : Math.round(totalRevenue),
          // minimal fields the analytics.html (desktop-style) also reads
          revenue         : Math.round(totalRevenue),
          visits          : totalVisits,
          pendingCount    : pendingCount,
          testCount       : Object.values(topTestsMap).reduce((a,b) => a + b, 0),
          cashInHand      : Math.round(totalRevenue)
      };

      const dailyTrends = Object.keys(dailyMap).sort().map(day => ({
          day,
          revenue: Math.round(dailyMap[day].revenue),
          visits : dailyMap[day].visits
      }));

      const topTests = Object.entries(topTestsMap)
          .sort((a, b) => b[1] - a[1]).slice(0, 10)
          .map(([test_name, count]) => ({ test_name, count }));

      const statusBreakdown = Object.entries(statusMap)
          .map(([status, count]) => ({ status, count }));

      const genderDemographic = Object.entries(genderMap)
          .map(([gender, set]) => ({ gender, count: set.size }));

      const categoryStats = Object.entries(categoryMap)
          .sort((a, b) => b[1] - a[1])
          .map(([category, revenue]) => ({ category, revenue: Math.round(revenue) }));

      return { overview, dailyTrends, topTests, statusBreakdown, genderDemographic, categoryStats };
  },
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

  revertBooking: async (bookingId) => {
      await ensureAuth();
      const snaps = await getDocs(collection(db, "reports"));
      for (const docSnap of snaps.docs) {
          const data = docSnap.data();
          if (data.visits && data.visits[bookingId]) {
              const targetDocId = docSnap.id;
              await updateDoc(doc(db, "reports", targetDocId), {
                  [`visits.${bookingId}.status`]: 'Pending',
                  [`visits.${bookingId}.test_results`]: {}
              });
              return true;
          }
      }
      return false;
  },

  deleteBooking: async (bookingId) => {
      await ensureAuth();
      const snaps = await getDocs(collection(db, "reports"));
      for (const docSnap of snaps.docs) {
          const data = docSnap.data();
          if (data.visits && data.visits[bookingId]) {
              const targetDocId = docSnap.id;
              const remainingVisits = Object.keys(data.visits).filter(id => String(id) !== String(bookingId));
              if (remainingVisits.length === 0) {
                  // No visits remaining, delete the entire patient doc
                  await deleteDoc(doc(db, "reports", targetDocId));
              } else {
                  // Remove only this visit
                  await updateDoc(doc(db, "reports", targetDocId), {
                      [`visits.${bookingId}`]: deleteField()
                  });
              }
              return true;
          }
      }
      return false;
  }
};