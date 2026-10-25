import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import type { Buffer } from 'node:buffer';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 1000;

export class TabularImportError extends Error {}

export function parseTabularImport(
  fileBuffer: Buffer,
  fileName: string,
  aliases: Record<string, string>,
  requiredColumns: string[],
): Record<string, string>[] {
  if (fileBuffer.byteLength > MAX_FILE_BYTES) throw new TabularImportError('Import file exceeds the 5 MB limit.');
  const extension = fileName.toLowerCase().split('.').pop();
  let matrix: unknown[][];
  if (extension === 'csv') {
    const parsed = Papa.parse<unknown[]>(fileBuffer.toString('utf8'), { header: false, skipEmptyLines: 'greedy' });
    if (parsed.errors.length) throw new TabularImportError(`CSV parse error: ${parsed.errors[0].message}`);
    matrix = parsed.data;
  } else if (extension === 'xlsx') {
    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer', cellFormula: true, bookVBA: false });
    } catch {
      throw new TabularImportError('Unable to parse the spreadsheet. Check that it is a valid .xlsx file.');
    }
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) throw new TabularImportError('Workbook does not contain a worksheet.');
    const formulaCell = Object.entries(worksheet).find(([address, cell]) =>
      !address.startsWith('!') && typeof cell === 'object' && cell !== null && 'f' in cell && Boolean(cell.f));
    if (formulaCell) throw new TabularImportError('Formula cells are not allowed in import files.');
    matrix = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', raw: false, blankrows: false });
  } else {
    throw new TabularImportError('Unsupported file format. Upload a .csv or .xlsx file.');
  }

  if (matrix.length < 2) throw new TabularImportError('The file must contain a header row and at least one data row.');
  if (matrix.length - 1 > MAX_ROWS) throw new TabularImportError(`Import files are limited to ${MAX_ROWS} data rows.`);

  const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const columns = (matrix[0] || []).map((value) => aliases[normalizeHeader(value)]);
  if (columns.some((column) => !column)) {
    throw new TabularImportError('The file contains an unsupported column. Use the provided import template headings.');
  }
  if (new Set(columns).size !== columns.length) throw new TabularImportError('The file contains duplicate column headings.');
  for (const column of requiredColumns) {
    if (!columns.includes(column)) throw new TabularImportError(`Required column is missing: ${column}.`);
  }

  for (const cells of matrix.slice(1)) {
    for (const cell of cells) {
      const strVal = String(cell ?? '').trim();
      if (/^[=@]|^[-+][A-Za-z]/.test(strVal)) {
        throw new TabularImportError('Potential spreadsheet formula detected in import cell. Formula cells are not allowed.');
      }
    }
  }

  const rows = matrix.slice(1)
    .filter((cells) => cells.some((cell) => String(cell ?? '').trim() !== ''))
    .map((cells) => Object.fromEntries(columns.map((column, index) => [column!, String(cells[index] ?? '').trim()])));
  if (!rows.length) throw new TabularImportError('The spreadsheet contains no data rows.');
  return rows;
}
