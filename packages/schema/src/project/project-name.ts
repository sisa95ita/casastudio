/** Maximum persisted length of a user-facing Project name. */
export const PROJECT_NAME_MAX_LENGTH = 120;

/** Returns the display form accepted at Project creation boundaries. */
export function prepareProjectName(value: string): string {
  return value.trim();
}

/** Returns the case-insensitive, surrounding-whitespace-insensitive uniqueness key. */
export function normalizeProjectName(value: string): string {
  return prepareProjectName(value).toLocaleLowerCase("en-US");
}
