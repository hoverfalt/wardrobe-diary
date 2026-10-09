import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth, OWNER_UID, signIn, signOutUser } from "./firebase";
import { Dashboard } from "./pages/Dashboard";
import { LogDay } from "./pages/LogDay";

type Tab = "dashboard" | "log";

// The Dashboard is public (it reads only users/{OWNER_UID}/public/data); logging needs sign-in.
export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("dashboard");
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  return (
    <main>
      <header>
        <h1>Wardrobe Diary</h1>
        <nav>
          <button aria-pressed={tab === "dashboard"} onClick={() => setTab("dashboard")}>Dashboard</button>
          <button aria-pressed={tab === "log"} onClick={() => setTab("log")}>Log</button>
          {user && <button onClick={signOutUser}>Sign out</button>}
        </nav>
      </header>
      {tab === "dashboard" && <Dashboard ownerUid={OWNER_UID} />}
      {tab === "log" &&
        (user ? (
          <LogDay uid={user.uid} />
        ) : user === null ? (
          <button onClick={signIn}>Sign in with Google to log</button>
        ) : null)}
    </main>
  );
}
