# KING TILE 鉅成 CRM 示範

免登入、全部使用合成資料的靜態流程示範。資料僅保存在目前瀏覽器，不跨人、裝置或網址同步。請勿填入真實客戶個資或機密。

- [開啟示範](https://dropout-tech.github.io/kt-crm-demo/)
- [逐週交付草案](https://dropout-tech.github.io/kt-crm-demo/weekly-plan.html)（估工與日期皆有前置條件，非完成承諾）
- [本次技術報告](docs/reports/2026-10-18-crm-demo.md)
- [部署／回復操作](docs/DEPLOYMENT.md)

可操作客戶與聯絡人、分類、互動記事、商機、產品系列多選／未定、零至多筆下一步及後補關聯。功能大全維持 01–50 唯讀簡表，沒有功能評審或意願記錄。介面採系統字體、分組表面、圓角、清楚層級與四個手機主入口，保留官網原始 KING TILE 品牌。

現場拜訪只試走合成定位成功／拒絕／逾時／不支援，不呼叫裝置位置。報價可試草稿→業務確認→主管模擬審核→測試 PDF；修改升版使舊確認與核准失效。PDF 每頁標示「測試樣張／範本待確認／不可對外正式報價」。產物為影像型 PDF，非正式或可搜尋文字的報價範本。

角色切換和前端檢查只示範流程，不是安全邊界；正式登入、三層授權、共享後端、真實 GPS、正式計價／稅額與範本、ERP 建單及庫存均未完成。沒有 production API、發訊或下單。LINE 只作手動記錄的聯繫方式。

## 開發與驗證

可編輯來源在 `src/`，根目錄是 Pages 發布產物。無執行期依賴；開發驗證需近期 Node.js、Python 3 及 Chrome。

```sh
npm ci
npm test
npm run lint
npm run build
npm run dev
```

本機 `http://127.0.0.1:4173/` 運作時：

```sh
npm run test:browser
node tests/catalog-browser.cjs
node tests/quote-browser.cjs
```

瀏覽器測試在本次驗證使用 Mac 的 Google Chrome；其他平台需調整測試檔內 executablePath。可用 `CRM_BASE_URL`、`CRM_ARTIFACT_DIR` 指定測試網址與證據位置。離線單檔可用 `node scripts/package-local.cjs /absolute/path/demo.html` 產生。測試、來源與文件皆使用合成情境；未上傳型錄全文、內部逐字稿、憑證或真客戶資料。
