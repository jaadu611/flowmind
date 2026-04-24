import { Page } from "playwright";

/**
 * Automates ChatGPT.
 * Supports deep file integrations and complex DOM polling.
 */
export async function askChatGPT(
  page: Page,
  query: string,
  filePaths: string[] = [],
): Promise<string> {
  const currentUrl = page.url();
  if (!currentUrl.includes("chatgpt.com")) {
    await page.goto("https://chatgpt.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(3000);
  }

  // 1. Upload files natively if they exist
  if (filePaths.length > 0) {
    try {
      // ChatGPT utilizes a hidden file input linked to the attachment paperclip
      await page.setInputFiles('input[type="file"]', filePaths);
      await page.waitForTimeout(2000 + filePaths.length * 500); // wait for uploads to buffer
    } catch (err) {
      console.warn(
        "[ChatGPT] Could not natively attach files. Pushing raw text fallback.",
      );
    }
  }

  const inputSelector = "#prompt-textarea";
  const inputHandle = await page.waitForSelector(inputSelector, {
    timeout: 30000,
  });
  if (!inputHandle) throw new Error("Could not find ChatGPT input box.");

  await inputHandle.click();
  await page.keyboard.insertText(query);
  await page.waitForTimeout(500);

  // Submit
  await page.keyboard.press("Enter");

  // 2. Poll for Completion using stability mechanics
  const startTime = Date.now();
  let lastText = "";
  let stableCount = 0;
  const STABLE_POLLS_NEEDED = 6; // 3 seconds total stability

  while (Date.now() - startTime < 300000) {
    // 5-minute timeout loop
    const result = await page.evaluate(() => {
      const messages = document.querySelectorAll(
        '[data-message-author-role="assistant"]',
      );
      if (messages.length === 0) return null;

      const lastMessage = messages[messages.length - 1] as HTMLElement;
      // Stop generating button indicates active streaming
      const isGenerating = !!document.querySelector(
        'button[aria-label="Stop generating"]',
      );

      return {
        text: lastMessage.innerText.trim(),
        isGenerating,
      };
    });

    if (result) {
      if (
        !result.isGenerating &&
        result.text === lastText &&
        result.text.length > 50
      ) {
        stableCount++;
        if (stableCount >= STABLE_POLLS_NEEDED) {
          try {
            await page.bringToFront();
            await page
              .context()
              .grantPermissions(["clipboard-read", "clipboard-write"]);

            const clickSuccess = await page.evaluate(() => {
              const messages = Array.from(
                document.querySelectorAll(
                  '[data-message-author-role="assistant"]',
                ),
              );
              if (messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                function findElementsDeep(
                  selector: string,
                  root: Document | DocumentFragment | Element = document,
                ): Element[] {
                  let els = Array.from(root.querySelectorAll(selector));
                  for (const el of Array.from(root.querySelectorAll("*"))) {
                    if (el.shadowRoot)
                      els = els.concat(
                        findElementsDeep(selector, el.shadowRoot),
                      );
                  }
                  return els;
                }
                const copyBtns = findElementsDeep(
                  'button[aria-label*="Copy"]',
                  lastMessage,
                ) as HTMLElement[];
                if (copyBtns.length > 0) {
                  copyBtns[copyBtns.length - 1].click();
                  return true;
                }
              }
              return false;
            });

            if (clickSuccess) {
              await page.waitForTimeout(600);
              const clipboardText = await page.evaluate(async () => {
                try {
                  return await navigator.clipboard.readText();
                } catch (e: any) {
                  return "ERROR: " + e.message;
                }
              });

              if (
                clipboardText &&
                !clipboardText.startsWith("ERROR: ") &&
                clipboardText.length > 50
              ) {
                console.log(
                  `[ChatGPT] Success: Extracted from clipboard (${clipboardText.length} chars).`,
                );
                return clipboardText.trim();
              }
            }
          } catch (err: any) {
            console.warn("[ChatGPT] Clipboard fallback triggered.");
          }

          console.log(
            `[ChatGPT] Success: Extracted from DOM (${result.text.length} chars).`,
          );
          return result.text;
        }
      } else {
        stableCount = 0;
        lastText = result.text;
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error("ChatGPT synthesis timed out.");
}
