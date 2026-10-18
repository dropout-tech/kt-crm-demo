# 示範部署與回復

本專案既有慣例為 GitHub Pages：`dropout-tech/kt-crm-demo`、`main` 分支根目錄、legacy Pages build。既有管道可承載本次靜態示範，無需另建 Cloudflare 服務、取得新憑證或新增費用。網站免登入，只可使用合成資料；公開 repo、noindex 與 robots.txt 均不是存取控制。

## 已核准的發布範圍

程式與測試、適合公開的技術報告、部署步驟及逐週草案。只發布白名單檔案，保留舊 localStorage key／schema；內部會議來源、完整 PDF 型錄、憑證、真客戶資料、環境檔及內部資料夾不在發布範圍。

## 操作步驟

1. 抓取遠端最新 main，確認工作目錄沒有別人的未提交修改；記錄目前 main SHA。
2. 在隔離來源執行模型測試、lint、build、瀏覽器與離線檢查。檢查公開檔案白名單及差異。
3. 將 `src/`、測試與建置腳本保存供編輯；將 `dist/` 的已驗證檔案複製到發布根目錄。保留 `.nojekyll`。
4. 將公開技術報告放入 `docs/reports/`，逐週草案放入 `weekly-plan.html`。不要複製內部文件或型錄全文。
5. 以既有 GitHub 授權提交並更新 main，指定預期舊 SHA，非 force 更新；若遠端已變更，先讀差異，不能覆蓋。
6. 確認 Pages build 完成，回讀線上 HTML／JS 與本機產物雜湊；再用全新 Chrome context 試走核心、報價與手機版型。驗證報告記錄實際 commit 與網址。

Pages 使用既有 main 根目錄。一般 Git 可 `git add` 審閱後的白名單、commit、`git push origin main`；本次使用具備公司 repo 權限的既有 GitHub 連接器提交，不切換其他帳號或取得 token。

## 回復

目前的舊基準為 `f5629c7c8d4eaddf2a91b1a5f07c5f2821c1f95f`。如需回復，先保留問題版本與證據，再以新 commit 回復已確認有問題的檔案，正常推送並重做 Pages 回讀；不要 reset/force push，避免破壞其他人的提交。

網站回復不會同步或回復瀏覽器 localStorage。此版本沿用既有儲存 key；新增欄位相容舊紀錄，請勿為了更新版本擅自清除使用者本機資料。正式後端／帳號／資料保存、費用、持久權限或新憑證需要另行核准。
