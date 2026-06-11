# 大台北水脈｜進階功能全包版

## 如何展示
1. 解壓縮 ZIP
2. 用 VS Code 開啟資料夾
3. 使用 Live Server 開啟 index.html
4. 若 GPS 無法使用，點選「示範位置」

## 已包進去的進階功能
- 首頁主視覺
- 開始遊玩
- 30 秒導覽動畫
- 語音導覽 SpeechSynthesis
- 五大水系動態流動線
- 河流 Hover 提亮與 Tooltip
- 河流歷史介紹
- 河流文化內容
- 水位安全判斷
- 背景水位異常警示
- GPS 定位對應最近河流
- 示範位置模式
- 沿河走路導覽模擬
- 街景感模式
- 景點震動框
- 手機 Vibration API 震動
- 景點徽章
- 24 小時限制
- 個人徽章介面
- 任務進度
- 文化問答
- 問答分數
- 探索紀錄
- JSON 匯出紀錄
- 圖層控制
- 水位風險熱區
- 古河道示意圖層
- localStorage 儲存
- PWA manifest / service worker 基礎

## 限制
目前真實水位資料與真實街景影像使用模擬資料展示。若要正式上線，可將 app.js 的 refreshWater / simulateDanger 改接水利署 API，將 street-panel 改接自製影片、360 照片或街景素材。


## 真實資料串接說明

此版本已串接經濟部水利署 Open Data：

1. 即時水位資料：stationid、datetime、waterlevel。
2. 河川水位測站站況：rivername、observatoryname、observatoryidentifier、alertlevel1、alertlevel2、alertlevel3。

系統會用測站站況資料找出屬於五大水系的測站，再與即時水位資料依 stationid / observatoryidentifier 合併。若 API 當下無法連線，系統會自動切回展示資料，避免課堂展示中斷。

水位資料最快約每 10 分鐘更新一次，因此系統設定為每 10 分鐘自動刷新。


## 修正版說明

原本的「街景感模式」已改成「河岸視角導覽卡」。  
原因是若沒有真實街景、360 照片或影片，硬做假街景會很尷尬。修正版改成更適合課堂 demo 的導覽卡，呈現：

- 河流名稱
- 河流文化介紹
- 附近景點
- 水位安全提示
- 可替換成真實影片 / 360 圖 / 現地照片的接口

展示時請說：「目前是河岸視角導覽卡，未來可替換為實拍影片或 360 度素材。」


## 真街景古蹟導覽版更新

本版已將原本的示意街景改成 Google Street View 嵌入畫面。  
使用者點擊河流導覽中的「街景古蹟」或點擊景點時，右下角會出現：

- Google Street View 街景畫面
- 景點 / 古蹟名稱
- 從河流視角撰寫的歷史介紹
- 水位安全提示
- 同一條河附近景點列表

注意：Google Street View 需要網路；若某座標沒有街景，Google 可能顯示附近街景或地圖畫面。


## 測站匹配修正

若畫面出現「API 有回應，但五大水系沒有匹配到測站」，代表 API 成功取得資料，但河名或測站名稱沒有直接對上。

本修正版已加入 `RIVER_MATCH_RULES`，用以下方式匹配：

- 河流名稱 alias
- 代表測站關鍵字
- API row 全欄位文字搜尋

若仍未匹配，可開啟瀏覽器 DevTools → Console，查看 `[WRA] stationRows` 與 `console.table`，再把實際測站名稱補進 `RIVER_MATCH_RULES`。
