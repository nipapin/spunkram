import semver from 'semver'

export interface VersionInfo {
  major: number
  minor: number
  patch: number
  prerelease: string[]
}

/**
 * Parse a version string into its components
 */
export function parseVersion(version: string): VersionInfo | null {
  const parsed = semver.parse(version)
  if (!parsed) return null

  return {
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
    prerelease: parsed.prerelease
  }
}

/**
 * Compare two versions
 * @returns -1 if v1 < v2, 0 if v1 = v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  return semver.compare(v1, v2)
}

/**
 * Check if a version is greater than another
 */
export function isNewerVersion(newVersion: string, oldVersion: string): boolean {
  return semver.gt(newVersion, oldVersion)
}

/**
 * Check if a version is a major update from another
 */
export function isMajorUpdate(newVersion: string, oldVersion: string): boolean {
  const v1 = parseVersion(newVersion)
  const v2 = parseVersion(oldVersion)

  if (!v1 || !v2) return false
  return v1.major > v2.major
}

/**
 * Check if a version is a minor update from another
 */
export function isMinorUpdate(newVersion: string, oldVersion: string): boolean {
  const v1 = parseVersion(newVersion)
  const v2 = parseVersion(oldVersion)

  if (!v1 || !v2) return false
  return v1.major === v2.major && v1.minor > v2.minor
}

/**
 * Check if a version is a patch update from another
 */
export function isPatchUpdate(newVersion: string, oldVersion: string): boolean {
  const v1 = parseVersion(newVersion)
  const v2 = parseVersion(oldVersion)

  if (!v1 || !v2) return false
  return v1.major === v2.
