import { Page } from "playwright";

export interface NotebookPlan {
  notebooks?: Array<unknown>;
  direct_answer?: string;
}

export function parseNotebookPlan(raw: string): NotebookPlan {
  const clean = (raw.match(/\{[\s\S]*\}/) ?? [raw])[0]
    .replace(/[\x00-\x1F]+/g, " ")
    .replace(/\/\/.*$/gm, "");
  try {
    return validatePlan(JSON.parse(clean));
  } catch (err: any) {
    throw new Error(`Failed to parse NotebookLM plan: ${err.message}`);
  }
}

function validatePlan(obj: unknown): NotebookPlan {
  const p = obj as any;
  if (!p || typeof p !== "object") throw new Error("Expected an object.");
  if (p.direct_answer) return p;
  if (!Array.isArray(p.notebooks) || !p.notebooks.length)
    throw new Error(
      "Expected { notebooks: [...] } or { direct_answer: '...' }",
    );
  return p;
}

export async function automateNotebookLM(
  page: Page,
  files: string[],
  question: string,
  options: { isFinalStep?: boolean; onPartial?: (text: string) => void } = {},
): Promise<string> {
  const { isFinalStep = false, onPartial } = options;

  if (
    !page.url().includes("notebooklm.google.com") ||
    page.url().includes("/notebook/")
  ) {
    await page.goto("https://notebooklm.google.com/", {
      waitUntil: "domcontentloaded",
    });
  }

  // 1. Create Notebook
  await page
    .locator(
      'button.create-new-button, [aria-label*="New notebook"], span:has-text("New notebook")',
    )
    .first()
    .click({ force: true });
  await page.waitForURL((u) => u.href.includes("/notebook/"), {
    timeout: 30000,
  });

  const uploadSel =
    'button.drop-zone-icon-button, button:has-text("Upload files"), [aria-label*="Upload files"]';
  const addSrcSel =
    '.add-source-button, [aria-label="Add source"], button:has-text("Add source")';

  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('mat-progress-spinner, [role="progressbar"]')
          .length === 0,
      { timeout: 15000 },
    )
    .catch(() => {});

  const uploadBtn = page.locator(uploadSel).first();
  const ensureUploadVisible = async () => {
    if (!(await uploadBtn.isVisible({ timeout: 1000 }).catch(() => false))) {
      const addBtn = page.locator(addSrcSel).first();
      if (await addBtn.isVisible()) await addBtn.click({ force: true });
    }
  };

  // 2. Upload Files
  await ensureUploadVisible();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15000 }),
    uploadBtn.click({ force: true }),
  ]);
  await chooser.setFiles(files);

  // 3. Polling for upload completion
  const startWait = Date.now();
  while (Date.now() - startWait < 60000) {
    const isUploading = await page.evaluate(() => {
      const t = document.body.innerText;
      return (
        t.includes("Uploading") ||
        document.querySelectorAll('mat-progress-spinner, [role="progressbar"]')
          .length > 0
      );
    });
    if (!isUploading && Date.now() - startWait > 5000) break;
    await page.waitForTimeout(400);
  }

  const closeBtn = page
    .locator('button[aria-label="Close"], .close-button')
    .first();
  if (await closeBtn.isVisible().catch(() => false))
    await closeBtn.click({ force: true });

  // 4. Send Query
  const inputSel =
    'textarea[placeholder*="Ask"], .chat-input textarea, textarea[aria-label*="Query"]';
  await page.waitForSelector(inputSel, { timeout: 30000 });
  await page.fill(inputSel, question);
  await page.keyboard.press("Enter");

  // 5. Poll for Response
  const startTime = Date.now();
  let lastLength = 0;
  let stableCount = 0;

  while (Date.now() - startTime < 300000) {
    const res = await page.evaluate(() => {
      function findDeep(selector: string, root: Document | ShadowRoot = document) {
        let els = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
        for (const el of Array.from(root.querySelectorAll("*"))) {
          if (el.shadowRoot)
            els = els.concat(findDeep(selector, el.shadowRoot));
        }
        return els;
      }

      const isGenerating =
        findDeep(
          '.loading-indicator, [aria-label*="Generating"], .generating, .response-loading, button[aria-label*="Stop"]',
        ).length > 0;
      const containers = findDeep(
        '.model-response, [class*="markdown"], [class*="response-text"], .message-content',
      );

      if (!containers.length) return null;
      const text = containers[containers.length - 1].innerText.trim();
      return { text, isGenerating };
    });

    if (res && res.text.length > 50 && !res.isGenerating) {
      if (res.text.length === lastLength) {
        stableCount++;
      } else {
        lastLength = res.text.length;
        stableCount = 0;
      }

      // Require text to be purely stable for 3 full seconds (6 intervals of 500ms)
      if (stableCount >= 6) {
      try {
        await page
          .context()
          .grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.bringToFront();

        const clipboardText = await page.evaluate(async () => {
          function findDeep(selector: string, root: Document | ShadowRoot = document) {
            let els = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
            for (const el of Array.from(root.querySelectorAll("*"))) {
              if (el.shadowRoot)
                els = els.concat(findDeep(selector, el.shadowRoot));
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
            await new Promise((r) => setTimeout(r, 300));
            try {
              return await navigator.clipboard.readText();
            } catch (e) {
              return null;
            }
          }
          return null;
        });

        if (clipboardText && clipboardText.length > 50) {
          console.log(
            `[NotebookLM] Success: Extracted from clipboard (${clipboardText.length} chars).`,
          );
          return clipboardText.trim();
        }
      } catch (e) {}

      console.log(
        `[NotebookLM] Success: Extracted from DOM (${res.text.length} chars).`,
      );
      return res.text;
      }
    } else {
      stableCount = 0; // Reset if generator spins back up
    }
    await page.waitForTimeout(500);
  }

  throw new Error("Timed out waiting for NotebookLM response (5m)");
}
