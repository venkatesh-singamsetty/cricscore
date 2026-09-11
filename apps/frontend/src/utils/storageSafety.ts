type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const getStorage = (storageName: "sessionStorage" | "localStorage") => {
  if (typeof window === "undefined") return undefined;

  try {
    const storage = window[storageName] as StorageLike | undefined;
    if (!storage) return undefined;
    // Some browsers can throw on access when storage is disabled.
    storage.getItem("__storage_probe__");
    return storage;
  } catch {
    return undefined;
  }
};

export const safeSessionStorageGet = (key: string): string | null => {
  const storage = getStorage("sessionStorage");
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

export const safeSessionStorageSet = (key: string, value: string) => {
  const storage = getStorage("sessionStorage");
  if (!storage) return;

  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage-related failures so auth/session flows do not crash the app.
  }
};

export const safeLocalStorageGet = (key: string): string | null => {
  const storage = getStorage("localStorage");
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

export const safeLocalStorageSet = (key: string, value: string) => {
  const storage = getStorage("localStorage");
  if (!storage) return;

  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage-related failures so auth/session flows do not crash the app.
  }
};

export const safeLocalStorageRemove = (key: string) => {
  const storage = getStorage("localStorage");
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage-related failures so auth/session flows do not crash the app.
  }
};
