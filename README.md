# LarpCity — saját chat alkalmazás

Ez egy Discord-szerű, sötét témájú chat alkalmazás: van egy **szerver** (ami az
interneten fut, ezt mindenki eléri) és egy **Windows kliens** (amit telepítesz
a gépedre, és úgy nyitod meg, mint bármelyik programot).

Kövesd sorban a lépéseket. Kb. 15 perc az egész, és utána bármikor hívhatod a
barátaidat beszélgetni, bárhonnan az internetről.

---

## 1. lépés — GitHub fiók és repó

1. Regisztrálj a https://github.com oldalon (ha még nincs fiókod).
2. Kattints jobb fent a **+** ikonra → **New repository**.
3. Nevezd el pl. `beszelo`, állítsd **Public**-ra, majd **Create repository**.
4. A repó "Add file" → "Upload files" gombjával töltsd fel ennek a
   projektnek MINDEN fájlját és mappáját (húzd be az egész `beszelo` mappa
   tartalmát: `server/`, `client/`, `.github/`, `README.md`).
5. Commit (zöld gomb lent).

## 2. lépés — Szerver indítása (Render.com, ingyenes)

1. Menj a https://render.com oldalra, regisztrálj (a GitHub fiókoddal is
   tudsz, az a legegyszerűbb).
2. Dashboard → **New** → **Web Service**.
3. Válaszd ki az imént feltöltött `beszelo` repót.
4. Az űrlapon:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Kattints **Create Web Service**-re. Pár perc múlva megkapod a szerver
   URL-jét, valami ilyesmit: `https://beszelo-szerver-xxxx.onrender.com`
   (ezt másold ki, a következő lépésben kell).

   Megjegyzés: az ingyenes Render plan "elalszik", ha 15 percig senki nem
   használja, és az első üzenetnél kb. 30-60 másodpercig ébred — ez normális,
   nem hiba.

## 3. lépés — A kliens beállítása erre a szerverre

1. A GitHub repódban nyisd meg a `client/config.json` fájlt, kattints a
   ceruza ikonra (Edit).
2. Írd be a 2. lépésben kapott URL-t:
   ```json
   {
     "serverUrl": "https://beszelo-szerver-xxxx.onrender.com"
   }
   ```
3. Mentsd el (Commit changes).

## 4. lépés — Windows telepítő (.exe) elkészítése

1. A repódban menj a **Actions** fülre.
2. Ha nem indult el automatikusan, válaszd a **Build Windows App**
   workflow-t, majd **Run workflow**.
3. Várj kb. 3-5 percet, amíg lefut (zöld pipa jelzi, ha kész).
4. Kattints a lefutott build-re, görgess le az **Artifacts** részhez, és
   töltsd le a **LarpCity-Windows** csomagot (egy .zip lesz).
5. Csomagold ki, és futtasd a benne lévő `.exe` telepítőt. Kész is — a
   LarpCity ott lesz a Start menüben, mint bármelyik telepített program.

## 5. lépés — Beszélgetés

- Nyisd meg a LarpCity alkalmazást, add meg a neved, és már beszélgethetsz is.
- Küldd el a barátaidnak is a `.exe` fájlt (vagy ők is letölthetik ugyanabból
  az Artifacts-ból) — mindenki, aki ugyanazt a telepítőt használja, ugyanahhoz
  a szerverhez (és ugyanazokhoz a szobákhoz) csatlakozik.
- A "Barátok" listában bejelölhetitek egymást; ha mindketten bejelöltétek
  egymást, "kölcsönös" jelzés jelenik meg.

---

### Ha valami nem működik

- **A kliens nem tud csatlakozni**: ellenőrizd, hogy a `config.json`-ban a
  helyes Render URL van-e, és hogy a Render szolgáltatás fut-e (Dashboard →
  a service állapota "Live" legyen).
- **Lassan reagál**: az ingyenes Render plan elalszik inaktivitás után, az
  első kapcsolódás ilyenkor lassabb.
- **Új funkciót szeretnél**: szólj, és bővítjük tovább a kódot (pl. hangcsatorna,
  privát üzenetek, avatar-képek).
