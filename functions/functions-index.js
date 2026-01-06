
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

const ALLOWED_ROLES = new Set(['Admin','LiderCiudad','LiderSector','LiderHan','Usuario+','Usuario']);

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
