"use strict";



/* ACD BITTU LAB CLOUD — ENTERPRISE OFFLINE DATABASE & SAFE SYNC QUEUE */



(function () {

  const DB_NAME = "acd_bittu_lab_offline_v1";

  const DB_VERSION = 3;

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



  const ALLOWED_TABLES = [

    "lab_patients",

    "lab_orders",

    "lab_order_items",

    "lab_test_results"

  ];



  const ALLOWED_OPS = ["insert", "update", "delete"];



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

        const tx = event.target.transaction;



        STORES.forEach(storeName => {

          let store;

          if (!database.objectStoreNames.contains(storeName)) {

            store = database.createObjectStore(storeName, { keyPath: "key" });

            store.createIndex("lab_id", "lab_id", { unique: false });

          } else {

            store = tx.objectStore(storeName);

            if (!store.indexNames.contains("lab_id")) {

              store.createIndex("lab_id", "lab_id", { unique: false });

            }

          }



          if (storeName === "sync_queue") {

            if (!store.indexNames.contains("status")) {

              store.createIndex("status", "status", { unique: false });

            }

            if (!store.indexNames.contains("dedupe_key")) {

              store.createIndex("dedupe_key", "dedupe_key", { unique: false });

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

        console.warn("Offline database upgrade is blocked by another open tab.");

      };

    });



    return dbPromise;

  }



  function validLabId(labId) {

    if (!labId || typeof labId !== "string" || !labId.trim()) {

      throw new Error("Valid Laboratory ID is required for tenant isolation.");

    }

    return labId.trim();

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

    const cleanLabId = validLabId(labId);



    if (!record || typeof record !== "object" || !record.id) {

      throw new Error("Valid record object with ID is required.");

    }



    const database = await openDB();

    const value = {

      ...record,

      key: makeKey(cleanLabId, record.id),

      lab_id: cleanLabId,

      offline_updated_at: new Date().toISOString()

    };



    return new Promise((resolve, reject) => {

      const tx = database.transaction(storeName, "readwrite");

      const request = tx.objectStore(storeName).put(value);

      request.onsuccess = () => resolve(value);

      request.onerror = () => reject(request.error);

      tx.onerror = () => reject(tx.error);

      tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted."));

    });

  }



  async function getRecords(storeName, labId) {

    validStore(storeName);

    const cleanLabId = validLabId(labId);

    const database = await openDB();



    return new Promise((resolve, reject) => {

      const tx = database.transaction(storeName, "readonly");

      const index = tx.objectStore(storeName).index("lab_id");

      const request = index.getAll(cleanLabId);

      request.onsuccess = () => resolve(request.result || []);

      request.onerror = () => reject(request.error);

    });

  }



  async function getRecord(storeName, labId, id) {

    validStore(storeName);

    const cleanLabId = validLabId(labId);

    if (!id) return null;

    const database = await openDB();



    return new Promise((resolve, reject) => {

      const tx = database.transaction(storeName, "readonly");

      const request = tx.objectStore(storeName).get(makeKey(cleanLabId, id));

      request.onsuccess = () => resolve(request.result || null);

      request.onerror = () => reject(request.error);

    });

  }



  async function deleteRecord(storeName, labId, id) {

    validStore(storeName);

    const cleanLabId = validLabId(labId);

    if (!id) return false;

    const database = await openDB();



    return new Promise((resolve, reject) => {

      const tx = database.transaction(storeName, "readwrite");

      const request = tx.objectStore(storeName).delete(makeKey(cleanLabId, id));

      request.onsuccess = () => resolve(true);

      request.onerror = () => reject(request.error);

    });

  }



  async function enqueueSyncJob(labId, tableName, operation, payload, options = {}) {

    const cleanLabId = validLabId(labId);

    const cleanOp = String(operation || "").toLowerCase().trim();



    if (!ALLOWED_TABLES.includes(tableName)) {

      throw new Error("Table is not allowed in the offline sync queue: " + tableName);

    }

    if (!ALLOWED_OPS.includes(cleanOp)) {

      throw new Error("Unsupported sync operation: " + operation);

    }

    if (!payload || typeof payload !== "object") {

      throw new Error("Sync payload object is required.");

    }



    const recordId = options.recordId || payload.id || null;

    if ((cleanOp === "update" || cleanOp === "delete") && !recordId) {

      throw new Error("Record ID is required for " + cleanOp.toUpperCase() + " sync operation.");

    }



    const safePayload = cleanOp === "delete"

      ? { id: recordId, lab_id: cleanLabId }

      : { ...payload, lab_id: cleanLabId };



    const dedupeKey = recordId

      ? `${cleanLabId}::${tableName}::${cleanOp}::${recordId}`

      : null;



    const existingJobs = await getRecords("sync_queue", cleanLabId);



    // Prevent duplicate pending jobs for the same record & operation; coalesce updates

    if (dedupeKey) {

      const dup = existingJobs.find(

        j => (j.status === "pending" || j.status === "failed") && j.dedupe_key === dedupeKey

      );

      if (dup) {

        return putRecord("sync_queue", cleanLabId, {

          ...dup,

          payload: cleanOp === "update" ? { ...dup.payload, ...safePayload } : safePayload,

          client_updated_at: new Date().toISOString(),

          status: "pending"

        });

      }

    }



    const jobId = crypto.randomUUID ? crypto.randomUUID() : "job-" + Date.now() + "-" + Math.random().toString(36).slice(2);

    const nowIso = new Date().toISOString();



    const job = {

      id: jobId,

      key: makeKey(cleanLabId, jobId),

      lab_id: cleanLabId,

      table_name: tableName,

      operation: cleanOp,

      record_id: recordId,

      dedupe_key: dedupeKey,

      payload: safePayload,

      client_updated_at: nowIso,

      status: "pending",

      attempts: 0,

      created_at: nowIso,

      last_attempt_at: null,

      last_error: null

    };



    const database = await openDB();

    return new Promise((resolve, reject) => {

      const tx = database.transaction("sync_queue", "readwrite");

      const request = tx.objectStore("sync_queue").add(job);

      request.onsuccess = () => resolve(job);

      request.onerror = () => reject(request.error);

      tx.onerror = () => reject(tx.error);

    });

  }



  async function getPendingSyncJobs(labId) {

    const jobs = await getRecords("sync_queue", labId);

    return jobs

      .filter(job => job.status === "pending")

      .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));

  }



  async function getSyncQueueStats(labId) {

    const jobs = await getRecords("sync_queue", labId);

    return {

      pending: jobs.filter(j => j.status === "pending").length,

      failed: jobs.filter(j => j.status === "failed").length,

      synced: jobs.filter(j => j.status === "synced").length,

      jobs

    };

  }



  async function retryFailedSyncJobs(labId) {

    const cleanLabId = validLabId(labId);

    const jobs = await getRecords("sync_queue", cleanLabId);

    const failed = jobs.filter(j => j.status === "failed");

    for (const job of failed) {

      await putRecord("sync_queue", cleanLabId, {

        ...job,

        status: "pending",

        last_error: null

      });

    }

    return failed.length;

  }



  async function updateSyncJob(labId, jobId, changes) {

    const cleanLabId = validLabId(labId);

    const existing = await getRecord("sync_queue", cleanLabId, jobId);

    if (!existing) {

      throw new Error("Sync job not found: " + jobId);

    }

    return putRecord("sync_queue", cleanLabId, {

      ...existing,

      ...changes,

      id: jobId,

      lab_id: cleanLabId

    });

  }



  window.ACDOfflineDB = Object.freeze({

    open: openDB,

    ALLOWED_TABLES,

    ALLOWED_OPS,

    putRecord,

    getRecords,

    getRecord,

    deleteRecord,

    enqueueSyncJob,

    getPendingSyncJobs,

    getSyncQueueStats,

    retryFailedSyncJobs,

    updateSyncJob

  });

})();
