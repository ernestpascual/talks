import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAgNZ4yUrdwqsnU_sVPjaZgnXbk91od8FI",
  authDomain: "prompathon-15d8e.firebaseapp.com",
  databaseURL: "https://prompathon-15d8e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "prompathon-15d8e",
  storageBucket: "prompathon-15d8e.firebasestorage.app",
  messagingSenderId: "848627596157",
  appId: "1:848627596157:web:a264e25155c01f2011ea14",
  measurementId: "G-L99FQ9ETGS",
};

// Reuse the app during Fast Refresh and prevent duplicate initialization.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Import this from client components when reading or writing Realtime Database data.
export const realtimeDatabase = getDatabase(firebaseApp);

// Firestore powers audience submissions that need ordered, real-time listeners.
export const firestore = getFirestore(firebaseApp);
