import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/confluence/csv";
import { confluenceSource, type ExportFiles } from "../sources/confluence";
import type { SourcePage } from "../types";

/** An export held in memory, standing in for a directory or a zip. */
function exportFiles(files: Record<string, string>, binary: Record<string, Uint8Array> = {}): ExportFiles {
  return {
    paths: [...Object.keys(files), ...Object.keys(binary)],
    rows: (path) =>
      parseCsv(
        (async function* () {
          yield files[path] ?? "";
        })(),
      ),
    readBytes: async (path) => binary[path] ?? new TextEncoder().encode(files[path] ?? ""),
  };
}

async function collect(files: ExportFiles): Promise<SourcePage[]> {
  const source = await confluenceSource(files);
  const pages: SourcePage[] = [];
  for await (const page of source.pages()) pages.push(page);
  return pages;
}

const BODIES = `CONTENTID,BODY
1,"<p>Six weeks of leave.</p>"
2,"<p>See the <ac:link><ri:page ri:content-title=""Parental leave"" /></ac:link> page.</p>"
`;

const CONTENT = `CONTENTID,TITLE,PARENTID,SPACEKEY,CONTENTTYPE,CONTENTSTATUS,CREATOR,LASTMODDATE
1,Parental leave,2,HR,PAGE,CURRENT,jsmith,2026-01-02 10:00:00
2,Leave,,HR,PAGE,CURRENT,jsmith,2026-01-01 10:00:00
`;

describe("confluenceSource", () => {
  it("converts bodies and pairs them with their metadata", async () => {
    const pages = await collect(
      exportFiles({ "entities/bodycontent.csv": BODIES, "entities/content.csv": CONTENT }),
    );

    expect(pages).toHaveLength(2);
    const parental = pages.find((p) => p.sourceId === "1");
    expect(parental?.title).toBe("Parental leave");
    expect(parental?.bodyMd).toContain("Six weeks of leave.");
    expect(parental?.parentSourceId).toBe("2");
    expect(parental?.spaceKey).toBe("HR");
    expect(parental?.author).toBe("jsmith");
  });

  it("finds the CSVs whether they sit at the root or under entities/", async () => {
    const pages = await collect(exportFiles({ "bodycontent.csv": BODIES, "content.csv": CONTENT }));
    expect(pages).toHaveLength(2);
  });

  it("detects column names rather than assuming one Confluence version's layout", async () => {
    const pages = await collect(
      exportFiles({
        "bodycontent.csv": `ID,BODY\n7,"<p>Hello</p>"\n`,
        "content.csv": `ID,TITLE,PARENT_ID,SPACE,TYPE,STATUS\n7,Welcome,,ENG,page,current\n`,
      }),
    );
    expect(pages[0]).toMatchObject({ sourceId: "7", title: "Welcome", spaceKey: "ENG" });
  });

  it("imports every body when there is no metadata at all, rather than nothing", async () => {
    // A flat import of real content beats a clean failure.
    const pages = await collect(exportFiles({ "entities/bodycontent.csv": BODIES }));
    expect(pages).toHaveLength(2);
    expect(pages[0].title).toBe("Untitled 1");
    expect(pages[0].parentSourceId).toBeNull();
  });

  it("skips comments, blog posts and superseded versions", async () => {
    const pages = await collect(
      exportFiles({
        "entities/bodycontent.csv": `CONTENTID,BODY\n1,"<p>A page</p>"\n2,"<p>A comment</p>"\n3,"<p>An old draft</p>"\n`,
        "entities/content.csv":
          `CONTENTID,TITLE,CONTENTTYPE,CONTENTSTATUS\n1,Real page,PAGE,CURRENT\n2,Re: Real page,COMMENT,CURRENT\n3,Real page,PAGE,DRAFT\n`,
      }),
    );
    expect(pages.map((p) => p.title)).toEqual(["Real page"]);
  });

  it("attaches files under attachments/<page id>/, naming them from attachments.csv", async () => {
    const pages = await collect(
      exportFiles(
        {
          "entities/bodycontent.csv": `CONTENTID,BODY\n1,"<p>x</p>"\n`,
          "entities/content.csv": `CONTENTID,TITLE,CONTENTTYPE\n1,Page,PAGE\n`,
          "entities/attachments.csv": `CONTENTID,TITLE\natt-9,office-desk.png\n`,
        },
        { "attachments/1/att-9/1": new Uint8Array([137, 80]) },
      ),
    );

    expect(pages[0].attachments).toHaveLength(1);
    expect(pages[0].attachments[0].filename).toBe("office-desk.png");
    expect(await pages[0].attachments[0].read()).toEqual(new Uint8Array([137, 80]));
  });

  it("falls back to the stored filename when no attachments.csv names it", async () => {
    const pages = await collect(
      exportFiles(
        {
          "entities/bodycontent.csv": `CONTENTID,BODY\n1,"<p>x</p>"\n`,
          "entities/content.csv": `CONTENTID,TITLE,CONTENTTYPE\n1,Page,PAGE\n`,
        },
        { "attachments/1/diagram.png": new Uint8Array([1]) },
      ),
    );
    expect(pages[0].attachments[0].filename).toBe("diagram.png");
  });

  it("reports which metadata columns it found, so a flat import is explainable", async () => {
    const source = await confluenceSource(
      exportFiles({ "entities/bodycontent.csv": BODIES, "entities/content.csv": CONTENT }),
    );
    expect(source.info.columns).toContain("parent");
    expect(source.info.pageCount).toBe(2);

    const bare = await confluenceSource(exportFiles({ "entities/bodycontent.csv": BODIES }));
    expect(bare.info.columns).toEqual([]);
  });

  it("refuses an export with no bodycontent.csv, saying what it expected", async () => {
    await expect(confluenceSource(exportFiles({ "readme.txt": "hello" }))).rejects.toThrow(
      /bodycontent\.csv/,
    );
  });

  it("carries conversion notes so nothing is dropped without the report saying so", async () => {
    const pages = await collect(
      exportFiles({
        "entities/bodycontent.csv":
          `CONTENTID,BODY\n` +
          `1,"<ac:structured-macro ac:name=""roadmap"" />"\n` +
          `2,"<ac:structured-macro ac:name=""weather-widget"" />"\n`,
      }),
    );

    // A macro the converter knows about and deliberately cannot represent...
    expect(pages[0].notes).toEqual([{ kind: "dropped", name: "roadmap" }]);
    // ...and one it has never seen. Both reach the per-page report; the
    // difference tells a reviewer whether to expect a handler to exist.
    expect(pages[1].notes).toEqual([{ kind: "unsupported-macro", name: "weather-widget" }]);
  });
});
