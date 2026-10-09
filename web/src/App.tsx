import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { useDateRange } from "./components/DateRangeControl";
import { usePublicWardrobe } from "./data/repo";
import { auth, OWNER_UID, signIn, signOutUser } from "./firebase";
import { navigate, useRoute } from "./lib/route";
import { CategoryPage } from "./pages/CategoryPage";
import { Dashboard } from "./pages/Dashboard";
import { LogDay } from "./pages/LogDay";

// Public pages (Dashboard, category pages) read only users/{OWNER_UID}/public/data, loaded once here
// and shared, as is the date range; logging needs sign-in.
export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const route = useRoute();
  const wardrobe = usePublicWardrobe(OWNER_UID);
  const { range, control } = useDateRange();

  return (
    <main>
      <header>
        <h1>Wardrobe Diary</h1>
        <nav>
          <button aria-pressed={route.page !== "log"} onClick={() => navigate({ page: "dashboard" })}>Dashboard</button>
          <button aria-pressed={route.page === "log"} onClick={() => navigate({ page: "log" })}>Log</button>
          {user && <button onClick={signOutUser}>Sign out</button>}
        </nav>
      </header>
      {route.page === "dashboard" && <Dashboard wardrobe={wardrobe} range={range} rangeControl={control} />}
      {route.page === "category" && (
        <CategoryPage slug={route.slug} wardrobe={wardrobe} range={range} rangeControl={control} />
      )}
      {route.page === "log" &&
        (user ? (
          <LogDay uid={user.uid} />
        ) : user === null ? (
          <button onClick={signIn}>Sign in with Google to log</button>
        ) : null)}
    </main>
  );
}
