import { Page } from "playwright";

/**
 * Main function to interact with Gemini.
 * Optimized for speed, reliability, and clean output.
 */
export async function askGemini(
  page: Page,
  query: string,
  filePaths: string[] = [],
): Promise<string> {
  // 1. Navigation
  if (!page.url().includes("gemini.google.com")) {
    await page.goto("https://gemini.google.com/app", { waitUntil: "domcontentloaded" });
  }

  // 2. File Uploads
  for (const filePath of filePaths) {
    const plusBtn = await page.waitForSelector('button[aria-label="Open upload file menu"]');
    await plusBtn.click();
    
    const uploadBtn = await page.waitForSelector(
      'button:has-text("Upload"), button[aria-label*="Upload"], [role="menuitem"]:has-text("Upload")',
      { timeout: 10000 }
    );
    
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      uploadBtn.click(),
    ]);
    await fileChooser.setFiles(filePath);
    await page.waitForTimeout(300); 
  }

  const inputSelector = 'div[aria-label="Enter a prompt for Gemini"], .ql-editor.textarea';
  await page.waitForSelector(inputSelector);
  
  // Use native Playwright keyboard bindings; DOM evaluate often misses React state triggers
  await page.click(inputSelector);
  await page.waitForTimeout(200);
  await page.keyboard.insertText(query); // instantaneous insertion
  await page.waitForTimeout(1000); // Wait for Lexical state to fully sync

  // Submit via Enter and fallback to Click
  // 1. Wait for Send button to enable (this confirms uploads are finished)
  const sendBtnSelector = 'button[aria-label*="Send"], button:has(svg path[d*="M2.01 21L23 12 2.01 3"]), button.send-button';
  
  try {
    await page.waitForFunction((selector) => {
      const btn = document.querySelector(selector) as HTMLButtonElement;
      return btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
    }, sendBtnSelector, { timeout: 30000 });
  } catch(e) {
    console.warn("[Gemini] Ready check timed out, attempting blind submission...");
  }

  await page.keyboard.press("Enter");
  await page.waitForTimeout(800); 
  
  try {
    const btn = await page.waitForSelector(sendBtnSelector, { state: 'visible', timeout: 3000 });
    if (btn && await btn.isEnabled()) {
        await btn.click();
    }
  } catch(e) {}

  // 3. Wait for Response & Extract
  const start = Date.now();
  await page.waitForTimeout(500);

  while (Date.now() - start < 300000) {
    const res = await page.evaluate(() => {
      const msgs = document.querySelectorAll('message-content:not([class*="user"]), .model-response-text');
      if (!msgs.length) return null;
      
      const last = msgs[msgs.length - 1] as HTMLElement;
      const textEl = last.querySelector('.markdown, [class*="markdown"]') || last;
      const text = (textEl as HTMLElement).innerText.trim();
      
      const isFin = !document.querySelector('button[aria-label="Stop response"]') && 
                    !document.querySelector('.generating, .loading-indicator');
      return { text, isFin };
    });

    if (res?.isFin && res.text.length > 20) {
      try {
        await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
        
        const clipboardText = await page.evaluate(async () => {
          function findDeep(selector: string, root: Document | ShadowRoot = document) {
            let els = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
            for (const el of Array.from(root.querySelectorAll("*"))) {
              if (el.shadowRoot) els = els.concat(findDeep(selector, el.shadowRoot));
            }
            return els;
          }

          const btns = findDeep("button").filter(b => {
             const l = (b.getAttribute("aria-label") || "").toLowerCase();
             const t = b.innerText.toLowerCase();
             return l.includes("copy") || t.includes("copy_all") || t.includes("content_copy");
          });

          if (btns.length) {
             btns[btns.length - 1].click();
             await new Promise(r => setTimeout(r, 200));
             try { return await navigator.clipboard.readText(); } catch (e) { return null; }
          }
          return null;
        });

        if (clipboardText && clipboardText.length > 5) {
          console.log(`[askGemini] Success: Extracted from clipboard (${clipboardText.length} chars).`);
          return clipboardText.trim();
        }
      } catch (err) {
        // Fallback to DOM if clipboard fails
      }
      
      console.log(`[askGemini] Success: Extracted from DOM (${res.text.length} chars).`);
      return res.text;
    }
    await page.waitForTimeout(500);
  }
  return "";
}
