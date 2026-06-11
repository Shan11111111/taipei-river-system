// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAfijpHSFrfM_OTwsnwxRIkw_TOh1Ucako",
  authDomain: "taipei-river-pulse.firebaseapp.com",
  projectId: "taipei-river-pulse",
  storageBucket: "taipei-river-pulse.firebasestorage.app",
  messagingSenderId: "1030768798443",
  appId: "1:1030768798443:web:f5cc7b6c01ffe02f81acae",
  measurementId: "G-D9BWQEFRV1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);