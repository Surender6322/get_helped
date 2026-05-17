# GetHelped — Key Features Implemented

This document is the "key points of features done as part of this project"
deliverable. It maps each line item from the synopsis (sections 3, 4, 6) to
the actual files that implement it.

---

## 1. Dual login system with role-based dashboards
- Users can register as **User** (seeker), **Helper** (psychology
  student/volunteer), or be promoted to **Admin** (seeded for demo).
- Login & Register flow validates role and routes the user to a
  role-specific dashboard.
- A `<Protected>` route wrapper enforces role-level access.

**Files:** `src/pages/Login.jsx`, `src/pages/Register.jsx`,
`src/context/AuthContext.jsx`, `src/App.jsx`

---

## 2. Real-time one-to-one chat
- Each conversation is a deterministic `userUid__helperUid` chat document.
- Messages are stored in **Firebase Realtime Database** and stream live to
  both participants.
- In demo mode the same UI works via `localStorage` + `storage` events,
  so two browser tabs talk to each other in real time.
- Auto-scroll, message timestamps, and an empty-state coaching message.

**Files:** `src/pages/Chat.jsx`, `src/services/api.js`,
`src/services/mockBackend.js`

---

## 3. Anonymous communication for users
- A toggle on the "Find a Helper" page starts the chat as **anonymous**.
- For anonymous chats, the helper sees the user labelled as
  *"Anonymous user"* in both the chat list and the chat header.
- The user always sees the helper's real name (helpers are verified).

**Files:** `src/pages/HelperList.jsx`, `src/pages/Chat.jsx`

---

## 4. Helper credential verification + admin approval
- Helpers submit credentials at registration; their account is created
  with `verified: false` and `available: false`.
- Admin dashboard lists **pending** vs **verified** helpers and lets the
  admin **approve** or **revoke** verification with one click.
- Helpers cannot toggle themselves to "available" until verified — the UI
  enforces this and the security rules prevent direct edits to `verified`.

**Files:** `src/pages/AdminDashboard.jsx`, `src/pages/HelperDashboard.jsx`,
`firestore.rules`

---

## 5. Mood tracking
- Users log moods on a 5-step scale (Great → Awful) with an optional note.
- History is shown in reverse chronological order with timestamps.
- Latest mood is surfaced on the User Dashboard.

**Files:** `src/pages/Mood.jsx`, `src/pages/UserDashboard.jsx`

---

## 6. Emergency support / crisis escalation
- A persistent **emergency banner** appears at the top of every signed-in
  page, opening a modal with curated, country-specific helplines and
  click-to-call links.
- A short disclaimer makes clear that the platform is not a substitute
  for emergency services.

**Files:** `src/components/EmergencyButton.jsx`, `src/components/AppLayout.jsx`

---

## 7. Resource library
- Self-help **articles** and **exercises** (4-7-8 Breathing, 5-4-3-2-1
  Grounding, Sleep Hygiene, Journaling Prompts, Understanding Anxiety).
- Filter by kind, click a card to open the full content in a modal.

**Files:** `src/pages/Resources.jsx`, seed data in `src/services/mockBackend.js`

---

## 8. Match users with available helpers
- The Helpers page only shows verified helpers, with a clear
  **available / away** pill.
- The User Dashboard surfaces a count of online helpers and quick links
  to the highest priority ones.

**Files:** `src/pages/HelperList.jsx`, `src/pages/UserDashboard.jsx`,
`src/services/api.js`

---

## 9. Secure & private communication
- All UI is gated behind `<Protected>` and the `AuthContext`.
- Firestore rules:
  - Users can read/update only their own profile (except admins).
  - Helpers cannot self-promote: `role` and `verified` are admin-only.
  - Chats and moods are readable only by their participants/owner.
- Realtime DB rules:
  - Only the two participants of a chat can read/write its messages.
  - Each message must come from the authenticated sender and is length-bounded.

**Files:** `firestore.rules`, `database.rules.json`

---

## 10. Modern, calming UI
- Custom design tokens (`src/styles/global.css`) using a soft blue/green
  palette appropriate for a mental-health product.
- Reusable card, pill, button, and modal styles.
- Responsive layout (sidebar collapses on mobile).
- Accessible focus states and aria labels on close buttons.

**Files:** `src/styles/global.css`, all `src/pages/*.jsx`

---

## 11. Backend facade & demo mode
- All data access goes through `src/services/api.js`. The UI never imports
  Firebase directly.
- A built-in `mockBackend.js` mirrors the same surface area using
  `localStorage`, so the project runs end-to-end without Firebase
  credentials — perfect for evaluation/demos.
- Switching to real Firebase is a single env-var change (`VITE_USE_DEMO=false`).

**Files:** `src/services/api.js`, `src/services/firebase.js`,
`src/services/mockBackend.js`

---

## 12. Deployable Firebase configuration
- `firebase.json` configures Hosting (with SPA rewrite), Firestore rules &
  indexes, and Realtime DB rules.
- `firestore.indexes.json` declares the composite indexes the app's
  helpers query needs.
- `.firebaserc` is wired so deployment is `firebase deploy` away.

**Files:** `firebase.json`, `firestore.indexes.json`, `.firebaserc`

---

## Mapping to the synopsis

| Synopsis Objective                                              | Implemented in                              |
| --------------------------------------------------------------- | ------------------------------------------- |
| Web-based mental health support system                          | Whole project                               |
| Dual login system for Users and Helpers                         | Login.jsx, Register.jsx, AuthContext.jsx    |
| Real-time chat between users and helpers                        | Chat.jsx + Realtime DB / mock RTDB          |
| Secure and private communication                                | firestore.rules, database.rules.json        |
| Allow users to remain anonymous                                 | HelperList.jsx + Chat.jsx                   |
| Match users with available helpers                              | HelperList.jsx, UserDashboard.jsx           |
| Verify helper credentials                                       | AdminDashboard.jsx                          |
| Emergency support features for crisis situations                | EmergencyButton.jsx                         |
| Mood tracking feature                                           | Mood.jsx                                    |
| Helpline references / Resource library                          | Resources.jsx, EmergencyButton.jsx          |
