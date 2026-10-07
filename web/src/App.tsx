import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth, signIn, signOutUser } from "./firebase";
import { Dashboard } from "./pages/Dashboard";
import { LogDay } from "./pages/LogDay";

type Tab = "log" | "dashboard";

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("log");
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return null;
  if (!user)
    return (
      <main>
        <h1>Wardrobe Diary</h1>
        <button onClick={signIn}>Sign in with Google</button>
      </main>
    );

  return (
    <main>
      <header>
        <h1>Wardrobe Diary</h1>
        <nav>
          <button aria-pressed={tab === "log"} onClick={() => setTab("log")}>Log</button>
          <button aria-pressed={tab === "dashboard"} onClick={() => setTab("dashboard")}>Dashboard</button>
          <button onClick={signOutUser}>Sign out</button>
        </nav>
      </header>
      {tab === "log" ? <LogDay uid={user.uid} /> : <Dashboard uid={user.uid} />}
    </main>
  );
}
