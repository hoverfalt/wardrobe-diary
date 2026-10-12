import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { useDateRange } from "./components/DateRangeControl";
import { usePublicWardrobe } from "./data/repo";
import { auth, OWNER_UID, signIn, signOutUser } from "./firebase";
import { navigate, useRoute } from "./lib/route";
import { AddGarmentPage } from "./pages/AddGarmentPage";
import { CategoryPage } from "./pages/CategoryPage";
import { GarmentEditPage } from "./pages/GarmentEditPage";
import { GarmentPage } from "./pages/GarmentPage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { ManagePage } from "./pages/ManagePage";
import { Dashboard } from "./pages/Dashboard";
import { LogDay } from "./pages/LogDay";

// Public pages (Dashboard, category pages) read only users/{OWNER_UID}/public/data, loaded once here
// and shared, as is the date range. Logging wears and managing garments need the owner's sign-in.
export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const route = useRoute();
  const wardrobe = usePublicWardrobe(OWNER_UID);
  const { range, control } = useDateRange();
  const isOwner = user?.uid === OWNER_UID;
  const signInPrompt = user === null ? <button onClick={signIn}>Sign in with Google</button> : null;

  return (
    <main>
      <header>
        <h1>Wardrobe Diary</h1>
        <nav>
          <button aria-pressed={route.page === "dashboard" || route.page === "category" || route.page === "garment" || route.page === "materials"} onClick={() => navigate({ page: "dashboard" })}>Dashboard</button>
          <button aria-pressed={route.page === "log"} onClick={() => navigate({ page: "log" })}>Log</button>
          {isOwner && (
            <button aria-pressed={route.page === "manage"} onClick={() => navigate({ page: "manage" })}>Manage</button>
          )}
          {user ? <button onClick={signOutUser}>Sign out</button> : user === null && <button onClick={signIn}>Sign in</button>}
        </nav>
      </header>
      {route.page === "dashboard" && <Dashboard wardrobe={wardrobe} range={range} rangeControl={control} />}
      {route.page === "category" && (
        <CategoryPage slug={route.slug} wardrobe={wardrobe} range={range} rangeControl={control} />
      )}
      {route.page === "garment" && <GarmentPage id={route.id} wardrobe={wardrobe} canEdit={isOwner} />}
      {route.page === "materials" && <MaterialsPage wardrobe={wardrobe} range={range} rangeControl={control} />}
      {route.page === "manage" &&
        (isOwner ? (
          route.id === "new" ? (
            <AddGarmentPage uid={user!.uid} wardrobe={wardrobe} />
          ) : route.id ? (
            <GarmentEditPage uid={user!.uid} id={route.id} wardrobe={wardrobe} />
          ) : (
            <ManagePage uid={user!.uid} wardrobe={wardrobe} />
          )
        ) : user ? (
          <p>Only the owner can manage garments.</p>
        ) : (
          signInPrompt
        ))}
      {route.page === "log" &&
        (isOwner ? (
          <LogDay uid={user!.uid} wardrobe={wardrobe} />
        ) : user ? (
          <p>Only the owner can log wears.</p>
        ) : (
          signInPrompt
        ))}
    </main>
  );
}
