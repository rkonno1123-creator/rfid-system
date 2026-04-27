# RFID入退場システム

現場作業員のリストバンド型RFIDカードをM5Stack（端末）で読み取り、入退場記録をFirebaseに保存してWebで表示するシステム。

```
M5Stack（現場端末） → Firebase（DB） → Webアプリ（表示）
```

詳細な設計思想・技術仕様・課題は [Obsidian設計メモ] を参照。

---

## 現場・端末一覧

| デバイスID | 現場 |
|-----------|------|
| HR-01 / HR-02 | 原瀬川 |
| ME-01 / ME-02 | 第二隈戸川 |
| HS-01 / HS-02 | 迫川 |

---

## 運用

メンバー登録・端末コード更新は**管理アプリ（m5-code-manager）**から実施。FirebaseとM5Stack両方に自動反映される。

RFID番号一覧はSharePointのExcelで管理。
場所：`04_バックオフィス共同編集用 / 5_各現場フォルダ / RFID_番号一覧`

トラブル時はまずM5Stackを再起動する。

---

## 関連リンク

- 管理アプリ（m5-code-manager）：Vercelで公開済み
- App Platform：https://app-manual-f870a.firebaseapp.com/
- Firebase Console：https://console.firebase.google.com
- GitHub：https://github.com/rkonno1123-creator/rfid-system
