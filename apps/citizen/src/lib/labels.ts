import type { LngLat, ReportCategory, VoteChoice } from "@athena-os/contracts";

export const CATEGORY_EL: Record<ReportCategory, string> = {
  pothole: "Λακκούβα",
  sidewalk_damage: "Φθορά πεζοδρομίου",
  waste: "Απορρίμματα",
  lighting: "Φωτισμός",
  obstruction: "Εμπόδιο",
  heat_exposure: "Θερμική έκθεση",
  graffiti: "Graffiti",
  accessibility: "Προσβασιμότητα",
  other: "Άλλο",
};

export const CHOICES: { value: VoteChoice; label: string; tone: string }[] = [
  { value: "yes", label: "Ναι", tone: "bg-yes" },
  { value: "no", label: "Όχι", tone: "bg-no" },
  { value: "maybe", label: "Ίσως", tone: "bg-maybe" },
];

/** Γειτονιές για το προαιρετικό «πού μένεις» (κέντρο γειτονιάς, όχι GPS: δεν ζητάμε άδεια τοποθεσίας για ψήφο). */
export const NEIGHBORHOODS: { name: string; lngLat: LngLat | null }[] = [
  { name: "Γκάζι", lngLat: [23.7125, 37.9785] },
  { name: "Κεραμεικός", lngLat: [23.718, 37.978] },
  { name: "Θησείο", lngLat: [23.7205, 37.9765] },
  { name: "Μεταξουργείο", lngLat: [23.72, 37.984] },
  { name: "Ψυρρή", lngLat: [23.724, 37.978] },
  { name: "Ρουφ", lngLat: [23.706, 37.975] },
  { name: "Βοτανικός", lngLat: [23.705, 37.983] },
  { name: "Πετράλωνα", lngLat: [23.71, 37.97] },
  { name: "Κουκάκι", lngLat: [23.723, 37.966] },
  { name: "Πλάκα", lngLat: [23.73, 37.972] },
  { name: "Κολωνός", lngLat: [23.713, 37.994] },
  { name: "Ακαδημία Πλάτωνος", lngLat: [23.709, 37.992] },
  { name: "Εξάρχεια", lngLat: [23.735, 37.986] },
  { name: "Κολωνάκι", lngLat: [23.742, 37.979] },
  { name: "Κυψέλη", lngLat: [23.74, 37.999] },
  { name: "Πατήσια", lngLat: [23.733, 38.013] },
  { name: "Αμπελόκηποι", lngLat: [23.76, 37.987] },
  { name: "Παγκράτι", lngLat: [23.748, 37.968] },
  { name: "Νέος Κόσμος", lngLat: [23.728, 37.96] },
  { name: "Άλλη περιοχή", lngLat: null },
];
