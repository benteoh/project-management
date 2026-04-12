/** Lowercase path segment for office URLs (trimmed). Pair with `encodeURIComponent`. */
export function officeNameToUrlPathSegment(name: string): string {
  return name.trim().toLowerCase();
}

/** Normalized office key from a route `[office]` param after decode. */
export function normalizeOfficeUrlParam(encodedSegment: string): string {
  return decodeURIComponent(encodedSegment).trim().toLowerCase();
}

export function officeNameMatchesUrlParam(officeName: string, encodedSegment: string): boolean {
  return officeNameToUrlPathSegment(officeName) === normalizeOfficeUrlParam(encodedSegment);
}
