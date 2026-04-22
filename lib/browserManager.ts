import { chromium, Page, Browser } from "playwright";

type AutomatorKey = "notebooklm" | "gemini" | "deepseek" | "qwen" | "chatgpt";

class BrowserManager {
  private browser: Browser | null = null;
  private pages = new Map<string, Page>();

  private async connect() {
    if (this.browser) {
      // Check if connection is still alive
      try {
        await this.browser.version();
      } catch {
        console.log("[browserManager] Connection lost, reconnecting...");
        this.browser = null;
        this.pages.clear();
      }
    }

    if (!this.browser) {
      console.log("[browserManager] Connecting to browser on port 9222...");
      this.browser = await chromium.connectOverCDP("http://localhost:9222");
      console.log("[browserManager] Connected.");
    }
  }

  async getPage(key: AutomatorKey): Promise<Page> {
    await this.connect();

    // Reuse existing page if it's still open
    const existing = this.pages.get(key);
    if (existing) {
      try {
        // Check the page is still alive
        await existing.title();
        console.log(`[browserManager] Reusing existing page for "${key}"`);
        return existing;
      } catch {
        console.log(
          `[browserManager] Page for "${key}" was closed, creating new one...`,
        );
        this.pages.delete(key);
      }
    }

    const contexts = this.browser!.contexts();
    const context = contexts[0] ?? (await this.browser!.newContext());
    const page = await context.newPage();
    this.pages.set(key, page);
    console.log(`[browserManager] New page created for "${key}"`);
    return page;
  }

  async closePage(key: AutomatorKey) {
    const page = this.pages.get(key);
    if (page) {
      await page.close().catch(() => {});
      this.pages.delete(key);
    }
  }

  async disconnect() {
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.pages.clear();
  }
}

export const browserManager = new BrowserManager();
