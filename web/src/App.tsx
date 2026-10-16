import { onAuthStateChanged, type User } from "firebase/auth";
import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { useDateRange } from "./components/DateRangeControl";
import { usePublicWardrobe } from "./data/repo";
import { auth, EMULATORS, OWNER_UID, signIn, signOutUser } from "./firebase";
import { navigate, useRoute } from "./lib/route";

/** A page loaded only when first shown (R-18: the charts and the owner-only pages are separate files). If the
 *  file is gone because a new version was deployed while the page was open, reload once to get the new one. */
function page<P extends object>(load: () => Promise<Record<string, unknown>>, name: string) {
  return lazy(async () => {
    try {
      const m = await load();
      sessionStorage.removeItem("chunk-reload");
      return { default: m[name] as ComponentType<P> };
    } catch (e) {
      if (!sessionStorage.getItem("chunk-reload")) {
        sessionStorage.setItem("chunk-reload", "1");
        location.reload();
      }
      throw e;
    }
  });
}

const Dashboard = page<Parameters<typeof import("./pages/Dashboard").Dashboard>[0]>(() => import("./pages/Dashboard"), "Dashboard");
const CategoryPage = page<Parameters<typeof import("./pages/CategoryPage").CategoryPage>[0]>(() => import("./pages/CategoryPage"), "CategoryPage");
const GarmentPage = page<Parameters<typeof import("./pages/GarmentPage").GarmentPage>[0]>(() => import("./pages/GarmentPage"), "GarmentPage");
const MaterialsPage = page<Parameters<typeof import("./pages/MaterialsPage").MaterialsPage>[0]>(() => import("./pages/MaterialsPage"), "MaterialsPage");
const ManagePage = page<Parameters<typeof import("./pages/ManagePage").ManagePage>[0]>(() => import("./pages/ManagePage"), "ManagePage");
const GarmentEditPage = page<Parameters<typeof import("./pages/GarmentEditPage").GarmentEditPage>[0]>(() => import("./pages/GarmentEditPage"), "GarmentEditPage");
const AddGarmentPage = page<Parameters<typeof import("./pages/AddGarmentPage").AddGarmentPage>[0]>(() => import("./pages/AddGarmentPage"), "AddGarmentPage");
const ComparisonPage = page<Parameters<typeof import("./pages/ComparisonPage").ComparisonPage>[0]>(() => import("./pages/ComparisonPage"), "ComparisonPage");
const LogDay = page<Parameters<typeof import("./pages/LogDay").LogDay>[0]>(() => import("./pages/LogDay"), "LogDay");

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
      {EMULATORS && <p className="emulator-banner">LOCAL EMULATOR – test data, nothing here reaches wardrobediary.web.app</p>}
      <header>
        <h1><a className="home-link" href="/">Wardrobe Diary</a></h1>
        <nav>
          <button aria-pressed={route.page === "dashboard" || route.page === "category" || route.page === "garment" || route.page === "materials"} onClick={() => navigate({ page: "dashboard" })}>Dashboard</button>
          <button aria-pressed={route.page === "log"} onClick={() => navigate({ page: "log" })}>Log</button>
          {isOwner && (
            <button aria-pressed={route.page === "manage"} onClick={() => navigate({ page: "manage" })}>Manage</button>
          )}
          {user ? <button onClick={signOutUser}>Sign out</button> : user === null && <button onClick={signIn}>Sign in</button>}
        </nav>
      </header>
      <Suspense fallback={<p>Loading…</p>}>
        {route.page === "dashboard" && <Dashboard wardrobe={wardrobe} range={range} rangeControl={control} />}
        {route.page === "category" && (
          <CategoryPage slug={route.slug} wardrobe={wardrobe} range={range} rangeControl={control} />
        )}
        {route.page === "garment" && <GarmentPage id={route.id} wardrobe={wardrobe} canEdit={isOwner} />}
        {route.page === "notFound" && (
          <section>
            <h2>Page not found</h2>
            <p>
              There is no page at this address. See <a href="/">the Wardrobe Diary Project</a> or{" "}
              <a href="/dashboard">my wardrobe data</a>.
            </p>
          </section>
        )}
        {route.page === "materials" && <MaterialsPage wardrobe={wardrobe} range={range} rangeControl={control} />}
        {route.page === "manage" &&
          (isOwner ? (
            route.id === "new" ? (
              <AddGarmentPage uid={user!.uid} wardrobe={wardrobe} />
            ) : route.id === "comparison" ? (
              <ComparisonPage uid={user!.uid} />
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
      </Suspense>
      <footer className="app-footer">
        <span>The data and how it's defined:</span>
        <a href="/glossary">Glossary</a>
        <a href="/model">Model</a>
        <a href="/data">Data catalog</a>
        <a href="/evals">AI evaluation</a>
        <a href="https://github.com/hoverfalt/wardrobe-diary">Source</a>
        <a href="/">About the project</a>
      </footer>
    </main>
  );
}
