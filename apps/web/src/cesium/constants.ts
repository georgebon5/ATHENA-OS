// Γεωγραφικές σταθερές της demo περιοχής.
// Σεράφειο: Πειραιώς 144 / Εχελιδών 19 (περίπου)
export const SERAFIO_LNGLAT: [number, number] = [23.7108, 37.9787];

// Bounding box γύρω από Πειραιώς / Γκάζι / Κεραμεικό / Θησείο
export const DEMO_BBOX = {
  west: 23.7,
  south: 37.97,
  east: 23.73,
  north: 37.99,
};

// Κινηματογραφικά υψόμετρα
export const HEIGHT = {
  map: 6000, // top-down «χάρτης» (2D look) του map lookup (Esc)
  nearby: 2500, // αρχική λήψη + «κοντά σου»: λιγότερα tiles από τα 6 km → γρηγορότερο άνοιγμα
  overview: 900,
  flyover: 500,
  street: 120,
  close: 50,
};

export const DEFAULT_WHEN_ISO = new Date().toISOString();
