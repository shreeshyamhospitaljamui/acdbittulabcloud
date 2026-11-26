
"use strict";

/* ACD BITTU LAB CLOUD — OFFLINE DATABASE */

(function () {
  const DB_NAME = "acd_bittu_lab_offline_v1";
 const DB_VERSION = 2;
  const STORES = [
    "meta",
    "patients",
    "orders",
    "order_items",
    "results",
    "catalogue",
    "parameters",
"report_settings",
"signature_assets",
"sync_queue"
  ];

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("This browser does not support IndexedDB."));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const database = event.target.result;

        STORES.forEach(storeName => {
          if (!database.objectStoreNames.contains(storeName)) {
            const store = database.createObjectStore(storeName, {
              keyPath: "key"
            });

            store.createIndex("lab_id", "lab_id", {
              unique: false
            });

            if (storeName === "sync_queue") {
              store.createIndex("status", "status", {
                unique: false
              });
            }
          }
        });
      };

      request.onsuccess = () => {
        const database = request.result;

        database.onversionchange = () => {
          database.close();
          dbPromise = null;
        };

        resolve(database);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error("Offline database could not open."));
      };

      request.onblocked = () => {
        console.warn("Offline database upgrade is blocked by another tab.");
      };
    });

    return dbPromise;
  }

  function validLabId(labId) {
    if (!labId || typeof labId !== "string") {
      throw new Error("Valid Laboratory ID is required.");
    }
    return labId;
  }

  function validStore(storeName) {
    if (!STORES.includes(storeName)) {
      throw new Error("Invalid offline data store: " + storeName);
    }
    return storeName;
  }

  function makeKey(labId, id) {
    return labId + "::" + String(id);
  }

  async function putRecord(storeName, labId, record) {
    validStore(storeName);
    validLabId(labId);

    if (!record || !record.id) {
      throw new Error("Record ID is required.");
    }

    const database = await openDB();

    const value = {
      ...record,
      key: makeKey(labId, record.id),
      lab_id: labId,
      offline_updated_at: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).put(value);

      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Save aborted."));
    });
  }

  async function getRecords(storeName, labId) {
    validStore(storeName);
    validLabId(labId);

    const database = await openDB();

    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readonly");
      const index = tx.objectStore(storeName).index("lab_id");
      const request = index.getAll(labId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function getRecord(storeName, labId, id) {
    validStore(storeName);
    validLabId(labId);

    const database = await openDB();

    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(
        makeKey(labId, id)
      );

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteRecord(storeName, labId, id) {
    validStore(storeName);
    validLabId(labId);

    const database = await openDB();

    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).delete(
        makeKey(labId, id)
      );

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async function enqueueSyncJob(labId, tableName, operation, payload) {
    validLabId(labId);

    const allowedTables = [
      "lab_patients",
      "lab_orders",
      "lab_order_items",
      "lab_test_results"
    ];

    if (!allowedTables.includes(tableName)) {
      throw new Error("Table is not allowed in the offline sync queue.");
    }

    if (!["insert", "update", "delete"].includes(operation)) {
      throw new Error("Invalid sync operation.");
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("Sync payload is required.");
    }

    const jobId = crypto.randomUUID();

    const job = {
      id: jobId,
      key: makeKey(labId, jobId),
      lab_id: labId,
      table_name: tableName,
      operation,
      payload,
      status: "pending",
      attempts: 0,
      created_at: new Date().toISOString(),
      last_error: null
    };

    const database = await openDB();

    return new Promise((resolve, reject) => {
      const tx = database.transaction("sync_queue", "readwrite");
      const request = tx.objectStore("sync_queue").add(job);

      request.onsuccess = () => resolve(job);
      request.onerror = () => reject(request.error);
    });
  }

  async function getPendingSyncJobs(labId) {
    const jobs = await getRecords("sync_queue", labId);

    return jobs
      .filter(job => job.status === "pending")
      .sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      );
  }

  async function updateSyncJob(labId, jobId, changes) {
    const existing = await getRecord(
      "sync_queue",
      labId,
      jobId
    );

    if (!existing) {
      throw new Error("Sync job not found.");
    }

    return putRecord("sync_queue", labId, {
      ...existing,
      ...changes,
      id: jobId
    });
  }

  window.ACDOfflineDB = Object.freeze({
    open: openDB,
    putRecord,
    getRecords,
    getRecord,
    deleteRecord,
    enqueueSyncJob,
    getPendingSyncJobs,
    updateSyncJob
  });
})();
