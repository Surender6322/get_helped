# GetHelped

> A web-based mental health support platform that connects users seeking
> emotional support with verified psychology helpers via real-time chat.

Built as the BCA major project for Dibrugarh University (2023–2026) by
**Priyom Kashyop** (Roll No. 23992301).

---

## What it does

- Two account types: **User** (seeker) and **Helper** (psychology student/volunteer), plus an **Admin**.
- Real-time 1:1 chat between users and helpers.
- **Anonymous mode** — users can talk without revealing their identity.
- **Helper verification** workflow controlled by an admin.
- **Mood tracker** with history and notes.
- **Resource library** of self-help articles & exercises.
- Always-visible **emergency support** with crisis helplines.
- Role-based dashboards and routing.
- Modern, calming UI tailored for a mental-health context.

## Tech stack

| Layer            | Technology                                 |
| ---------------- | ------------------------------------------ |
| Frontend         | React 18, Vite, React Router               |
| Backend & DB     | Firebase Firestore (NoSQL, serverless)     |
| Authentication   | Firebase Authentication                    |
| Real-time chat   | Firebase Realtime Database                 |
| Hosting          | Firebase Hosting                           |
| Version control  | Git & GitHub                               |
| IDE              | Visual Studio Code                         |

The app is structured behind a single `services/api.js` facade so it can run
on either real Firebase **or** a built-in **demo backend** (uses
`localStorage`). This makes it easy to demo the project without needing
Firebase credentials, while still being a faithful Firebase implementation.

---

## Quick start (demo mode — no Firebase needed)

```bash
cd ~/Projects/GetHelped
npm install
npm run dev
```

Open <http://localhost:5173>.

Demo accounts (all preloaded):

| Role   | Email                       | Password    | Notes                       |
| ------ | --------------------------- | ----------- | --------------------------- |
| User   | `riya@gethelped.app`        | `user123`   |                             |
| Helper | `aarav@gethelped.app`       | `helper123` | already verified            |
| Helper | `meera@gethelped.app`       | `helper123` | pending verification        |
| Admin  | `admin@gethelped.app`       | `admin123`  | can approve/revoke helpers  |

Open the app in two browser windows (e.g. one logged in as the user, one as
the helper) — messages sync in real time across tabs through `localStorage`
events, just like Firebase Realtime Database does in production.

---

## Running on real Firebase

1. Create a Firebase project at <https://console.firebase.google.com>.
2. In the project, enable:
   - **Authentication → Email/Password**
   - **Firestore Database** (in production mode)
   - **Realtime Database**
   - **Hosting**
3. In the project's web app settings, copy the SDK config.
4. Create `.env` from `.env.example` and fill in the values:

   ```
   VITE_USE_DEMO=false
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_DATABASE_URL=...
   ```

5. Edit `.firebaserc` and set your project id.
6. Deploy security rules and indexes:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes,database
   ```

7. Build and deploy the app:

   ```bash
   npm run build
   firebase deploy --only hosting
   ```

The Firebase security rules in this repo enforce:

- Users can only read/write their own profile (except admins).
- Only admins can change a helper's `verified` flag.
- Chats and messages are readable/writable only by their two participants.
- Mood entries are strictly private to their owner.

---

## Project structure

```
GetHelped/
├── public/                  # static assets (favicon, etc.)
├── src/
│   ├── components/          # AppLayout, EmergencyButton
│   ├── context/             # AuthContext (auth + role gating)
│   ├── pages/               # Landing, Login, Register, dashboards, Chat, Mood, Resources, Profile
│   ├── services/
│   │   ├── firebase.js      # Firebase init (Auth, Firestore, RTDB)
│   │   ├── mockBackend.js   # localStorage-backed demo backend
│   │   └── api.js           # unified API facade — UI talks only to this
│   ├── styles/global.css    # design tokens + components
│   ├── App.jsx              # routes
│   └── main.jsx             # React entry
├── firebase.json            # Hosting + rules + DB config
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Composite indexes
├── database.rules.json      # Realtime DB rules
├── .env.example             # Firebase config template
└── vite.config.js
```

---

## Methodology

The project follows the modular development approach described in the synopsis:

1. **Requirement Analysis** — see `docs/Features.md` for the feature checklist.
2. **System Design** — role-based routing, two-collection auth model
   (`users` with role + verification flags), and a deterministic
   `userUid__helperUid` chat id pattern for idempotent chat creation.
3. **Implementation** — React + Firebase, with a backend facade so the data
   layer is swappable for testing.
4. **Testing** — manual verification via the demo accounts (see above) and
   security rules unit-testable via the Firebase emulator.
5. **Deployment** — `firebase deploy` ships hosting, rules, and indexes.

---

## Disclaimer

GetHelped is **not** a substitute for licensed clinical care. The emergency
banner is always visible inside the app and links to verified crisis
helplines. If you or someone you know is in immediate danger, please call
your local emergency services.
