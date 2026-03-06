
/**
 * Cloud Functions — setUserClaims
 * Assigns custom claims to a target user: role, hanIds[], sector, city.
 * - Callable: functions.https.onCall (requires Firebase Auth context)
 * - Validates caller is Admin (context.auth.token.role === 'Admin' or admin=true)
 * - Merges with existing claims to avoid overwriting
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Admin SDK
try { admin.initializeApp(); } catch (e) {}

const ALLOWED_ROLES = new Set(['Admin','SubRegion','LiderCiudad','LiderSector','LiderHan','Usuario+','Usuario']);
const MEMBER_COLLECTION = 'miembros';
const ROLE_POLICY_COLLECTION = 'fieldPolicies';

const DEFAULT_FIELD_POLICY = {
  allowedFields: ['*'],
  sameRoleHiddenFields: ['zaimu'],
  canViewSameRole: true,
};

function normalizeRole(role) {
  const r = String(role || '').trim();
  if (!r) return 'Usuario';
  return r;
}

function toArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x).trim()).filter(Boolean);
}

function hasScopeAccess(callerClaims, memberData) {
  const role = normalizeRole(callerClaims.role);
  if (role === 'Admin' || callerClaims.admin === true) return true;

  const hanIds = toArray(callerClaims.hanIds);
  const sectorIds = toArray(callerClaims.sectorIds || (callerClaims.sector ? [callerClaims.sector] : []));
  const cityIds = toArray(callerClaims.cityIds || (callerClaims.city ? [callerClaims.city] : []));
  const subregionIds = toArray(callerClaims.subregionIds);

  if (role === 'LiderHan') return hanIds.includes(String(memberData.hanId || ''));
  if (role === 'LiderSector') return sectorIds.includes(String(memberData.sectorId || ''));
  if (role === 'LiderCiudad') return cityIds.includes(String(memberData.ciudadId || memberData.cityId || ''));
  if (role === 'SubRegion') return subregionIds.includes(String(memberData.subregionId || ''));

  return false;
}

function applyFieldPolicy(memberData, policy, callerRole) {
  const allowedFields = toArray(policy.allowedFields);
  const sameRoleHiddenFields = toArray(policy.sameRoleHiddenFields);
  const canViewSameRole = policy.canViewSameRole !== false;
  const memberRole = normalizeRole(memberData.role || memberData.rol);
  const isSameRole = normalizeRole(callerRole) === memberRole;

  const output = {};
  const keys = Object.keys(memberData || {});
  const allowAll = allowedFields.includes('*');

  for (const key of keys) {
    if (!allowAll && !allowedFields.includes(key)) continue;
    if (!canViewSameRole && isSameRole) continue;
    if (isSameRole && sameRoleHiddenFields.includes(key)) continue;
    output[key] = memberData[key];
  }

  return output;
}

async function getRoleFieldPolicy(role) {
  const db = admin.firestore();
  const roleDoc = await db.collection(ROLE_POLICY_COLLECTION).doc(normalizeRole(role)).get();
  if (!roleDoc.exists) return DEFAULT_FIELD_POLICY;
  return { ...DEFAULT_FIELD_POLICY, ...(roleDoc.data() || {}) };
}

async function mergeSetCustomClaims(uid, partialClaims) {
  const user = await admin.auth().getUser(uid);
  const oldClaims = user.customClaims || {};
  const newClaims = { ...oldClaims, ...partialClaims };
  // Safety: enforce size limit (<~1000 bytes) and whitelist certain keys
  const safeClaims = {};
  for (const [k,v] of Object.entries(newClaims)) {
    if (['admin','role','hanIds','sector','city'].includes(k)) safeClaims[k] = v;
  }
  // Keep legacy boolean 'admin' in sync with role Admin
  if (safeClaims.role === 'Admin') safeClaims.admin = true; else if (safeClaims.admin === true && !safeClaims.role) safeClaims.role = 'Admin';
  await admin.auth().setCustomUserClaims(uid, safeClaims);
  return safeClaims;
}

exports.setUserClaims = functions.https.onCall(async (data, context) => {
  // Require auth
  if (!context.auth) { throw new functions.https.HttpsError('unauthenticated', 'Debe iniciar sesión.'); }

  // Only Admin caller can assign claims
  const caller = context.auth.token || {};
  const isAdminCaller = caller.role === 'Admin' || caller.admin === true;
  if (!isAdminCaller) { throw new functions.https.HttpsError('permission-denied', 'Solo Admin puede asignar roles.'); }

  // Validate input
  const targetUid = String(data?.targetUid || '').trim();
  const role = String(data?.role || '').trim();
  const hanIds = Array.isArray(data?.hanIds) ? data.hanIds.map(String) : [];
  const sector = data?.sector ? String(data.sector).trim() : '';
  const city = data?.city ? String(data.city).trim() : '';

  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'Falta targetUid.');
  if (!ALLOWED_ROLES.has(role)) throw new functions.https.HttpsError('invalid-argument', 'Rol inválido.');
  if (hanIds.length > 10) throw new functions.https.HttpsError('invalid-argument', 'hanIds admite hasta 10 elementos.');

  const claims = { role, hanIds, sector, city };
  const applied = await mergeSetCustomClaims(targetUid, claims);

  // Force token refresh recommendation (client must call getIdTokenResult(true))
  return { ok: true, claims: applied };
});

// Optional: HTTP endpoint for admin scripts (Bearer token of Admin required)
exports.setUserClaimsHttp = functions.https.onRequest(async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing Bearer token' });
    const decoded = await admin.auth().verifyIdToken(token);
    const isAdminCaller = decoded.role === 'Admin' || decoded.admin === true;
    if (!isAdminCaller) return res.status(403).json({ error: 'permission-denied' });

    const { targetUid, role, hanIds = [], sector = '', city = '' } = req.body || {};
    if (!targetUid) return res.status(400).json({ error: 'Falta targetUid' });
    if (!ALLOWED_ROLES.has(role)) return res.status(400).json({ error: 'Rol inválido' });
    if (!Array.isArray(hanIds)) return res.status(400).json({ error: 'hanIds debe ser array' });

    const applied = await mergeSetCustomClaims(String(targetUid), { role: String(role), hanIds: hanIds.map(String), sector: String(sector), city: String(city) });
    return res.json({ ok: true, claims: applied });
  } catch (err) {
    console.error('[setUserClaimsHttp] error', err);
    return res.status(500).json({ error: 'internal', detail: String(err?.message || err) });
  }
});

/**
 * getMemberSecureView
 * - Retorna información de un miembro filtrada por:
 *   1) Alcance jerárquico (claims del usuario logueado)
 *   2) Política de campos configurable por rol (`fieldPolicies/{role}`)
 *
 * Política esperada por rol:
 * fieldPolicies/LiderSector {
 *   allowedFields: ['nombre','telefono','hanId','zaimu'],
 *   sameRoleHiddenFields: ['zaimu'],
 *   canViewSameRole: true
 * }
 */
exports.getMemberSecureView = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debe iniciar sesión.');
  }

  const memberId = String(data?.memberId || '').trim();
  if (!memberId) {
    throw new functions.https.HttpsError('invalid-argument', 'Falta memberId.');
  }

  const callerClaims = context.auth.token || {};
  const callerRole = normalizeRole(callerClaims.role);
  const db = admin.firestore();
  const memberSnap = await db.collection(MEMBER_COLLECTION).doc(memberId).get();

  if (!memberSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Miembro no encontrado.');
  }

  const memberData = memberSnap.data() || {};
  if (!hasScopeAccess(callerClaims, memberData)) {
    throw new functions.https.HttpsError('permission-denied', 'Sin permisos para ver este miembro.');
  }

  const policy = await getRoleFieldPolicy(callerRole);
  const filteredMember = applyFieldPolicy(memberData, policy, callerRole);

  return {
    ok: true,
    memberId,
    role: callerRole,
    visibleData: filteredMember,
  };
});

/**
 * setRoleFieldPolicy
 * Permite a Admin definir qué campos son visibles para cada rol,
 * incluyendo exclusión de campos entre usuarios del mismo rol.
 */
exports.setRoleFieldPolicy = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debe iniciar sesión.');
  }

  const caller = context.auth.token || {};
  const isAdminCaller = caller.role === 'Admin' || caller.admin === true;
  if (!isAdminCaller) {
    throw new functions.https.HttpsError('permission-denied', 'Solo Admin puede editar políticas de campos.');
  }

  const targetRole = normalizeRole(data?.targetRole);
  if (!ALLOWED_ROLES.has(targetRole) && targetRole !== 'SubRegion') {
    throw new functions.https.HttpsError('invalid-argument', 'targetRole inválido.');
  }

  const allowedFields = toArray(data?.allowedFields);
  const sameRoleHiddenFields = toArray(data?.sameRoleHiddenFields);
  const canViewSameRole = data?.canViewSameRole !== false;

  const db = admin.firestore();
  const payload = {
    allowedFields: allowedFields.length ? allowedFields : ['*'],
    sameRoleHiddenFields,
    canViewSameRole,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: context.auth.uid,
  };

  await db.collection(ROLE_POLICY_COLLECTION).doc(targetRole).set(payload, { merge: true });

  return { ok: true, targetRole, policy: payload };
});
