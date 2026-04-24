import { Page } from "playwright";

/**
 * Automates Perplexity AI.
 * Optimizes for fast research and citation-rich synthesis.
 */
export async function askPerplexity(
  page: Page,
  query: string,
  filePaths: string[] = [],
): Promise<string> {
  const currentUrl = page.url();
  if (!currentUrl.includes("perplexity.ai")) {
    await page.goto("https://www.perplexity.ai/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(2000);
  }

  // 1. Handle File Uploads if any (Perplexity supports file uploads in the same text area menu often)
  if (filePaths.length > 0) {
    try {
      // Look for the hidden file input
      await page.setInputFiles('input[type="file"]', filePaths);
      await page.waitForTimeout(2000 + filePaths.length * 500); 
    } catch (err) {
      console.warn("[Perplexity] Could not strictly attach files via input[type=file].");
    }
  }

  const inputSelector = 'div#ask-input[role="textbox"]';
  await page.waitForSelector(inputSelector, { timeout: 30000 });
  await page.click(inputSelector);
  await page.keyboard.insertText(query);
  await page.waitForTimeout(1000);
  
  // Submit via Enter and fallback to Click
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);

  // Fallback: Click the submit button if Enter didn't trigger it
  try {
    // Perplexity uses an arrow up button within or next to the input
    const submitBtn = 'button[aria-label*="Submit"], button[aria-label*="Search"], button:has(svg[data-icon="arrow-up"])';
    if (await page.isVisible(submitBtn)) {
      await page.click(submitBtn);
    }
  } catch (e) {}

  // 2. Poll for Completion using stability mechanics
  const startTime = Date.now();
  let lastText = "";
  let stableCount = 0;
  const STABLE_POLLS_NEEDED = 6; 

  while (Date.now() - startTime < 300000) { 
    const result = await page.evaluate(() => {
      // Perplexity assistant messages are in prose blocks
      const messages = document.querySelectorAll('.prose'); 
      if (messages.length === 0) return null;
      
      const lastMessage = messages[messages.length - 1] as HTMLElement;
      // The Stop button appears only during generation
      const isGenerating = !!document.querySelector('button[aria-label="Stop"]');
      
      return {
        text: lastMessage.innerText.trim(),
        isGenerating
      };
    });

    if (result) {
      if (!result.isGenerating && result.text === lastText && result.text.length > 50) {
        stableCount++;
        if (stableCount >= STABLE_POLLS_NEEDED) {
          // Attempt a clipboard copy if a copy button exists
          try {
             await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
             const res = await page.evaluate(() => {
                const copyBtns = Array.from(document.querySelectorAll('button[aria-label="Copy"]'));
                if (copyBtns.length > 0) {
                  (copyBtns[copyBtns.length - 1] as HTMLElement).click();
                  return true;
                }
                return false;
             });
             if (res) {
               await page.waitForTimeout(500);
               const text = await page.evaluate(() => navigator.clipboard.readText());
               if (text && text.length > 10) return text;
             }
          } catch(e) {}

          console.log(`[Perplexity] Success: Extracted (${result.text.length} chars).`);
          return result.text;
        }
      } else {
        stableCount = 0;
        lastText = result.text;
      }
    }
    
    await page.waitForTimeout(500);
  }

  throw new Error("Perplexity research timed out.");
}
