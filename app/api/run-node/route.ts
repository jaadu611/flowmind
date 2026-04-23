import { NextRequest, NextResponse } from "next/server";
import { automateNotebookLM } from "@/lib/automators/notebookAutomator";
import { askGemini } from "@/lib/automators/geminiAutomator";
import { ResearchAutomator } from "@/lib/automators/Researchautomator";
import path from "path";
import os from "os";
import { mkdir, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { chromium, BrowserContext, Page } from "playwright";

const UPLOAD_DIR = "/tmp/flowmind_uploads";
// Global directory to share sessions across all your projects
const USER_DATA_DIR = path.join(os.homedir(), ".automation_browser_data");

async function launchContext(): Promise<BrowserContext> {
  const isHeadless = process.env.HEADLESS !== "false";
  if (!existsSync(USER_DATA_DIR)) await mkdir(USER_DATA_DIR, { recursive: true });

  return chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: isHeadless,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });
}

async function preparePage(context: BrowserContext): Promise<Page> {
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return page;
}

export async function POST(req: NextRequest) {
  const { type, config } = await req.json();
  let filePaths: string[] = [];
  let context: BrowserContext | null = null;

  try {
    context = await launchContext();
    const page = await preparePage(context);

    if (type === "research") {
      const automator = new ResearchAutomator(page);
      const result = await automator.run({ 
        query: config.query || "", 
        maxPages: config.maxPages ?? 3,
        mode: config.mode ?? "deep"
      });
      return NextResponse.json(result);
    }

    if (type === "notebooklm" || type === "gemini") {
      filePaths = await saveFiles(config.files ?? [], config.fileData ?? []);
      const allFiles = [...(config.previousOutput?.context_files ?? []), ...filePaths];

      const result = type === "notebooklm"
        ? await automateNotebookLM(page, allFiles, config.query || "", config.label || "NotebookLM")
        : await askGemini(page, config.query || "", allFiles);

      return NextResponse.json({
        status: "success",
        data: result,
        summary: typeof result === "string" ? result.slice(0, 200) : "",
        next_input: result,
      });
    }

    return NextResponse.json({ error: `Unknown type: ${type}`, status: "failed" }, { status: 400 });
  } catch (err: any) {
    console.error("[API Error]:", err.message);
    return NextResponse.json({ error: err.message, status: "failed" }, { status: 500 });
  } finally {
    await Promise.all(filePaths.map((fp) => rm(fp).catch(() => {})));
    await context?.close();
  }
}

async function saveFiles(files: string[], fileData: string[]): Promise<string[]> {
  if (!files.length || !fileData.length) return [];
  if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });
  return Promise.all(
    files.map(async (name, i) => {
      const filePath = path.join(UPLOAD_DIR, name);
      const base64 = fileData[i].includes(",") ? fileData[i].split(",")[1] : fileData[i];
      await writeFile(filePath, Buffer.from(base64, "base64"));
      return filePath;
    }),
  );
}

