import PDFDocument from 'pdfkit';

export async function buildReportPdf(
  title: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#555555').text(`Generated ${new Date().toISOString().slice(0, 19)}Z`);
    doc.moveDown();

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = Math.max(60, pageWidth / Math.max(headers.length, 1));
    const rowHeight = 16;
    let y = doc.y;

    const drawRow = (cells: string[], bold = false) => {
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#000000');
      cells.forEach((cell, i) => {
        doc.text(String(cell ?? ''), doc.page.margins.left + i * colWidth, y, {
          width: colWidth - 4,
          height: rowHeight,
          ellipsis: true,
        });
      });
      y += rowHeight;
    };

    drawRow(headers, true);
    for (const row of rows) {
      drawRow(row.map((c) => (c == null ? '' : String(c))));
    }

    doc.end();
  });
}
