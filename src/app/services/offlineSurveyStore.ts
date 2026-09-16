const DB_NAME = 'secureasset-surveyor-offline';
const DB_VERSION = 1;
const DRAFT_STORE = 'drafts';
const KEY_STORE = 'keys';
const KEY_NAME = 'survey-draft-aes-gcm';

type EncryptedDraft = { id: string; iv: ArrayBuffer; ciphertext: ArrayBuffer; createdAt: string };

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error || new Error('Offline transaction aborted')); });
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE, { keyPath: 'name' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function encryptionKey(db: IDBDatabase) {
  const read = db.transaction(KEY_STORE, 'readonly');
  const existing = await requestResult<any>(read.objectStore(KEY_STORE).get(KEY_NAME));
  if (existing?.key) return existing.key as CryptoKey;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const write = db.transaction(KEY_STORE, 'readwrite');
  write.objectStore(KEY_STORE).put({ name: KEY_NAME, key });
  await transactionDone(write);
  return key;
}
async function encryptDraft(value: Record<string, any>, key: CryptoKey): Promise<EncryptedDraft> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { id: String(value.offlineId), iv: iv.buffer, ciphertext, createdAt: new Date().toISOString() };
}
async function decryptDraft(record: EncryptedDraft, key: CryptoKey) {
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(record.iv) }, key, record.ciphertext);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function addSurveyDraft(value: Record<string, any>) {
  const db = await database();
  try {
    const key = await encryptionKey(db); const encrypted = await encryptDraft(value, key);
    const tx = db.transaction(DRAFT_STORE, 'readwrite'); tx.objectStore(DRAFT_STORE).put(encrypted); await transactionDone(tx);
  } finally { db.close(); }
}
export async function listSurveyDrafts() {
  const db = await database();
  try {
    const key = await encryptionKey(db); const tx = db.transaction(DRAFT_STORE, 'readonly'); const rows = await requestResult<EncryptedDraft[]>(tx.objectStore(DRAFT_STORE).getAll());
    return Promise.all(rows.map((row) => decryptDraft(row, key)));
  } finally { db.close(); }
}
export async function countSurveyDrafts() {
  const db = await database();
  try { const tx = db.transaction(DRAFT_STORE, 'readonly'); return await requestResult<number>(tx.objectStore(DRAFT_STORE).count()); }
  finally { db.close(); }
}
export async function clearSurveyDrafts() {
  const db = await database();
  try { const tx = db.transaction(DRAFT_STORE, 'readwrite'); tx.objectStore(DRAFT_STORE).clear(); await transactionDone(tx); }
  finally { db.close(); }
}

export async function getSurveyDraft(id: string) {
  const db = await database();
  try {
    const key = await encryptionKey(db);
    const tx = db.transaction(DRAFT_STORE, 'readonly');
    const row = await requestResult<EncryptedDraft | undefined>(tx.objectStore(DRAFT_STORE).get(id));
    return row ? decryptDraft(row, key) : null;
  } finally { db.close(); }
}
export async function deleteSurveyDraft(id: string) {
  const db = await database();
  try { const tx = db.transaction(DRAFT_STORE, 'readwrite'); tx.objectStore(DRAFT_STORE).delete(id); await transactionDone(tx); }
  finally { db.close(); }
}
