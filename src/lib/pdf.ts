import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Générateur de rapports PDF WadAcces.
 *
 * Mise en page A4 : bandeau d'en-tête, indicateurs clés, tableaux lisibles
 * et pied de page numéroté sur chaque page.
 */

export type PdfTone = "default" | "good" | "bad" | "warn";

export interface PdfKpi {
  label: string;
  value: string;
  tone?: PdfTone;
}

export interface PdfSection {
  title: string;
  head: string[];
  rows: Array<Array<string | number>>;
  /** Index des colonnes à aligner à droite (montants, quantités). */
  numericColumns?: number[];
  /** Ligne de total affichée en gras sous le tableau. */
  totalRow?: Array<string | number>;
  note?: string;
  emptyText?: string;
}

export interface PdfReportOptions {
  fileName: string;
  title: string;
  subtitle?: string;
  storeName: string;
  generatedBy?: string;
  kpis?: PdfKpi[];
  sections: PdfSection[];
}

const TEAL: [number, number, number] = [13, 148, 136];
const SLATE_900: [number, number, number] = [15, 23, 42];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_100: [number, number, number] = [241, 245, 249];
const SLATE_200: [number, number, number] = [226, 232, 240];
const GREEN: [number, number, number] = [21, 128, 61];
const RED: [number, number, number] = [185, 28, 28];
const AMBER: [number, number, number] = [180, 83, 9];

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;

function toneColor(tone: PdfTone | undefined): [number, number, number] {
  if (tone === "good") return GREEN;
  if (tone === "bad") return RED;
  if (tone === "warn") return AMBER;
  return SLATE_900;
}

/**
 * Formatage des montants pour le PDF.
 * Intl utilise une espace insécable étroite que les polices PDF standard
 * ne savent pas afficher : on la remplace par une espace normale.
 */
export function pdfAmount(value: number, currency = "FCFA"): string {
  const n = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(n)
    .replace(/[\u202f\u00a0]/g, " ");
  return `${formatted} ${currency}`;
}

export function pdfNumber(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(n)
    .replace(/[\u202f\u00a0]/g, " ");
}

function frenchDateTime(d = new Date()): string {
  return d
    .toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/[\u202f\u00a0]/g, " ");
}

/** Bandeau supérieur : boutique, titre du rapport et date d'édition. */
function drawHeader(doc: jsPDF, options: PdfReportOptions): number {
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, PAGE_W, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(options.storeName, MARGIN, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(options.title, MARGIN, 21.5);

  doc.setFontSize(8.5);
  doc.text(`Édité le ${frenchDateTime()}`, PAGE_W - MARGIN, 13, { align: "right" });
  if (options.generatedBy) {
    doc.text(`Par ${options.generatedBy}`, PAGE_W - MARGIN, 18.5, { align: "right" });
  }

  let y = 38;
  if (options.subtitle) {
    doc.setTextColor(...SLATE_500);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.text(options.subtitle, MARGIN, y);
    y += 7;
  }
  return y;
}

/** Cartes d'indicateurs clés, 4 par ligne. */
function drawKpis(doc: jsPDF, kpis: PdfKpi[], startY: number): number {
  const perRow = 4;
  const gap = 4;
  const boxW = (PAGE_W - MARGIN * 2 - gap * (perRow - 1)) / perRow;
  const boxH = 17;
  let y = startY;

  kpis.forEach((kpi, index) => {
    const col = index % perRow;
    if (col === 0 && index > 0) y += boxH + gap;
    const x = MARGIN + col * (boxW + gap);

    doc.setFillColor(...SLATE_100);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");

    doc.setTextColor(...SLATE_500);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(kpi.label, boxW - 6)[0], x + 3, y + 6);

    doc.setTextColor(...toneColor(kpi.tone));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const value = doc.splitTextToSize(kpi.value, boxW - 6)[0];
    doc.text(value, x + 3, y + 13);
  });

  return y + boxH + 9;
}

function lastTableY(doc: jsPDF, fallback: number): number {
  const withTable = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return withTable.lastAutoTable?.finalY ?? fallback;
}

/** Pied de page numéroté, ajouté sur toutes les pages à la fin. */
function drawFooters(doc: jsPDF, storeName: string): void {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);

    doc.setTextColor(...SLATE_500);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${storeName} — Document interne`, MARGIN, PAGE_H - 9);
    doc.text(`Page ${page} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 9, { align: "right" });
  }
}

/** Construit et télécharge le rapport PDF. */
export function generatePdfReport(options: PdfReportOptions): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = drawHeader(doc, options);
  if (options.kpis?.length) {
    y = drawKpis(doc, options.kpis, y);
  }

  options.sections.forEach((section, index) => {
    // Nouvelle page si la place restante est insuffisante pour le titre + entête.
    if (y > PAGE_H - 55) {
      doc.addPage();
      y = 20;
    } else if (index > 0) {
      y += 2;
    }

    doc.setTextColor(...SLATE_900);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(section.title, MARGIN, y);
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y + 1.8, MARGIN + doc.getTextWidth(section.title), y + 1.8);
    y += 6;

    if (section.rows.length === 0) {
      doc.setTextColor(...SLATE_500);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(section.emptyText ?? "Aucune donnée sur cette période.", MARGIN, y + 2);
      y += 10;
      return;
    }

    const columnStyles: Record<number, { halign: "right" }> = {};
    for (const col of section.numericColumns ?? []) {
      columnStyles[col] = { halign: "right" };
    }

    const body = [...section.rows.map((r) => r.map((cell) => String(cell)))];
    if (section.totalRow) {
      body.push(section.totalRow.map((cell) => String(cell)));
    }

    autoTable(doc, {
      startY: y,
      head: [section.head],
      body,
      theme: "striped",
      margin: { left: MARGIN, right: MARGIN, bottom: 20 },
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.2, textColor: SLATE_900, lineColor: SLATE_200 },
      headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles,
      // Met en valeur la ligne de total placée en dernier.
      didParseCell: (data) => {
        if (section.totalRow && data.section === "body" && data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = SLATE_100;
        }
      },
    });

    y = lastTableY(doc, y) + 8;

    if (section.note) {
      doc.setTextColor(...SLATE_500);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(section.note, PAGE_W - MARGIN * 2);
      doc.text(lines, MARGIN, y);
      y += lines.length * 4 + 4;
    }
  });

  drawFooters(doc, options.storeName);
  doc.save(options.fileName);
}
