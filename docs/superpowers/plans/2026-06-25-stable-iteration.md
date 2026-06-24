# Stable Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first stable iteration foundation: admin feedback inbox, visible version metadata, and a documented release process.

**Architecture:** Keep production behavior stable by shipping small, testable increments. Backend admin-only APIs remain in Rust Axum and reuse the existing `ADMIN_USER_IDS` authorization rule. Web surfaces stay thin: `/stats` displays admin feedback, `/about` displays injected build metadata, and release discipline lives in docs/checklists before platform automation changes.

**Tech Stack:** Rust + Axum + SQLx + PostgreSQL, Next.js 16 + React + Jest, pnpm, cargo-nextest, GitHub Release/tag workflow.

---

## File Structure

- Modify `crates/backend/src/routes/stats.rs`: expose reusable admin authorization helper or keep behavior aligned with new admin feedback route.
- Modify `crates/backend/src/routes/feedback.rs`: add admin feedback list types and handler.
- Modify `crates/backend/src/lib.rs`: route `GET /api/admin/feedback`.
- Modify `crates/backend/src/routes/openapi.json`: document admin feedback response.
- Modify `crates/backend/tests/api_test.rs`: add authorization, pagination, anonymous feedback, and content visibility tests.
- Modify `apps/web/src/lib/api.ts`: add `FeedbackItem`, `AdminFeedbackResponse`, and `getAdminFeedback()`.
- Modify `apps/web/src/lib/__tests__/api.test.ts`: cover admin feedback client behavior.
- Modify `apps/web/src/app/stats/page.tsx`: render feedback inbox independently from stats cards.
- Modify `apps/web/src/app/stats/__tests__/page.test.tsx`: cover feedback rendering and partial failure.
- Modify `apps/web/src/app/about/page.tsx`: display app version metadata and release notes link.
- Create `apps/web/src/lib/version.ts`: centralize public build metadata parsing for UI.
- Create `apps/web/src/lib/__tests__/version.test.ts`: verify dev fallback and injected metadata.
- Create `docs/RELEASE_PROCESS.md`: stable release, smoke, gray, rollback checklist.
- Modify `AGENTS.md` and `CLAUDE.md`: record production release discipline once docs exist.
- Modify `DEVLOG.md`: record each implementation step, root cause, verification.

## Task 1: Admin Feedback API

**Files:**
- Modify: `crates/backend/src/routes/stats.rs`
- Modify: `crates/backend/src/routes/feedback.rs`
- Modify: `crates/backend/src/lib.rs`
- Modify: `crates/backend/tests/api_test.rs`

- [ ] **Step 1: Write failing backend tests**

Add tests near existing feedback/stats tests in `crates/backend/tests/api_test.rs`:

```rust
#[tokio::test]
async fn test_admin_feedback_requires_auth() {
    let base = spawn_test_server().await;
    let client = reqwest::Client::new();

    let res = client
        .get(format!("{}/api/admin/feedback", base))
        .send()
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_admin_feedback_rejects_non_admin() {
    let base = spawn_test_server().await;
    let auth = register_user(&base, "feedback-normal").await;
    let token = auth["access_token"].as_str().unwrap();
    let client = reqwest::Client::new();

    let res = client
        .get(format!("{}/api/admin/feedback", base))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_admin_feedback_lists_feedback_content() {
    let base = spawn_test_server().await;
    let admin_auth = register_user(&base, "feedback-admin").await;
    let user_auth = register_user(&base, "feedback-member").await;
    let admin_token = admin_auth["access_token"].as_str().unwrap();
    let user_token = user_auth["access_token"].as_str().unwrap();
    let admin_id = admin_auth["user"]["id"].as_str().unwrap();
    let client = reqwest::Client::new();

    client
        .post(format!("{}/api/feedback", base))
        .header("Authorization", format!("Bearer {}", user_token))
        .json(&json!({ "content": "这个按钮我有点看不懂" }))
        .send()
        .await
        .unwrap();

    client
        .post(format!("{}/api/feedback", base))
        .json(&json!({ "content": "匿名反馈也应该能看到" }))
        .send()
        .await
        .unwrap();

    let res = client
        .get(format!("{}/api/admin/feedback?page=1&per_page=20", base))
        .header("Authorization", format!("Bearer {}", admin_token))
        .header("X-Roselet-Test-Admin-Ids", admin_id)
        .send()
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body: Value = res.json().await.unwrap();
    assert_eq!(body["total"], 2);
    assert_eq!(body["page"], 1);
    assert_eq!(body["per_page"], 20);
    assert_eq!(body["data"].as_array().unwrap().len(), 2);
    assert_eq!(body["data"][0]["content"], "匿名反馈也应该能看到");
    assert!(body["data"][0]["nickname"].is_null());
    assert_eq!(body["data"][1]["content"], "这个按钮我有点看不懂");
    assert_eq!(body["data"][1]["nickname"], "feedback-member");
}
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
NO_PROXY=localhost,127.0.0.1 cargo nextest run -p roselet-backend --test api_test test_admin_feedback --no-fail-fast -j1
```

Expected: tests fail with `404 Not Found` because `/api/admin/feedback` does not exist yet.

- [ ] **Step 3: Implement admin authorization reuse**

In `crates/backend/src/routes/stats.rs`, make admin helper visible within the crate:

```rust
pub(crate) fn is_admin_user(user_id: Uuid, state: &AppState, headers: &HeaderMap) -> bool {
    let header_ids = header_admin_user_ids(headers);
    let configured_ids = if state.config.is_production {
        &state.config.admin_user_ids
    } else {
        header_ids.as_ref().unwrap_or(&state.config.admin_user_ids)
    };

    configured_ids.iter().any(|id| id == &user_id.to_string())
}
```

- [ ] **Step 4: Implement feedback listing handler**

In `crates/backend/src/routes/feedback.rs`, add response structs and handler:

```rust
#[derive(Debug, Serialize)]
pub struct AdminFeedbackItem {
    pub id: i64,
    pub user_id: Option<Uuid>,
    pub nickname: Option<String>,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct AdminFeedbackResponse {
    pub data: Vec<AdminFeedbackItem>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

#[derive(Debug, Deserialize)]
pub struct AdminFeedbackQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(sqlx::FromRow)]
struct AdminFeedbackRow {
    id: i64,
    user_id: Option<Uuid>,
    nickname: Option<String>,
    content: String,
    created_at: chrono::DateTime<chrono::Utc>,
}
```

Handler behavior:

```rust
pub async fn list_admin_feedback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AdminFeedbackQuery>,
) -> Result<Json<AdminFeedbackResponse>, AppError> {
    let user_id = auth::require_active_user_id(&state.pool, &headers, &state.jwt_secret).await?;
    if !crate::routes::stats::is_admin_user(user_id, &state, &headers) {
        return Err(AppError::Forbidden);
    }

    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).clamp(1, 50);
    let offset = (page - 1) * per_page;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feedbacks")
        .fetch_one(&state.pool)
        .await?;

    let rows = sqlx::query_as::<_, AdminFeedbackRow>(
        r#"
        SELECT f.id, f.user_id, u.nickname, f.content, f.created_at
        FROM feedbacks f
        LEFT JOIN users u ON u.id = f.user_id AND u.deleted_at IS NULL
        ORDER BY f.created_at DESC, f.id DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.pool)
    .await?;

    let total_pages = if total == 0 { 0 } else { (total + per_page - 1) / per_page };

    Ok(Json(AdminFeedbackResponse {
        data: rows.into_iter().map(|row| AdminFeedbackItem {
            id: row.id,
            user_id: row.user_id,
            nickname: row.nickname,
            content: row.content,
            created_at: row.created_at,
        }).collect(),
        total,
        page,
        per_page,
        total_pages,
    }))
}
```

- [ ] **Step 5: Wire route**

In `crates/backend/src/lib.rs`, add:

```rust
.route("/api/admin/feedback", get(routes::feedback::list_admin_feedback))
```

- [ ] **Step 6: Run backend feedback tests**

Run:

```bash
NO_PROXY=localhost,127.0.0.1 cargo nextest run -p roselet-backend --test api_test test_admin_feedback --no-fail-fast -j1
```

Expected: all `test_admin_feedback*` tests pass.

- [ ] **Step 7: Commit backend API**

```bash
git add crates/backend/src/routes/stats.rs crates/backend/src/routes/feedback.rs crates/backend/src/lib.rs crates/backend/tests/api_test.rs
git commit -m "feat: add admin feedback API"
```

## Task 2: Admin Feedback UI

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/__tests__/api.test.ts`
- Modify: `apps/web/src/app/stats/page.tsx`
- Modify: `apps/web/src/app/stats/__tests__/page.test.tsx`

- [ ] **Step 1: Write failing API client tests**

Add tests in `apps/web/src/lib/__tests__/api.test.ts`:

```ts
describe("getAdminFeedback", () => {
  it("loads admin feedback with auth header", async () => {
    const { getAdminFeedback } = await import("../api");
    setToken("admin-token");
    const payload = {
      data: [{
        id: 1,
        user_id: "u1",
        nickname: "alice",
        content: "页面很好看",
        created_at: "2026-06-25T10:00:00Z",
      }],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
    };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => payload });

    await expect(getAdminFeedback()).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/admin/feedback?page=1&per_page=20",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer admin-token" }),
      }),
    );
  });

  it("throws forbidden for non-admin feedback requests", async () => {
    const { getAdminFeedback } = await import("../api");
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });

    await expect(getAdminFeedback()).rejects.toThrow("ADMIN_FEEDBACK_FORBIDDEN");
  });
});
```

- [ ] **Step 2: Run failing API client tests**

Run:

```bash
pnpm --filter web test -- src/lib/__tests__/api.test.ts -t getAdminFeedback
```

Expected: fail because `getAdminFeedback` is not exported.

- [ ] **Step 3: Implement API client**

In `apps/web/src/lib/api.ts`, add interfaces and function:

```ts
export interface AdminFeedbackItem {
  id: number;
  user_id: string | null;
  nickname: string | null;
  content: string;
  created_at: string;
}

export interface AdminFeedbackResponse {
  data: AdminFeedbackItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export async function getAdminFeedback(page = 1, perPage = 20): Promise<AdminFeedbackResponse> {
  const res = await authFetch(`${READ_API_BASE}/api/admin/feedback?page=${page}&per_page=${perPage}`, {
    headers: authHeaders(),
  });
  if (res.status === 403) throw new Error("ADMIN_FEEDBACK_FORBIDDEN");
  if (!res.ok) throw new Error("Failed to fetch admin feedback");
  return res.json();
}
```

- [ ] **Step 4: Add stats page tests**

Mock `getAdminFeedback` in `apps/web/src/app/stats/__tests__/page.test.tsx` and add:

```tsx
it("shows recent feedback content for admins", async () => {
  getUsageStats.mockResolvedValue(mockStats());
  getAdminFeedback.mockResolvedValue({
    data: [{
      id: 1,
      user_id: "u1",
      nickname: "alice",
      content: "我找不到送玫瑰入口",
      created_at: "2026-06-25T10:00:00Z",
    }],
    total: 1,
    page: 1,
    per_page: 20,
    total_pages: 1,
  });

  render(<StatsPage />);

  await waitFor(() => expect(screen.getByText("我找不到送玫瑰入口")).toBeInTheDocument());
  expect(screen.getByText("alice")).toBeInTheDocument();
});

it("keeps stats visible when feedback inbox fails", async () => {
  getUsageStats.mockResolvedValue(mockStats());
  getAdminFeedback.mockRejectedValue(new Error("offline"));

  render(<StatsPage />);

  await waitFor(() => expect(screen.getByText("12 / 100")).toBeInTheDocument());
  expect(screen.getByText("反馈暂时加载失败")).toBeInTheDocument();
});
```

- [ ] **Step 5: Implement stats feedback section**

In `apps/web/src/app/stats/page.tsx`, load stats and feedback independently. Keep existing forbidden behavior driven by `getUsageStats`. Render a “最近反馈” section after latest timestamps.

- [ ] **Step 6: Run web tests**

Run:

```bash
pnpm --filter web test -- src/lib/__tests__/api.test.ts -t getAdminFeedback
pnpm --filter web test -- src/app/stats/__tests__/page.test.tsx
pnpm --filter web typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit feedback UI**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/__tests__/api.test.ts apps/web/src/app/stats/page.tsx apps/web/src/app/stats/__tests__/page.test.tsx
git commit -m "feat(web): show admin feedback inbox"
```

## Task 3: Version Metadata and About Page

**Files:**
- Create: `apps/web/src/lib/version.ts`
- Create: `apps/web/src/lib/__tests__/version.test.ts`
- Modify: `apps/web/src/app/about/page.tsx`
- Modify: `apps/web/src/app/about/__tests__/page.test.tsx` if present, otherwise create it.

- [ ] **Step 1: Write version utility tests**

Create `apps/web/src/lib/__tests__/version.test.ts`:

```ts
import { getAppVersionInfo } from "../version";

describe("getAppVersionInfo", () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  it("uses dev fallbacks when metadata is absent", () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    delete process.env.NEXT_PUBLIC_COMMIT_SHA;
    delete process.env.NEXT_PUBLIC_BUILD_TIME;
    delete process.env.NEXT_PUBLIC_RELEASE_NOTES_URL;

    expect(getAppVersionInfo()).toEqual({
      version: "dev",
      commit: "unknown",
      buildTime: null,
      releaseNotesUrl: null,
    });
  });

  it("reads public build metadata", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "v0.2.0";
    process.env.NEXT_PUBLIC_COMMIT_SHA = "76738cb";
    process.env.NEXT_PUBLIC_BUILD_TIME = "2026-06-25T10:00:00Z";
    process.env.NEXT_PUBLIC_RELEASE_NOTES_URL = "https://github.com/qiaopengjun5162/roselet/releases/tag/v0.2.0";

    expect(getAppVersionInfo()).toEqual({
      version: "v0.2.0",
      commit: "76738cb",
      buildTime: "2026-06-25T10:00:00Z",
      releaseNotesUrl: "https://github.com/qiaopengjun5162/roselet/releases/tag/v0.2.0",
    });
  });
});
```

- [ ] **Step 2: Implement version utility**

Create `apps/web/src/lib/version.ts`:

```ts
export interface AppVersionInfo {
  version: string;
  commit: string;
  buildTime: string | null;
  releaseNotesUrl: string | null;
}

export function getAppVersionInfo(): AppVersionInfo {
  return {
    version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
    commit: process.env.NEXT_PUBLIC_COMMIT_SHA || "unknown",
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || null,
    releaseNotesUrl: process.env.NEXT_PUBLIC_RELEASE_NOTES_URL || null,
  };
}
```

- [ ] **Step 3: Render version on about page**

Add a “当前版本” card to `apps/web/src/app/about/page.tsx` using `getAppVersionInfo()`. Show release notes link only when `releaseNotesUrl` is not null.

- [ ] **Step 4: Run tests and build**

Run:

```bash
pnpm --filter web test -- src/lib/__tests__/version.test.ts
pnpm --filter web typecheck
pnpm --filter web build
```

- [ ] **Step 5: Commit version metadata**

```bash
git add apps/web/src/lib/version.ts apps/web/src/lib/__tests__/version.test.ts apps/web/src/app/about/page.tsx
git commit -m "feat(web): show app version metadata"
```

## Task 4: Release Process Documentation

**Files:**
- Create: `docs/RELEASE_PROCESS.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Create release process doc**

Create `docs/RELEASE_PROCESS.md` with sections:

```markdown
# Roselet Release Process

## Release Rule
Production is released intentionally from a versioned release, not as a side effect of routine feature work.

## Version Source
Git tag and GitHub Release are the source of truth.

## Pre-Release Checks
- Run focused backend tests for changed Rust code.
- Run focused Web tests for changed frontend code.
- Run `pnpm --filter web typecheck` for Web changes.
- Run `NEXT_PUBLIC_API_URL=https://roselet.47.131.238.0.sslip.io pnpm --filter web build:cf` for Cloudflare Pages changes.

## Manual Smoke Test
- Home opens.
- Login/register works.
- Garden loads.
- Create rose works.
- New rose detail opens from public garden.
- My garden opens own rose.
- Feedback submits from About.
- Admin `/stats` shows feedback inbox.
- Normal user cannot access `/stats`.

## Production Release
1. Create tag, for example `v0.2.0`.
2. Write user-facing GitHub Release notes.
3. Trigger or allow production deployment.
4. Smoke test Vercel and Cloudflare.
5. Record result in `DEVLOG.md`.

## Rollback
- Frontend: roll back Vercel/Cloudflare to previous successful deployment.
- Backend: recreate backend with previous GHCR image.
- Database: avoid irreversible migrations unless a rollback plan is documented.
```

- [ ] **Step 2: Update project instructions**

Add concise release rule to `AGENTS.md` and `CLAUDE.md`:

```markdown
- 生产发布按 `docs/RELEASE_PROCESS.md` 执行；功能开发先走分支/预览/冒烟，不要把日常优化直接当作生产发布。
- 用户可见版本号以 Git tag / GitHub Release 为准，关于页展示的版本、commit、构建时间必须能追溯到发布记录。
```

- [ ] **Step 3: Verify docs**

Run:

```bash
rg -n "RELEASE_PROCESS|生产发布|GitHub Release|版本" AGENTS.md CLAUDE.md docs/RELEASE_PROCESS.md
```

- [ ] **Step 4: Commit release docs**

```bash
git add docs/RELEASE_PROCESS.md AGENTS.md CLAUDE.md DEVLOG.md
git commit -m "docs: add release process"
```

## Final Verification

- [ ] Run backend focused tests:

```bash
NO_PROXY=localhost,127.0.0.1 cargo nextest run -p roselet-backend --test api_test test_admin_feedback --no-fail-fast -j1
```

- [ ] Run web focused tests:

```bash
pnpm --filter web test -- src/lib/__tests__/api.test.ts -t getAdminFeedback
pnpm --filter web test -- src/app/stats/__tests__/page.test.tsx
pnpm --filter web test -- src/lib/__tests__/version.test.ts
```

- [ ] Run typecheck:

```bash
pnpm --filter web typecheck
```

- [ ] Run Cloudflare build:

```bash
NEXT_PUBLIC_API_URL=https://roselet.47.131.238.0.sslip.io pnpm --filter web build:cf
```

- [ ] Update `DEVLOG.md` with final verification and remaining risks.

- [ ] Push branch:

```bash
https_proxy=http://127.0.0.1:7890 git push -u origin codex/stable-iteration
```
