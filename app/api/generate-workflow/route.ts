import { NextRequest, NextResponse } from "next/server";
import { generateWorkflow } from "@/lib/automators/workflowGenerator";
import path from "path";
import os from "os";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { chromium, BrowserContext, Page } from "playwright";

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
  let context: BrowserContext | null = null;
  
  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt", status: "failed" }, { status: 400 });
    }

    context = await launchContext();
    const page = await preparePage(context);

    const generatedWorkflow = await generateWorkflow(page, prompt);

    return NextResponse.json({
      status: "success",
      workflow: generatedWorkflow
    });

  } catch (err: any) {
    console.error("[Generate Workflow API Error]:", err.message);
    return NextResponse.json({ error: err.message, status: "failed" }, { status: 500 });
  } finally {
    await context?.close(); // Restoring to free the profile lock
  }
}
