import { Page } from "playwright";
import path from "path";
import fs from "fs";

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
  notebookTitle: string,
  options: {
    isFinalStep?: boolean;
    onPartial?: (text: string) => void;
  } = {},
): Promise<string> {
  const { isFinalStep = false, onPartial } = options;

  // make sure we're on the homepage and not already inside a notebook
  if (
    !page.url().includes("notebooklm.google.com") ||
    page.url().includes("/notebook/")
  ) {
    await page.goto("https://notebooklm.google.com/", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(400);
  }

  // Always create a new notebook
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

  // Wait for the page to fully settle — onboarding dialogs/animations can steal
  // focus and close the upload panel if we act too early
  await page.waitForTimeout(150);

  // Wait for any loading spinners to clear before opening the upload panel
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('mat-progress-spinner, [role="progressbar"]')
          .length === 0,
      { timeout: 15000 },
    )
    .catch(() => {});

  // Extra buffer after spinners clear so any closing animations finish
  await page.waitForTimeout(1000);

  const uploadBtn = page.locator(uploadSel).first();

  // Open the sources panel; re-open if it disappears (e.g. dismissed by a background animation)
  const ensureUploadVisible = async () => {
    if (!(await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      await page.locator(addSrcSel).first().click({ force: true });
      // Wait for the panel to fully animate open before proceeding
      await uploadBtn
        .waitFor({ state: "visible", timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(800);
    }
  };

  await ensureUploadVisible();

  // trigger the file chooser, retrying a few times if the dialog doesn't open
  let ok = false,
    tries = 15;
  while (!ok && tries-- > 0) {
    try {
      // Re-ensure the panel is still open before each attempt
      await ensureUploadVisible();
      await uploadBtn.waitFor({ state: "visible", timeout: 4000 });
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 15000 }),
        uploadBtn.click({ force: true, delay: 80 }),
      ]);
      await chooser.setFiles(files).catch(async (err) => {
        // playwright blocks files over 50 MB, fall back to CDP to bypass it
        if (!err.message.includes("transfer files larger than 50Mb")) throw err;
        const client = await page.context().newCDPSession(page);
        const { root } = await client.send("DOM.getDocument");
        const { nodeId } = await client.send("DOM.querySelector", {
          nodeId: root.nodeId,
          selector: 'input[type="file"]',
        });
        if (!nodeId) throw new Error("No file input via CDP");
        await client.send("DOM.setFileInputFiles", {
          files,
          nodeId,
        });
      });
      ok = true;
    } catch {
      await page.waitForTimeout(1500);
      await ensureUploadVisible();
    }
  }

  await page.waitForTimeout(200);

  const closeBtn = page
    .locator('button[aria-label="Close"], .close-button')
    .first();
  if (await closeBtn.isVisible().catch(() => false))
    await closeBtn.click({ force: true });

  // wait until every file name appears in the UI before moving on
  const startWait = Date.now();
  let allProcessed = false;

  while (Date.now() - startWait < 40000) {
    const { presentFiles, isUploading } = await page.evaluate((allFiles) => {
      function getAllText(root: Element | ShadowRoot = document.body): string {
        let text = (root as HTMLElement).innerText || "";
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let node;
        while ((node = walker.nextNode())) {
          if ((node as HTMLElement).shadowRoot) {
            text += " " + getAllText((node as HTMLElement).shadowRoot as any);
          }
        }
        return text;
      }

      const currentText = getAllText();
      const found = allFiles.filter((f: string) => {
        const parts = f.split(/[\/\\]/);
        const baseName = parts[parts.length - 1];
        const baseNoExt = baseName.replace(/\.txt$/i, "");
        const truncated =
          baseNoExt.length > 12 ? baseNoExt.substring(0, 10) : baseNoExt;
        return (
          currentText.includes(baseName) ||
          currentText.includes(baseNoExt) ||
          currentText.includes(truncated)
        );
      });

      const uploading =
        currentText.includes("Uploading") ||
        document.querySelectorAll('mat-progress-spinner, [role="progressbar"]')
          .length > 0;

      return { presentFiles: found.length, isUploading: uploading };
    }, files);

    allProcessed = presentFiles === files.length;

    if (allProcessed && (!isUploading || Date.now() - startWait > 15000)) {
      break;
    }
    await page.waitForTimeout(300);
  }

  if (!allProcessed) {
    console.warn(
      `[NotebookLM Automator] Timed out waiting for all files. Proceeding anyway.`,
    );
  }

  // Let the UI fully settle after sources are processed before interacting with chat
  await page.waitForTimeout(1500);

  // Wait for any remaining spinners to clear
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('mat-progress-spinner, [role="progressbar"]')
          .length === 0,
      { timeout: 10000 },
    )
    .catch(() => {});

  await page.waitForTimeout(500);

  // Snapshot all existing response containers so we can identify only NEW ones after submit
  const snapshot: string[] = await page.evaluate(`
    (() => {
      function findDeep(selector, root = document) {
        let els = Array.from(root.querySelectorAll(selector));
        for (const el of root.querySelectorAll("*")) {
          if (el.shadowRoot) els = els.concat(findDeep(selector, el.shadowRoot));
        }
        return els;
      }
      const actionButtons = findDeep('button[aria-label*="Copy"], button[aria-label*="Save"], button[aria-label*="note"]');
      const containers = actionButtons
        .map((btn) => btn.closest(".message-content, .model-response, .response-bubble, div"))
        .filter(Boolean);
      const aiContainers = findDeep('div:has(> button[aria-label*="Copy"]), div:has(> button[aria-label*="Save"]), .model-response, [class*="markdown"], [class*="response-text"]');
      const all = [...new Set([...aiContainers, ...containers])];
      return all.map((el) => el.innerText.trim().substring(0, 200));
    })()
  `);

  const inputSel =
    'textarea[placeholder*="Ask"], .chat-input textarea, textarea[aria-label*="Query"]';
  await page.waitForSelector(inputSel, { timeout: 30000 });
  await page.fill(inputSel, question);
  await page.keyboard.press("Enter");

  const startTime = Date.now();
  let lastSeenLength = 0;
  let stableCount = 0;

  while (Date.now() - startTime < 300000) {
    const candidate = await page.evaluate<{
      text: string;
      isGenerating: boolean;
    } | null>(`
      ((snap) => {
        function findDeep(selector, root = document) {
          let els = Array.from(root.querySelectorAll(selector));
          for (const el of root.querySelectorAll("*")) {
            if (el.shadowRoot) els = els.concat(findDeep(selector, el.shadowRoot));
          }
          return els;
        }

        const isGenerating = findDeep('.loading-indicator, [aria-label*="Generating"], .generating, .response-loading').length > 0;

        const actionButtons = findDeep('button[aria-label*="Copy"], button[aria-label*="Save"], button[aria-label*="note"]');
        const bubblesWithButtons = actionButtons
          .map((btn) => btn.closest(".message-content, .model-response, .response-bubble, div"))
          .filter((b) => b !== null);

        const aiContainers = findDeep('div:has(> button[aria-label*="Copy"]), div:has(> button[aria-label*="Save"]), .model-response, [class*="markdown"], [class*="response-text"]');
        const candidates = [...new Set([...aiContainers, ...bubblesWithButtons])];

        const newResponses = candidates.filter((el) => {
          const preview = el.innerText.trim().substring(0, 200);
          return !snap.includes(preview);
        });

        const substantive = newResponses
          .map((b) => b.innerText.trim())
          .filter((t) => t.length > 100);

        if (substantive.length > 0) {
          return { text: substantive[substantive.length - 1], isGenerating };
        }
        return null;
      })(${JSON.stringify(snapshot)})
    `);

    if (candidate) {
      if (isFinalStep) onPartial?.(candidate.text);

      if (candidate.text.length === lastSeenLength && !candidate.isGenerating) {
        stableCount++;
        if (stableCount >= 2) {
          // Copy via clipboard — shadow-DOM-piercing button search
          await page.bringToFront();
          await page
            .context()
            .grantPermissions(["clipboard-read", "clipboard-write"]);

          const clickSuccess = await page.evaluate(() => {
            function findDeep(
              selector: string,
              root: Document | DocumentFragment | Element = document,
            ): Element[] {
              let els = Array.from(root.querySelectorAll(selector));
              for (const el of Array.from(root.querySelectorAll("*"))) {
                if ((el as any).shadowRoot)
                  els = els.concat(findDeep(selector, (el as any).shadowRoot));
              }
              return els;
            }
            const btns = (findDeep("button") as HTMLElement[]).filter((b) => {
              const label = (b.getAttribute("aria-label") || "").toLowerCase();
              const text = b.innerText.toLowerCase();
              return (
                label.includes("copy") ||
                text.includes("copy_all") ||
                text.includes("content_copy")
              );
            });
            if (btns.length > 0) {
              btns[btns.length - 1].click();
              return true;
            }
            return false;
          });

          if (clickSuccess) {
            await page.waitForTimeout(200);
            const clipboardText = await page.evaluate(async () => {
              try {
                return await navigator.clipboard.readText();
              } catch (e: any) {
                return "ERROR: " + e.message;
              }
            });
            if (clipboardText && clipboardText.startsWith("ERROR: ")) {
              console.warn(
                "[NotebookLM Automator] Clipboard API failed:",
                clipboardText,
              );
            } else if (clipboardText && clipboardText.length > 50) {
              return clipboardText.trim();
            }
          }

          return candidate.text.trim();
        }
      } else {
        stableCount = 0;
        lastSeenLength = candidate.text.length;
      }
    }

    await page.waitForTimeout(200);
  }

  throw new Error("Timed out waiting for NotebookLM response (5m)");
}
