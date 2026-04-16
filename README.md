# HCL Mobile Web App (PWA)

This folder contains the complete, standalone web version of your diagnostic lab application.

## Overview
- **No Node.js / Electron Dependencies:** This version runs natively in any modern web browser (Chrome, Safari, Firefox).
- **OCR Removed:** The camera and image processing features have been removed to ensure the app is fast and fully cross-platform.
- **Firebase Backend:** All `window.api` calls have been beautifully mapped to the new `firebase_config.js` file.

## How to test it
You can simply open `webapp/pages/login.html` in Chrome! You do not need to run `npm start`.

## Setup Instructions

1. **Add Your Firebase Config:**
   Open `webapp/assets/firebase_config.js` and replace the placeholder config variables `YOUR_API_KEY`, `YOUR_PROJECT_ID`, etc., with your actual Firebase project credentials.
2. **Deploy to Firebase:**
   Once your testing and config are done, you can deploy this directly:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting 
   # (select the "webapp" folder as your public directory)
   firebase deploy
   ```

## Architecture
- `firebase_config.js` intercepts all the UI button clicks in the app. Instead of talking to a local SQLite database, it interacts directly with Firebase's Cloud Firestore.
- Because it reads/writes straight to Firestore, your desktop application's `firebase_sync.js` will automatically pick up any bookings or test results entered by the technician on this web app!