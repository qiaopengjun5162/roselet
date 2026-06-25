export interface AppVersionInfo {
  version: string;
  commit: string;
  buildTime: string | null;
  releaseNotesUrl: string | null;
}

export function getAppVersionInfo(): AppVersionInfo {
  return {
    version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
    commit: process.env.NEXT_PUBLIC_COMMIT_SHA || "unknown",
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || null,
    releaseNotesUrl: process.env.NEXT_PUBLIC_RELEASE_NOTES_URL || null,
  };
}
