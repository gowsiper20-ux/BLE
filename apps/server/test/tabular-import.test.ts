import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { parseTabularImport, TabularImportError } from '../src/services/tabular-import';

const aliases = {
  register_number: 'register_number',
  name: 'name',
  college_email: 'college_email',
  class_id: 'class_id',
};
const requiredColumns = ['register_number', 'name', 'college_email', 'class_id'];

describe('tabular import parsing', () => {
  it('normalizes supported CSV headers and trims cell values', () => {
    const rows = parseTabularImport(
      Buffer.from('Register Number,Name,College Email,Class ID\r\n 12345 , Test Student , test@sonatech.ac.in , class-1 '),
      'students.csv',
      aliases,
      requiredColumns,
    );

    expect(rows).toEqual([{
      register_number: '12345',
      name: 'Test Student',
      college_email: 'test@sonatech.ac.in',
      class_id: 'class-1',
    }]);
  });

  it('returns a controlled validation error for unsupported file formats', () => {
    expect(() => parseTabularImport(Buffer.from('data'), 'students.xls', aliases, requiredColumns))
      .toThrow(TabularImportError);
  });

  it('rejects duplicate headings after normalization', () => {
    expect(() => parseTabularImport(
      Buffer.from('register_number,Register Number,name,college_email,class_id\r\n12345,12345,Test,test@sonatech.ac.in,class-1'),
      'students.csv',
      aliases,
      requiredColumns,
    )).toThrow('duplicate column headings');
  });

  it('rejects formula injection cells in CSV imports', () => {
    expect(() => parseTabularImport(
      Buffer.from('register_number,name,college_email,class_id\r\n=cmd|calc,Test,test@sonatech.ac.in,class-1'),
      'students.csv',
      aliases,
      requiredColumns,
    )).toThrow('Potential spreadsheet formula detected');

    expect(() => parseTabularImport(
      Buffer.from('register_number,name,college_email,class_id\r\n@SUM(1+1),Test,test@sonatech.ac.in,class-1'),
      'students.csv',
      aliases,
      requiredColumns,
    )).toThrow('Potential spreadsheet formula detected');
  });
});
