# @athena-os/contracts

Κοινά contracts μεταξύ όλων των services και apps. Παγώνουν στο T+2h
του hackathon και αλλάζουν μόνο με συμφωνία των 4 devs.

## fixtures/

| Αρχείο | Ποιος το γράφει | Ποιος το καταναλώνει |
|---|---|---|
| `network.geojson` | Dev2 (Σωτήρης) από εκτομή OSM | Dev1 (web, render polylines & resolver `wayId → path`), Dev2 (sim routing) |
| `sim_result.json` | Dev2 ως output του sim | Dev1 (mock-first visual), Dev2 (validation) |

Οι συντεταγμένες είναι WGS84, `[lng, lat]`.

### Network

Ο gateway εκθέτει `GET /network` που επιστρέφει αυτό το ίδιο GeoJSON.
Στο dev mode το apps/web πέφτει σε `/demo/network.geojson` αν το
endpoint δεν απαντά.

Κάθε feature έχει properties:

```json
{ "wayId": 100003, "name": "Πειραιώς", "highway": "primary", "lanes": 3, "oneway": false, "maxspeed": 50 }
```

### Sim result

Ακολουθεί το `SimResult` interface (CLAUDE.md §4.1). Τα segments έχουν
`path` inline — αν λείπει, ο client το λύνει μέσω του δικτύου με το
`wayId`.
