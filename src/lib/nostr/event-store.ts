import { EventStore } from 'applesauce-core';
import { validateEvent } from './event-validator';

/** Singleton EventStore — single source of truth for all Nostr events */
export const eventStore = new EventStore({ verifyEvent: validateEvent });
