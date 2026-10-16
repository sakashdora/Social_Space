const DB_NAME = "veil_crypto_db";
const STORE_NAME = "keys";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export interface KeyRecord {
  privateKey: CryptoKey;
  publicKeyBase64: string;
}

export async function saveKeyRecord(
  userId: string,
  record: KeyRecord,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const previous = store.get(userId);
    previous.onsuccess = () => {
      if (previous.result)
        store.put(
          previous.result,
          userId + ":" + previous.result.publicKeyBase64,
        );
      store.put(record, userId + ":" + record.publicKeyBase64);
      store.put(record, userId);
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getKeyRecord(
  userId: string,
  publicKeyBase64?: string,
): Promise<KeyRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    let value: KeyRecord | null = null;
    const request = store.get(
      publicKeyBase64 ? userId + ":" + publicKeyBase64 : userId,
    );
    request.onsuccess = () => {
      value = request.result || null;
      if (!value && publicKeyBase64) {
        const current = store.get(userId);
        current.onsuccess = () => {
          if (current.result?.publicKeyBase64 === publicKeyBase64)
            value = current.result;
        };
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(value);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deletePrivateKey(userId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const request = tx.objectStore(STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (
          cursor.key === userId ||
          String(cursor.key).startsWith(userId + ":")
        )
          cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function generateChatKeyPair(): Promise<CryptoKeyPair> {
  return window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false, // Private key is marked non-extractable to block theft/exfiltration
    ["deriveKey", "deriveBits"],
  );
}

export async function exportPublicKeyBase64(
  publicKey: CryptoKey,
): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", publicKey);
  const binary = String.fromCharCode(...new Uint8Array(exported));
  return btoa(binary);
}

export async function importPublicKeyBase64(
  base64Str: string,
): Promise<CryptoKey> {
  const binary = atob(base64Str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return window.crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    [],
  );
}

export async function deriveSharedAesKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> {
  // Derive shared bits
  const sharedSecret = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    256,
  );

  // Import raw bits into HKDF secret
  const hkdfSecret = await window.crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"],
  );

  // Derive symmetric AES-GCM key (256-bit)
  return window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(),
      info: new TextEncoder().encode("VEIL_MESSAGE_ENCRYPTION"),
    },
    hkdfSecret,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(
  text: string,
  aesKey: CryptoKey,
  context?: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      ...(context ? { additionalData: new TextEncoder().encode(context) } : {}),
    },
    aesKey,
    encoded,
  );

  const ciphertextBase64 = btoa(
    String.fromCharCode(...new Uint8Array(ciphertextBuffer)),
  );
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return {
    ciphertext: ciphertextBase64,
    iv: ivBase64,
  };
}

export async function decryptText(
  ciphertextBase64: string,
  ivBase64: string,
  aesKey: CryptoKey,
  context?: string,
): Promise<string> {
  const ciphertextBinary = atob(ciphertextBase64);
  const ciphertext = new Uint8Array(ciphertextBinary.length);
  for (let i = 0; i < ciphertextBinary.length; i++) {
    ciphertext[i] = ciphertextBinary.charCodeAt(i);
  }

  const ivBinary = atob(ivBase64);
  const iv = new Uint8Array(ivBinary.length);
  for (let i = 0; i < ivBinary.length; i++) {
    iv[i] = ivBinary.charCodeAt(i);
  }

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      ...(context ? { additionalData: new TextEncoder().encode(context) } : {}),
    },
    aesKey,
    ciphertext,
  );

  return new TextDecoder().decode(decryptedBuffer);
}

const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
export async function encryptAttachment(bytes: ArrayBuffer) {
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    bytes,
  );
  return {
    bytes: encrypted,
    key: base64(
      new Uint8Array(await window.crypto.subtle.exportKey("raw", key)),
    ),
    iv: base64(iv),
  };
}
export async function decryptAttachment(
  bytes: ArrayBuffer,
  encodedKey: string,
  encodedIv: string,
) {
  const key = await window.crypto.subtle.importKey(
    "raw",
    fromBase64(encodedKey),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  return window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(encodedIv) },
    key,
    bytes,
  );
}
