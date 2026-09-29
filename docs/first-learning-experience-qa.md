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

逐步記錄畫面上的進度和是否能按主要按鈕繼續。以下是未來可達時的測試步驟，不代表已驗證；每次測試只能沿現有實際政策前進。若 Step 6 停止政策把任務 deferred，保持在 Step 6 並記錄後續為 NOT VERIFIED，不可更改資料庫或 session pointer 來進入後續步驟。

1. **情境理解**：情境／聆聽內容可見；音訊失敗時仍可繼續或重試。
2. **課文／對話**：課文可見，顯示繁體與注音；重播音訊不重開 session。
3. **核心生詞**：生詞、注音、提示和選項可見；選擇後有成功或錯誤回饋。
4. **認識生字**：逐一回答本課字題。故意答錯一次，確認有錯誤回饋、題目可重答，且沒有前進到下一步；正確作答後才前進。
5. **實用句型**：完成句型選擇，確認成功／重答回饋與 Next 行為正常。
6. **開口使用**：在 Owner 裝置檢查麥克風時，確認錄音只在裝置端短暫處理，正常結果是「練習已記錄」，不是發音分數。若 `getUserMedia` 失敗，原因可能是裝置不可用、權限拒絕或其他瀏覽器錯誤；錯誤訊息不可單憑失敗就宣稱家長或 Owner 拒絕權限。確認可重試並保留原有離開／從首頁續接提示；只有後端回傳完成及有效證據的口說任務才可前進。不得模擬語音、把 abort 當成功或手動略過。
7. **筆順書寫**：確認顯示的字形符合繁體目標，嘗試引導描寫並繼續。此處用戶端筆跡結果不等於權威精熟度；若略過可選練習，確認 UI 如實顯示。
8. **Exit Ticket**：完成所有題目，故意答錯一次再修正；不應卡住、重置整堂或把錯答記成正確。
9. **結算**：只有按完成／結算後 session 才能完成。確認完成活動與既有獎勵資訊合理，沒有虛構精熟百分比；Finish 返回 Home。

## Simplified run

對另一個新測試孩子切換簡體字形，從 Home 重新開始。核對課文、字詞與輸入目標使用簡體和拼音；順序、題目數量、錄音和結算政策應與繁體路徑相同。

## Refresh, exit, and resume

- 在 Step 4 完成至少一題後重新整理。應回到同一個 session，已完成題目保留，未完成題目仍可操作。
- 在任何可達步驟使用 lesson exit。確認先出現離開確認；保存並離開後，從 Home 再次選擇今天的課程，應繼續同一個 session，而非建立新課。若 Step 6 停止政策使後續步驟不可達，僅驗證 Step 6 的退出／恢復並停止。
- 在 Step 9 完成後重新整理。該 session 應維持 `COMPLETED`，不能再次結算或重複獎勵。
- 慢速網路或重複點擊下，確認 loading／disabled 狀態清楚；同一答題不應產生重複 evidence、SRS event 或獎勵。

## API / DB spot check

瀏覽器 DevTools Network 可查看 Home queue、session start、各 task answer/evidence，以及完成 API。記下 session ID 後，在本機暫存 SQLite 檢查：

```powershell
python -c "import os,sqlite3; db=sqlite3.connect(os.environ['TONGXUAN_DB_PATH']); db.row_factory=sqlite3.Row; sid='PASTE_SESSION_ID'; print(dict(db.execute('select id,status,lesson_id,started_at,completed_at,reward_points from learning_flow_sessions where id=?',(sid,)).fetchone())); print([dict(r) for r in db.execute('select id,task_type,state,attempt_count,failure_count from learning_flow_tasks where session_id=? order by position',(sid,))]); print([dict(r) for r in db.execute('select dimension,script,outcome,source_task_id from learner_evidence_events where source_session_id=? order by occurred_at',(sid,))]); print([dict(r) for r in db.execute('select skill_domain,item_id,stage,due_at,last_result from srs_review_states where child_id=(select child_id from learning_flow_sessions where id=?) order by skill_domain,item_id',(sid,))]); db.close()"
```

Expected for a genuinely completed run: one completed session; required tasks in `COMPLETED` (or an explicitly policy-allowed state); recognition evidence uses `ORTHOGRAPHIC_RECOGNITION`; speaking evidence is `SPEAK` / `NOT_ASSESSED`; handwriting remains `HANDWRITING` / `NOT_ASSESSED` when based on client trace; existing SRS rows are present without a newly invented interval policy. A paused/stopped Step 6 run is not completion; verify there is no speaking `evidence_ref` or completion timestamp. Compare child IDs when switching learners to ensure the other child's session and evidence stay isolated. These are read-only checks: never edit task rows, database state, or session pointers to force progress.

## Evidence ownership and limits — Issue #114

This runbook separates observed evidence from planned procedures. The implementation report is not PM acceptance. Product Governor must independently record verification_matrix, owner_validation_required, release_blockers, and required_changes after this handoff.

### AUTOMATED

| Criterion | Evidence | Result and limit |
| --- | --- | --- |
| Home child isolation, identity, queue, CTA, and unsupported rewards | Frontend child-first regressions, including child A versus child B/demo identity and reward display cases | Final full Vitest result recorded below. This does not substitute for the live browser identity/session check. |
| Book 1 Simplified display text and unchanged source/task/answer identifiers | Lesson Player regressions for Traditional and Simplified rendering and exact answer choices | Final full Vitest result recorded below. The scoped runtime display correction does not rewrite package text or IDs. |
| Step 6 retryable partial success, getUserMedia error classification, attempt cleanup, deferred-resume and exact-task Next/capture gating | Lesson Player regressions for provider/task evidence persistence, pronunciation failure after speaking success, pronunciation-only retry, authoritative completion, abort cleanup, and either exact task deferred; readingAloud regressions cover unavailable API, generic capture rejection, and legacy denial code | Final full frontend result is recorded below. The partial-success path uses mocked provider and API responses; no fake browser speech or real microphone success is claimed. |
| Full backend pytest, full frontend Vitest, production build and canonical import guard | Commands and outcomes below | Both full suites pass. Backend pytest required transient `requests`, which is not declared in `backend/requirements.txt`. Standard npm build remains blocked by workspace path access; the Vite runner build passes. |
| Open Curriculum Rights Gate and git diff --check | Digest refresh is run only after the last content edit, then check and diff check | Final outcomes recorded below. No official course rights assertion is made. |

### Canonical frontend chain — seven checks

1. Branch: `codex/first-complete-learning-experience`; QA follows the existing branch tip. Check the current remote PR SHA and GitHub Actions after push.
2. Production entry: `frontend/src/main.tsx`.
3. Target learner route for Step 6: `/learning-session`.
4. Final component: `LessonPlayerPage`.
5. Production `AppShell` lazily imports `LessonPlayerPage` and renders it for `/learning-session`.
6. The archive contains only its historical preview note; legacy player routes are retired and no similarly named archived component is in the active production source.
7. The production build and canonical import guard confirm the active graph is included; the guard found 38 production modules and no archived React source.

### CODEX_RUNTIME — actual browser evidence

- Canonical route: Chrome opened the local production-flow development app at the canonical / route, then entered /learning-session through the Home CTA. Backend ran at 127.0.0.1:8000; frontend ran at 127.0.0.1:49231/TongXuan-Chinese/ because the normal ports were unavailable. The isolated database was %TEMP%/tongxuan-issue114-bfec915019c64248a6b71bc82cef6b67.sqlite3.
- A fictional backend child named QA Traditional 114 (child ID 1) was created through the app and selected. Home displayed that selected child. Its Today queue and CTA launched session learning_flow_a31baf58d0ac for child 1, lesson book1-l01, Traditional/Zhuyin. The Home CTA and session therefore used the same backend child. Home displayed no unsupported demo reward or progress totals.
- A fresh same-origin Home tab at 1278×843 was checked after its first render settled. The immediate post-reload capture was a partial first paint: AX already contained the learner name, while the screenshot showed incomplete header styling and a 12-node timeline. A later capture on the same tab showed the logo, Q identity tile, “早安 · QA Traditional 114”, and the expected 3-course timeline. The initial “4” avatar was changed to the learner name's first character because the trailing digit resembled progress. The normal Home CTA launch evidence above still binds the queue, learner, and session to backend child 1.
- Traditional/Zhuyin: current browser completed the normal reachable Steps 1–5 by visible UI choices. The Book 1 name appeared in Traditional form in dialogue, vocabulary, and sentence pattern.
- Simplified/Pinyin: the prior local browser record in this worktree exercised the Home CTA and Steps 1–5 with a separate fictional child. Steps 2, 3, and 5 displayed 大卫 and Pinyin, including the Step 2 speaker accessibility name. No source package, task ID, answer choice ID, or answer key was changed.
- Step 6: Chrome produced a genuine getUserMedia capture failure without a permission prompt. The UI presented general device/browser guidance and a retry action; this error did not establish permission denial. One retry produced another genuine failure. The existing SPEAKING_ABORTS stop policy paused the same session. The learner used the visible exit confirmation to return Home; Home CTA resumed the same session at Step 6.
- Exact read-only API evidence after resume: session ID learning_flow_a31baf58d0ac, child 1, status IN_PROGRESS. The speaking task is DEFERRED with attemptCount 2, completedAt null, evidenceRef null. The pronunciation task is PENDING with no completion or evidence. After the code fix, the live Step 6 view shows a missing-evidence alert; microphone and Next are both disabled. A screenshot confirmed the disabled microphone is also visibly muted. No Next action was taken to enter an unverified later step.
- The retryable partial-success path added in this correction is covered by automated regression only; no live recording or provider success was exercised.
- Browser Home after a normal manual exit from Step 6 was observed. Home return after lesson settlement was not verified.

### CODEX_RUNTIME — limits and unvisited flow

- The existing stop policy leaves the speaking task terminal-deferred after two aborted attempts. The backend does not return authoritative speech evidence, and this session cannot advance. Steps 7–9, settlement, and Home return after settlement are NOT VERIFIED. No speech was faked, no session pointer/database/task was edited, no abort was treated as success, and no skip route was added.
- Both script paths were observed only through Step 5. Browser Step 6 failure/retry/exit/resume was observed on the Traditional path. The full normal audio-success path is unvisited.
- Browser evidence is Codex runtime evidence, not iPad Safari, physical microphone, touch/Apple Pencil, or supervised child testing. The latest 390×844 identity-pill check is NOT VERIFIED: the independent viewport tool was blocked by its approval gate, and the available CUA interface had no viewport override. No page or state changed during that failed attempt. The earlier 390×844 check predates the current identity CSS and does not count as current narrow-width evidence.
- For this correction, Chrome was available through the CUA extension with two unrelated user tabs; both were left untouched. No TongXuan browser tab or local app runtime was launched or verified, and the partial-success retry regression is automated evidence only.
- Browser navigation to /learning-session was triggered through the production Home CTA. No archive or preview route was used.

### OWNER_DEVICE

Required separately: real iPad Safari microphone permission/capture and recovery; physical touch and Apple Pencil/handwriting interaction; supervised child usability. These checks were not obtainable in this workspace, are not fabricated, and do not block Coding acceptance.

### EXTERNAL

GitHub Actions for the revised branch tip and Architect review have not been checked. Local test/build results are not GitHub CI. Check the current remote PR SHA and CI after push. Coding made no commit, push, or GitHub write; verify the existing PR's Draft state in the remote handoff.

### Review handoff

- Branch: `codex/first-complete-learning-experience`; QA follows the existing branch tip.
- After push, check that the remote PR SHA matches the pushed tip and review the corresponding GitHub Actions result.
- Next gate: Product Governor's independent PM acceptance, followed by Architect review against the exact remote PR head. Keep the existing PR Draft; its remote state is EXTERNAL and was not changed or checked by Coding.

### Frontend auditor checklist — separate review pass, findings only

- **Primary action and hierarchy:** Home visibly prioritizes the selected child’s Today lesson CTA; parent controls remain behind Settings. No rewards or unsupported progress totals appear. Existing Home shows a second CTA in the lesson card; this is a hierarchy polish finding, unchanged by this bounded correction.
- **Responsive behavior and media crop:** Settled Home identity was visibly rechecked at 1278×843. The current 390×844 identity-pill check is NOT VERIFIED because the viewport connector was blocked by its approval gate and CUA has no viewport override; the prior narrow-width observation predates this CSS change. Step 6 error state was visually checked at the desktop browser viewport, not a narrow viewport. The illustration slot is a reserved placeholder; this work did not change media or crop.
- **Visual states:** Earlier runtime review observed Step 6 normal, terminal error, and disabled states. After a terminal speaking deferral, the error is visible, mic and Next are disabled, and mic disabled styling is visibly muted. The retryable partial-success error with an enabled mic added in this correction is covered by automated regression only and was not visually rechecked. Earlier real browser checks covered a retry before the stop threshold. Hover and pressed states were not separately checked in this run.
- **Accessibility and reduced motion — NOT VERIFIED:** the browser accessibility tree exposes the error as an alert and reports the mic and Next controls disabled. The mic has a localized accessible label; global focus-visible styling remains in place. Reduced-motion emulation was not verified because the browser media-emulation action was unavailable.
- **Tests and build:** full frontend test, full backend test, standard npm build, Vite runner build, canonical import guard, Rights Gate, and diff results are recorded below.
- **Learning behavior:** no scoring, SRS, mastery, curriculum, task plan, answer key, package text, or backend policy changed. Step 6 now advances only when the exact backend speaking tasks are COMPLETED; DEFERRED is not treated as speech evidence.
- **Review status:** this separate checklist pass records observed facts and limits. Hover/pressed, narrow Step 6, current narrow Home identity, reduced-motion, and Owner-device behavior remain pending. Narrow-width browser review could not be performed with the available viewport tools.

### Product escalation

The existing SPEAKING_ABORTS policy makes the current session’s speaking task DEFERRED after two aborted attempts. Existing Home resume leaves that task deferred, so the learner remains on Step 6 with capture and Next disabled and no evidence. Product Governor accepted preserving this terminal state fail-closed. No recovery behavior was added.

### Latest automated verification — 2026-09-29

This follow-up reran the full frontend suite, production build paths, and canonical production import guard after the retry correction. The parent subsequently completed the full backend suite: 336/336 passed using its cached Python 3.11 `uv` environment, `backend/requirements.txt`, transient `requests`, and a unique `%TEMP%` basetemp. No `backend/.pytest-tmp-*` path was touched. Earlier parent reruns while the QA document was changing reported 335 passed/1 failure when optional `requests` was unavailable, then 336 collected with two Rights Gate digest tests racing the document edit; those attempts were superseded by the final stable 336/336 pass. The parent’s Rights Gate `--check` passed after the previous digest refresh, but its post-edit invocation could not initialize `C:\Users\webbe\AppData\Local\uv\cache` (`os error 183`) and stopped before the script ran. This QA edit changes registered digest input; the digest refresh and final post-edit check are recorded separately below. `requests` is used by existing tests but is not declared in `backend/requirements.txt`; it was supplied transiently and no requirements file was changed.

| Check | Result | Scope / limit |
| --- | --- | --- |
| Full backend pytest | PASS — 336/336 — AUTOMATED (parent-run) | Parent used cached Python 3.11 through `uv`, `backend/requirements.txt` plus transient `requests`, and a unique `%TEMP%` basetemp. No `backend/.pytest-tmp-*` path was touched. `requests` is an undeclared test/runtime transport dependency; project requirements were not changed. |
| Full frontend Vitest | PASS — 196 passed across 16 files | `npm run test -- --configLoader runner`; includes partial-success, deferred-pronunciation, and unexpected task-state regressions. Existing React `act(...)` warnings appear in child-first tests. |
| Standard production build | BLOCKED by workspace path access | `npm run build` passed TypeScript, then standard Vite config loading failed with `Cannot read directory "../../../../..": Access is denied` and could not resolve `frontend/vite.config.js`. |
| Vite runner production build | PASS — 3,253 modules transformed and PWA output generated | `node node_modules/vite/bin/vite.js build --configLoader runner`. Existing chunk-size warning over 500 kB. This workaround does not replace the standard `npm run build` result. |
| Canonical production import guard | PASS — 38 production modules | `node scripts/assert-canonical-frontend.mjs` from `frontend/`; `frontend/src/main.tsx` → `AppShell`; `/learning-session` → `LessonPlayerPage`; no archived React source in the import graph/bundle. |
| Open Curriculum Rights Gate | PASS — post-edit digest refresh and parent-run `--check` | `python scripts/open_curriculum_rights_gate.py --refresh-digests` refreshed the registered inventory after the final QA text edit. Parent then ran `uv run --no-project --with-requirements backend/requirements.txt -- python scripts/open_curriculum_rights_gate.py --check`; the command returned exit code 0 with `Open Curriculum rights gate PASS`. This supersedes the earlier cache-initialization failure. |
| `git diff --check` | PASS | No whitespace errors. Git reported only LF-to-CRLF normalization warnings for the three edited text files. |
| Migration | N/A | No schema or migration change. |
