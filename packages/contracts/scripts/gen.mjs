#!/usr/bin/env node
/**
 * Codegen των contracts: schemas/*.json → generated/{bundle.schema.json, ts/index.ts, py/athena_contracts/models.py}
 * και έλεγχος ότι κάθε fixture ταιριάζει στο schema του.
 *
 *   node scripts/gen.mjs           γράφει τα generated αρχεία
 *   node scripts/gen.mjs --check   αποτυγχάνει αν τα generated δεν είναι ενημερωμένα (CI)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { compile } from "json-schema-to-typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMAS = join(ROOT, "schemas");
const FIXTURES = join(ROOT, "fixtures");
const OUT_BUNDLE = join(ROOT, "generated", "bundle.schema.json");
const OUT_TS = join(ROOT, "generated", "ts", "index.ts");
const OUT_PY = join(ROOT, "generated", "py", "athena_contracts", "models.py");
const DMCG = "datamodel-code-generator==0.98.0";
const CHECK = process.argv.includes("--check");

const BANNER = "AUTO-GENERATED από packages/contracts/schemas — ΜΗΝ το αλλάξεις με το χέρι. Τρέξε `pnpm contracts:gen`.";

/** Ενώνει όλα τα schemas σε ένα έγγραφο με κοινό `definitions`. */
function bundle() {
  const definitions = {};
  for (const file of readdirSync(SCHEMAS).filter((f) => f.endsWith(".json")).sort()) {
    const doc = JSON.parse(readFileSync(join(SCHEMAS, file), "utf8"));
    for (const [name, def] of Object.entries(doc.definitions ?? {})) {
      if (definitions[name]) throw new Error(`Διπλό definition "${name}" (${file})`);
      definitions[name] = def;
    }
  }
  const rewritten = JSON.parse(
    JSON.stringify(definitions).replace(/"\$ref":"[a-z]+\.json#\/definitions\//g, '"$ref":"#/definitions/'),
  );
  for (const m of JSON.stringify(rewritten).matchAll(/"\$ref":"#\/definitions\/([A-Za-z0-9]+)"/g)) {
    if (!rewritten[m[1]]) throw new Error(`Άγνωστο $ref: ${m[1]}`);
  }
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $comment: BANNER,
    title: "AthenaContracts",
    type: "object",
    properties: {},
    definitions: rewritten,
  };
}

async function genTs(schema) {
  let ts = await compile(structuredClone(schema), "AthenaContracts", {
    bannerComment: `/* ${BANNER} */`,
    additionalProperties: false,
    unreachableDefinitions: true,
    style: { singleQuote: false, printWidth: 100 },
  });
  // Το root type είναι μόνο «δοχείο» για τα definitions.
  ts = ts.replace(/export interface AthenaContracts \{\}\n\n?/, "");
  return ts;
}

function genPy(bundlePath) {
  const tmp = mkdtempSync(join(tmpdir(), "athena-contracts-"));
  const out = join(tmp, "models.py");
  try {
    execFileSync(
      "uvx",
      [
        "--quiet",
        "--from",
        DMCG,
        "datamodel-codegen",
        "--input", bundlePath,
        "--input-file-type", "jsonschema",
        "--output", out,
        "--output-model-type", "pydantic_v2.BaseModel",
        "--target-python-version", "3.11",
        "--enum-field-as-literal", "all",
        "--use-title-as-name",
        "--use-standard-collections",
        "--use-union-operator",
        "--use-schema-description",
        "--disable-timestamp",
        "--formatters", "black", "isort",
        "--custom-file-header", `# ${BANNER}`,
      ],
      { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, PYTHONWARNINGS: "ignore::FutureWarning" } },
    );
    return readFileSync(out, "utf8").replace(/\r\n/g, "\n");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Κάθε fixture δηλώνει στο manifest σε ποιο definition αντιστοιχεί ("Report" ή "Report[]"). */
function validateFixtures(schema) {
  const manifest = JSON.parse(readFileSync(join(FIXTURES, "manifest.json"), "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addSchema(schema, "bundle");
  let failed = 0;
  for (const [file, typeName] of Object.entries(manifest)) {
    const isArray = typeName.endsWith("[]");
    const ref = { $ref: `bundle#/definitions/${typeName.replace("[]", "")}` };
    const validate = ajv.compile(isArray ? { type: "array", items: ref } : ref);
    const data = JSON.parse(readFileSync(join(FIXTURES, file), "utf8"));
    if (!validate(data)) {
      failed++;
      console.error(`✗ fixtures/${file} δεν ταιριάζει στο ${typeName}:`);
      for (const e of validate.errors.slice(0, 5)) console.error(`   ${e.instancePath} ${e.message}`);
    }
  }
  const unlisted = readdirSync(FIXTURES).filter((f) => f.endsWith(".json") && f !== "manifest.json" && !manifest[f]);
  if (unlisted.length) console.warn(`! fixtures χωρίς δήλωση στο manifest.json: ${unlisted.join(", ")}`);
  if (failed) throw new Error(`${failed} fixture(s) δεν περνούν το schema`);
  console.log(`✓ ${Object.keys(manifest).length} fixtures ταιριάζουν στα schemas`);
}

function writeOrCheck(path, content, stale) {
  if (CHECK) {
    let current = "";
    try {
      current = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    } catch {}
    if (current !== content) stale.push(path.slice(ROOT.length + 1));
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

const schema = bundle();
const bundleJson = JSON.stringify(schema, null, 2) + "\n";
const stale = [];
writeOrCheck(OUT_BUNDLE, bundleJson, stale);

// Ο Python generator διαβάζει από αρχείο· στο --check γράφουμε προσωρινό bundle.
const tmpBundleDir = mkdtempSync(join(tmpdir(), "athena-bundle-"));
const tmpBundle = join(tmpBundleDir, "bundle.schema.json");
writeFileSync(tmpBundle, bundleJson);
try {
  writeOrCheck(OUT_TS, await genTs(schema), stale);
  writeOrCheck(OUT_PY, genPy(tmpBundle), stale);
} finally {
  rmSync(tmpBundleDir, { recursive: true, force: true });
}
validateFixtures(schema);

if (stale.length) {
  console.error(`✗ Τα generated δεν είναι ενημερωμένα: ${stale.join(", ")}\n  Τρέξε: pnpm contracts:gen`);
  process.exit(1);
}
console.log(CHECK ? "✓ generated ενημερωμένα" : "✓ generated γράφτηκαν");
