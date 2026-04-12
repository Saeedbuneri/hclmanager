const { initializeApp } = require('firebase/app');
const { getFirestore, setDoc, getDoc, updateDoc, doc, collection, getDocs, deleteDoc, deleteField } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const dbLocal = require('../db/sqlite');

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
const fsDb = getFirestore(app);
const auth = getAuth(app);

async function startSyncInterval() {
    setInterval(async () => {
        try {
            await syncBookingsToOnline();
            await syncNotesToOnline();
        } catch (e) {
            console.error("Firebase Sync Error: Offline or Credentials Missing.", e.message);
        }
    }, 15000);
    console.log("Firebase Offline-to-Online sync engine started...");
}

async function syncBookingsToOnline() {
    const unsynced = await dbLocal.getUnsyncedBookings() || [];
    if (unsynced.length === 0) return;

    console.log(`Found ${unsynced.length} records to sync to Firebase.`);       

    for (let booking of unsynced) {
        try {
            const patientId = booking.patient_id.toString().trim();
            const strPin = booking.pin ? booking.pin.toString() : "123456";
            const password = strPin.padStart(6, '0');
            const email = patientId.toLowerCase() + '@lab.local';
            
            try {
                // Ensure patient can log in
                await createUserWithEmailAndPassword(auth, email, password);
                console.log(`Created Web Auth account for ${patientId}`);
            } catch (authErr) {
                if (authErr.code === 'auth/email-already-in-use') {
                    try {
                        await signInWithEmailAndPassword(auth, email, password);
                        console.log(`Signed in to Web Auth account for ${patientId}`);
                    } catch (e) {
                         console.log(`Failed to sign in: ${e.message}`);
                    }
                } else {
                    console.log(`Auth notice for ${patientId}: ${authErr.message}`);
                }
            }



            // Map data to expected schema
            const visitData = {
                receipt_id: booking.id,
                date: new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                timestamp: new Date(booking.date).getTime(),
                total_amount: booking.total_amount || 0,
                discount: booking.discount || 0,
                status: booking.status || 'Pending',
                test_names: [],
                units_and_ranges: {},
                test_results: {},
                comments: booking.comments || ""
            };

            let resultsDb = [];
            try {
                if (booking.results_data) {
                    resultsDb = JSON.parse(booking.results_data);
                }
            } catch(e) {}

            for (const r of resultsDb) {
                const tName = r.test_name;
                visitData.test_names.push(tName);
                
                try {
                    visitData.units_and_ranges[tName] = JSON.parse(r.parameters);
                } catch(e) {
                    visitData.units_and_ranges[tName] = [];
                }
                
                try {
                    let d = {};
                    if(typeof r.parameter_data === 'string' && r.parameter_data.trim() !== '') {
                        d = JSON.parse(r.parameter_data);
                    } else if(typeof r.parameter_data === 'object' && r.parameter_data !== null) {
                        d = r.parameter_data;
                    }
                    for (const key of Object.keys(d)) {
                        visitData.test_results[key] = d[key];
                    }
                } catch(e) {}
            }

            const finalPayload = {
                patient_id: patientId,
                patient_name: booking.patient_name || "",
                password: password,
                age: booking.age ? booking.age.toString() : "",
                gender: booking.gender || "",
                contact: booking.contact || "",
                visits: {
                    [booking.id]: visitData
                }
            };

            // Upload direct onto document ID = patient_id
            await setDoc(doc(fsDb, "reports", patientId), finalPayload, { merge: true });
            await dbLocal.setBookingSynced(booking.id);
            console.log(`Successfully synced tracking ID: ${booking.id} for patient ${patientId}`);

        } catch (syncErr) {
            console.error(`Failed to sync booking ${booking.id}: ${syncErr.message}`);
        }
    }
}

async function fetchManualSyncDetails(patientId) {
    try {
        let firebaseData = null;
        let localPatient = null;
        let localBookings = [];

        const patientRow = await dbLocal.getPatientById(patientId);
        if (patientRow) {
            localPatient = patientRow;
            localBookings = await dbLocal.getBookingsByPatientId(patientId);
        }

        const docRef = doc(fsDb, "reports", patientId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            firebaseData = docSnap.data();
        }

        return { success: true, localPatient, localBookings, firebaseData };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

async function updateManualSyncDetails(patientId, updates) {
    try {
        await dbLocal.updatePatientDetailsAndPin(patientId, updates);
        
        const docRef = doc(fsDb, "reports", patientId);
        const docSnap = await getDoc(docRef);
        const passwordSafe = updates.pin ? updates.pin.toString().padStart(6, '0') : "123456";

        if (docSnap.exists()) {
            const finalPayload = {
                patient_name: updates.name || "",
                age: updates.age ? updates.age.toString() : "",
                gender: updates.gender || "",
                contact: updates.phone || "",
                password: passwordSafe
            };
            await updateDoc(docRef, finalPayload);
        } else {
            const finalPayload = {
                patient_id: patientId,
                patient_name: updates.name || "",
                age: updates.age ? updates.age.toString() : "",
                gender: updates.gender || "",
                contact: updates.phone || "",
                password: passwordSafe
            };
            await setDoc(docRef, finalPayload, { merge: true });
        }
        
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function forceFullSync() {
    try {
        console.log('Authenticating as admin to fetch records...');
        const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
        try {
            await createUserWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123');
        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                try {
                    await signInWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123');
                } catch(signInErr) {}
            }
        }

        console.log('Fetching all database records from Firebase to SQLite...');
        const colRef = collection(fsDb, "reports");
        const docSnapshots = await getDocs(colRef);
        const docs = [];
        // Pass raw Firestore snapshots so importDatabaseFromFirebase can call doc.data() correctly
        docSnapshots.forEach(docSnap => {
            docs.push(docSnap);
        });
        
        await dbLocal.importDatabaseFromFirebase(docs);
        
        console.log('Pushing any local changes back to Firebase...');
        await syncBookingsToOnline();
        await syncTestCatalog();
        
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function syncTestCatalog() {
    try {
        console.log('[Sync] Starting Test Catalog Sync to Firebase...');
        const tests = await dbLocal.getTests();
        
        try {
            await signInWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123');
        } catch(e) {
            const { createUserWithEmailAndPassword } = require('firebase/auth');
            try {
               await createUserWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123');
            } catch(e2) {}
        }

        let count = 0;
        for (let test of tests) {
            const testRef = doc(fsDb, "tests_catalog", test.id.toString());
            const payload = {
                name: test.name,
                price: parseFloat(test.price),
                category: test.category || 'General',
                parameters: test.parameters,
                last_updated: new Date().toISOString()
            };
            await setDoc(testRef, payload, { merge: true });
            count++;
        }
        
        console.log(`[Sync] Successfully Synced ${count} tests to Cloud`);
        return { success: true, count: count };
    } catch(err) {
        console.error('[Sync] Test Catalog Sync Failed: ', err);
        return { success: false, error: err.message };
    }
}

async function syncNotesToOnline() {
    try {
        const unsyncedNotes = await dbLocal.getUnsyncedNotes() || [];
        if (unsyncedNotes.length === 0) return;

        console.log(`[Sync] Found ${unsyncedNotes.length} unsynced notes/tasks. Syncing to Cloud...`);
        
        try {
            await signInWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123');
        } catch(e) {
            const { createUserWithEmailAndPassword } = require('firebase/auth');
            try { await createUserWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123'); } catch(e2) {}
        }

        let count = 0;
        for (let note of unsyncedNotes) {
            const noteRef = doc(fsDb, "notes", note.id.toString());
            const payload = {
                type: note.type,
                title: note.title,
                content: note.content || "",
                is_done: note.is_done ? true : false,
                date_created: note.date_created,
                due_date: note.due_date || null
            };
            await setDoc(noteRef, payload, { merge: true });
            await dbLocal.setNoteSynced(note.id);
            count++;
        }
        
        console.log(`[Sync] Successfully Synced ${count} notes to Cloud`);
    } catch(err) {
        console.error('[Sync] Notes Sync Failed: ', err);
    }
}

async function deleteBookingFromCloud(patientId, bookingId) {
    try {
        const { signInWithEmailAndPassword } = require('firebase/auth');
        try { await signInWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123'); } catch(e) {}
        const docRef = doc(fsDb, "reports", patientId.toString());
        await updateDoc(docRef, {
            [`visits.${bookingId}`]: deleteField()
        });
        console.log(`Deleted booking ${bookingId} from cloud`);
        return true;
    } catch(e) {
        console.error("Failed to delete booking from cloud", e);
        return false;
    }
}

async function deletePatientFromCloud(patientId) {
    try {
        const { signInWithEmailAndPassword } = require('firebase/auth');
        try { await signInWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123'); } catch(e) {}
        const docRef = doc(fsDb, "reports", patientId.toString());
        await deleteDoc(docRef);
        console.log(`Deleted patient ${patientId} from cloud`);
        return true;
    } catch(e) {
        console.error("Failed to delete patient from cloud", e);
        return false;
    }
}

async function deleteTestFromCloud(testId) {
    try {
        const { signInWithEmailAndPassword } = require('firebase/auth');
        try { await signInWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123'); } catch(e) {}
        const docRef = doc(fsDb, "tests_catalog", testId.toString());
        await deleteDoc(docRef);
        console.log(`Deleted test ${testId} from cloud`);
        return true;
    } catch(e) {
        console.error("Failed to delete test from cloud", e);
        return false;
    }
}

async function deleteNoteFromCloud(noteId) {
    try {
        const { signInWithEmailAndPassword } = require('firebase/auth');
        try { await signInWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123'); } catch(e) {}
        const docRef = doc(fsDb, "notes", noteId.toString());
        await deleteDoc(docRef);
        console.log(`Deleted note ${noteId} from cloud`);
        return true;
    } catch(e) {
        console.error("Failed to delete note from cloud", e);
        return false;
    }
}

module.exports = { startSyncInterval, syncBookingsToOnline, syncNotesToOnline, fetchManualSyncDetails, updateManualSyncDetails, forceFullSync, syncTestCatalog, deleteBookingFromCloud, deletePatientFromCloud, deleteTestFromCloud, deleteNoteFromCloud };
