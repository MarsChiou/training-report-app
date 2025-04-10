// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCvonabdEn0DsHSh0DlQHk7SfzpkqAXh1c",
  authDomain: "joi-team.firebaseapp.com",
  projectId: "joi-team",
  storageBucket: "joi-team.firebasestorage.app",
  messagingSenderId: "544238827116",
  appId: "1:544238827116:web:5e22094cd97dc89e134a49",
  measurementId: "G-HCFRZ4BJJ9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
