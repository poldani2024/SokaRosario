
import { /* ... */, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Llamalo después de que se determine el rol y antes de listenPersonas()
async function ensureSeedData() {
  // Solo admin hace seed (para evitar múltiples usuarios pisando)
  if (currentRole !== "Admin") return;

  // Seed Hanes
  const hanSnap = await getDocs(collection(db, "hanes"));
  if (hanSnap.empty) {
    const defaultsHanes = [
      { name: "Han Centro", city: "Rosario" },
      { name: "Han Norte", city: "Granadero Baigorria" },
      { name: "Han Oeste", city: "Funes" },
    ];
    for (const h of defaultsHanes) {
      await addDoc(collection(db, "hanes"), { ...h, createdAt: Date.now() });
    }
  }

  // Seed Grupos
  const grpSnap = await getDocs(collection(db, "grupos"));
  if (grpSnap.empty) {
    const defaultsGrupos = [
      { name: "Grupo A" },
      { name: "Grupo B" },
      { name: "Grupo C" },
    ];
    for (const g of defaultsGrupos) {
      await addDoc(collection(db, "grupos"), { ...g, createdAt: Date.now() });
    }
  }

  // Seed Personas (si no hay ninguna)
  const persSnap = await getDocs(collection(db, "personas"));
  if (persSnap.empty) {
    // Tomar ids ya creados para referenciar
    const hanDocs = await getDocs(collection(db, "hanes"));
    const grupoDocs = await getDocs(collection(db, "grupos"));
    const [han1] = hanDocs.docs.map(d => ({ id: d.id, ...d.data() }));
    const [grp1] = grupoDocs.docs.map(d => ({ id: d.id, ...d.data() }));

    const demoPersonas = [
      { firstName: "Juan", lastName: "Pérez", email: "juan@ejemplo.com", status: "Miembro", frecuenciaSemanal: "Frecuentemente", frecuenciaZadankai: "Poco", suscriptoHumanismoSoka: true, realizaZaimu: false },
      { firstName: "Ana", lastName: "García", email: "ana@ejemplo.com", status: "Amigo Soka", frecuenciaSemanal: "Poco", frecuenciaZadankai: "Nunca", suscriptoHumanismoSoka: false, realizaZaimu: false },
      { firstName: "Luis", lastName: "Mendoza", email: "luis@ejemplo.com", status: "Miembro", frecuenciaSemanal: "Nunca", frecuenciaZadankai: "Frecuentemente", suscriptoHumanismoSoka: true, realizaZaimu: true },
      { firstName: "Carla", lastName: "Sosa", email: "carla@ejemplo.com", status: "Sakubuku", frecuenciaSemanal: "Poco", frecuenciaZadankai: "Poco", suscriptoHumanismoSoka: false, realizaZaimu: true },
      { firstName: "Pablo", lastName: "Ríos", email: "pablo@ejemplo.com", status: "Miembro", frecuenciaSemanal: "Frecuentemente", frecuenciaZadankai: "Frecuentemente", suscriptoHumanismoSoka: true, realizaZaimu: true },
    ];

    for (const p of demoPersonas) {
      await addDoc(collection(db, "personas"), {
        ...p,
        hanId: han1?.id || "",
        hanName: han1?.name || "",
        hanCity: han1?.city || "",
        grupoId: grp1?.id || "",
        grupoName: grp1?.name || "",
        updatedAt: Date.now()
      });
    }
  }
}
