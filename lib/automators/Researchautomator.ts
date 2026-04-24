import * as fs from "fs";
import * as path from "path";
import { Page } from "playwright";

export interface ResearchConfig {
  query: string;
  maxPages?: number;
  sites?: string[];
}

export class ResearchAutomator {
  constructor(private page: Page) {}

  async run(config: ResearchConfig): Promise<any> {
    try {
      const outputDir = path.join("/tmp", `research_${Date.now()}`);
      fs.mkdirSync(outputDir, { recursive: true });

      const result = await this.searchAndExtract(config, outputDir);
      return {
        status: "success",
        node_type: "research",
        files: result.files,
        execution_time_ms: 0,
        error: null,
      };
    } catch (err) {
      return {
        status: "failed",
        summary: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  private async searchAndExtract(
    config: ResearchConfig,
    dir: string,
  ): Promise<{ allUrls: string[]; files: string[] }> {
    let { query } = config;
    const sites = config.sites || [];
    
    // 1. Refine query with site: restrictions if provided
    if (sites.length > 0) {
      const siteQuery = sites.map(s => `site:${s.trim()}`).join(" OR ");
      query = `${query} (${siteQuery})`;
    }

    // Hard cap max Pages limit to 6 to prevent runaway AI scraping instances
    const maxPages = Math.min(config.maxPages ?? 3, 6);
    
    // Leave Google's raw search algorithm alone so it doesn't misinterpret massive operator blocks as literal strings
    const encodedQuery = encodeURIComponent(query);
    const allUrlsSet = new Set<string>();
    const savedFiles: string[] = [];

    const targetStarts: number[] = [];
    for (let i = 0; i < maxPages; i++) {
       targetStarts.push(i * 10);
    }

    // 2. Parallel Staggering (evade CAPTCHA by drastically delaying simultaneous starts by up to 15 seconds)
    const randomStagger = Math.floor(Math.random() * 15000);
    console.log(`[Research] Staggering start by ${randomStagger}ms to avoid Google bot limits...`);
    await this.page.waitForTimeout(randomStagger);

    for (const startIndex of targetStarts) {
      if (startIndex > 0) {
        // Human emulation: heavily pause before querying Google for the next deep page
        const coolDown = 8000 + Math.floor(Math.random() * 5000);
        console.log(`[Research] Cooling down for ${coolDown}ms to dodge Google CAPTCHA...`);
        await this.page.waitForTimeout(coolDown);
      }

      const pageNum = Math.floor(startIndex / 10);
      const searchUrl = `https://www.google.com/search?q=${encodedQuery}&start=${startIndex}&hl=en&gl=us`;
      console.log(`[Research] Final Google Query URL: ${searchUrl}`);
      console.log(`[Research] Scraping page ${pageNum + 1} (start=${startIndex})...`);

      await this.page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      if (this.page.url().includes("/sorry/index")) {
        console.log(`[Research] 🚨 CAPTCHA WALL HIT on page ${pageNum + 1}!`);
        console.log(`[Research] -> Waiting... Please solve the CAPTCHA manually in the browser window.`);
        
        // Wait up to 3 minutes for the user to solve it and get redirected back to the real results
        await this.page.waitForFunction(
          () => !window.location.href.includes("/sorry/index"),
          { timeout: 180000 }
        ).catch(() => {});
        
        if (this.page.url().includes("/sorry/index")) {
          console.log(`[Research] CAPTCHA timed out after 3 minutes! Skipping page...`);
          continue;
        } else {
          console.log(`[Research] CAPTCHA bypassed! Resuming extraction...`);
          await this.page.waitForTimeout(3000); // Wait for the real search page to fully load
        }
      }

      // For the first page, handle potential cookie consent modals
      if (startIndex === 0) {
        try {
          const consentSelectors = [
            'button:has-text("Accept all")',
            'button:has-text("Accept")',
            'button:has-text("I Accept")',
            'button:has-text("Reject all")',
          ];

          for (const selector of consentSelectors) {
            const btn = this.page.locator(selector).first();
            if (await btn.isVisible({ timeout: 500 })) {
              await btn.click();
              await this.page.waitForTimeout(1000);
              break;
            }
          }
        } catch (err) {
          console.log("[Research] Cookie consent bypass failed or not needed.");
        }
        await this.page.waitForTimeout(1000);
      }

      await this.page
        .waitForSelector("h3, [role='heading'], a[href*='url?q='], #search", {
          timeout: 7000,
        })
        .catch(() => {});

      // Tiny scroll to trigger lazy results
      await this.page.mouse.wheel(0, 500);
      await this.page.waitForTimeout(500);

      const pageUrls: string[] = await this.page.evaluate(() => {
        const seen = new Set<string>();
        const process = (href: string) => {
          try {
            if (!href || href.startsWith("javascript:") || href.startsWith("#"))
              return;

            // Unpack Google redirects
            if (href.includes("/url?")) {
              try {
                const urlObj = new URL(href);
                const actualUrl =
                  urlObj.searchParams.get("q") ||
                  urlObj.searchParams.get("url") ||
                  urlObj.searchParams.get("adurl");
                if (actualUrl) href = actualUrl;
              } catch {}
            }

            const u = new URL(href);
            const host = u.hostname.toLowerCase();
            const path = u.pathname.toLowerCase();

            // Refined filter: Skip known noise but KEEP search results
            if (
              host.includes("bing.com") ||
              host.includes("microsoft.com") ||
              host.includes("google") ||
              host.includes("gstatic") ||
              host.includes("adservice")
            ) {
              return;
            }

            const BLOCKED = [
              "facebook.com",
              "twitter.com",
              "instagram.com",
              "linkedin.com",
              "youtube.com",
              "pinterest.com",
              "google.com",
            ];
            if (BLOCKED.some((d) => host.includes(d))) return;
            if (u.protocol !== "http:" && u.protocol !== "https:") return;

            u.hash = "";
            const cleanUrl = u.toString().replace(/\/$/, "");
            if (cleanUrl && cleanUrl.length > 12) seen.add(cleanUrl);
          } catch {}
        };

        document.querySelectorAll("h3, [role='heading']").forEach((h) => {
          const a = h.closest("a") || h.querySelector("a");
          if (a) process((a as HTMLAnchorElement).href);
        });

        document
          .querySelectorAll("#search a, #rso a, .v7W49e a, .g a")
          .forEach((a) => {
            process((a as HTMLAnchorElement).href);
          });

        return Array.from(seen);
      });

      if (pageUrls.length === 0) {
        console.log(`[Research] No URLs found on page ${pageNum + 1}`);
        continue;
      }

      // Limit to 5 new links per page
      const newUrlsOnPage = pageUrls.filter((url) => !allUrlsSet.has(url));
      console.log(
        `[Research] Found ${newUrlsOnPage.length} new URLs on page ${pageNum + 1}`,
      );

      const filePath = path.join(dir, `page_${pageNum + 1}.txt`);
      let fileContent = `RESEARCH DATA FOR PAGE ${pageNum + 1}\nQUERY: ${query}\n\n`;

      for (const url of newUrlsOnPage) {
        allUrlsSet.add(url);
        try {
          console.log(`[Research] Visiting: ${url}`);
          await this.page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 15000, // Slightly longer timeout for CF checks
          });
          
          // Human emulate: Wait for Cloudflare/DDoS checks to resolve and JS to mount text
          const stabilityWait = 2500 + Math.floor(Math.random() * 2000);
          await this.page.waitForTimeout(stabilityWait);

          const text = await this.page.evaluate(() => {
            const t = document.title;
            const b = document.body.innerText.replace(/\s+/g, " ").trim();
            return `--- SOURCE: ${window.location.href} ---\nTITLE: ${t}\nCONTENT:\n${b.substring(0, 8000)}\n\n`;
          });
          fileContent += text;
        } catch (e: any) {
          console.error(`[Research] Failed to visit ${url}: ${e.message}`);
          fileContent += `--- SOURCE: ${url} ---\nERROR: Failed to load content.\n\n`;
        }
      }

      fs.writeFileSync(filePath, fileContent);
      savedFiles.push(filePath);
    }

    return { allUrls: Array.from(allUrlsSet), files: savedFiles };
  }
}
