# 🐰 Arnouba Gaming Bot

## التشغيل
1. `npm install`
2. انسخ `.env.example` إلى `.env` وعبّئ: `TOKEN`, `CLIENT_ID`, `MONGODB_URI` (و`GUILD_ID` اختياري لتسجيل الأوامر فوراً).
3. `npm start`
4. في Discord Developer Portal → Bot: فعّل **Server Members Intent** فقط (لا تحتاج Message Content).
5. ادعُ البوت بصلاحية **Administrator** مع `bot` + `applications.commands`، وضع رتبة البوت **أعلى** رتب السيرفر.
6. في السيرفر نفّذ `/setup` ثم اضغط **Yes, build the server**.

## ماذا يفعل `/setup`؟
- ينشئ الرتب: 👑 Management / 🛡️ Staff / ✅ Member (تُعطى تلقائياً عند الدخول) + **20 رتبة ألعاب** (FiveM, Valorant, ...).
- ينشئ كل الفئات والقنوات بترتيب احترافي (معلومات، مجتمع، ألعاب، لوبيات الألعاب، فويس، غرف خاصة، تذاكر، إدارة).
- **لا يحذف أي شيء**: القنوات والفئات القديمة تبقى كما هي، وإعادة `/setup` تحدّث قنوات البوت بدل تكرارها. ثم ينشر اللوحات: القوانين، رتب الألعاب (مع صورة شعارات الألعاب)، التذاكر، الدليل.
- يحفظ كل المعرّفات في MongoDB.

## الميزات
| الميزة | أين |
|---|---|
| لوحة الفويس (Lock, Hide, Kick, Add, Permit, Access List, Rename, User Limit, Roles, Claim/Transfer, Save/Reset Settings, Call Admins, Channel features) | تظهر تلقائياً في شات غرفتك بعد دخول **➕ Create Room** |
| رتب الألعاب بالضغط على زر (ضغطة ثانية تزيلها) | `🎭┃game-roles` |
| لوبي خاص لكل لعبة (يظهر فقط لحاملي الرتبة) | فئة GAME LOBBIES |
| `/lfg` يبحث عن فريق ويمنشن رتبة اللعبة | `🎮┃looking-for-team` |
| `/suggest` مع تصويت وقبول/رفض للإدارة | `💡┃suggestions` |
| تذاكر (دعم / إبلاغ / تقديم إدارة) مع Claim وإغلاق ونسخة نصية في اللوغ | `🎫┃open-ticket` |
| `/panels` `/announce` | `⚙️┃staff-commands` |
| `/voice` يرجع لوحة الفويس إن حذفتها | داخل شات غرفتك |
| `/clear` | أي قناة (إدارة فقط) |

كل أمر مقيّد بقناته الخاصة، وإن استُعمل في مكان آخر يعرض البوت القناة الصحيحة.

## تغيير صورة اللوحة
استبدل `assets/voice-banner.png` بصورتك (نفس الاسم). 

## الصور
- `assets/games/<game>.png`: شعار كل لعبة (256×256) يظهر في `/lfg`، و`assets/game-roles-banner.png` يظهر في لوحة رتب الألعاب.
- لإعادة توليدها بعد تغيير الشعارات في `assets/logos/source/`: `pip install pillow` ثم `python3 scripts/build-assets.py` (الألعاب بدون شعار تحصل على أيقونة أحرف أصلية).
- ثم نفّذ `/panels` لإعادة نشر اللوحات.

## ملاحظات
- الأوامر تُسجَّل عند تشغيل البوت. بدون `GUILD_ID` تكون عامة وقد تتأخر في الظهور.
- يمكن إعادة `/setup` متى شئت، وهو يعيد استعمال رتب الألعاب الموجودة بنفس الاسم.
