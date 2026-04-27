# UID確認用コード（UIFlow Core2）
# カードをかざすと画面にUIDが表示される
# メンバー登録時のUID確認に使う

from m5stack import *
from m5ui import *
from uiflow import *
import unit

setScreenColor(0xFFFFFF)
label_uid = M5Label('かざしてください', x=10, y=100, color=0x000000, font=FONT_MONT_22, parent=None)

rfid = unit.get(unit.RFID, unit.PORTA)
card_present = False

while True:
    if rfid.isCardOn():
        if not card_present:
            uid = rfid.readUid()
            label_uid.set_text(uid)
            card_present = True
    else:
        card_present = False
    wait_ms(100)
