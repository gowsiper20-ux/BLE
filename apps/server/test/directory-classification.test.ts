import { afterEach, describe, expect, it } from 'vitest';
import {
  classifyDirectoryGroups,
  getDirectoryGroupConfiguration,
  readDirectoryAcademicAttribute,
} from '../src/services/directory-classification';

const studentGroupId = '11111111-1111-4111-8111-111111111111';
const staffGroupId = '22222222-2222-4222-8222-222222222222';
const originalEnvironment = {
  mode: process.env.MICROSOFT_GROUP_MEMBERSHIP_MODE,
  students: process.env.MICROSOFT_IT_STUDENT_GROUP_IDS,
  staff: process.env.MICROSOFT_IT_STAFF_GROUP_IDS,
  batchAttribute: process.env.MICROSOFT_BATCH_ATTRIBUTE,
  classAttribute: process.env.MICROSOFT_CLASS_ATTRIBUTE,
};

afterEach(() => {
  const values = {
    MICROSOFT_GROUP_MEMBERSHIP_MODE: originalEnvironment.mode,
    MICROSOFT_IT_STUDENT_GROUP_IDS: originalEnvironment.students,
    MICROSOFT_IT_STAFF_GROUP_IDS: originalEnvironment.staff,
    MICROSOFT_BATCH_ATTRIBUTE: originalEnvironment.batchAttribute,
    MICROSOFT_CLASS_ATTRIBUTE: originalEnvironment.classAttribute,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('directory classification configuration', () => {
  it('leaves users unclassified until approved membership semantics and group IDs are configured', () => {
    delete process.env.MICROSOFT_GROUP_MEMBERSHIP_MODE;
    delete process.env.MICROSOFT_IT_STUDENT_GROUP_IDS;
    delete process.env.MICROSOFT_IT_STAFF_GROUP_IDS;

    const configuration = getDirectoryGroupConfiguration();
    expect(classifyDirectoryGroups([studentGroupId], configuration)).toBe('UNCLASSIFIED');
  });

  it('classifies only identities with an exact configured group object ID', () => {
    process.env.MICROSOFT_GROUP_MEMBERSHIP_MODE = 'direct';
    process.env.MICROSOFT_IT_STUDENT_GROUP_IDS = studentGroupId;
    process.env.MICROSOFT_IT_STAFF_GROUP_IDS = staffGroupId;
    const configuration = getDirectoryGroupConfiguration();

    expect(classifyDirectoryGroups([studentGroupId], configuration)).toBe('IT_STUDENT');
    expect(classifyDirectoryGroups([staffGroupId], configuration)).toBe('IT_FACULTY_STAFF');
    expect(classifyDirectoryGroups(['33333333-3333-4333-8333-333333333333'], configuration)).toBe('UNCLASSIFIED');
    expect(classifyDirectoryGroups([studentGroupId, staffGroupId], configuration)).toBe('CONFLICT');
  });

  it('rejects malformed configured group IDs rather than silently disabling classification', () => {
    process.env.MICROSOFT_IT_STUDENT_GROUP_IDS = 'IT-Students';
    expect(getDirectoryGroupConfiguration).toThrow(/MICROSOFT_IT_STUDENT_GROUP_IDS/);
  });

  it('uses only explicitly selected academic attributes and does not infer missing values', () => {
    delete process.env.MICROSOFT_BATCH_ATTRIBUTE;
    expect(readDirectoryAcademicAttribute({ department: 'IT' }, 'MICROSOFT_BATCH_ATTRIBUTE')).toBeNull();

    process.env.MICROSOFT_BATCH_ATTRIBUTE = 'extension_example_batch';
    expect(readDirectoryAcademicAttribute({ extension_example_batch: '2024 cohort' }, 'MICROSOFT_BATCH_ATTRIBUTE'))
      .toBe('2024 cohort');
  });
});
