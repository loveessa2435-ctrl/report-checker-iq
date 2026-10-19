import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export type Verdict = "pass" | "fail" | "review";
export type FormatCriterion = { verdict: Verdict; detail: string; evidence?: string };
export type FormatReport = {
  pageCount: number;
  paper: FormatCriterion;
  fontFamily: FormatCriterion;
  fontSize: FormatCriterion;
  lineSpacing: FormatCriterion;
  notes: string[];
};

export type FormatRequirements = {
  fontFamily: string;
  fontSizePt: number;
  lineSpacing: number;
  paper: "A4";
};

export const DEFAULT_REQUIREMENTS: FormatRequirements = {
  fontFamily: "Times New Roman",
  fontSizePt: 16,
  lineSpacing: 1.5,
  paper: "A4",
};

type TextRun = {
  text: string;
  x: number;
  y: number;
  fontId: string;
  heightPt: number;
  page: number;
};

const close = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;
const normFont = (value: string) => value.replace(/^[A-Z]{6}\+/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const isTimes = (value: string) => /timesnewroman|timesroman|timesnrmt|timesnewromanps|liberationserif/.test(normFont(value));
const fmt = (n: number) => Number(n.toFixed(1));

export async function checkFormatting(
  data: Uint8Array,
  requirements: FormatRequirements = DEFAULT_REQUIREMENTS
): Promise<FormatReport> {
  const task = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  try {
    const pdf = await task.promise;
    const runs: TextRun[] = [];
    const paperSizes: Array<{ page: number; width: number; height: number; ok: boolean }> = [];
    const fontNames = new Map<string, string>();
    const lineRatios: number[] = [];
    let hasNonLatin = false;

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      // scale=1 gives PDF point units (1/72 inch).
      const viewport = page.getViewport({ scale: 1 });
      const width = Math.min(viewport.width, viewport.height);
      const height = Math.max(viewport.width, viewport.height);
      const ok = close(width, 595.28, 2) && close(height, 841.89, 2);
      paperSizes.push({ page: pageNo, width, height, ok });

      const content = await page.getTextContent();
      const styles = content.styles as Record<string, { fontFamily?: string; ascent?: number; descent?: number }>;
      for (const [id, style] of Object.entries(styles)) {
        fontNames.set(id, style.fontFamily ?? "");
      }

      const pageRuns: TextRun[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        if (/[^\u0000-\u024F]/.test(item.str)) hasNonLatin = true;
        const transform = item.transform;
        // Text transform length is a useful visual-height proxy, NOT a guaranteed original font-size.
        const heightPt = Math.hypot(transform[2], transform[3]);
        if (!Number.isFinite(heightPt) || heightPt <= 0) continue;
        pageRuns.push({
          text: item.str,
          x: transform[4],
          y: transform[5],
          fontId: item.fontName,
          heightPt,
          page: pageNo,
        });
      }
      runs.push(...pageRuns);

      // Group items with near-identical baselines to estimate visual line spacing.
      // This is NOT Word's 1.5-line setting, so results remain review-only.
      const sorted = [...pageRuns].sort((a, b) => b.y - a.y || a.x - b.x);
      const lines: Array<{ y: number; x: number; height: number; chars: number }> = [];
      for (const run of sorted) {
        const line = lines.find(l => Math.abs(l.y - run.y) < 2 && Math.abs(l.x - run.x) < 300);
        if (line) {
          line.height = Math.max(line.height, run.heightPt);
          line.chars += run.text.length;
        } else {
          lines.push({ y: run.y, x: run.x, height: run.heightPt, chars: run.text.length });
        }
      }
      const candidates = lines.filter(l => l.chars >= 15).sort((a, b) => b.y - a.y);
      for (let i = 1; i < candidates.length; i++) {
        const previous = candidates[i - 1];
        const current = candidates[i];
        const delta = previous.y - current.y;
        const ratio = delta / previous.height;
        if (delta > 0 && ratio >= 0.8 && ratio <= 3 && Math.abs(previous.x - current.x) < 30) {
          lineRatios.push(ratio);
        }
      }
      page.cleanup();
    }

    const badPages = paperSizes.filter(p => !p.ok);
    const paper: FormatCriterion = badPages.length === 0
      ? { verdict: "pass", detail: `كل الصفحات (${paperSizes.length}) بأبعاد A4 ضمن سماحية ±2 pt.` }
      : { verdict: "fail", detail: `${badPages.length} صفحة لا تطابق أبعاد A4.`, evidence: badPages.slice(0, 8).map(p => `ص${p.page}: ${fmt(p.width)}×${fmt(p.height)} pt`).join("؛ ") };

    // Font names in PDFs may be subsets, aliases, or substitutions. Never certify Times New Roman by name alone.
    const textRuns = runs.filter(r => r.text.trim().length >= 3);
    const totalChars = textRuns.reduce((n, r) => n + r.text.length, 0);
    const namedChars = textRuns.reduce((n, r) => n + (fontNames.get(r.fontId) ? r.text.length : 0), 0);
    const timesChars = textRuns.reduce((n, r) => n + (isTimes(fontNames.get(r.fontId) ?? "") ? r.text.length : 0), 0);
    const timesShare = namedChars ? timesChars / namedChars : 0;
    const names = [...new Set([...fontNames.values()].filter(Boolean))].slice(0, 8);
    const fontFamily: FormatCriterion = totalChars < 80 || namedChars < totalChars * 0.5
      ? { verdict: "review", detail: "ماكو نص كافي أو بيانات خطوط موثوقة حتى نحدد نوع الخط." }
      : { verdict: "review", detail: `الخطوط المسجلة بالـPDF: ${names.join("، ") || "غير معروفة"}. نسبة النص المنسوب لخط شبيه Times: ${Math.round(timesShare * 100)}%.`, evidence: "أسماء الخطوط قد تكون بدائل أو أسماء داخلية؛ لازم مراجعة بصرية قبل الحكم." };

    // Dominant rendered height can differ from authoring size due to transforms/scaling.
    const heights = textRuns.filter(r => r.heightPt >= 6 && r.heightPt <= 40).map(r => r.heightPt).sort((a, b) => a - b);
    const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : null;
    const fontSize: FormatCriterion = medianHeight === null
      ? { verdict: "review", detail: "ما قدرنا نستخرج قياسات نص كافية." }
      : { verdict: "review", detail: `ارتفاع النص المرئي الوسيط ≈ ${fmt(medianHeight)} pt، والمطلوب ${requirements.fontSizePt} pt.`, evidence: "الارتفاع المرئي مو دائماً حجم الخط الأصلي؛ ما نعتبره إثبات مطابقة أو مخالفة." };

    const ratios = lineRatios.sort((a, b) => a - b);
    const medianRatio = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
    const lineSpacing: FormatCriterion = medianRatio === null
      ? { verdict: "review", detail: "ماكو أسطر متتالية كافية لقياس التباعد بصرياً." }
      : { verdict: "review", detail: `نسبة المسافة بين الأسطر إلى ارتفاع النص المرئي ≈ ${fmt(medianRatio)}، والمطلوب تباعد ${requirements.lineSpacing}.`, evidence: "هاي النسبة ليست إعداد 1.5 في Word؛ تتأثر بالخط وحجم النص والأعمدة." };

    return {
      pageCount: pdf.numPages,
      paper,
      fontFamily,
      fontSize,
      lineSpacing,
      notes: [
        "النتائج تعتمد على النص القابل للاستخراج؛ الملفات المصورة تحتاج OCR.",
        "العناوين والواجهة والجداول قد تختلف عن النص الأساسي.",
        ...(hasNonLatin ? ["النص غير اللاتيني (مثل العربية) قد يحتاج مراجعة إضافية بسبب الخطوط والترميز."] : []),
        "للتأكد من إعدادات الخط والتباعد الأصلية يُفضّل فحص ملف DOCX المصدر.",
      ],
    };
  } finally {
    await task.destroy();
  }
}

export function formatReportMessage(report: FormatReport): string {
  const symbol = (v: Verdict) => v === "pass" ? "✅" : v === "fail" ? "❌" : "🔎";
  const entry = (label: string, c: FormatCriterion) => `${symbol(c.verdict)} ${label}: ${c.detail}${c.evidence ? `\n   ${c.evidence}` : ""}`;
  return [
    "📐 فحص تنسيق PDF — تقرير أولي",
    `📄 الصفحات: ${report.pageCount}`,
    "",
    entry("حجم الورق A4", report.paper),
    entry("نوع الخط Times New Roman", report.fontFamily),
    entry("حجم الخط 16 pt", report.fontSize),
    entry("تباعد الأسطر 1.5", report.lineSpacing),
    "",
    "ℹ️ 🔎 = يحتاج مراجعة، مو خطأ مؤكد.",
    ...report.notes.map(n => `• ${n}`),
  ].join("\n");
}
