import { EventStore } from 'applesauce-core';

/** Singleton EventStore — single source of truth for all Nostr events */
export const eventStore = new EventStore();
