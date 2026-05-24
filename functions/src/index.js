// Cloud Functions for GetHelped — entry point.
//
// All functions are deployed to asia-south1 (Mumbai) since the user
// base is India-first; lower latency for chat/AI calls.

import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { companionChat } from './companionChat.js';
export { submitRating } from './ratings.js';
export { onUserWrite, backfillUsersPublic } from './userSync.js';
export { saveMemoryItem, wipeMemory } from './companionMemory.js';
