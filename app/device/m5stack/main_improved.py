# ===== 必要ライブラリ =====
from m5stack import lcd
from m5stack_ui import *
from uiflow import *
import unit, time, urequests, ujson, gc

# ===== 設定 =====
DEVICE_ID = "HR-01"
DISPLAY_MS = 1500
POLL_MS    = 50
PORT       = unit.PORTA
SEND_COOLDOWN_MS = 700  # 誤二重送信ガード

# ===== 画面 =====
screen = M5Screen(); screen.clean_screen(); screen.set_screen_bg_color(0xFFFFFF)
label_device = M5Label(DEVICE_ID, x=10, y=10, color=0x0000FF, font=FONT_MONT_22, parent=None)
label_name = M5Label('', x=30, y=70, color=0x000, font=FONT_MONT_38, parent=None)

# ===== 名簿（任意：表示用）=====
# ===== 原瀬 用のメンバーリスト =====
name_list = ['T.Miura','Y.Sukegawa','A.Satou','S.Kuchiki','Y.Kon','i.le-ho','I.Ho-Ta','Y.Abe','T.Itou','J.Uchikawa','K.Abe','T.Ohthuka','S.Itou','M.Mishima']
uid_list  = ['3059e1a028','c0f8dda045','7015dea01b','b048dca084','20e9eea087','b0e4eea01a','032e2a070','f056eea0e8','b0c2eca03e','7018e6a02e','d0f9dda054','7064d9a06d','10dfe9a086','10b3efa0ec']

def find_index(lst, v):
    try: return lst.index(v)
    except: return -1

# ===== 【新規追加】UID妥当性チェック関数 =====
def is_valid_uid(uid):
    """
    UIDが有効かチェック
    - 文字列型であること
    - 空でないこと
    - 10文字の16進数文字列であること
    """
    if not isinstance(uid, str):
        return False
    uid_clean = uid.strip()
    if len(uid_clean) != 10:
        return False
    # 16進数文字（0-9, a-f, A-F）のみかチェック
    try:
        int(uid_clean, 16)  # 16進数として解釈できるか
        return True
    except:
        return False

# ===== 【新規追加】安定したUID読み取り関数 =====
def safe_read_uid(rfid_unit, is_first_read=False):
    """
    複数回読み取って一致したUIDを返す（ノイズ対策）
    - 初回読み取り時のみ2回読み取って一致確認（速度重視）
    - 2回目以降は1回読み取りで十分（既に検証済み）
    - 一致しない場合は空文字を返す
    """
    uid1 = rfid_unit.readUid()
    if not uid1:
        return ''
    
    # 初回読み取り時のみ2回読み取りで検証（ノイズ対策）
    # 2回目以降は1回で十分（速度重視）
    if is_first_read:
        # 短い待機時間で再読み取り（速度を優先）
        wait_ms(15)  # 30ms → 15msに短縮
        uid2 = rfid_unit.readUid()
        
        # 2回の読み取り結果が一致し、かつ有効なUIDなら採用
        if uid1 == uid2 and is_valid_uid(uid1):
            return uid1.strip()
        return ''  # 一致しない、または無効なUID
    else:
        # 2回目以降は1回読み取りで十分（速度重視）
        if is_valid_uid(uid1):
            return uid1.strip()
        return ''

# ===== 送信（POSTのみ・即戻る）=====
FIREBASE_LOGS = "https://rfid-cd77f-default-rtdb.asia-southeast1.firebasedatabase.app/logs.json"

# ===== 【改善】送信関数：エラーハンドリング強化 =====
def post_scan(uid, device_id=DEVICE_ID):
    """
    改善点：
    1. 送信前にUIDの妥当性を再チェック
    2. HTTPステータスコードを確認
    3. エラー時に詳細を出力（デバッグ用）
    """
    # 送信前にUIDを再チェック（念のため）
    if not is_valid_uid(uid):
        print('POST skipped: invalid UID:', uid)
        return False
    
    try:
        payload = {
            'uid': uid.strip(),  # 前後の空白を除去
            'ts': {'.sv': 'timestamp'},   # ← Firebaseサーバ時刻を使う
            'dev': device_id
        }
        headers = {'Content-Type': 'application/json'}
        r = urequests.post(FIREBASE_LOGS, data=ujson.dumps(payload), headers=headers)
        
        # 【改善】HTTPステータスコードを確認
        status_ok = (r.status_code >= 200 and r.status_code < 300)
        if not status_ok:
            print('POST failed: status', r.status_code, 'UID:', uid)
        
        try: 
            r.close()
        except: 
            pass
        
        return status_ok
    except Exception as e:
        print('POST err:', e, 'UID:', uid)
        return False

# ===== 表示 =====
def show_name(name): label_name.set_text(name)
def clear_display():
    label_name.set_text('')
    screen.set_screen_bg_color(0xFFFFFF)

# ===== 準備 =====
lcd.clear()
rfid = unit.get(unit.RFID, PORT)
card_present = False
last_show_ms = 0
last_sent_uid = None
last_sent_ms  = 0

# ===== メインループ =====
while True:
    now = time.ticks_ms()

    if rfid.isCardOn():
        # 【最適化】カードが新しく検知された時のみ2回読み取り（速度重視）
        # 既に検知されている間は1回読み取りで十分
        is_first_read = not card_present
        uid = safe_read_uid(rfid, is_first_read=is_first_read)
        
        # 【改善】UIDが空または無効な場合は処理をスキップ
        if not uid or not is_valid_uid(uid):
            card_present = True  # カードは検知されているが、UIDが読めない
            wait_ms(POLL_MS)
            continue
        
        if not card_present:
            # ★ カードが新しく検知された時のみ処理実行（高速読み取り制御維持）
            idx = find_index(uid_list, uid)
            name = name_list[idx] if idx != -1 else 'UNKNOWN'
            show_name(name)
            last_show_ms = now

            # ★ 誤連打ガード（同一UIDの短時間連投を捨てる）← 700msクールダウン維持
            # 【改善】有効なUIDの場合のみ送信処理を実行
            if not (uid == last_sent_uid and time.ticks_diff(now, last_sent_ms) < SEND_COOLDOWN_MS):
                success = post_scan(uid)
                if success:
                    # 送信成功時のみ記録を更新
                    last_sent_uid = uid
                    last_sent_ms  = now
                # 送信失敗時はログに出力済み（post_scan内でprint）

            try: gc.collect()
            except: pass

            card_present = True
    else:
        card_present = False

    if last_show_ms and time.ticks_diff(now, last_show_ms) > DISPLAY_MS:
        clear_display(); last_show_ms = 0

    wait_ms(POLL_MS)

