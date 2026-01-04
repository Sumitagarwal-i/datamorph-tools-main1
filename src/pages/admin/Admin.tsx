import { useCallback, useMemo, useState } from "react";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminInsightsDashboard from "@/pages/admin/AdminInsightsDashboard";
import { adminLogout, isAdminAuthed } from "@/lib/adminAuth";

const Admin = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<"insights" | "cms">("insights");

  const authed = useMemo(() => {
    void refreshKey;
    return isAdminAuthed();
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (!authed) {
    return <AdminLogin onSuccess={refresh} />;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Admin
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Insights, feedback, and admin tools.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              adminLogout();
              refresh();
            }}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Logout
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("insights")}
            className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition ${
              tab === "insights"
                ? "border-border bg-muted text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Insights
          </button>
          <button
            type="button"
            onClick={() => setTab("cms")}
            className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition ${
              tab === "cms"
                ? "border-border bg-muted text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Blog CMS
          </button>
        </div>

        <div className="mt-6">
          {tab === "insights" ? <AdminInsightsDashboard /> : <AdminDashboard />}
        </div>
      </div>
    </main>
  );
};

export default Admin;
