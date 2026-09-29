# First Learning Experience QA

這份 runbook 用隔離的本機資料庫測試既有 Book 1 第 1 課。它不代表正式課程授權，也不需要部署資料或真實兒童資料。

## Setup

在第一個 PowerShell 視窗啟動 backend，使用新的暫存資料庫：

```powershell
$env:TONGXUAN_ENV = 'development'
$env:TONGXUAN_DB_PATH = Join-Path $env:TEMP 'tongxuan-first-learning-qa.sqlite3'
$qaSecretPath = Join-Path $env:TEMP 'tongxuan-first-learning-qa-auth-secret.txt'
$env:TONGXUAN_AUTH_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:TONGXUAN_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://127.0.0.1:5183'
Set-Content -NoNewline -Path $qaSecretPath -Value $env:TONGXUAN_AUTH_SECRET
Set-Location backend
python -m uvicorn app.main:app --reload --port 8001
```

在第二個視窗啟動 frontend：

```powershell
$env:VITE_API_BASE = 'http://127.0.0.1:8001'
Set-Location frontend
npm run dev -- --host 127.0.0.1 --port 5183
```

開啟 `http://127.0.0.1:5183/TongXuan-Chinese/`。前端直接連到本機 `8001`。若這些 port 已被占用，選用空閒 port 並同步調整 `TONGXUAN_ALLOWED_ORIGINS` 和 `VITE_API_BASE`。如果資料庫檔已存在，請改用另一個檔名；不要指向正式或家庭資料庫。

## Test child and entry

1. 以一個虛構名字在 Settings / Family 建立本機測試孩子，並選中該孩子。
2. 在本機 development backend 將此孩子的 placement 設為 Book 1。API 仍要求 parent session；在新 PowerShell 視窗讀取同一個本機測試 secret，簽發只授權此測試 child 的暫時 token。將 `$childId` 換成 `/api/children` 回傳的 ID：

   ```powershell
   $childId = 1
   $env:TONGXUAN_AUTH_SECRET = Get-Content (Join-Path $env:TEMP 'tongxuan-first-learning-qa-auth-secret.txt') -Raw
   $token = python -c "from app.auth import issue_session; print(issue_session(subject='local-qa-parent', role='parent', child_ids=[$childId]))"
   $headers = @{ Authorization = "Bearer $token" }
   $body = @{
     domain_levels = @{
       listening = 'BOOK_1'; recognition = 'BOOK_1'; speaking = 'BOOK_1'
       pronunciation = 'BOOK_1'; reading = 'BOOK_1'; vocabulary = 'BOOK_1'
       writing = 'BOOK_1'; grammar = 'BOOK_1'
     }
     assessment_method = 'PARENT_OBSERVATION'
     age_hint_years = 7
   } | ConvertTo-Json -Depth 4
   Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:8001/api/children/$childId/placement-profile" -Headers $headers -ContentType 'application/json' -Body $body
   ```

3. 重新整理 Home。確認 Today / Daily Queue 顯示 Book 1 第 1 課，並由 Home 的「開始今天的課程」入口進入。不要以直接呼叫 start-session API 代替這項入口檢查。

繁體與簡體請各用一個新的虛構測試孩子執行；在 Settings 設定該孩子的學習字形。顯示語言設定不應改變學習字形。

## Traditional run: 1–9

逐步記錄畫面上的進度和是否能按主要按鈕繼續：

1. **情境理解**：情境／聆聽內容可見；音訊失敗時仍可繼續或重試。
2. **課文／對話**：課文可見，顯示繁體與注音；重播音訊不重開 session。
3. **核心生詞**：生詞、注音、提示和選項可見；選擇後有成功或錯誤回饋。
4. **認識生字**：逐一回答本課字題。故意答錯一次，確認有錯誤回饋、題目可重答，且沒有前進到下一步；正確作答後才前進。
5. **實用句型**：完成句型選擇，確認成功／重答回饋與 Next 行為正常。
6. **開口使用**：允許麥克風，開始並停止錄音。正常結果是「練習已記錄」，不是發音分數。拒絕權限時，確認錯誤可理解且可重試；原始錄音不應留存在產品資料中。
7. **筆順書寫**：確認顯示的字形符合繁體目標，嘗試引導描寫並繼續。此處用戶端筆跡結果不等於權威精熟度；若略過可選練習，確認 UI 如實顯示。
8. **Exit Ticket**：完成所有題目，故意答錯一次再修正；不應卡住、重置整堂或把錯答記成正確。
9. **結算**：只有按完成／結算後 session 才能完成。確認完成活動與既有獎勵資訊合理，沒有虛構精熟百分比；Finish 返回 Home。

## Simplified run

對另一個新測試孩子切換簡體字形，從 Home 重新開始。核對課文、字詞與輸入目標使用簡體和拼音；順序、題目數量、錄音和結算政策應與繁體路徑相同。

## Refresh, exit, and resume

- 在 Step 4 完成至少一題後重新整理。應回到同一個 session，已完成題目保留，未完成題目仍可操作。
- 在 Step 7 使用 lesson exit。確認先出現離開確認；保存並離開後，從 Home 再次選擇今天的課程，應繼續同一個 session，而非建立新課。
- 在 Step 9 完成後重新整理。該 session 應維持 `COMPLETED`，不能再次結算或重複獎勵。
- 慢速網路或重複點擊下，確認 loading／disabled 狀態清楚；同一答題不應產生重複 evidence、SRS event 或獎勵。

## API / DB spot check

瀏覽器 DevTools Network 可查看 Home queue、session start、各 task answer/evidence，以及完成 API。記下 session ID 後，在本機暫存 SQLite 檢查：

```powershell
python -c "import os,sqlite3; db=sqlite3.connect(os.environ['TONGXUAN_DB_PATH']); db.row_factory=sqlite3.Row; sid='PASTE_SESSION_ID'; print(dict(db.execute('select id,status,lesson_id,started_at,completed_at,reward_points from learning_flow_sessions where id=?',(sid,)).fetchone())); print([dict(r) for r in db.execute('select id,task_type,state,attempt_count,failure_count from learning_flow_tasks where session_id=? order by position',(sid,))]); print([dict(r) for r in db.execute('select dimension,script,outcome,source_task_id from learner_evidence_events where source_session_id=? order by occurred_at',(sid,))]); print([dict(r) for r in db.execute('select skill_domain,item_id,stage,due_at,last_result from srs_review_states where child_id=(select child_id from learning_flow_sessions where id=?) order by skill_domain,item_id',(sid,))]); db.close()"
```

Expected: one completed session; required tasks in `COMPLETED` (or an explicitly policy-allowed state); recognition evidence uses `ORTHOGRAPHIC_RECOGNITION`; speaking evidence is `SPEAK` / `NOT_ASSESSED`; handwriting remains `HANDWRITING` / `NOT_ASSESSED` when based on client trace; existing SRS rows are present without a newly invented interval policy. Compare child IDs when switching learners to ensure the other child's session and evidence stay isolated.

## Coverage and limits

Backend integration tests and frontend Lesson Player tests cover the deterministic end-to-end lifecycle, both scripts, wrong answers, provider commits, resume, duplicate settlement and evidence persistence. This repository has no browser E2E framework, so those suites are not a claim of a real browser end-to-end run. Record browser dimensions and any issue as **BLOCKER**, **FRICTION**, or **POLISH**. Desktop and local browser checks can be completed with this runbook; real iPad and real-child validation must be recorded separately and are not implied by automated results.

### Verification results — 2026-09-29

| Check | Result | Scope / limit |
| --- | --- | --- |
| Full backend pytest | PASS — 336 passed, 93 warnings | Full backend suite; warnings are existing SQLite datetime adapter deprecations. |
| Full frontend Vitest | PASS — 183 passed across 16 files | Full frontend suite. |
| Production build | PASS | `npm run build`. |
| Canonical production import guard | PASS — 38 production modules, no archived React source | Production import graph check. |
| Production artifact check | PASS | Built artifact scan. |
| Python compile check | PASS | `python -m compileall -q backend`. |
| Root final smoke | PASS | All 10 listed domains; `read_only_verified: true`. |
| Open Curriculum rights gate | PASS | `python scripts/open_curriculum_rights_gate.py --check`. |
| Migration check | N/A | No database schema migration in this change. |
| Desktop browser manual flow | PARTIAL | Real Home CTA → `/learning-session` → Step 1, wrong-answer feedback/retry, persisted completion, Step 2 reload/resume, exit confirmation and return Home. Not a full nine-step manual course run. |
| Tablet viewport checks (768×1024, 820×1180, 1024×1366) | NOT VERIFIED | The manual run did not exercise these viewport sizes, keyboard overlay, or tablet touch targets. |
| iPad / real child | NOT VERIFIED | Requires real device and owner-supervised child validation. |

### Nine-step status

| Step | Automated coverage | Browser manual status |
| --- | --- | --- |
| 1. Context and listening | WORKING — integration covers task outcomes and resume | PARTIAL — entered from Home; deliberately wrong answer showed failure, corrected answer completed; audio-failure recovery not manually exercised. |
| 2. Lesson / dialogue | WORKING — package, script, task sequence and persistence covered | PARTIAL — reached after Step 1 and restored at the same step after reload; dialogue replay was not manually exercised. |
| 3. Core vocabulary | WORKING — task contract and answer evidence covered | PARTIAL — not manually completed in browser. |
| 4. Character recognition | WORKING — authoritative answer/evidence and retry covered | PARTIAL — browser smoke's wrong answer was on Step 1, not this step; not manually completed. |
| 5. Sentence pattern | WORKING — task contract and progression covered | PARTIAL — not manually completed in browser. |
| 6. Speaking | WORKING — provider commit, evidence, retry and failure paths covered by backend integration | BLOCKED for live browser capture — microphone permission was not granted; no real recording was made. |
| 7. Handwriting | WORKING — task/result policy covered; client trace is not mastery evidence | PARTIAL — not manually completed or drawn in browser. |
| 8. Exit ticket | WORKING — task outcomes, retry and progression covered | PARTIAL — not manually completed in browser. |
| 9. Settlement | WORKING — completion, duplicate protection and reward persistence covered by integration | PARTIAL — not manually settled through the browser. |

### Browser finding severity

- **BLOCKER — learner identity / reward source mismatch:** Home's legacy demonstration learner and reward badge are not bound to the backend-selected child. In the browser smoke, Settings and the Daily Queue used the fictional backend child, while Home displayed a local demo identity and demo balance. The CTA still opened that backend child's correct session. Do not present the Home badge as authoritative child progress until the identity surfaces are unified. This milestone records and exposes the issue; it does not redesign Home or rewrite unrelated profile flows.
- **FRICTION — manual nine-step proof requires a permissioned microphone:** live speaking capture was not tested because microphone permission was not granted. Automated provider transaction coverage passed.
- **NOT VERIFIED — device / learner validation:** no iPad or real child was used.
- **NOT VERIFIED — cross-cutting manual checks:** Simplified-script browser run, child switching in the browser, full-session TTS replay/error recovery, handwriting interaction, post-settlement parent progress, slow-network/double-tap browser behavior, and the requested tablet viewport checks were not manually exercised. Backend/frontend suites cover their deterministic contracts where listed above.

## Git handoff

- Merged PR #111 SHA: `f3b91d2315bf978d03eb83f23d20a78bae72e8e9`.
- Merged PR #112 SHA: `de116187db0e220b2e628138fba9fadb20b214ba`.
- Implementation branch: `codex/first-complete-learning-experience`.
- Draft PR: linked in the PR description after push; use GitHub's current PR head SHA as the exact review target.

## Local smoke run — 2026-09-29

- Started this worktree's backend on `8001` with a new temporary SQLite database and frontend on `5183`; existing listeners on `8000`, `5173`, and `5174` were left untouched.
- Created a fictional backend child through Settings, set Book 1 placement in the temporary database, and confirmed the authoritative Daily Queue returned `book1-l01`.
- From canonical Home, the primary `開始今日學習` action opened `/learning-session` and rendered Book 1 Lesson 1, Step 1 of 9.
- A wrong context answer persisted as one failure; the corrected answer completed the exact task. SQLite then showed the same session still `IN_PROGRESS`, with Step 1 tasks completed and later tasks pending.
- Reload restored the same session at Step 2. This verifies the browser entry, first task persistence, and resume path; the full nine-step browser run was not completed manually.
- **BLOCKER observed:** the Home's legacy demonstration learner badge/reward state is separate from the backend-selected child in Settings. During this smoke the Home badge showed a local demo profile while the Daily Queue and session used backend child `1`. The CTA reached the correct backend session, but the visible learner identity/rewards must not be treated as backend progress evidence. No UI redesign or unrelated profile rewrite was included in this milestone.
- Automated backend and frontend tests cover full settlement and provider transaction paths. Browser microphone permission and real-device/real-child use were not granted or verified in this local smoke.
- After stopping both servers, remove the temporary database and secret file with `Remove-Item -LiteralPath` for the exact files created by this run. The isolated SQLite database was removed after the smoke. The in-app browser's local demo-profile deletion confirmation did not complete reliably; the test-only `QA Demo 20260929` entry may remain in that browser's local storage for the `127.0.0.1:5183` origin. It is not a backend child and does not affect other origins.
