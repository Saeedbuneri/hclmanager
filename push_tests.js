const sqlite3 = require('sqlite3').verbose();
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

// Desktop App Database Path
const dbPath = process.env.APPDATA + '\\hcl-lab-management\\hcl_local.sqlite';
console.log('Connecting to:', dbPath);
const dbLocal = new sqlite3.Database(dbPath);

// Firebase Config
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

function pushTests() {
    dbLocal.all("SELECT * FROM tests_catalog", async (err, rows) => {
        if (err) {
            console.error('Error reading SQLite:', err);
            return;
        }

        try {
            console.log('Authenticating as admin to bypass security roles...');
            await signInWithEmailAndPassword(auth, 'hcl@lab.local', 'hcl123');

            console.log(`Found ${rows.length} tests in desktop database.`);
            console.log('Uploading to Firebase collection "tests_catalog"...');
            
            let count = 0;
            for (let test of rows) {
                const testRef = doc(fsDb, "tests_catalog", test.id.toString());
                const payload = {
                    id: test.id,
                    name: test.name,
                    price: test.price,
                    parameters: test.parameters,
                    category: test.category || "General"
                };
                
                await setDoc(testRef, payload);
                count++;
                console.log(`Uploaded ${count}/${rows.length}: ${test.name}`);
            }
            
            console.log('Successfully pushed all tests to Firebase!');
            process.exit(0);
        } catch (authErr) {
            console.error('Auth Error:', authErr.message);
            process.exit(1);
        }
    });
}

pushTests();