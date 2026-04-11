const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db;

function init() {
  const dbPath = path.join(app.getPath('userData'), 'hcl_local.sqlite');
  console.log('Database path:', dbPath);

  // Initialize DB
  db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    // Write-Ahead Logging for better concurrent performance
    db.run('PRAGMA journal_mode = WAL;');
  
    db.run(`
      CREATE TABLE IF NOT EXISTS tests_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL,
        parameters TEXT,
        category TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER,
        gender TEXT,
        phone TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        pin TEXT,
        date TEXT,
        total_amount REAL,
        discount REAL DEFAULT 0,
        status TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
      )
    `);

    db.run(`ALTER TABLE bookings ADD COLUMN discount REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE bookings ADD COLUMN referred_by TEXT DEFAULT ''`, () => {});
    db.run(`ALTER TABLE bookings ADD COLUMN amount_paid REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE results ADD COLUMN comment TEXT DEFAULT ''`, () => {});

    db.run(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        unit TEXT DEFAULT 'units',
        current_stock REAL DEFAULT 0,
        min_stock REAL DEFAULT 5,
        max_stock REAL DEFAULT 100,
        last_updated TEXT,
        notes TEXT DEFAULT ''
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        message TEXT,
        details TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS results (
        booking_id INTEGER,
        test_id INTEGER,
        parameter_data TEXT,
        completed INTEGER DEFAULT 0,
        PRIMARY KEY (booking_id, test_id)
      )
    `);
  });
  
  // Seed initial test data if catalog is empty
  db.get("SELECT COUNT(*) as count FROM tests_catalog", (err, row) => {
    if (row && row.count === 0) {
      console.log("Seeding initial tests catalog...");
      
      const cbcParams = [
        { name: "WBC", ref: "4.0 - 11.0", unit: "10^3/µL" },
        { name: "RBC", ref: "4.2 - 5.4", unit: "10^6/µL" },
        { name: "HGB", ref: "12.0 - 16.0", unit: "g/dL" },
        { name: "HCT", ref: "37.0 - 47.0", unit: "%" },
        { name: "MCV", ref: "80.0 - 100.0", unit: "fL" },
        { name: "MCH", ref: "27.0 - 31.0", unit: "pg" },
        { name: "MCHC", ref: "32.0 - 36.0", unit: "g/dL" },
        { name: "Platelet Count (PLT)", ref: "150 - 400", unit: "10^3/µL" },
        { name: "Lymphocytes (LY)", ref: "1.0 - 4.0", unit: "10^3/µL" },
        { name: "Monocytes (MO)", ref: "0.1 - 1.0", unit: "10^3/µL" },
        { name: "Granulocytes (GR)", ref: "2.0 - 7.5", unit: "10^3/µL" },
        { name: "RDW-CV", ref: "11.0 - 16.0", unit: "%" },
        { name: "RDW-SD", ref: "35.0 - 56.0", unit: "fL" },
        { name: "PCT", ref: "0.15 - 0.40", unit: "%" },
        { name: "MPV", ref: "7.0 - 11.0", unit: "fL" },
        { name: "PDW", ref: "15.0 - 17.0", unit: "%" }
      ];

      const bsParams = [
        { name: "Blood Sugar Random", ref: "70.0 - 140.0", unit: "mg/dL" }
      ];

      const lftParams = [
        { name: "Bilirubin Total", ref: "0.2 - 1.2", unit: "mg/dL" },
        { name: "Bilirubin Direct", ref: "0.0 - 0.3", unit: "mg/dL" },
        { name: "SGPT (ALT)", ref: "0 - 40", unit: "U/L" },
        { name: "SGOT (AST)", ref: "0 - 40", unit: "U/L" },
        { name: "Alkaline Phosphatase (ALP)", ref: "40 - 120", unit: "U/L" },
        { name: "Total Protein", ref: "6.0 - 8.3", unit: "g/dL" },
        { name: "Albumin", ref: "3.5 - 5.5", unit: "g/dL" }
      ];

      const lipidParams = [
        { name: "Cholesterol Total", ref: "150 - 200", unit: "mg/dL" },
        { name: "Triglycerides", ref: "< 150", unit: "mg/dL" },
        { name: "HDL Cholesterol", ref: "40 - 60", unit: "mg/dL" },
        { name: "LDL Cholesterol", ref: "< 100", unit: "mg/dL" },
        { name: "VLDL", ref: "< 30", unit: "mg/dL" },
        { name: "Cholesterol/HDL Ratio", ref: "< 4.5", unit: "N/A" }
      ];

      const rftParams = [
        { name: "Blood Urea", ref: "15 - 45", unit: "mg/dL" },
        { name: "Serum Creatinine", ref: "0.6 - 1.2", unit: "mg/dL" },
        { name: "Uric Acid", ref: "2.4 - 7.0", unit: "mg/dL" }
      ];

      const urineCultureParams = [
        { name: "Organism Isolated", ref: "No Growth", unit: "N/A" },
        { name: "Colony Count", ref: "< 10^5", unit: "N/A" }
      ];

      const stoolParams = [
        { name: "Color", ref: "Brown", unit: "N/A" },
        { name: "Consistency", ref: "Formed", unit: "N/A" },
        { name: "Ova/Cysts", ref: "Not Seen", unit: "N/A" }
      ];

      const pcrCovidParams = [
        { name: "SARS-CoV-2 RNA", ref: "Negative", unit: "Positive/Negative" }
      ];

      const tftParams = [
        { name: "T3 (Triiodothyronine)", ref: "0.8 - 2.0", unit: "ng/mL" },
        { name: "T4 (Thyroxine)", ref: "5.1 - 14.1", unit: "µg/dL" },
        { name: "TSH", ref: "0.4 - 4.0", unit: "µIU/mL" }
      ];

      const hba1cParams = [
        { name: "HbA1c", ref: "4.0 - 5.6", unit: "%" },
        { name: "Estimated Average Glucose", ref: "< 117", unit: "mg/dL" }
      ];

      const hcgParams = [
        { name: "Beta hCG", ref: "< 5.0 (Non-pregnant)", unit: "mIU/mL" }
      ];

      const viralAntibodiesParams = [
        { name: "Anti-HCV", ref: "Non-Reactive", unit: "Positive/Negative" },
        { name: "HBsAg", ref: "Non-Reactive", unit: "Positive/Negative" }
      ];

      const vitaminDParams = [
        { name: "25-OH Vitamin D", ref: "30.0 - 100.0", unit: "ng/mL" }
      ];

      const rapidDengueParams = [
        { name: "Dengue NS1 Antigen", ref: "Negative", unit: "Positive/Negative" },
        { name: "Dengue IgG/IgM", ref: "Negative", unit: "Positive/Negative" }
      ];

      const rapidMalariaParams = [
        { name: "Malaria Antigen (Pan/Pf)", ref: "Negative", unit: "Positive/Negative" }
      ];

      const insertStmt = "INSERT INTO tests_catalog (name, price, parameters, category) VALUES (?, ?, ?, ?)";
      db.run(insertStmt, ["CBC (Complete Blood Count)", 800, JSON.stringify(cbcParams), "Hematology"]);
      db.run(insertStmt, ["Blood Sugar Random", 250, JSON.stringify(bsParams), "Biochemistry"]);
      db.run(insertStmt, ["LFT (Liver Function Test)", 1200, JSON.stringify(lftParams), "Biochemistry"]);
      db.run(insertStmt, ["Lipid Profile", 1500, JSON.stringify(lipidParams), "Biochemistry"]);
      db.run(insertStmt, ["Renal Function Test (RFT/KFT)", 1100, JSON.stringify(rftParams), "Biochemistry"]);
      db.run(insertStmt, ["Urine Routine / Culture", 850, JSON.stringify(urineCultureParams), "Microbiology"]);
      db.run(insertStmt, ["Stool Routine Analysis", 400, JSON.stringify(stoolParams), "Pathology"]);
      db.run(insertStmt, ["COVID-19 RT-PCR", 4500, JSON.stringify(pcrCovidParams), "Molecular Diagnostics"]);
      db.run(insertStmt, ["Thyroid Profile (TFT)", 2200, JSON.stringify(tftParams), "Immunology"]);
      db.run(insertStmt, ["HbA1c (Glycosylated Hemoglobin)", 1350, JSON.stringify(hba1cParams), "Biochemistry"]);
      db.run(insertStmt, ["Beta HCG (Pregnancy Test)", 1000, JSON.stringify(hcgParams), "Immunology"]);
      db.run(insertStmt, ["Viral Markers (Hep B / C)", 1800, JSON.stringify(viralAntibodiesParams), "Serology"]);
      db.run(insertStmt, ["Vitamin D (25-OH)", 3200, JSON.stringify(vitaminDParams), "General"]);
      db.run(insertStmt, ["Dengue Rapid NS1/IgG/IgM", 1200, JSON.stringify(rapidDengueParams), "Serology"]);
      db.run(insertStmt, ["Malaria Antigen ICT", 600, JSON.stringify(rapidMalariaParams), "Serology"]);
    }
  });
  console.log("Local SQLite initialized at:", dbPath);
}

// Helper functions for Promises
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.log('Error running sql ' + sql);
                console.log(err);
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, result) => {
            if (err) {
                console.log('Error running sql: ' + sql);
                console.log(err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.log('Error running sql: ' + sql);
                console.log(err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}


async function getTests() { return await all("SELECT * FROM tests_catalog"); }
async function addTest(name, price, parameters, category = "General") { 
  return await run("INSERT INTO tests_catalog (name, price, parameters, category) VALUES (?, ?, ?, ?)", [name, price, parameters, category]); 
}
async function updateTest(id, name, price, parameters, category = "General") { 
  return await run("UPDATE tests_catalog SET name = ?, price = ?, parameters = ?, category = ? WHERE id = ?", [name, price, parameters, category, id]); 
}
async function saveBooking(patient, tests, total, discount = 0) {
  await run('BEGIN IMMEDIATE');
  try {
    // Patient UPSERT
    const existing = await get('SELECT id FROM patients WHERE id = ?', [patient.id]);
    if (existing) {
        await run('UPDATE patients SET name = ?, age = ?, gender = ?, phone = ? WHERE id = ?', 
            [patient.name, patient.age, patient.gender, patient.phone, patient.id]);
    } else {
        await run('INSERT INTO patients (id, name, age, gender, phone) VALUES (?, ?, ?, ?, ?)', 
            [patient.id, patient.name, patient.age, patient.gender, patient.phone]);
    }

    const res = await run("INSERT INTO bookings (patient_id, pin, date, total_amount, discount, status) VALUES (?, ?, ?, ?, ?, 'Pending')", 
      [patient.id, patient.pin, new Date().toISOString(), total, discount]);

    // Add tests to results queue
    for (const t of tests) {
        await run("INSERT INTO results (booking_id, test_id, parameter_data) VALUES (?, ?, ?)", [res.id, t.id || null, JSON.stringify(t)]);
    }

    await run('COMMIT');
    return res.id;
  } catch(e) {
    try { await run('ROLLBACK'); } catch(_) {}
    throw e;
  }
}

async function getPendingBookings() {
  return await all(`
    SELECT b.id, b.date, b.patient_id, p.name as patient_name,
    COALESCE(
      (
        SELECT json_group_array(json_object(
          'test_id', r.test_id,
          'test_name', t.name,
          'completed', r.completed,
          'parameters', t.parameters,
          'parameter_data', r.parameter_data
        )) FROM results r JOIN tests_catalog t ON r.test_id = t.id WHERE r.booking_id = b.id
      ), '[]'
    ) as tests_json
    FROM bookings b JOIN patients p ON b.patient_id = p.id
    WHERE b.status='Pending'
  `);
}

async function completeResult(booking_id, test_id, test_data) {
  await run("UPDATE results SET parameter_data = ?, completed = 1 WHERE booking_id = ? AND test_id = ?", [test_data, booking_id, test_id]);
  
  // Only trigger cloud sync when ALL results are completed — prevents uploading partial data
  const uncompleted = await all("SELECT test_id FROM results WHERE booking_id = ? AND completed = 0", [booking_id]);
  if(uncompleted.length === 0) {
    await run("UPDATE bookings SET status = 'Completed', synced = 0 WHERE id = ?", [booking_id]);
  }
  // Partial saves do NOT set synced=0 — avoids incomplete Firebase overwrites
}

async function getUnsyncedBookings() {
  return await all(`
    SELECT b.*, 
      p.name as patient_name, p.age, p.gender, p.phone as contact,
      (
        SELECT json_group_array(json_object(
          'test_id', r.test_id, 
          'test_name', t.name,
          'parameters', t.parameters,
          'parameter_data', r.parameter_data, 
          'completed', r.completed
        )) 
        FROM results r 
        JOIN tests_catalog t ON r.test_id = t.id
        WHERE r.booking_id = b.id
      ) as results_data 
    FROM bookings b 
    JOIN patients p ON b.patient_id = p.id 
    WHERE b.synced = 0
  `);
}

async function setBookingSynced(booking_id) {
  await run("UPDATE bookings SET synced = 1 WHERE id = ?", [booking_id]);
}

async function getBookingReport(id) {
  const booking = await all("SELECT b.*, p.name as patient_name, p.age, p.gender FROM bookings b JOIN patients p ON b.patient_id = p.id WHERE b.id = ?", [id]);
  if (booking.length === 0) return null;
  const results = await all(`
    SELECT r.test_id, t.name as test_name, t.parameters, r.parameter_data, r.completed 
    FROM results r JOIN tests_catalog t ON r.test_id = t.id 
    WHERE r.booking_id = ?
  `, [id]);
  return { booking: booking[0], results };
}
async function getPatientByPhone(phone) {
  return await get('SELECT * FROM patients WHERE phone = ? ORDER BY id DESC LIMIT 1', [phone]);
}

async function getPatientById(id) {
  return await get('SELECT * FROM patients WHERE id = ?', [id]);
}

async function getBookingsByPatientId(id) {
  return await all('SELECT * FROM bookings WHERE patient_id = ? ORDER BY date DESC', [id]);
}

async function updatePatientDetailsAndPin(id, updates) {
  await run('BEGIN IMMEDIATE');
  try {
    await run('UPDATE patients SET name = ?, age = ?, gender = ?, phone = ? WHERE id = ?', 
      [updates.name, updates.age, updates.gender, updates.phone, id]);
      
    if (updates.pin && updates.pin.trim() !== "") {
      await run('UPDATE bookings SET pin = ?, synced = 0 WHERE patient_id = ?', [updates.pin, id]);
    }
    await run('COMMIT');
    return { success: true };
  } catch (e) {
    try { await run('ROLLBACK'); } catch(_) {}
    throw e;
  }
}

async function getPatientHistory(searchTerm = "") {
  if (searchTerm === "ALL_PATIENTS") {
    let query = `
      SELECT p.id as patient_id, p.name as patient_name, p.phone as contact,
             MAX(b.date) as last_visit, COUNT(b.id) as total_visits
      FROM patients p
      LEFT JOIN bookings b ON p.id = b.patient_id
      GROUP BY p.id
      ORDER BY last_visit DESC LIMIT 100
    `;
    return await all(query, []);
  } else if (searchTerm.startsWith("VISITS:")) {
    const pId = searchTerm.substring(7);
    let query = `
      SELECT b.id, b.date, b.status, b.total_amount, b.pin,
             p.id as patient_id, p.name as patient_name, p.phone as contact, p.age, p.gender
      FROM bookings b
      JOIN patients p ON b.patient_id = p.id
      WHERE p.id = ?
      ORDER BY b.date DESC
    `;
    return await all(query, [pId]);
  }

  let query = `
    SELECT b.id, b.date, b.status, b.total_amount, b.pin,
           p.id as patient_id, p.name as patient_name, p.phone as contact, p.age, p.gender
    FROM bookings b
    JOIN patients p ON b.patient_id = p.id
  `;
  let params = [];

  if (searchTerm) {
    query += " WHERE p.name LIKE ? OR p.phone LIKE ? OR p.id LIKE ?";
    const likeTerm = `%${searchTerm}%`;
    params = [likeTerm, likeTerm, likeTerm];
  }

  query += " ORDER BY b.date DESC LIMIT 100";
  return await all(query, params);
}

async function getAnalyticsData(filterType = '30days') {
  // Build a complete analytics profile
  const data = {};
  
let dateCond = "";
    switch(filterType) {
        case 'today':
            dateCond = `datetime(b.date, 'localtime') >= datetime('now', 'localtime', 'start of day')`;
            break;
        case 'yesterday':
            dateCond = `datetime(b.date, 'localtime') >= datetime('now', 'localtime', '-1 day', 'start of day') AND datetime(b.date, 'localtime') < datetime('now', 'localtime', 'start of day')`;
            break;
        case '7days':
            dateCond = `datetime(b.date, 'localtime') >= datetime('now', 'localtime', '-7 days')`;
            break;
        case 'this_month':
            dateCond = `datetime(b.date, 'localtime') >= datetime('now', 'localtime', 'start of month')`;
            break;
        case 'last_month':
            dateCond = `datetime(b.date, 'localtime') >= datetime('now', 'localtime', 'start of month', '-1 month') AND datetime(b.date, 'localtime') < datetime('now', 'localtime', 'start of month')`;
            break;
        case '30days':
            dateCond = `datetime(b.date, 'localtime') >= datetime('now', 'localtime', '-30 days')`;
            break;
        case '90days':
            dateCond = `datetime(b.date, 'localtime') >= datetime('now', 'localtime', '-90 days')`;
            break;
        case '6months':
            dateCond = `datetime(b.date, 'localtime') >= datetime('now', 'localtime', '-6 months')`;
            break;
        case '1year':
            dateCond = `datetime(b.date, 'localtime') >= datetime('now', 'localtime', '-1 year')`;
            break;
        case 'all':
        default:
            dateCond = `datetime(b.date, 'localtime') >= datetime('now', 'localtime', '-100 years')`;
            break;
    }

  // 1. High-level Overview Stats
  const statsQuery = `
      SELECT 
          COUNT(b.id) as total_visits,
          SUM(b.total_amount) as total_revenue,
          (SELECT COUNT(id) FROM patients) as total_patients,
          (SELECT COUNT(id) FROM bookings WHERE datetime(date, 'localtime') >= datetime('now', 'localtime', 'start of day')) as today_visits,
          (SELECT SUM(total_amount) FROM bookings WHERE datetime(date, 'localtime') >= datetime('now', 'localtime', 'start of day')) as today_revenue
      FROM bookings b
      WHERE ${dateCond}
  `;
  data.overview = await get(statsQuery);
  data.overview.total_revenue = data.overview.total_revenue || 0;
  data.overview.today_revenue = data.overview.today_revenue || 0;

  // 2. Charts Data: Revenue & Visits per day
  const dailyQuery = `
      SELECT 
          date(b.date, 'localtime') as day, 
          COUNT(b.id) as visits, 
          SUM(b.total_amount) as revenue
      FROM bookings b
      WHERE ${dateCond}
      GROUP BY day
      ORDER BY day ASC
  `;
  data.dailyTrends = await all(dailyQuery);

  // 3. Top Tests inside this time range
  const topTestsQuery = `
        SELECT 
            t.name as test_name, 
            COUNT(r.test_id) as count
        FROM results r
        JOIN bookings b ON r.booking_id = b.id
        JOIN tests_catalog t ON r.test_id = t.id
        WHERE ${dateCond}
      LIMIT 10
  `;
  data.topTests = await all(topTestsQuery);

  // 4. Financial Breakdown by Status
  const statusQuery = `
      SELECT status, COUNT(*) as count 
      FROM bookings b 
      WHERE ${dateCond} 
      GROUP BY status
  `;
  data.statusBreakdown = await all(statusQuery);

  // 5. Gender Demographic
  const genderQuery = `
      SELECT p.gender, COUNT(DISTINCT p.id) as count
      FROM patients p 
      JOIN bookings b ON p.id = b.patient_id 
      WHERE ${dateCond}
      GROUP BY p.gender
  `;
  data.genderDemographic = await all(genderQuery);

  // 6. Revenue & Count by Category
    const categoryQuery = `
          SELECT t.category as category, SUM(t.price) as revenue, COUNT(r.test_id) as count
          FROM results r
          JOIN tests_catalog t ON r.test_id = t.id
          JOIN bookings b ON r.booking_id = b.id
          WHERE ${dateCond}
          GROUP BY t.category
    `;
    data.categoryStats = await all(categoryQuery);
  return data;
}

async function getPatientById(id) {
  return await get('SELECT * FROM patients WHERE id = ?', [id]);
}

async function getBookingsByPatientId(id) {
  return await all('SELECT * FROM bookings WHERE patient_id = ? ORDER BY date DESC', [id]);
}

async function updatePatientDetailsAndPin(id, updates) {
  await run('UPDATE patients SET name = ?, age = ?, gender = ?, phone = ? WHERE id = ?', 
      [updates.name, updates.age, updates.gender, updates.phone, id]);
  await run('UPDATE bookings SET pin = ? WHERE patient_id = ?', 
      [updates.pin, id]);
}

async function deleteBooking(id) {
    try {
        await run('DELETE FROM results WHERE booking_id = ?', [id]);
        await run('DELETE FROM bookings WHERE id = ?', [id]);
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

async function revertBooking(id) {
    try {
        await run('UPDATE bookings SET status = ? WHERE id = ?', ['Pending', id]);
        await run('UPDATE results SET completed = 0 WHERE booking_id = ?', [id]);
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

async function importDatabaseFromFirebase(snapshotDocs) {
    for (const doc of snapshotDocs) {
        const patientId = doc.id;
        const data = doc.data();
        
        let pName = data.patient_name || "Unknown";
        let pAge = data.age || "";
        let pGender = data.gender || "";
        let pContact = data.contact || "";
        let pin = data.password || "";
        
        // Upsert Patient
        const existingPatient = await get('SELECT id FROM patients WHERE id = ?', [patientId]);
        if (existingPatient) {
            await run('UPDATE patients SET name = ?, age = ?, gender = ?, phone = ? WHERE id = ?', [pName, pAge, pGender, pContact, patientId]);
            await run('UPDATE bookings SET pin = ? WHERE patient_id = ?', [pin, patientId]);
        } else {
            await run('INSERT INTO patients (id, name, age, gender, phone) VALUES (?, ?, ?, ?, ?)', [patientId, pName, pAge, pGender, pContact]);
        }
        
        // Upsert Bookings and Results
        if (data.visits) {
            for (const [bookingId, visitData] of Object.entries(data.visits)) {
                const bId = bookingId;
                const existingBooking = await get('SELECT id FROM bookings WHERE id = ?', [bId]);
                
                if (!existingBooking) {
                    await run("INSERT INTO bookings (id, patient_id, pin, date, total_amount, discount, status, synced) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
                        [bId, patientId, pin, visitData.date, visitData.total_amount || 0, 0, visitData.status || 'Completed']);
                    
                    // Reconstruct results
                    const tests = visitData.units_and_ranges || {};
                    const testResults = visitData.test_results || {};
                    
                    for (const [testName, paramsArray] of Object.entries(tests)) {
                        // find test catalog id if possible
                        const catalogTest = await get('SELECT id FROM tests_catalog WHERE name = ?', [testName]);
                        const tId = catalogTest ? catalogTest.id : null;
                        
                        let paramDataObj = {};
                        if (Array.isArray(paramsArray)) {
                            paramsArray.forEach(p => {
                                if (testResults[p.name] !== undefined) {
                                    paramDataObj[p.name] = testResults[p.name];
                                }
                            });
                        }
                        
                        await run("INSERT INTO results (booking_id, test_id, parameter_data, completed) VALUES (?, ?, ?, ?)",
                            [bId, tId, JSON.stringify(paramDataObj), visitData.status === 'Pending' ? 0 : 1]);
                    }
                }
            }
        }
    }
}

// ── Inventory CRUD ───────────────────────────────────────────
async function getInventory() {
  return await all('SELECT * FROM inventory ORDER BY category, name');
}
async function saveInventoryItem(item) {
  const now = new Date().toISOString();
  if (item.id) {
    await run('UPDATE inventory SET name=?, category=?, unit=?, current_stock=?, min_stock=?, max_stock=?, notes=?, last_updated=? WHERE id=?',
      [item.name, item.category, item.unit, item.current_stock, item.min_stock, item.max_stock, item.notes, now, item.id]);
    return item.id;
  } else {
    const res = await run('INSERT INTO inventory (name, category, unit, current_stock, min_stock, max_stock, notes, last_updated) VALUES (?,?,?,?,?,?,?,?)',
      [item.name, item.category, item.unit, item.current_stock, item.min_stock, item.max_stock, item.notes, now]);
    return res.id;
  }
}
async function deleteInventoryItem(id) {
  await run('DELETE FROM inventory WHERE id = ?', [id]);
  return { success: true };
}
async function adjustInventoryStock(id, qty) {
  await run('UPDATE inventory SET current_stock = MAX(0, current_stock + ?), last_updated = ? WHERE id = ?',
    [qty, new Date().toISOString(), id]);
  return { success: true };
}
async function getLowStockItems() {
  return await all('SELECT * FROM inventory WHERE current_stock <= min_stock ORDER BY current_stock ASC');
}

// ── Dues / Payments ───────────────────────────────────────────
async function getDues() {
  return await all(`
    SELECT b.id, b.date, b.total_amount, b.amount_paid, b.discount, b.status,
           (b.total_amount - b.discount - b.amount_paid) as balance,
           p.id as patient_id, p.name as patient_name, p.phone
    FROM bookings b
    JOIN patients p ON b.patient_id = p.id
    WHERE (b.total_amount - b.discount - COALESCE(b.amount_paid, 0)) > 0.01
    ORDER BY b.date DESC
  `);
}
async function recordPayment(booking_id, amount) {
  await run('UPDATE bookings SET amount_paid = COALESCE(amount_paid, 0) + ?, synced = 0 WHERE id = ?',
    [parseFloat(amount), booking_id]);
  return { success: true };
}

// ── Sync Log ──────────────────────────────────────────────────
async function logSyncEvent(level, message, details) {
  await run('INSERT INTO sync_log (timestamp, level, message, details) VALUES (?,?,?,?)',
    [new Date().toISOString(), level, message, JSON.stringify(details || null)]);
}
async function getSyncLog(limit = 50) {
  return await all('SELECT * FROM sync_log ORDER BY timestamp DESC LIMIT ?', [limit]);
}
async function clearSyncLog() {
  await run('DELETE FROM sync_log');
  return { success: true };
}

// ── Extended Analytics ────────────────────────────────────────
async function getReferralStats(filterType) {
  const { startDate } = _getDateRange(filterType);
  return await all(`
    SELECT COALESCE(NULLIF(TRIM(b.referred_by), ''), 'Self / Walk-in') as referred_by,
           COUNT(*) as visits, SUM(b.total_amount) as revenue
    FROM bookings b
    WHERE date(b.date) >= date(?)
    GROUP BY referred_by
    ORDER BY visits DESC
  `, [startDate]);
}
async function getRepeatPatientRate(filterType) {
  const { startDate } = _getDateRange(filterType);
  const all_patients = await all(`
    SELECT p.id, COUNT(b.id) as visit_count
    FROM patients p JOIN bookings b ON p.id = b.patient_id
    WHERE date(b.date) >= date(?)
    GROUP BY p.id
  `, [startDate]);
  const total = all_patients.length;
  const returning = all_patients.filter(p => p.visit_count > 1).length;
  return { total, returning, new_patients: total - returning, rate: total ? Math.round((returning / total) * 100) : 0 };
}
async function getTestPopularityHeatmap(days = 90) {
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  return await all(`
    SELECT date(b.date) as day, COUNT(*) as count
    FROM bookings b
    WHERE date(b.date) >= date(?)
    GROUP BY day ORDER BY day
  `, [since]);
}
async function getMonthlySummary(year, month) {
  const pad = m => String(m).padStart(2,'0');
  const prefix = year + '-' + pad(month) + '%';
  const [overview, topTests, referrals] = await Promise.all([
    get(`SELECT COUNT(*) as visits, SUM(total_amount) as revenue, SUM(amount_paid) as collected,
              SUM(total_amount - discount - COALESCE(amount_paid,0)) as outstanding
         FROM bookings WHERE date LIKE ?`, [prefix]),
    all(`SELECT t.name as test_name, COUNT(*) as count FROM results r
         JOIN bookings b ON r.booking_id = b.id
         JOIN tests_catalog t ON r.test_id = t.id
         WHERE b.date LIKE ? GROUP BY t.id ORDER BY count DESC LIMIT 10`, [prefix]),
    all(`SELECT COALESCE(NULLIF(TRIM(referred_by),''),'Self') as dr, COUNT(*) as count
         FROM bookings WHERE date LIKE ? GROUP BY dr ORDER BY count DESC LIMIT 5`, [prefix])
  ]);
  return { overview, topTests, referrals, year, month };
}

function _getDateRange(filterType) {
  const now = new Date();
  let startDate = new Date(now);
  switch(filterType) {
    case 'today':    startDate = now; break;
    case 'yesterday':startDate.setDate(now.getDate()-1); break;
    case '7days':    startDate.setDate(now.getDate()-6); break;
    case '30days':   startDate.setDate(now.getDate()-29); break;
    case 'this_month':startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'last_month':startDate = new Date(now.getFullYear(), now.getMonth()-1, 1); break;
    case '90days':   startDate.setDate(now.getDate()-89); break;
    case '6months':  startDate.setMonth(now.getMonth()-5); break;
    case '1year':    startDate = new Date(now.getFullYear(), 0, 1); break;
    default:         startDate = new Date('2020-01-01');
  }
  return { startDate: startDate.toISOString().split('T')[0] };
}

module.exports = {
  importDatabaseFromFirebase, deleteBooking, revertBooking, getPatientById,
  getBookingsByPatientId, updatePatientDetailsAndPin, getAnalyticsData,
  getPatientByPhone, getPatientHistory, getBookingReport,
  init, getTests, addTest, updateTest, saveBooking, getPendingBookings,
  completeResult, getUnsyncedBookings, setBookingSynced,
  // New
  getInventory, saveInventoryItem, deleteInventoryItem, adjustInventoryStock, getLowStockItems,
  getDues, recordPayment,
  logSyncEvent, getSyncLog, clearSyncLog,
  getReferralStats, getRepeatPatientRate, getTestPopularityHeatmap, getMonthlySummary
};







