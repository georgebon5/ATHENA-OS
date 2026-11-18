# demo/cache

Κάθε αρχείο `<beat>.json` περιέχει ακολουθία `{ atMs, event }` που αντιγράφει
ένα παλιό πραγματικό session, για να παίζει ως fallback όταν ο director πατάει
`F`. Τα events έχουν το ίδιο σχήμα με το WebSocket (βλ. `CLAUDE.md §4.3`).

Παράδειγμα:

```json
[
  { "atMs": 0, "event": { "type": "agent.say", "payload": { "textEl": "Γεια.", "mood": "neutral" } } },
  { "atMs": 1500, "event": { "type": "report.created", "payload": { "id": "r1", "...": "..." } } }
]
```

Beats: `intro`, `pitch`, `sense`, `simulate`, `engage`, `decision`, `close`.
