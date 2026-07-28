import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

type AnalyticsEvent = {
  event_name: string;
  build_number: string | null;
  occurred_at: string;
  platform: string;
  properties: Record<string, unknown> | null;
};

type StorageTotals = {
  objectCount: number;
  totalBytes: number;
};

const countEvents = (events: AnalyticsEvent[], names: string[]) =>
  events.filter((event) => names.includes(event.event_name)).length;

const readStorageTotals = async (
  admin: ReturnType<typeof createClient>,
): Promise<StorageTotals> => {
  const queue = [""];
  let objectCount = 0;
  let totalBytes = 0;

  while (queue.length) {
    const path = queue.shift() ?? "";
    const { data, error } = await admin.storage
      .from("user-uploads")
      .list(path, { limit: 1000 });
    if (error) throw error;

    for (const item of data ?? []) {
      const nextPath = path ? `${path}/${item.name}` : item.name;
      if (item.metadata) {
        objectCount += 1;
        const size = Number(item.metadata.size ?? 0);
        if (Number.isFinite(size)) totalBytes += size;
      } else {
        queue.push(nextPath);
      }
    }
  }

  return { objectCount, totalBytes };
};

Deno.serve(async (request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const expectedSecret = Deno.env.get("ADMIN_DASHBOARD_SHARED_SECRET");
  const providedSecret = request.headers.get("X-Admin-Dashboard-Secret");

  if (!supabaseUrl || !serviceRoleKey || !expectedSecret) {
    return json({ error: "Server configuration is unavailable." }, 500);
  }
  if (!providedSecret || providedSecret !== expectedSecret) {
    return json({ error: "Authentication required." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  try {
    const [
      dailyResult,
      monthlyResult,
      cohortResult,
      eventsResult,
      profilesResult,
      usersResult,
      storageTotals,
    ] = await Promise.all([
      admin
        .from("analytics_daily")
        .select(
          "metric_date,event_name,platform,app_version,build_number,event_count,user_count",
        )
        .gte("metric_date", ninetyDaysAgo)
        .order("metric_date", { ascending: true }),
      admin
        .from("analytics_monthly")
        .select("month_start,metric_name,metric_value")
        .order("month_start", { ascending: true }),
      admin
        .from("analytics_cohort_monthly")
        .select(
          "cohort_month,activity_month,cohort_size,retained_users,retention_rate",
        )
        .order("activity_month", { ascending: false }),
      admin
        .from("analytics_events")
        .select(
          "event_name,build_number,occurred_at,platform,properties",
        )
        .gte("occurred_at", thirtyDaysAgo)
        .order("occurred_at", { ascending: false })
        .limit(10000),
      admin.from("user_profiles").select("id,analytics_excluded"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      readStorageTotals(admin),
    ]);

    const firstError = [
      dailyResult.error,
      monthlyResult.error,
      cohortResult.error,
      eventsResult.error,
      profilesResult.error,
      usersResult.error,
    ].find(Boolean);
    if (firstError) throw firstError;

    const events = (eventsResult.data ?? []) as AnalyticsEvent[];
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.event_name, (counts.get(event.event_name) ?? 0) + 1);
    }

    const buildMap = new Map<
      string,
      { build: string; requests: number; failures: number }
    >();
    for (const event of events) {
      const build = event.build_number || "unknown";
      const row = buildMap.get(build) ?? { build, requests: 0, failures: 0 };
      if (
        [
          "ai_analysis_started",
          "catch_save_started",
          "photo_library_save_succeeded",
          "photo_library_save_failed",
        ].includes(event.event_name)
      ) {
        row.requests += 1;
      }
      if (
        [
          "ai_analysis_failed",
          "catch_save_failed",
          "photo_upload_failed",
          "photo_library_save_failed",
        ].includes(event.event_name)
      ) {
        row.failures += 1;
      }
      buildMap.set(build, row);
    }

    const monthly = monthlyResult.data ?? [];
    const latestMonth = monthly.at(-1)?.month_start ?? null;
    const latestMetrics = Object.fromEntries(
      monthly
        .filter((row) => row.month_start === latestMonth)
        .map((row) => [row.metric_name, Number(row.metric_value)]),
    );
    const profiles = profilesResult.data ?? [];

    return json({
      generatedAt: new Date().toISOString(),
      rangeDays: 30,
      current: {
        newUsers: latestMetrics.new_users ?? 0,
        meaningfulActiveUsers: latestMetrics.meaningful_active_users ?? 0,
        catchesCreated: latestMetrics.catches_created ?? 0,
        tripsCreated: latestMetrics.trips_created ?? 0,
      },
      funnel: {
        catchFlowStarted: counts.get("catch_flow_started") ?? 0,
        photoCaptured: counts.get("photo_captured") ?? 0,
        analysisResultViewed: counts.get("analysis_result_viewed") ?? 0,
        catchSaveSucceeded: counts.get("catch_save_succeeded") ?? 0,
      },
      ai: {
        started: counts.get("ai_analysis_started") ?? 0,
        succeeded: counts.get("ai_analysis_succeeded") ?? 0,
        rejected: counts.get("ai_analysis_rejected") ?? 0,
        failed: counts.get("ai_analysis_failed") ?? 0,
      },
      permissions: {
        prompted: counts.get("permission_prompted") ?? 0,
        granted: events.filter(
          (event) =>
            event.event_name === "permission_result" &&
            event.properties?.granted === true,
        ).length,
        denied: events.filter(
          (event) =>
            event.event_name === "permission_result" &&
            event.properties?.granted === false,
        ).length,
      },
      builds: [...buildMap.values()]
        .filter((row) => row.requests > 0 || row.failures > 0)
        .sort((a, b) => b.build.localeCompare(a.build))
        .slice(0, 8)
        .map((row) => ({
          ...row,
          failureRate:
            row.requests > 0 ? row.failures / row.requests : row.failures > 0 ? 1 : 0,
        })),
      operating: {
        registeredUsers: usersResult.data.users.length,
        excludedAccounts: profiles.filter(
          (profile) => profile.analytics_excluded,
        ).length,
        rawEventCount: events.length,
        rawEventRetentionDays: 90,
        storageObjectCount: storageTotals.objectCount,
        storageBytes: storageTotals.totalBytes,
      },
      daily: dailyResult.data ?? [],
      monthly,
      cohorts: cohortResult.data ?? [],
    });
  } catch (error) {
    console.error("Admin KPI dashboard failed", error);
    return json({ error: "Dashboard data is temporarily unavailable." }, 500);
  }
});
