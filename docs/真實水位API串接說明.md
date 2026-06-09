# 真實水位 API 串接說明

## 使用資料來源

### 1. 即時水位資料
https://opendata.wra.gov.tw/api/v2/73c4c3de-4045-4765-abeb-89f9f9cd5ff0?format=JSON&sort=_importdate+asc

欄位：stationid、datetime、waterlevel。

### 2. 河川水位測站站況
https://opendata.wra.gov.tw/api/v2/c4acc691-7416-40ca-9464-292c0c00da92?format=JSON&sort=_importdate+asc

欄位：rivername、observatoryname、observatoryidentifier、alertlevel1、alertlevel2、alertlevel3。

## 系統邏輯

1. 下載測站站況資料。
2. 找出 rivername 屬於五大水系的測站。
3. 下載即時水位資料。
4. 依 stationid / observatoryidentifier 合併。
5. 每條河取最新有效水位資料。
6. 用 waterlevel 與 alertlevel 比對安全狀態。
7. 若 API 失敗，切回展示水位資料。
