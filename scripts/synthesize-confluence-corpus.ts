/**
 * Synthetic stand-in for `bodycontent.csv`.
 *
 * The real corpus — a 1,361-page Confluence space export — is not present in
 * this environment, and it is the input the fidelity gate is meant to run
 * against. This generator builds a corpus with the same shape so
 * the converter and the gate are exercised end to end and the harness is proven
 * before the export arrives: page count, macro mix and element frequencies all
 * follow the census in spec §8.
 *
 * It is not a substitute for the real run. Synthetic content cannot contain the
 * malformed markup, encoding oddities and one-off macros that make a real
 * export interesting, which is exactly what the gate exists to find. Treat its
 * report as evidence the pipeline works, not as the answer to "does markdown
 * hold up against 1,361 real pages".
 *
 * Usage: pnpm confluence:synthesize [--out path] [--pages N] [--seed N]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/** Element and macro counts measured in the real export (spec §8). */
const CENSUS = {
  pages: 1361,
  macros: {
    status: 3105,
    code: 2394,
    "view-file": 221,
    info: 90,
    note: 78,
    tip: 56,
    jira: 172,
    toc: 158,
    mermaid: 40,
    "mermaid-cloud": 22,
    "mermaid-macro": 10,
    drawio: 60,
    "inc-drawio": 15,
    "drawio-sketch": 8,
    expand: 8,
    children: 6,
    roadmap: 5,
    "recently-updated": 4,
    contributors: 4,
    panel: 3,
  },
  elements: {
    "ac:inline-comment-marker": 8158,
    "ac:link": 6494,
    "ac:image": 4643,
    "ri:user": 2239,
    "ac:layout": 2090,
    "ac:adf-extension": 1778,
    "ac:task-list": 195,
    strong: 85896,
    ul: 20754,
    code: 12856,
    table: 7613,
    hr: 8998,
  },
} as const;

/** Deterministic PRNG so a report can be reproduced from its seed. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

const WORDS =
  `custody fees settlement order routing kyc onboarding compliance ledger reconciliation
   webhook retry backoff idempotent broker trade execution venue liquidity margin collateral
   escrow payout clearing depositary mandate suitability disclosure audit trail attestation
   zagtrader oms fix session heartbeat throttle latency market open close auction`
    .split(/\s+/)
    .filter(Boolean);

export function synthesize(pageCount: number, seed: number): { id: string; body: string }[] {
  const random = makeRandom(seed);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const words = (n: number) =>
    Array.from({ length: n }, () => pick(WORDS)).join(" ");
  const sentence = () => {
    const s = words(4 + Math.floor(random() * 10));
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  };

  /** Expected occurrences of a thing per page, from the census. */
  const rate = (total: number) => total / CENSUS.pages;
  const times = (perPage: number): number => {
    const whole = Math.floor(perPage);
    return whole + (random() < perPage - whole ? 1 : 0);
  };

  const inlineMarkup = (): string => {
    const roll = random();
    if (roll < 0.3) return `<strong>${words(2)}</strong>`;
    if (roll < 0.45) return `<em>${words(2)}</em>`;
    if (roll < 0.6) return `<code>${pick(WORDS)}_${pick(WORDS)}</code>`;
    if (roll < 0.7)
      return `<ac:link><ri:page ri:content-title="${words(3)}" /><ac:plain-text-link-body>${words(2)}</ac:plain-text-link-body></ac:link>`;
    if (roll < 0.78) return `<ri:user ri:userkey="${pick(WORDS)}" />`;
    if (roll < 0.9)
      return `<ac:inline-comment-marker ac:ref="${Math.floor(random() * 1e6)}">${words(3)}</ac:inline-comment-marker>`;
    return `<ac:structured-macro ac:name="status"><ac:parameter ac:name="title">${pick(["DONE", "IN PROGRESS", "BLOCKED"])}</ac:parameter></ac:structured-macro>`;
  };

  const paragraph = () => {
    const parts = [sentence()];
    for (let i = 0; i < 1 + Math.floor(random() * 3); i++) {
      parts.push(inlineMarkup(), sentence());
    }
    return `<p>${parts.join(" ")}</p>`;
  };

  const list = () =>
    `<ul>${Array.from({ length: 2 + Math.floor(random() * 4) }, () => `<li><p>${sentence()} ${inlineMarkup()}</p></li>`).join("")}</ul>`;

  const table = () => {
    const cols = 2 + Math.floor(random() * 2);
    const head = `<tr>${Array.from({ length: cols }, () => `<th><p>${words(2)}</p></th>`).join("")}</tr>`;
    const rows = Array.from(
      { length: 1 + Math.floor(random() * 4) },
      () => `<tr>${Array.from({ length: cols }, () => `<td><p>${words(3)} ${random() < 0.2 ? inlineMarkup() : ""}</p></td>`).join("")}</tr>`,
    ).join("");
    return `<table><tbody>${head}${rows}</tbody></table>`;
  };

  const codeMacro = () => {
    const language = pick(["java", "sql", "bash", "json", "typescript", ""]);
    const body = [
      `-- ${sentence()}`,
      `select ${pick(WORDS)} from ${pick(WORDS)} where id = 1;`,
      random() < 0.2 ? "# not a heading\n- not a list\n| not | a table |" : "",
    ]
      .filter(Boolean)
      .join("\n");
    return `<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">${language}</ac:parameter><ac:plain-text-body><![CDATA[${body}]]></ac:plain-text-body></ac:structured-macro>`;
  };

  const alertMacro = () => {
    const name = pick(["info", "note", "tip", "warning"]);
    return `<ac:structured-macro ac:name="${name}"><ac:rich-text-body><p>${sentence()}</p></ac:rich-text-body></ac:structured-macro>`;
  };

  const mermaidMacro = () =>
    `<ac:structured-macro ac:name="${pick(["mermaid", "mermaid-cloud", "mermaid-macro"])}"><ac:plain-text-body><![CDATA[flowchart TD\n  A[Start] --> B{Check}\n  B -- yes --> C[Ship]]]></ac:plain-text-body></ac:structured-macro>`;

  const drawioMacro = () =>
    `<ac:structured-macro ac:name="${pick(["drawio", "inc-drawio", "drawio-sketch"])}"><ac:parameter ac:name="diagramName">${words(2).replace(/\s/g, "-")}</ac:parameter></ac:structured-macro>`;

  const taskList = () =>
    `<ac:task-list>${Array.from({ length: 2 + Math.floor(random() * 3) }, () => `<ac:task><ac:task-status>${random() < 0.5 ? "complete" : "incomplete"}</ac:task-status><ac:task-body>${sentence()}</ac:task-body></ac:task>`).join("")}</ac:task-list>`;

  const image = () =>
    `<ac:image ac:alt="${words(2)}"><ri:attachment ri:filename="${pick(WORDS)}-${Math.floor(random() * 99)}.png" /></ac:image>`;

  const viewFile = () =>
    `<ac:structured-macro ac:name="view-file"><ac:parameter ac:name="name">${pick(WORDS)}.pdf</ac:parameter></ac:structured-macro>`;

  const jiraMacro = () =>
    `<ac:structured-macro ac:name="jira"><ac:parameter ac:name="key">TAB-${Math.floor(random() * 900) + 100}</ac:parameter></ac:structured-macro>`;

  const tocMacro = () => `<ac:structured-macro ac:name="toc" />`;

  const expandMacro = () =>
    `<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">${words(3)}</ac:parameter><ac:rich-text-body><p>${sentence()}</p></ac:rich-text-body></ac:structured-macro>`;

  const unsupportedMacro = () =>
    `<ac:structured-macro ac:name="${pick(["children", "roadmap", "recently-updated", "contributors"])}" />`;

  const adfExtension = () =>
    `<ac:adf-extension><ac:adf-node type="panel"><ac:adf-content><p>${sentence()}</p></ac:adf-content></ac:adf-node><ac:adf-fallback><p>${sentence()}</p></ac:adf-fallback></ac:adf-extension>`;

  const layout = (inner: string) =>
    `<ac:layout><ac:layout-section ac:type="two_equal"><ac:layout-cell>${inner}</ac:layout-cell><ac:layout-cell><p>${sentence()}</p></ac:layout-cell></ac:layout-section></ac:layout>`;

  const pages: { id: string; body: string }[] = [];

  for (let i = 0; i < pageCount; i++) {
    const blocks: string[] = [];
    const heading = (level: number) => `<h${level}>${words(3)}</h${level}>`;

    blocks.push(heading(1));
    if (random() < rate(CENSUS.macros.toc)) blocks.push(tocMacro());

    const sections = 2 + Math.floor(random() * 5);
    for (let s = 0; s < sections; s++) {
      blocks.push(heading(2 + Math.floor(random() * 3)));
      blocks.push(paragraph());
      if (random() < rate(CENSUS.elements.ul)) blocks.push(list());
      if (random() < rate(CENSUS.elements.table)) blocks.push(table());
      if (random() < rate(CENSUS.macros.code)) blocks.push(codeMacro());
      if (random() < rate(CENSUS.elements.hr)) blocks.push("<hr />");
      if (random() < 0.5) blocks.push(paragraph());
    }

    for (let n = times(rate(CENSUS.macros.info + CENSUS.macros.note + CENSUS.macros.tip)); n > 0; n--) {
      blocks.push(alertMacro());
    }
    for (let n = times(rate(CENSUS.macros.mermaid + CENSUS.macros["mermaid-cloud"] + CENSUS.macros["mermaid-macro"])); n > 0; n--) {
      blocks.push(mermaidMacro());
    }
    for (let n = times(rate(CENSUS.macros.drawio + CENSUS.macros["inc-drawio"] + CENSUS.macros["drawio-sketch"])); n > 0; n--) {
      blocks.push(drawioMacro());
    }
    for (let n = times(rate(CENSUS.elements["ac:image"])); n > 0; n--) blocks.push(`<p>${image()}</p>`);
    for (let n = times(rate(CENSUS.elements["ac:task-list"])); n > 0; n--) blocks.push(taskList());
    if (random() < rate(CENSUS.macros["view-file"])) blocks.push(viewFile());
    if (random() < rate(CENSUS.macros.jira)) blocks.push(`<p>${jiraMacro()}</p>`);
    if (random() < rate(CENSUS.macros.expand)) blocks.push(expandMacro());
    if (random() < rate(CENSUS.macros.children + CENSUS.macros.roadmap + CENSUS.macros["recently-updated"] + CENSUS.macros.contributors)) {
      blocks.push(unsupportedMacro());
    }
    for (let n = times(rate(CENSUS.elements["ac:adf-extension"])); n > 0; n--) blocks.push(adfExtension());

    let body = blocks.join("");
    if (random() < rate(CENSUS.elements["ac:layout"])) body = layout(body);

    pages.push({ id: `page-${String(i + 1).padStart(4, "0")}`, body });
  }

  return pages;
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const arg = (name: string, fallback: string) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : argv[i + 1];
  };

  const outPath = resolve(arg("out", "reports/synthetic-bodycontent.csv"));
  const pageCount = Number(arg("pages", String(CENSUS.pages)));
  const seed = Number(arg("seed", "20260805"));

  const pages = synthesize(pageCount, seed);
  const rows = ["CONTENTID,BODY", ...pages.map((p) => `${csvEscape(p.id)},${csvEscape(p.body)}`)];

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${rows.join("\n")}\n`, "utf8");

  const bytes = rows.reduce((total, row) => total + row.length, 0);
  console.log(`pages: ${pages.length}`);
  console.log(`bytes: ${bytes}`);
  console.log(`out:   ${outPath}`);
}

void main();
