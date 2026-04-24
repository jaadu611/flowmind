import { NextRequest, NextResponse } from "next/server";
import { automateNotebookLM } from "@/lib/automators/notebookAutomator";
import { askGemini } from "@/lib/automators/geminiAutomator";
import { askChatGPT } from "@/lib/automators/chatgptAutomator";
import { askPerplexity } from "@/lib/automators/perplexityAutomator";
import { ResearchAutomator } from "@/lib/automators/Researchautomator";
import path from "path";
import os from "os";
import { mkdir, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { chromium, BrowserContext, Page } from "playwright";

const UPLOAD_DIR = "/tmp/flowmind_uploads";
// Global directory to share sessions across all your projects
const USER_DATA_DIR = path.join(os.homedir(), ".automation_browser_data");

async function launchContext(type?: string): Promise<BrowserContext> {
  const isHeadless = process.env.HEADLESS !== "false";
  const commonArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
  ];

  if (type === "research") {
    // Research nodes do not require authenticated profiles. Wrap in ephemeral context to allow true parallel runs.
    const browser = await chromium.launch({ headless: isHeadless, args: commonArgs });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    // Attach browser instance to cleanly close it later
    (context as any)._ephemeralBrowser = browser;
    return context;
  }

  if (!existsSync(USER_DATA_DIR)) await mkdir(USER_DATA_DIR, { recursive: true });

  return chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: isHeadless,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    args: commonArgs,
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
    context = await launchContext(type);
    const page = await preparePage(context);

    if (type === "research") {
      console.log(`[Research Node] Executing with sites: ${JSON.stringify(config.sites)}`);
      const automator = new ResearchAutomator(page);
      const result = await automator.run({ 
        query: config.query || "", 
        maxPages: config.maxPages ?? 3,
        sites: config.sites || []
      });
      return NextResponse.json(result);
    }

    if (type === "notebooklm" || type === "gemini" || type === "chatgpt" || type === "perplexity") {
      filePaths = await saveFiles(config.files ?? [], config.fileData ?? []);
      const resultFilesContext = config.previousOutput?.files || config.previousOutput?.data?.files || [];
      const allFiles = [...resultFilesContext, ...filePaths];

      let nodePrompt = config.query || "";
      if (typeof config.previousOutput?.data === "string") {
        nodePrompt += "\n\n--- UPSTREAM OUTPUT TO ANALYZE ---\n" + config.previousOutput.data;
      }

      let result = "";
      if (type === "notebooklm") {
        result = await automateNotebookLM(page, allFiles, nodePrompt, config.label || "NotebookLM");
      } else if (type === "chatgpt") {
        result = await askChatGPT(page, nodePrompt, allFiles);
      } else if (type === "perplexity") {
        result = await askPerplexity(page, nodePrompt, allFiles);
      } else {
        result = await askGemini(page, nodePrompt, allFiles);
      }

      return NextResponse.json({
        status: "success",
        data: result,
        files: allFiles,
        summary: typeof result === "string" ? result.slice(0, 200) : "",
        next_input: result,
      });
    }

    if (type === "export_file") {
      const filename = config.filename || `export_${Date.now()}.pdf`;
      const dataText = config.previousOutput?.data || "No content generated from upstream.";
      const outPath = path.join("/home/jaadu/Downloads", filename);

      if (filename.toLowerCase().endsWith(".pdf") || filename.toLowerCase().endsWith(".html")) {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; line-height: 1.6; color: #222; max-width: 900px; margin: auto; }
              h1, h2, h3 { color: #111; border-bottom: 2px solid #eaeaea; padding-bottom: 0.3em; margin-top: 1.5em; }
              code { background: #fdfdfd; border: 1px solid #eee; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
              pre { background: #1e1e1e; color: #f8f8f8; padding: 16px; border-radius: 8px; overflow-x: auto; }
              pre code { background: transparent; border: none; color: inherit; }
              blockquote { border-left: 5px solid #3b82f6; margin: 1.5em 0; padding-left: 16px; color: #555; background: #f8fafc; padding: 12px 16px; }
              table { border-collapse: collapse; width: 100%; margin-top: 1em; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #f1f5f9; font-weight: 600; }
            </style>
          </head>
          <body>
            <div id="content">Loading compilation...</div>
            <script>
              document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(dataText)});
            </script>
          </body>
          </html>
        `;

        if (filename.toLowerCase().endsWith(".pdf")) {
          await page.setContent(htmlContent, { waitUntil: "networkidle" });
          await page.waitForTimeout(800); // Let JS renderer parse Markdown
          await page.pdf({ 
            path: outPath, 
            format: "A4", 
            margin: { top: "25px", right: "25px", bottom: "25px", left: "25px" } 
          });
        } else {
          // If .html, simply write the formatted HTML string statically
          await writeFile(outPath, htmlContent);
        }
      } else if (filename.toLowerCase().endsWith(".json")) {
        const jsonPayload = {
          generated_at: new Date().toISOString(),
          format: "markdown",
          content: dataText
        };
        await writeFile(outPath, JSON.stringify(jsonPayload, null, 2));
      } else {
        // Fallback for .md, .txt, etc.
        await writeFile(outPath, dataText);
      }

      return NextResponse.json({
        status: "success",
        data: `Successfully compiled physical file to ${outPath}`,
        files: [],
        summary: `Exported to ${filename}`,
        next_input: dataText
      });
    }

    return NextResponse.json({ error: `Unknown type: ${type}`, status: "failed" }, { status: 400 });
  } catch (err: any) {
    console.error("[API Error]:", err.message);
    return NextResponse.json({ error: err.message, status: "failed" }, { status: 500 });
  } finally {
    await Promise.all(filePaths.map((fp) => rm(fp).catch(() => {})));
    await context?.close();
    if (context && (context as any)._ephemeralBrowser) {
       await (context as any)._ephemeralBrowser.close();
    }
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

