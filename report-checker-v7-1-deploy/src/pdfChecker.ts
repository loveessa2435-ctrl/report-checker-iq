import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export type SectionName = "introduction" | "conclusion" | "references" | "contents";
export type SectionResult = { found: boolean; pages: number[] };
export type PdfCheckResult = {
  pages: number;
  sections: Record<SectionName, SectionResult>;
  noExtractableTextPages: number[];
  totalCharacters: number;
  reviewNotes: string[];
  contentsPages: number[];
};

const names: Record<SectionName, string[]> = {
  introduction: ["introduction", "المقدمة", "مقدمة", "تمهيد"],
  conclusion: ["conclusion", "conclusions", "الخاتمة", "خاتمة", "الاستنتاجات", "استنتاجات"],
  references: ["references", "bibliography", "works cited", "المصادر", "المراجع", "المصادر والمراجع"],
  contents: ["table of contents", "contents", "الفهرس", "المحتويات", "فهرس المحتويات"],
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/\s+/g, " ").trim();
}

function titleOf(line: string): SectionName | null {
  const cleaned = normalize(line)
    .replace(/^(?:chapter|section|الفصل|المبحث|القسم)\s*(?:\d+|[ivx]+|[٠-٩]+)?\s*[:.\-–]?\s*/i, "")
    .replace(/^(?:\d+(?:\.\d+)*|[٠-٩]+(?:\.[٠-٩]+)*|[ivx]+)\s*[.)\-–:]?\s*/i, "")
    .replace(/\s*[:.\-–]+\s*$/, "");
  for (const key of Object.keys(names) as SectionName[]) {
    if (names[key].some(name => normalize(name) === cleaned)) return key;
  }
  return null;
}

type PageInfo = { lines: string[]; text: string; headingCandidates: SectionName[]; likelyContents: boolean };

export async function checkPDF(data: Uint8Array): Promise<PdfCheckResult> {
  const task = pdfjsLib.getDocument({ data, useSystemFonts: true, isEvalSupported: false });
  try {
    const pdf = await task.promise;
    const sections = Object.fromEntries(
      (Object.keys(names) as SectionName[]).map(name => [name, { found: false, pages: [] as number[] }])
    ) as Record<SectionName, SectionResult>;
    const noExtractableTextPages: number[] = [];
    const reviewNotes: string[] = [];
    const pageInfos: PageInfo[] = [];
    let totalCharacters = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let currentLine = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        currentLine += item.str;
        if (item.hasEOL) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = "";
        } else currentLine += " ";
      }
      if (currentLine.trim()) lines.push(currentLine.trim());
      const text = lines.join("\n");
      totalCharacters += text.replace(/\s/g, "").length;
      if (!text.trim()) noExtractableTextPages.push(pageNumber);
      const headingCandidates = lines.map(titleOf).filter((v): v is SectionName => v !== null);
      const explicitContents = headingCandidates.includes("contents");
      const dottedEntries = lines.filter(line => /\.{3,}\s*[\d٠-٩ivx]+\s*$/i.test(line)).length;
      const numberedEntries = lines.filter(line => /^\s*(?:\d+(?:\.\d+)*|[٠-٩]+)\s*[.)-]?\s+.{3,}\s+\d+\s*$/.test(line)).length;
      const likelyContents = explicitContents || dottedEntries >= 2 || numberedEntries >= 4;
      pageInfos.push({ lines, text, headingCandidates, likelyContents });
      page.cleanup();
    }

    const contentsPages = pageInfos.flatMap((p, i) => p.likelyContents ? [i + 1] : []);
    for (let i = 0; i < pageInfos.length; i++) {
      const page = pageInfos[i];
      if (page.likelyContents) {
        if (page.headingCandidates.includes("contents")) sections.contents.pages.push(i + 1);
        continue;
      }
      for (const key of ["introduction", "conclusion", "references"] as SectionName[]) {
        if (page.headingCandidates.includes(key)) sections[key].pages.push(i + 1);
      }
    }
    // If a contents page was inferred from dotted entries, count it as contents evidence.
    if (!sections.contents.pages.length) sections.contents.pages = [...contentsPages];
    for (const key of Object.keys(sections) as SectionName[]) {
      sections[key].pages = [...new Set(sections[key].pages)];
      sections[key].found = sections[key].pages.length > 0;
    }
    if (noExtractableTextPages.length) reviewNotes.push("بعض الصفحات بدون نص قابل للاستخراج؛ قد تكون صوراً أو صفحات فارغة.");
    if (contentsPages.length) reviewNotes.push("استُبعدت صفحات الفهرس المحتملة من إثبات وجود المقدمة والخاتمة والمصادر.");
    reviewNotes.push("الكشف مبني على النص والعناوين، ولا يؤكد جودة المحتوى أو صحة المصادر أو التنسيق.");
    return { pages: pdf.numPages, sections, noExtractableTextPages, totalCharacters, reviewNotes, contentsPages };
  } finally {
    await task.destroy();
  }
}
