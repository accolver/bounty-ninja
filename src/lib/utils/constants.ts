import { config } from '$lib/config';

/** Tag value appended to all published events to identify the client */
export const CLIENT_TAG = config.nostr.clientTag;

/** Application display name */
export const APP_NAME = config.app.nameCaps;

/** localStorage key for session persistence */
export const SESSION_STORAGE_KEY = `${config.storagePrefix}-pubkey`;

/** Timeout for NIP-07 signer operations (ms) */
export const SIGNER_TIMEOUT_MS = 30_000;

/** Polling interval for NIP-07 extension detection (ms) */
export const SIGNER_POLL_INTERVAL_MS = 500;

/** Maximum number of NIP-07 detection retries */
export const SIGNER_MAX_RETRIES = 10;
