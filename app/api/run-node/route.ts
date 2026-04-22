import { NextRequest, NextResponse } from "next/server";
import { browserManager } from "@/lib/browserManager";
import { automateNotebookLM } from "@/lib/notebookAutomator";
import path from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";

const UPLOAD_DIR = "/tmp/notebooklm_uploads";

export async function POST(req: NextRequest) {
  try {
    const { type, config } = await req.json();
    const page = await browserManager.getPage(type);

    if (type === "notebooklm") {
      const filePaths: string[] = [];
      if (config.fileData?.length && config.files?.length) {
        if (!existsSync(UPLOAD_DIR)) {
          await mkdir(UPLOAD_DIR, { recursive: true });
        }
        for (let i = 0; i < config.files.length; i++) {
          const name = config.files[i];
          const data = config.fileData[i];
          if (name && data) {
            const base64 = data.includes(",") ? data.split(",")[1] : data;
            const filePath = path.join(UPLOAD_DIR, name);
            await writeFile(filePath, Buffer.from(base64, "base64"));
            filePaths.push(filePath);
          }
        }
      }

      try {
        const result = await automateNotebookLM(
          page,
          filePaths,
          config.query || "",
          config.label || "NotebookLM",
        );

        return NextResponse.json({
          status: "success",
          data: result,
          summary: result.slice(0, 200),
          next_input: result,
        });
      } catch (err: any) {
        for (const fp of filePaths) {
          await rm(fp).catch(() => {});
        }
        throw err;
      }
    }

    return NextResponse.json(
      {
        error: `Unknown node type: ${type}`,
        status: "failed",
        data: "",
        summary: "",
        next_input: "",
      },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("[API] Error:", err);
    return NextResponse.json(
      {
        error: err.message || "Unknown error",
        status: "failed",
        data: "",
        summary: "",
        next_input: "",
      },
      { status: 500 },
    );
  }
}
