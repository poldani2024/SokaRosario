
<!-- firebase.js -->

// firebase.js — AUTH ONLY (v8, sin Firestore)

// ⚠️ Usá tus credenciales reales (las que ya tenés):
const firebaseConfig = {
  apiKey: "AIzaSyDSC8bYc5XF94OhHjM7rmQMR1zX8CE7h9E",
  authDomain: "sokarosario.firebaseapp.com",
  projectId: "sokarosario",
  storageBucket: "sokarosario.appspot.com",
  messagingSenderId: "569099432032",
  appId: "1:569099432032:web:b520d16270508ed25f1305"
};

// Inicializa Firebase (v8)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Auth global
const auth = firebase.auth();

// Persistencia local (evita perder sesión tras redirect/popup)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    // Idioma del dispositivo (opcional)
    auth.useDeviceLanguage?.();
    console.log("✅ Firebase Auth inicializado con persistencia LOCAL");
  })
  .catch((err) => {
    console.warn("⚠️ No se pudo establecer persistencia LOCAL:", err?.message || err);
  });


// 👉 Firestore (v8) — habilitar DB en la app
const db = firebase.firestore();             // 👈 NUEVO
window.db = db;                              // 👈 NUEVO (clave para que tus scripts usen DB)

// Exponer auth global
window.auth = auth;
window.firebaseApp = firebase.app();

// Log de dominio actual (útil para validar dominios autorizados)
console.log("🌐 Dominio actual:", location.host);

