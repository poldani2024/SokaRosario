// firebase (1).js — AUTH ONLY (v8, sin Firestore)
(function initFirebase(){
  const firebaseConfig = {
    apiKey: "AIzaSyDSC8bYc5XF94OhHjM7rmQMR1zX8CE7h9E",
    authDomain: "sokarosario.firebaseapp.com",
    projectId: "sokarosario",
    storageBucket: "sokarosario.appspot.com",
    messagingSenderId: "569099432032",
    appId: "1:569099432032:web:b520d16270508ed25f1305"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('[Firebase] App inicializada');
  }

  // Exponer 'auth' global UNA sola vez
  window.auth = firebase.auth();

  // Persistencia LOCAL antes de cualquier flujo
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
      auth.useDeviceLanguage?.();
      console.log('✅ Firebase Auth inicializado con persistencia LOCAL');
      console.log('🌐 Dominio actual:', location.host);
    })
    .catch(err => console.error('⚠️ Persistencia LOCAL error:', err));
})();
