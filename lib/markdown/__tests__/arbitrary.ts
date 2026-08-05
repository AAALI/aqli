/**
 * Markdown generators for the round-trip property test.
 *
 * Two of them, because they answer different questions.
 *
 * `wellFormedMarkdown` produces markdown a person or a converter would actually
 * write: balanced emphasis, closed code spans, escaped metacharacters. This is
 * the input the strict fixed-point guarantee has to hold for.
 *
 * `hostileMarkdown` produces deliberately malformed source — unbalanced `*`,
 * stray backticks, unclosed brackets. CommonMark resolves those by rules that
 * can leave emphasis spanning inline boundaries in ways no serializer can spell
 * unambiguously, so the guarantee there is convergence rather than a fixed
 * point after exactly one pass.
 */
import fc from "fast-check";

/** Characters that carry no markdown meaning, so text stays well-formed. */
const SAFE_TEXT = /^[A-Za-z0-9 ,.;:!?()/'"+=@-]{1,40}$/;

const safeText = fc.stringMatching(SAFE_TEXT).filter((s) => s.trim().length > 0);

/**
 * Text containing markdown metacharacters, emitted backslash-escaped so the
 * source stays well-formed. This is what exercises the escaping paths without
 * handing the parser ambiguous emphasis.
 */
const escapedText = fc
  .stringMatching(/^[A-Za-z0-9 *_`~[\]#>|-]{1,30}$/)
  .filter((s) => s.trim().length > 0)
  .map((s) => s.replace(/[*_`~[\]\\]/g, (c) => `\\${c}`));

const plainChunk = fc.oneof(safeText, escapedText);

const markedChunk = fc.oneof(
  safeText.map((t) => `**${t}**`),
  safeText.map((t) => `*${t}*`),
  safeText.map((t) => `~~${t}~~`),
  safeText.map((t) => `\`${t.replace(/`/g, "")}\``),
  safeText.map((t) => `[${t.replace(/[[\]()]/g, "")}](http://example.com/x)`),
  safeText.map((t) => `**${t} *${t}* ${t}**`),
);

const inlineLine = fc
  .array(fc.oneof(plainChunk, markedChunk), { minLength: 1, maxLength: 4 })
  .map((parts) => parts.join(" "));

const paragraph = inlineLine.map((l) => `${l}\n`);

const heading = fc
  .tuple(fc.integer({ min: 1, max: 6 }), inlineLine)
  .map(([level, l]) => `${"#".repeat(level)} ${l}\n`);

const bulletList = fc
  .array(inlineLine, { minLength: 1, maxLength: 4 })
  .map((items) => `${items.map((i) => `- ${i}`).join("\n")}\n`);

const nestedBulletList = fc
  .array(fc.tuple(inlineLine, inlineLine), { minLength: 1, maxLength: 3 })
  .map(
    (items) =>
      `${items.map(([outer, inner]) => `- ${outer}\n  - ${inner}`).join("\n")}\n`,
  );

const orderedList = fc
  .array(inlineLine, { minLength: 1, maxLength: 4 })
  .map((items) => `${items.map((i, n) => `${n + 1}. ${i}`).join("\n")}\n`);

const taskList = fc
  .array(fc.tuple(fc.boolean(), inlineLine), { minLength: 1, maxLength: 4 })
  .map(
    (items) =>
      `${items.map(([done, i]) => `- [${done ? "x" : " "}] ${i}`).join("\n")}\n`,
  );

const codeFence = fc
  .tuple(
    fc.constantFrom("", "js", "sql", "mermaid", "python"),
    fc.array(fc.stringMatching(/^[A-Za-z0-9 ={}();*#|_-]{0,30}$/), {
      minLength: 1,
      maxLength: 4,
    }),
  )
  .map(([language, lines]) => `\`\`\`${language}\n${lines.join("\n")}\n\`\`\`\n`);

const blockquote = fc
  .array(inlineLine, { minLength: 1, maxLength: 3 })
  .map((lines) => `${lines.map((l) => `> ${l}`).join("\n>\n")}\n`);

const quotedList = fc
  .array(inlineLine, { minLength: 1, maxLength: 3 })
  .map((items) => `${items.map((i) => `> - ${i}`).join("\n")}\n`);

const callout = fc
  .tuple(
    fc.constantFrom("NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"),
    inlineLine,
  )
  .map(([kind, body]) => `> [!${kind}]\n> ${body}\n`);

const table = fc
  .tuple(
    fc.array(safeText, { minLength: 1, maxLength: 3 }),
    fc.array(fc.array(fc.oneof(safeText, markedChunk), { minLength: 1, maxLength: 3 }), {
      minLength: 1,
      maxLength: 3,
    }),
  )
  .map(([header, rows]) => {
    const width = header.length;
    const cell = (s: string) => s.replace(/[|\\]/g, "").trim() || "x";
    const line = (cells: string[]) =>
      `| ${Array.from({ length: width }, (_, i) => cell(cells[i] ?? "")).join(" | ")} |`;
    return `${[line(header), `|${" --- |".repeat(width)}`, ...rows.map(line)].join("\n")}\n`;
  });

const rule = fc.constant("---\n");

const block = fc.oneof(
  paragraph,
  heading,
  bulletList,
  nestedBulletList,
  orderedList,
  taskList,
  codeFence,
  blockquote,
  quotedList,
  callout,
  table,
  rule,
);

export const wellFormedMarkdown = fc
  .array(block, { minLength: 1, maxLength: 8 })
  .map((blocks) => blocks.join("\n"));

/** Raw metacharacters, unbalanced on purpose. */
const hostileInline = fc
  .stringMatching(/^[A-Za-z0-9 *_`~[\]()|#>\\!.-]{1,40}$/)
  .filter((s) => s.trim().length > 0);

const hostileLine = fc
  .array(hostileInline, { minLength: 1, maxLength: 4 })
  .map((parts) => parts.join(" "));

const hostileBlock = fc.oneof(
  hostileLine.map((l) => `${l}\n`),
  hostileLine.map((l) => `# ${l}\n`),
  hostileLine.map((l) => `- ${l}\n`),
  hostileLine.map((l) => `1. ${l}\n`),
  hostileLine.map((l) => `- [ ] ${l}\n`),
  hostileLine.map((l) => `> ${l}\n`),
  hostileLine.map((l) => `> [!NOTE]\n> ${l}\n`),
  hostileLine.map((l) => `| ${l} |\n| --- |\n| ${l} |\n`),
  hostileLine.map((l) => `\`\`\`\n${l}\n\`\`\`\n`),
);

export const hostileMarkdown = fc
  .array(hostileBlock, { minLength: 1, maxLength: 6 })
  .map((blocks) => blocks.join("\n"));
