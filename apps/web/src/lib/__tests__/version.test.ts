import { getAppVersionInfo } from "../version";

describe("getAppVersionInfo", () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  it("uses dev fallbacks when metadata is absent", () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    delete process.env.NEXT_PUBLIC_COMMIT_SHA;
    delete process.env.NEXT_PUBLIC_BUILD_TIME;
    delete process.env.NEXT_PUBLIC_RELEASE_NOTES_URL;

    expect(getAppVersionInfo()).toEqual({
      version: "dev",
      commit: "unknown",
      buildTime: null,
      releaseNotesUrl: null,
    });
  });

  it("reads public build metadata", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "v0.2.0";
    process.env.NEXT_PUBLIC_COMMIT_SHA = "76738cb";
    process.env.NEXT_PUBLIC_BUILD_TIME = "2026-06-25T10:00:00Z";
    process.env.NEXT_PUBLIC_RELEASE_NOTES_URL =
      "https://github.com/qiaopengjun5162/roselet/releases/tag/v0.2.0";

    expect(getAppVersionInfo()).toEqual({
      version: "v0.2.0",
      commit: "76738cb",
      buildTime: "2026-06-25T10:00:00Z",
      releaseNotesUrl: "https://github.com/qiaopengjun5162/roselet/releases/tag/v0.2.0",
    });
  });
});
