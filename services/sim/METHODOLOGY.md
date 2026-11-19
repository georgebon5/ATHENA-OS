# Μεθοδολογία Simulation Service — ATHENA OS

> Αυτό το έγγραφο απαντά στις ερωτήσεις των κριτών (ΕΜΠ/Πανεπιστήμιο).
> Για κάθε νούμερο που εμφανίζεται στο demo, εδώ βρίσκεται η αιτιολόγηση.

---

## 1. Μοντέλο Κυκλοφορίας

### Μεθοδολογία
**Στατική Ισορροπία Χρήστη (Static User Equilibrium)** με αλγόριθμο Frank-Wolfe.

Κάθε οδηγός επιλέγει τη διαδρομή που ελαχιστοποιεί τον χρόνο ταξιδιού του, λαμβάνοντας υπόψη τη συμφόρηση (όχι παίκτης που αγνοεί τους άλλους — αλλά τυπικός χρήστης οδικού δικτύου).

**Συνάρτηση κόστους BPR (Bureau of Public Roads, 1964):**

$$t_a(x_a) = t_a^0 \left(1 + \alpha \left(\frac{x_a}{c_a}\right)^{\beta}\right), \quad \alpha = 0.15,\ \beta = 4$$

όπου:
- $t_a^0$ = χρόνος ελεύθερης ροής (μήκος / ταχύτητα ορίου)
- $c_a$ = χωρητικότητα ακμής (λωρίδες × τυπική χωρητικότητα ανά τύπο δρόμου)
- $x_a$ = ροή (veh/h)

**Γράφος:** OSM drive network, bbox Πειραιώς/Γκάζι/Κεραμεικός/Θησείο (~300–500 κόμβοι).

**Ζήτηση (OD):** Συνθετικός Origin-Destination πίνακας μεταξύ ζωνών εισόδου/εξόδου bbox. Βαθμονόμηση: least squares ώστε οι ροές στους βασικούς άξονες να ταιριάζουν στους γνωστούς μέσους όρους κυκλοφορίας (EL.STAT 2023 + data.gov.gr αισθητήρες αν βρεθούν).

### Σενάρια
| Τύπος | Εφαρμογή |
|---|---|
| `close_road` | Αφαίρεση ακμών από γράφο → ξανά ανάθεση |
| `bus_lane` | Μείωση $c_a$ κατά 1 λωρίδα ΙΧ → ξανά ανάθεση |
| `remove_lane` | Ίδιο με bus_lane |
| `add_trees` | Καμία επίδραση στον γράφο (επίδραση μόνο θερμική) |
| `cool_pavement` | Καμία επίδραση στον γράφο |

**Warm start:** Το σενάριο ξεκινά από τη βασική ισορροπία και τρέχει 15 iterations (αντί 50 της βάσης), γεγονός που μειώνει τον χρόνο <2s.

### Αβεβαιότητα (p10/p50/p90)
Ανάλυση ευαισθησίας σε 3 επίπεδα ζήτησης (×0.85, ×1.00, ×1.15):
- p10 = αποτέλεσμα με αυξημένη ζήτηση (χειρότερη περίπτωση)
- p50 = baseline ζήτηση
- p90 = μειωμένη ζήτηση (βέλτιστη περίπτωση για βελτίωση)

Αυτό είναι **ανάλυση ευαισθησίας**, όχι τυχαία δειγματοληψία (Monte Carlo). Είναι γρηγορότερη και εξίσου κατατοπιστική για τους σκοπούς του demo.

### Εκπομπές CO₂
Απλοποιημένη καμπύλη COPERT: CO₂ ≈ vehicle-km × εκπομπή(ταχύτητα). Εμφανίζεται **μόνο ως εύρος %** (δεν δίνεται απόλυτη τιμή kg).

---

## 2. Θερμικό Μοντέλο

### Τι μετράμε
**Θερμοκρασία Επιφάνειας Γης (LST — Land Surface Temperature)** από Landsat 8/9 Collection 2 Level-2, Band ST_B10.

> **ΣΗΜΑΝΤΙΚΟ:** Η LST είναι η θερμοκρασία της επιφάνειας (πεζοδρόμιο, άσφαλτος, ταράτσα), ΟΧΙ η θερμοκρασία αέρα. Η θερμοκρασία αέρα είναι τυπικά 8–15°C χαμηλότερη. Η LST αντιστοιχεί στη θερμοκρασία που νιώθει ο πεζός σε ηλιόλουστο πεζοδρόμιο τη μεσημβρία.

### Πλέγμα
25m × 25m grid στο bbox (~4800 κελιά).

### Features ανά κελί
| Feature | Πηγή | Σχόλιο |
|---|---|---|
| Κλάσμα σκιάς | pvlib + ύψη κτιρίων OSM | Γεωμετρική προσέγγιση: H / (W × tan(ήλιος)) |
| NDVI | Sentinel-2 10m (ή OSM βλάστηση) | 0=άσφαλτος, 1=πυκνή βλάστηση |
| Κάλυψη κτιρίων | OSM buildings | Fraction of 25m cell covered |
| Κλάσμα οδοστρώματος | OSM roads | Fraction covered by road surface |
| Albedo proxy | Γεωμεσταθμισμένο | Χαμηλό albedo → υψηλότερη LST |
| Sky View Factor | Approx. από κτίρια | Χαμηλό SVF → παγίδευση θερμότητας |
| Απόσταση από πράσινο | OSM parks/trees | Σε m, κανονικοποιημένο /500 |
| sin(ηλιακή γωνία) | pvlib | Χρονική εξάρτηση |

### Μοντέλο
**Ridge Regression** (L2 regularization, α=1.0) από features → LST.

Εκπαίδευση: Landsat scenes καλοκαίρι 2024/2025.

**Spatial Cross-Validation:** Αξιολόγηση σε χωρικά blocked holdout (200m tiles, κάθε 4ο block = holdout) για να αποφευχθεί η **data leakage** μεταξύ γειτονικών pixels.

### Σενάρια
| Τύπος | Εφαρμογή |
|---|---|
| `add_trees` | Gaussian boost NDVI (σ=4m) + σκιά κάτω από κόμη. Ρεαλιστικά: κόμη 8m, shade peak 70% |
| `cool_pavement` | +0.15 albedo proxy στα κελιά με road_frac > 0.3 |

### Αβεβαιότητα
Bootstrap εκτίμηση: ±1.65σ γύρω από τον μέσο δέλτα LST στα κελιά του hotspot. σ ≈ residual std του μοντέλου (~1.5–2°C).

---

## 3. Backtest — «το όπλο μας»

### Κυκλοφορία
- **Metric:** MAPE (Mean Absolute Percentage Error) ροών στους αισθητήρες
- **Held-out:** 1 ημέρα που δεν είδε το μοντέλο (βαθμονόμηση σε N-1 ημέρες)
- **Αναμενόμενο:** 10–20% (τυπικό για συνθετικό OD χωρίς πλήρη OD survey)
- **Scatter:** predicted vs observed ροή ανά αισθητήρα

### Θερμικό
- **Metrics:** MAE (°C) + R²
- **Held-out:** χωρικά blocked tiles (κάθε 4ο 200m block)
- **Αναμενόμενο:** MAE 1.0–2.5°C, R² 0.65–0.80
- **Scatter:** predicted vs observed LST ανά pixel

> Ειλικρίνεια: Ένα 18% MAPE που εξηγείται σωστά κερδίζει περισσότερο από ένα 3% που δεν πιστεύεται. Τα νούμερα είναι ό,τι βγαίνει, όχι ό,τι θέλαμε.

---

## 4. Limitations (που γνωρίζουμε)

1. **Δυναμική κυκλοφορία:** Το μοντέλο είναι static assignment (μία ώρα αιχμής). Δεν μοντελοποιεί queue spillback ή ανακατανομή λόγω πληροφορίας realtime.
2. **LST ≠ θερμοκρασία αέρα:** Χρειάζεται correction factor ~0.3–0.6 για μετατροπή σε θερμοκρασία αέρα σε σκιά.
3. **Συνθετικό OD:** Χωρίς πλήρη Origin-Destination survey, η βαθμονόμηση βασίζεται σε αισθητήρες ροής (όχι εκκίνηση/προορισμός).
4. **Πλέγμα 25m:** Για fine-grained shade analysis χρειάζεται LiDAR. Χρησιμοποιούμε geometric approximation.
5. **Bbox-only:** Το μοντέλο δεν λαμβάνει υπόψη traffic diversion εκτός bbox.

---

## 5. Αναφορές

- Sheffi, Y. (1985). *Urban Transportation Networks.* Prentice-Hall.
- BPR (1964). *Traffic Assignment Manual.* US Bureau of Public Roads.
- Voogt, J.A. & Oke, T.R. (2003). Thermal remote sensing of urban climates. *Remote Sensing of Environment*, 86(3).
- pvlib Python: Holmgren et al. (2018). J. Open Source Software.
- OSMnx: Boeing, G. (2017). *OSMnx: New methods for acquiring, constructing, analyzing, and visualizing complex street networks.* Computers, Environment and Urban Systems.
