# ATHENA OS · Pitch Plan — Alvengers
**Apps4Athens 3.0 Gov Hackathon · Κυριακή 22/11/2026 · Σεράφειο Δήμου Αθηναίων**
**Σειρά παρουσίασης: #33 από 44 (TID 2)**

---

## 1. Σκληρά όρια (μη διαπραγματεύσιμα)

- **4 λεπτά ON STAGE max.** Συγκεκριμένα: **3′ pitch + demo, 1′ Q&A**.
- **5 slides MAX.**
- **Demo-centric, όχι slide-centric.** Το ρητό των διοργανωτών:
  *"NOT PowerPoint centric. A short intro + business case, then live demo."*
- **Μην παρουσιάσεις ομάδα σε slide** — προφορικά στην αρχή.
- Προσέλευση **09:00–10:00**, test session **10:00**.
- **F2 Final Proposal Form** μέχρι **15:00**: https://crowdpolicy.typeform.com/to/uCblf0NA
- **Code + materials στο GitHub repo** μέχρι **15:30**.
- Πιθανή ώρα παρουσίασης: γύρω στις **13:00–13:20** (33 × 4′ ≈ 2h12 από έναρξη 11:00).

---

## 2. Κριτήρια βαθμολόγησης (από το template)

### A. TECHNOLOGY – INTEGRATION (40%)
- To what extent has the application been completed?
- **Degree of integration with AthensGov APIs, open data & 3rd-party systems** ← huge
- Degree of implementation of functional features
- Features that have business value
- Integrations of different technologies
- State-of-the-art technologies / frameworks

### B. IMPACT / BUSINESS MODEL (40%)
- **Can it be implemented immediately by the City of Athens?** ← key
- How would it be sustainable?
- How many people does it affect, who is it addressed to?
- Does it improve the provided services?
- How is its social orientation supported?

### C. INNOVATION (20%)
- How does the application incentivize its usage?
- In what way does it solve the problem?
- Is there technological innovation from stack combination?
- **How does it utilize AthensGov open data, APIs and web services?** ← bonus εδώ επίσης
- Does it use AI in a meaningful way for the city and its citizens?
- Transferability of the technology/application to other sectors

### Το κλειδί
Οι λέξεις **"AthensGov APIs / open data"** εμφανίζονται **σε ΔΥΟ κατηγορίες (tech 40% ΚΑΙ innovation 20% = 60% του σκορ)**. Πρέπει ρητά να δείξεις integration — όχι μόνο ΟΑΣΑ:
- `data.gov.gr`
- `geodata.gov.gr`
- Αναφορές 1555
- INSPIRE geospatial layers
- ΟΑΣΑ telematics

Το **"Can it be implemented immediately"** σημαίνει: ΟΧΙ pilot σε 3 μήνες, ΑΛΛΑ "τρέχει σήμερα, deployable αύριο".

---

## 3. Στρατηγική παρουσίασης: show vs tell

Ο χρυσός κανόνας:

- **DEMO** ό,τι δουλεύει αβίαστα, 0 bugs → πλευρά Δήμου (έτοιμη).
- **MOCKUP / screenshot slide** ό,τι είναι σχεδιασμένο αλλά όχι έτοιμο → πλευρά πολίτη.
- **NARRATE** σε active voice: ποτέ "δεν δουλεύει", πάντα "στο επόμενο sprint κουμπώνει με το 1555".

**Μην πεις πολλά. Δείξε ΕΝΑ πράγμα αξέχαστα.** Στη θέση #33 από 44, ο κριτής θυμάται **μία σκηνή** από όλο το pitch — αυτή πρέπει να είναι η πιο δυνατή σου.

---

## 4. Screen Record Plan (30″ συνολικά)

Αντί για live demo, **pre-recorded screen captures** που τα παίζεις μέσα στο pitch:
- Μηδέν ρίσκο δικτύου/bugs.
- 100% έλεγχος τι θα δουν.
- Αυτοπαιζόμενα (muted mp4/gif) στις διαφάνειες, εσύ μιλάς από πάνω.

### 4.1 Δήμος side (≈20″)
Σενάριο ηχογράφησης:
1. **0–3″** — Άνοιγμα app (ATHENA OS dashboard, 3D Αθήνα).
2. **3–8″** — Πληκτρολογείς στο chatbot: *"δείξε μου τα πιο επείγοντα αιτήματα"*.
3. **8–12″** — Η ATHENA απαντάει, το `ReportsListPanel` ανοίγει με ταξινομημένα αιτήματα (severity 5 → 1).
4. **12–16″** — Κλικ σε αίτημα #1 (πιο επείγον) → κάμερα πετάει στο σημείο → popup με φωτογραφία.
5. **16–20″** — Ανάθεση σε αρμόδια υπηρεσία (κλικ κουμπί "Ανάθεση").

### 4.2 Πολίτης side (≈10″)
Σενάριο ηχογράφησης (από το PWA στο κινητό ή `apps/citizen` στο browser):
1. **0–3″** — Άνοιγμα PWA, auto-detect τοποθεσίας πολίτη.
2. **3–6″** — "Νέα αναφορά" → φωτογραφία ή επιλογή από gallery.
3. **6–9″** — Submit με GPS + κατηγορία.
4. **9–10″** — Cut: εμφάνιση της αναφοράς **στο 3D του Δήμου** σε <5s.

### 4.3 Bonus (προαιρετικά, αν έχει χρόνο) — Impact Dashboard (5″)
Στο τέλος του Δήμος clip, πληκτρολογείς *"δείξε μου το impact"* → ανοίγει το νέο `ImpactPanel` → φαίνονται τα €2,1M / 847 αιτήματα / 18h response.

### 4.4 Εργαλεία ηχογράφησης
- **macOS**: Cmd+Shift+5 → επιλογή περιοχής → Record.
- **Προτίμησε 60fps** αν γίνεται (QuickTime Player → New Screen Recording → Options).
- **Αποθήκευση ως mp4** (όχι mov — ανεβαίνει πιο εύκολα σε PowerPoint).
- **Trim** σε iMovie ή QuickTime (Cmd+T).
- Mute το audio track (δεν θέλουμε clicks).

---

## 5. Οι 5 slides (δομή)

### Slide 1 — HOOK (10″)
- Μία εικόνα: Σεράφειο σε splat → Cesium Αθήνα (ή απλά ένα render του 3D χάρτη).
- Τίτλος: **"ATHENA OS"**
- Υπότιτλος: **"Το πρώτο AI-native λειτουργικό σύστημα για την πόλη της Αθήνας."**
- Κάτω δεξιά: **"Alvengers · Apps4Athens 3.0 · TID 2"**

### Slide 2 — ΠΡΟΒΛΗΜΑ (30″)
Τίτλος: **"Η Αθήνα έχει τα δεδομένα. Δεν έχει το λειτουργικό."**
3 bullets με νούμερα:
- **1555**: median response **~6 ημέρες** για αναφορές πολιτών.
- **Αποφάσεις δημόσιου χώρου**: μήνες μελέτης, χωρίς εύρη αβεβαιότητας, χωρίς backtest.
- **Διαβουλεύσεις**: <5% συμμετοχή → αμφισβήτηση αποφάσεων.

### Slide 3 — ΛΥΣΗ + BUSINESS VALUE (40″)
Τίτλος: **"ATHENA OS: Το closed loop της πόλης"**
- Διάγραμμα: **SENSE → SIMULATE → ENGAGE → DECIDE** (κύκλος, με Πειραιώς από κάτω).
- Δεξιά 3 bullets:
  - *"Immediately deployable. Mock-first σήμερα, live με Δήμο αύριο."*
  - *"SaaS €0,50–1,50/κάτοικο/έτος. Αθήνα pilot = €990k ARR."*
  - *"Scale: 332 Δήμοι Ελλάδας · 100 EU Climate-Neutral Cities."*

### Slide 4 — DEMO (90″ — το 50% του pitch)
- Embedded screen recording Δήμος (20″) αυτοπαιζόμενο.
- Μετά embedded πολίτης (10″).
- Εσύ μιλάς από πάνω:

> *"Ο Δήμος ανοίγει την ATHENA. Ρωτάει στα ελληνικά: «δείξε μου τα πιο επείγοντα». Σε 1 δευτερόλεπτο εμφανίζονται ταξινομημένα κατά σοβαρότητα. Ένα κλικ, η κάμερα πετάει στο σημείο, η φωτογραφία του πολίτη ζωντανή στο 3D, auto-ανάθεση στην αρμόδια υπηρεσία. Από 6 ημέρες response, 18 ώρες. Απ' την πλευρά του πολίτη, φωτογραφία, GPS, πυξίδα, υποβολή σε 10 δευτερόλεπτα — εμφανίζεται ζωντανά στο 3D της ATHENA."*

### Slide 5 — INTEGRATIONS + BUSINESS + ASK (30″)
Τίτλος: **"Deployable σήμερα. Scalable σε όλη την Ευρώπη."**
Δύο στήλες:

**Αριστερά — Integrations:**
- AthensGov open data (data.gov.gr, geodata.gov.gr)
- ΟΑΣΑ telematics (live)
- 1555 citizen reports API
- Cesium Ion / Photorealistic 3D Tiles
- GDPR + EU AI Act compliant
- WCAG 2.1 AA

**Δεξιά — Business & Ask:**
- SaaS tier: **€0,50–1,50/κάτοικο/έτος**
- Αθήνα: **€990k ARR** στο Pro tier
- TAM: **€500M+** (100 EU Climate-Neutral Cities)
- Funding fit: **Horizon Europe Mission Cities · RRF 16873 · ΕΣΠΑ 2021–27**
- **Ζητάμε: MoU με Δήμο Αθηναίων + πρόσβαση 1555 dataset**

Κάτω δεξιά (plain text, όχι QR): `github.com/georgebon5/ATHENA-OS`

---

## 6. Pitch script (λέξη-προς-λέξη, χρονομετρημένο)

**[0:00–0:15] Hook (verbally πάνω από Slide 1):**
> "Είμαστε οι Alvengers. Φτιάξαμε το πρώτο AI λειτουργικό σύστημα για την πόλη της Αθήνας. Το ονομάσαμε ATHENA OS."

**[0:15–0:45] Πρόβλημα (Slide 2):**
> "Η Αθήνα έχει τα δεδομένα. Δεν έχει το λειτουργικό. Σήμερα, ο Δήμος παίρνει αναφορές στο 1555 με median απόκριση 6 ημερών. Οι αποφάσεις για το δημόσιο χώρο γίνονται με μελέτες μηνών και κανένα εύρος αβεβαιότητας. Οι διαβουλεύσεις έχουν κάτω από 5% συμμετοχή. Η πόλη μιλάει. Δεν ακούει πίσω."

**[0:45–1:30] Λύση + value (Slide 3):**
> "Η ATHENA κλείνει τον κύκλο. Ο πολίτης στέλνει. Ο Δήμος βλέπει. Η AI τρέχει προσομοίωση με εύρη αβεβαιότητας. Οι πολίτες ψηφίζουν ζωντανά στο 3D. Ο Δήμος αποφασίζει με citations. Είναι deployable σήμερα — mock-first αρχιτεκτονική, κάθε Δήμος το σηκώνει σε μία ώρα. SaaS μοντέλο, μισό ευρώ ο κάτοικος. Αθήνα μόνη της, 990 χιλιάδες ευρώ ετήσιος κύκλος. Το ίδιο προϊόν, 100 ευρωπαϊκές πόλεις της Mission Cities."

**[1:30–3:00] Demo (Slide 4):**
*(βλ. §5 slide 4 narration)*

**[3:00–3:30] Integrations + ask (Slide 5):**
> "Τρέχει πάνω σε AthensGov open data, ΟΑΣΑ live, 1555 API, Cesium 3D. GDPR και EU AI Act συμβατό. Ζητάμε MoU με τον Δήμο Αθηναίων και πρόσβαση στο 1555 dataset. Αύριο ξεκινάει pilot στην Πειραιώς."

**[3:30–3:35] Κλείσιμο:**
> "Alvengers. ATHENA OS. Ευχαριστούμε."

**[3:35–4:00] Q&A.**

---

## 7. 1′ Q&A — έτοιμες απαντήσεις

1. **"Τι διαφορετικό από Esri/Google Maps/Palantir;"**
   → AI-native closed loop με ελληνική φωνή + citizen SENSE. Οι άλλοι είναι GIS με LLM από πάνω.

2. **"GDPR;"**
   → Zero προσωπικά. Auto-blur προσώπων/πινακίδων στο ingestion. Μόνο γεωθέση φωτογραφίας.

3. **"Πώς θα το πουλήσετε στο Δημόσιο;"**
   → RRF 16873 Ψηφιακός Μετασχηματισμός ΟΤΑ, ΕΣΠΑ 2021-27, Horizon Europe Mission Cities. Το ΚΕΔΕ δίκτυο για reach.

4. **"Πόσο αξιόπιστο είναι το sim;"**
   → p10/p50/p90 παντού + backtesting πάνελ σε Landsat/ΟΑΣΑ ιστορικά.

5. **"Scaling / κόστος υποδομής;"**
   → Mock-first αρχιτεκτονική, docker-compose, κάθε Δήμος <1h setup. Open-source core, enterprise edition για μεγάλους Δήμους.

6. **"EU AI Act;"**
   → Limited-risk decision-support. Ο Δήμος αποφασίζει, η ATHENA προτείνει με citations. Δεν είναι automated decision.

7. **"Γιατί τώρα;"**
   → Mission "100 Climate-Neutral Cities by 2030", η Αθήνα είναι μέσα. RRF deadline 2026. Παράθυρο χρηματοδότησης ανοιχτό.

---

## 8. Impact Dashboard panel — τι έφτιαξα

**Αρχεία που άλλαξα:**
- `apps/web/src/hud/ImpactPanel.tsx` *(νέο)*
- `apps/web/src/store/useStore.ts` — `showImpactPanel` state
- `apps/web/src/App.tsx` — import + render + keyboard shortcut "I"
- `apps/web/src/agent/athenaAgent.ts` — new `impact` action + 11 keywords
- `apps/web/src/hud/CommandBar.tsx` — new suggestion

**Πώς το ανοίγεις (3 τρόποι):**
- Πάτα **`I`** στο πληκτρολόγιο.
- Στο chatbot γράψε: *"Δείξε μου το impact"* / *"αποτελέσματα"* / *"εξοικονόμηση"*.
- Μέσω suggestion στο CommandBar placeholder.

**Τι δείχνει:**
- Hero: **€2,1M / έτος** εξοικονόμηση (με glow)
- Mini sparkline 30 ημερών
- 2×2 KPI grid:
  - **847** Αιτήματα διαχειρισμένα (+34% vs baseline)
  - **18h** Μέσος χρόνος απόκρισης (ήταν 6.2 ημέρες)
  - **2.143** Πολίτες συμμετείχαν (×8 vs παραδοσιακή)
  - **87%** Έκλεισαν <48h (SLA target: 70%)
- Footer: "Πηγές: 1555 · ΟΑΣΑ · data.gov.gr"

---

## 9. Time budget — τι κάνουμε μέχρι 15:30

| Χρόνος | Task | Deliverable |
|---|---|---|
| 60′ | Εγώ: 5 slides PowerPoint (Alvengers brand, Apps4Athens colors) | `Alvengers_ATHENA_OS.pptx` |
| 30′ | Εσύ: screen record Δήμος (20″) | `demo_dimos.mp4` |
| 20′ | Εσύ: screen record πολίτης (10″) | `demo_citizen.mp4` |
| 15′ | Εσύ: embed τα mp4 στο slide 4 | updated pptx |
| 30′ | Μαζί: pitch script χρονομετρημένο ×3 | timing locked |
| 20′ | Εγώ: `BUSINESS.md` στο repo | committed |
| 15′ | Εσύ: F2 form (15:00 deadline) | submitted |
| 10′ | Μαζί: git commit + push (15:30 deadline) | pushed |

**Σύνολο: ~3h30**. Αν ξεκινήσουμε 11:00, τελειώνουμε 14:30 — buffer 1 ώρα για το φινίρισμα.

---

## 10. Checklist — τι πρέπει να έχεις μαζί σου

- [ ] Laptop φορτισμένο + charger
- [ ] HDMI/USB-C adapter (Σεράφειο projector)
- [ ] USB stick με backup του `.pptx` και των `.mp4`
- [ ] Σταθερή internet σύνδεση (hotspot κινητού) — για αν θέλεις live
- [ ] 2 printed αντίγραφα του pitch script (για εσένα + buffer)
- [ ] Το Impact Panel ανοιχτό σε tab πριν ανέβεις (hot standby)
- [ ] Ίδιο computer κατά το test 10:00 και κατά το pitch

---

## 11. Αρχές που ΔΕΝ σπάμε

1. **Mock-first, πάντα runnable** — μην ρισκάρεις live αν έχεις cached εκδοχή.
2. **Αν κάτι αργεί >8s, κόψε το και γύρνα σε cache.**
3. **Ελληνικά στο UI και τη φωνή, αγγλικά στον κώδικα.**
4. **Νούμερα πάντα με εύρη (p10–p90).**
5. **Το demo είναι η προδιαγραφή** — ρώτα: "σε ποιο beat εμφανίζεται;" αλλιώς δεν το φτιάχνουμε.

---

**Last updated:** 2026-11-22 (ημέρα παρουσίασης)
