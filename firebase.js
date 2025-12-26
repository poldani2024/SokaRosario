
// firebase.js — AUTH ONLY (sin Firestore)
const firebaseConfig = {
  apiKey: "AIzaSyDSC8bYc5XF94OhHjM7rmQMR1zX8CE7h9E",
  authDomain: "sokarosario.firebaseapp.com",
  projectId: "sokarosario",
  storageBucket: "sokarosario.appspot.com", // recomendado
  messagingSenderId: "569099432032",
  appId: "1:569099432032:web:b520d16270508ed25f1305"
};

// Inicializa Firebase (v8)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Exponer auth global (como hiciste en la otra app)
window.auth = firebase.auth();

// (Opcional) Si querés logs mínimos:
console.log("✅ Firebase Auth inicializado");
