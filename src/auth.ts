import fs from "fs";
import path from "path";
import os from "os";
import { chromium } from "playwright-core";
import type { OperateCredentials } from "./config-client.js";

const CREDS_DIR = path.join(os.homedir(), ".back-config-mcp");
const CREDS_FILE = path.join(CREDS_DIR, "credentials.json");

export async function loadCredentials(): Promise<OperateCredentials | null> {
  try {
    if (!fs.existsSync(CREDS_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(CREDS_FILE, "utf-8"));
    if (data && data.expiresAt > Date.now()) return data;
    return null;
  } catch {
    return null;
  }
}

export async function saveCredentials(creds: OperateCredentials): Promise<void> {
  if (!fs.existsSync(CREDS_DIR)) fs.mkdirSync(CREDS_DIR, { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
}

export async function clearCredentials(): Promise<void> {
  try { fs.unlinkSync(CREDS_FILE); } catch { /* ignore */ }
}

function findBrowser(): string | undefined {
  const platform = process.platform;
  const systemCandidates: string[] = [];

  if (platform === "darwin") {
    systemCandidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      path.join(os.homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
      path.join(os.homedir(), "Applications", "Microsoft Edge.app", "Contents", "MacOS", "Microsoft Edge"),
    );
  } else if (platform === "linux") {
    systemCandidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/microsoft-edge",
      "/usr/bin/microsoft-edge-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    );
  } else if (platform === "win32") {
    const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    const localAppData = process.env.LOCALAPPDATA || "";
    systemCandidates.push(
      path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    );
  }

  for (const c of systemCandidates) {
    if (fs.existsSync(c)) return c;
  }

  const cacheDir = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  if (fs.existsSync(cacheDir)) {
    const dirs = fs.readdirSync(cacheDir)
      .filter(d => d.startsWith("chromium-"))
      .sort()
      .reverse();
    for (const dir of dirs) {
      const playwrightCandidates = [
        path.join(cacheDir, dir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
        path.join(cacheDir, dir, "chrome-mac", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
        path.join(cacheDir, dir, "chrome-mac-arm64", "Chromium.app", "Contents", "MacOS", "Chromium"),
        path.join(cacheDir, dir, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
        path.join(cacheDir, dir, "chrome-linux", "chrome"),
      ];
      for (const c of playwrightCandidates) {
        if (fs.existsSync(c)) return c;
      }
    }
  }

  return undefined;
}

export interface SsoConfig {
  operateBaseUrl: string;
}

export async function startSsoLogin(config: SsoConfig): Promise<OperateCredentials> {
  const execPath = findBrowser();
  if (!execPath) {
    throw new Error(
      "Cannot find a Chromium-based browser (Chrome, Edge, or Chromium). " +
      "Please install Google Chrome or run: npx playwright install chromium"
    );
  }

  const userDataDir = path.join(CREDS_DIR, "browser-data");
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const lockFile = path.join(userDataDir, "SingletonLock");
  try { fs.unlinkSync(lockFile); } catch { /* ignore */ }

  const targetUrl = config.operateBaseUrl + "/camscanner/back_config";

  console.error("[Auth] Launching browser for login...");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: execPath,
    ignoreHTTPSErrors: true,
    viewport: null,
    args: ["--start-maximized"],
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

    const currentHost = new URL(page.url()).hostname;
    const operateHost = new URL(config.operateBaseUrl).hostname;

    if (currentHost !== operateHost) {
      console.error("[Auth] Waiting for user to complete login (up to 180s)...");
      await page.waitForURL(url => {
        const u = typeof url === "string" ? new URL(url) : url;
        return u.hostname === operateHost;
      }, { timeout: 180000 });
    }

    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const cookies = await context.cookies();
    const operateCookies = cookies.filter(c =>
      c.domain.includes("intsig.net") || c.domain.includes("operate")
    );

    if (operateCookies.length === 0) {
      throw new Error("No cookies captured after login. Please try again.");
    }

    await page.goto(config.operateBaseUrl + "/site/get-config", { waitUntil: "domcontentloaded", timeout: 15000 });

    const allCookies = (await context.cookies()).filter(c =>
      c.domain.includes("intsig.net") || c.domain.includes("operate")
    );
    const finalCookie = allCookies.map(c => `${c.name}=${c.value}`).join("; ");

    let csrfToken = "";
    try {
      csrfToken = await page.evaluate(`
        (() => {
          const el = document.querySelector('input[name="_csrf"]');
          return el ? el.value : '';
        })()
      `) as string;
    } catch { /* ignore */ }

    if (!csrfToken) {
      const html = await page.content();
      const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
      if (match) csrfToken = match[1];
    }

    if (!csrfToken) {
      throw new Error("Login succeeded but failed to extract CSRF token. Please try again.");
    }

    console.error("[Auth] Login successful! Cookies and CSRF token captured.");

    return {
      sessionCookie: finalCookie,
      csrfToken,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
  } finally {
    await context.close();
  }
}
