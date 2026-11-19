import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD0TIQ8eTtN8uXpnuRqcipiC_3Mf41l9q4",
  authDomain: "solvix-1b84e.firebaseapp.com",
  projectId: "solvix-1b84e",
  storageBucket: "solvix-1b84e.firebasestorage.app",
  messagingSenderId: "692713418953",
  appId: "1:692713418953:web:003258c84a6b8b79c0dd18",
  measurementId: "G-79GRY189FL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { firebaseConfig };
export default app;