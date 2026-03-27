/**
 * Extracts kycData from a Firestore user document.
 * Handles both storage formats and merges them:
 * - Nested map: { kycData: { panStatus: '...', ... } }  (from updateDoc)
 * - Flat keys:  { 'kycData.panStatus': '...', ... }     (legacy, from setDoc with merge)
 * When both exist (mixed state after re-uploads), flat keys are used as base
 * and nested map values override them (newer data wins).
 */
export function extractKycData(docData: Record<string, any>): Record<string, any> {
  // Start with flat dot-notation keys
  const kd: Record<string, any> = {};
  for (const [key, value] of Object.entries(docData)) {
    if (key.startsWith('kycData.')) {
      const field = key.slice('kycData.'.length);
      kd[field] = value;
    }
  }

  // Merge nested kycData map on top (newer values override)
  if (docData.kycData && typeof docData.kycData === 'object') {
    Object.assign(kd, docData.kycData);
  }

  return kd;
}
