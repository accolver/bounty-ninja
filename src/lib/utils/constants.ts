/** Tag value appended to all published events to identify the client */
export const CLIENT_TAG = 'tasks.fyi';

/** Application display name */
export const APP_NAME = 'Tasks.fyi';

/** localStorage key for session persistence */
export const SESSION_STORAGE_KEY = 'tasks-fyi-pubkey';

/** Timeout for NIP-07 signer operations (ms) */
export const SIGNER_TIMEOUT_MS = 30_000;

/** Polling interval for NIP-07 extension detection (ms) */
export const SIGNER_POLL_INTERVAL_MS = 500;

/** Maximum number of NIP-07 detection retries */
export const SIGNER_MAX_RETRIES = 10;
