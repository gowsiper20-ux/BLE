export type DirectoryClassification = 'IT_STUDENT' | 'IT_FACULTY_STAFF' | 'UNCLASSIFIED' | 'CONFLICT';

export interface DirectoryGroupConfiguration {
  membershipMode: 'direct' | 'transitive' | null;
  itStudentGroupIds: string[];
  itStaffGroupIds: string[];
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseGroupIds(settingName: string): string[] {
  const raw = process.env[settingName]?.trim();
  if (!raw) return [];

  const ids = raw.split(',').map((id) => id.trim().toLowerCase());
  if (ids.some((id) => !GUID_PATTERN.test(id))) {
    throw new Error(`CONFIG_ERROR: ${settingName} must contain comma-separated Entra group object IDs.`);
  }
  return [...new Set(ids)];
}

export function getDirectoryGroupConfiguration(): DirectoryGroupConfiguration {
  const requestedMode = process.env.MICROSOFT_GROUP_MEMBERSHIP_MODE?.trim().toLowerCase();
  if (requestedMode && requestedMode !== 'direct' && requestedMode !== 'transitive') {
    throw new Error('CONFIG_ERROR: MICROSOFT_GROUP_MEMBERSHIP_MODE must be direct or transitive.');
  }

  return {
    membershipMode: requestedMode === 'direct' || requestedMode === 'transitive' ? requestedMode : null,
    itStudentGroupIds: parseGroupIds('MICROSOFT_IT_STUDENT_GROUP_IDS'),
    itStaffGroupIds: parseGroupIds('MICROSOFT_IT_STAFF_GROUP_IDS'),
  };
}

export function classifyDirectoryGroups(
  actualGroupIds: string[],
  configuration: DirectoryGroupConfiguration,
): DirectoryClassification {
  if (!configuration.membershipMode) return 'UNCLASSIFIED';

  const memberships = new Set(actualGroupIds.map((groupId) => groupId.toLowerCase()));
  const isStudent = configuration.itStudentGroupIds.some((groupId) => memberships.has(groupId));
  const isStaff = configuration.itStaffGroupIds.some((groupId) => memberships.has(groupId));

  if (isStudent && isStaff) return 'CONFLICT';
  if (isStudent) return 'IT_STUDENT';
  if (isStaff) return 'IT_FACULTY_STAFF';
  return 'UNCLASSIFIED';
}

export function readDirectoryAcademicAttribute(user: Record<string, unknown>, settingName: string): string | null {
  const attribute = process.env[settingName]?.trim();
  if (!attribute) return null;
  if (!/^[A-Za-z][A-Za-z0-9_.]*$/.test(attribute)) {
    throw new Error(`CONFIG_ERROR: ${settingName} must be a valid Microsoft Graph user property name.`);
  }
  const value = user[attribute];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getDirectoryAcademicAttributeNames(): string[] {
  return [...new Set([
    process.env.MICROSOFT_BATCH_ATTRIBUTE?.trim(),
    process.env.MICROSOFT_CLASS_ATTRIBUTE?.trim(),
  ].filter((attribute): attribute is string => Boolean(attribute)))];
}
