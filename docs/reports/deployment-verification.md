# 部署完成與線上驗證

驗證時間（UTC）：2026-10-18T06:06:44.580773+00:00。本記錄在程式部署及線上檢查後新增，不更動程式資產。

- 應用程式提交：[`5dbca84`](https://github.com/dropout-tech/kt-crm-demo/commit/5dbca84445ea1ea24f882e7bea31392a17801295)。
- 既有發布方式：公司 repo `main` 根目錄，GitHub Pages。沒有新 Cloudflare 服務、費用、持久存取或憑證。
- [Pages 部署工作](https://github.com/dropout-tech/kt-crm-demo/actions/runs/39102746196)：`completed / success`，對應上述應用提交；Pages build 狀態 `built`，沒有建置錯誤。
- [免登入示範](https://dropout-tech.github.io/kt-crm-demo/) 與[逐週草案](https://dropout-tech.github.io/kt-crm-demo/weekly-plan.html)均已回讀。

## 回讀與煙霧測試

HTML、app.js、model.js、quote-pdf.js、styles.css、原始 Logo、weekly-plan.html 共 **7 個線上檔案**皆 HTTP 200，SHA256 全部與本機發布包一致。[逐檔雜湊](live-asset-hashes.json)。

在實際公司網址，以全新 Chrome context 執行 **85 項線上檢查，全部通過**：[機器可讀結果](live-smoke.json)。

| 套件 | 通過項數 | 驗證重點 |
| --- | ---: | --- |
| 核心流程 | 50 | 客戶、記事、零／多筆下一步、商機／產品、舊資料相容、獨立 context 不同步、五種尺寸 |
| 功能簡表 | 15 | 01–50 編號與搜尋、移除功能評審、四個手機主入口、版型 |
| 合成定位與報價 | 18 | 四種合成情境、客戶／方式切換清除、業務確認、主管退回／核准、升版失效、PDF 下載、五種尺寸 |
| 逐週草案 | 2 | 桌機與手機完整顯示 11 節點、9 項差距、10 項估工與起算條件 |

瀏覽器執行錯誤、外部 API 請求與真實定位 API 呼叫均為零。另有 43 項模型／PDF 結構測試、lint、build 與離線版同流程 18 項測試通過，見[技術報告](2026-10-18-crm-demo.md)。

已檢視線上手機畫面與 PDF 渲染。實體 iPhone／Android、Safari、真實 GPS 權限、人工 LINE 分享未驗證；Chrome viewport 結果不能代替實機驗收。

## 正式系統狀態

網站仍是**需求確認用原型／模擬資料**，只存目前瀏覽器、不跨人同步。定位僅合成測試；報價 PDF 每頁標示測試樣張／範本待確認／不可對外正式報價。沒有正式後端、具名登入、三層伺服器授權、正式報價範本與稅額規則，沒有 ERP／庫存串接。靜態部署不代表正式共用 CRM 完成。

本次公開白名單包含來源、測試、技術報告、部署操作與逐週草案，沒有型錄全文、內部逐字稿／來源連結、真客戶資料、個人電腦路徑或憑證。
