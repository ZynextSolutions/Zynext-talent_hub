import ExcelJS from 'exceljs';

export async function buildReportXlsx(
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Zynext TalentHub';
  const sheet = workbook.addWorksheet(title.slice(0, 31) || 'Report');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = headers.map((header, index) => ({
    header,
    key: String(index),
    width: Math.min(40, Math.max(header.length + 2, 12)),
  }));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
