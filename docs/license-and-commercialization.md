# Phase 0A：License Tracking & Commercialization Gate

## 目的

本專案目前是家庭私人使用系統。家庭版不因未來可能商業化而犧牲兩名兒童的學習功能；但每一項第三方元件、內容、圖片、語音、字體、資料集、API 與家長提供的教材，都必須記錄來源與授權狀態。

「目前可供家庭使用」與「可供商業發布」是兩個獨立判定，不得混為一談。

## Build target

```text
BUILD_TARGET=family
BUILD_TARGET=commercial
```

### Family Build

允許：

```text
PRIVATE_OK
COMMERCIAL_OK
COMMERCIAL_LICENSE_REQUIRED
LICENSE_REVIEW_REQUIRED
REPLACE_BEFORE_COMMERCIAL
```

其中非 `COMMERCIAL_OK` 的資源必須在系統中留下警告，並且 `commercial_ready=false`。

### Commercial Build

只允許：

```text
COMMERCIAL_OK
```

或已另外取得商業授權、完成登記且有可追溯證據的資源。以下狀態一律 fail：

```text
PRIVATE_OK
COMMERCIAL_LICENSE_REQUIRED
LICENSE_REVIEW_REQUIRED
REPLACE_BEFORE_COMMERCIAL
PROHIBITED
```

## License status

```text
PRIVATE_OK
COMMERCIAL_OK
COMMERCIAL_LICENSE_REQUIRED
LICENSE_REVIEW_REQUIRED
REPLACE_BEFORE_COMMERCIAL
PROHIBITED
```

`PROHIBITED` 代表目前使用方式不符合授權條件，不得進入任何 Build；例如教育或研究授權的資料，不應因尚未商用而直接標為 `PROHIBITED`。

## Provenance 必填欄位

每項資源至少保存：

```text
resource_id
resource_type
source_name
source_url
license_name
usage_status
private_use_allowed
commercial_use_allowed
commercial_license_required
commercial_replacement_required
technical_usable
commercial_ready
commercial_action
notes
```

可直接參考 [data/license-registry.json](../data/license-registry.json) 的資料格式。

## 家長提供的學校教材

School Queue 的課文照片、Worksheet、老師指定生字、考試範圍與課文文字，必須標記：

```text
source_type=USER_PROVIDED_SCHOOL_CONTENT
private_learning_use=true
public_curriculum_reuse=false
commercial_reuse=false
```

這些資料只供該家庭私人分析，不得自動加入公共題庫或官方 Curriculum。商業產品可以保留「家長上傳自己孩子教材進行私人分析」的功能，但不得把上傳內容變成公共內容。

## Commercial Replacement Registry

對需要替換或取得授權的資源，登記：

```text
resource_id
current_source
current_license
commercial_issue
replacement_candidate
license_option
estimated_work
status
```

Commercialization Gate 必須逐項處理，直到 `commercial_blockers=0`。

## CI 行為

```text
Family Build:
  PRIVATE_OK                    PASS
  COMMERCIAL_OK                 PASS
  COMMERCIAL_LICENSE_REQUIRED   WARNING
  LICENSE_REVIEW_REQUIRED       WARNING
  REPLACE_BEFORE_COMMERCIAL     WARNING
  PROHIBITED                    FAIL

Commercial Build:
  COMMERCIAL_OK                 PASS
  all other statuses            FAIL
```

警告不能隱藏；每次 Build 都應輸出資源名稱、來源、授權狀態與 commercial action。

## Phase 18：Commercialization Gate & Release Audit

真正準備販售時才執行完整審計：

1. 掃描全部 dependencies、content、圖片、語音、字體、datasets 與第三方 API。
2. 驗證 provenance 欄位完整，並檢查授權證據與替代方案。
3. 處理所有 `PRIVATE_OK`、`COMMERCIAL_LICENSE_REQUIRED`、`REPLACE_BEFORE_COMMERCIAL`、`LICENSE_REVIEW_REQUIRED`。
4. 確認 commercial blockers 為 0。
5. 才能產生 `COMMERCIAL RELEASE BUILD`。
