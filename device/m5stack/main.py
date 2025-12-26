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
# ===== 原瀬 用のメンバーリスト =====
name_list = ['T.Miura','Y.Sukegawa','A.Satou','S.Kuchiki','Y.Kon','i.le-ho','I.Ho-Ta','Y.Abe','T.Itou','J.Uchikawa','K.Abe','T.Ohthuka','S.Itou','M.Mishima']
uid_list  = ['3059e1a028','c0f8dda045','7015dea01b','b048dca084','20e9eea087','b0e4eea01a','032e2a070','f056eea0e8','b0c2eca03e','7018e6a02e','d0f9dda054','7064d9a06d','10dfe9a086','10b3efa0ec']
def find_index(lst, v):
    try: return lst.index(v)
    except: return -1

# ===== 送信（POSTのみ・即戻る）=====
FIREBASE_LOGS = "https://rfid-cd77f-default-rtdb.asia-southeast1.firebasedatabase.app/logs.json"

# 送信関数：now_msは不要にする
def post_scan(uid, device_id=DEVICE_ID):
    try:
        payload = {
            'uid': uid,
            'ts': {'.sv': 'timestamp'},   # ← Firebaseサーバ時刻を使う
            'dev': device_id
        }
        headers = {'Content-Type': 'application/json'}
        r = urequests.post(FIREBASE_LOGS, data=ujson.dumps(payload), headers=headers)
        try: r.close()
        except: pass
    except Exception as e:
        print('POST err:', e)


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
        uid = rfid.readUid()  # 文字列
        if not card_present:
            idx = find_index(uid_list, uid)
            name = name_list[idx] if idx != -1 else 'UNKNOWN'
            show_name(name)
            last_show_ms = now

            # ★ 誤連打ガード（同一UIDの短時間連投を捨てる）
            if not (uid == last_sent_uid and time.ticks_diff(now, last_sent_ms) < SEND_COOLDOWN_MS):
                post_scan(uid)
                last_sent_uid = uid
                last_sent_ms  = now

            try: gc.collect()
            except: pass

            card_present = True
    else:
        card_present = False

    if last_show_ms and time.ticks_diff(now, last_show_ms) > DISPLAY_MS:
        clear_display(); last_show_ms = 0

    wait_ms(POLL_MS)




