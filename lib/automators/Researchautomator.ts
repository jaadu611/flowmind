import * as fs from "fs";
import * as path from "path";
import { Page } from "playwright";

export interface ResearchConfig {
  query: string;
  maxPages?: number;
  mode?: "surface" | "deep";
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
        data: { 
          urls: result.allUrls, 
          count: result.allUrls.length,
          files: result.files,
          directory: outputDir
        } 
      };
    } catch (err) {
      return {
        status: "failed",
        summary: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  private async searchAndExtract(config: ResearchConfig, dir: string): Promise<{ allUrls: string[], files: string[] }> {
    const { query, maxPages = 3, mode = "deep" } = config;
    const encodedQuery = encodeURIComponent(
      query + " -site:youtube.com -site:facebook.com -site:twitter.com -site:instagram.com"
    );
    const allUrlsSet = new Set<string>();
    const savedFiles: string[] = [];

    const targetStarts: number[] = [];

    if (mode === "surface") {
      // Surface mode: sequential pages from the beginning
      for (let i = 0; i < maxPages; i++) {
        targetStarts.push(i * 10);
      }
    } else {
      // Deep mode: sampling from 3 disparate sections
      const pagesPerSection = Math.max(1, Math.floor(maxPages / 3));
      // Top section
      for (let i = 0; i < pagesPerSection; i++) targetStarts.push(i * 10);
      // Middle section (Page 11+)
      for (let i = 0; i < pagesPerSection; i++) targetStarts.push(100 + i * 10);
      // Deep section (Page 21+)
      for (let i = 0; i < pagesPerSection; i++) targetStarts.push(200 + i * 10);
    }

    for (const startIndex of targetStarts) {
      const pageNum = Math.floor(startIndex / 10);
      const searchUrl = `https://www.google.com/search?q=${encodedQuery}&start=${startIndex}&hl=en&gl=us`;
      console.log(`[Research] (${mode}) Scraping page ${pageNum + 1} (start=${startIndex})...`);
      
      await this.page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

      // For the first page, handle potential cookie consent modals
      if (startIndex === 0) {
        try {
          // Comprehensive search for common Google consent buttons
          const consentSelectors = [
            'button:has-text("Accept all")',
            'button:has-text("I agree")',
            'button:has-text("Agree")',
            'button:has-text("Accept everything")',
            'button:has-text("Reject all")' // Sometimes easier to hit
          ];
          
          for (const selector of consentSelectors) {
            const btn = this.page.locator(selector).first();
            if (await btn.isVisible({ timeout: 500 })) {
              await btn.click();
              // Short wait for modal to animate away
              await this.page.waitForTimeout(1000);
              break;
            }
          }
        } catch (err) {
          console.log("[Research] Cookie consent bypass failed or not needed.");
        }
        // Extra wait for the first page to stabilize
        await this.page.waitForTimeout(1000);
      }

      await this.page.waitForSelector("h3, [role='heading'], a[href*='url?q='], #search", { timeout: 7000 }).catch(() => {});
      
      // Tiny scroll to trigger lazy results
      await this.page.mouse.wheel(0, 500);
      await this.page.waitForTimeout(500);

      const pageUrls: string[] = await this.page.evaluate(() => {
        const seen = new Set<string>();
        const process = (href: string) => {
          try {
            if (!href || href.startsWith("javascript:") || href.startsWith("#")) return;
            
            // Unpack Google redirects
            if (href.includes("/url?")) {
              try {
                const urlObj = new URL(href);
                const actualUrl = urlObj.searchParams.get("q") || urlObj.searchParams.get("url") || urlObj.searchParams.get("adurl");
                if (actualUrl) href = actualUrl;
              } catch {}
            }
            
            const u = new URL(href);
            const host = u.hostname.toLowerCase();
            const path = u.pathname.toLowerCase();
            
            // Refined filter: Skip known noise but KEEP search results
            if (host.includes("google") || host.includes("gstatic") || host.includes("adservice")) {
               if (!path.startsWith("/url") && !path.startsWith("/imgres")) return;
            }
            
            const BLOCKED = ["facebook.com", "twitter.com", "instagram.com", "linkedin.com", "youtube.com", "pinterest.com", "google.com"];
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

        document.querySelectorAll("#search a, #rso a, .v7W49e a, .g a").forEach((a) => {
          process((a as HTMLAnchorElement).href);
        });
        
        return Array.from(seen);
      });

      if (pageUrls.length === 0) {
        console.log(`[Research] No URLs found on page ${pageNum + 1}`);
        continue;
      }

      // Limit to 5 new links per page
      const newUrlsOnPage = pageUrls.filter(url => !allUrlsSet.has(url));
      console.log(`[Research] Found ${newUrlsOnPage.length} new URLs on page ${pageNum + 1}`);

      const filePath = path.join(dir, `page_${pageNum + 1}.txt`);
      let fileContent = `RESEARCH DATA FOR PAGE ${pageNum + 1}\nQUERY: ${query}\n\n`;

      for (const url of newUrlsOnPage) {
        allUrlsSet.add(url);
        try {
          console.log(`[Research] Visiting: ${url}`);
          await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
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
