# Flowmind

> AI-native workflow automation. Every node thinks.

Flowmind is a free, open-source visual workflow builder where the primitives are AI reasoning systems instead of dumb API wrappers. Think n8n or Zapier, but every node is powered by Claude, Gemini, DeepSeek, Qwen, NotebookLM, or ChatGPT — and the workflows themselves can think, validate, gap-fill, and course-correct.

---

## What makes it different

Most workflow tools move data between services. Flowmind moves _reasoning_ between AI systems.

- **AI nodes reason** — they don't just pass data, they think about it, fill gaps, and validate their own output
- **Browser automators** — NotebookLM, Gemini, ChatGPT, DeepSeek, Qwen are automated via Playwright, giving access to full context windows at zero token cost
- **Gap-fill loop** — any node can say "I need more information", the runner fetches it and resumes. Works for every node type, not just code
- **AI validator** — describe your goal, the AI designs your workflow, writes prompts for each node, and configures everything. Or build manually and let the validator check your work, gray out what's wrong, and add what's missing highlighted in green
- **Final QA gate** — after every workflow run, Gemini checks "did this actually answer the original intent?" Silent wrong answers become explainable breakdowns

---

## Architecture

### Node contract

Every node in Flowmind speaks the same language:

```typescript
interface NodeOutput {
  status: "success" | "partial" | "failed";
  data: any;
  context_files?: string[];
  summary: string;
  next_input: any; // pre-formatted for next node
}
```

### Workflow format

The visual builder produces a simple JSON array:

```typescript
const workflow = [
  { type: "research", config: { query: "...", pages: 30 } },
  { type: "context_builder", config: { chunk_size: 50 } },
  { type: "notebooklm", config: { sub_question: "..." } },
  { type: "deepseek", config: { mode: "FIX", max_attempts: 5 } },
  { type: "gemini_qa", config: { check_intent: true } },
];
```

The runner executes nodes sequentially, passing the NodeOutput contract between each step. The visual builder and runner are completely separate concerns.

### Gap-fill loop

Any node can request missing data mid-execution. The runner fetches it and resumes. This started as a code-specific pattern (DeepSeek saying "I need this file") but is generalized here — a research node can request more pages, a NotebookLM node can request files from another directory, any node can ask for anything.

---

## Node types

### AI reasoning nodes (browser-automated)

| Node         | Description                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `notebooklm` | Semantic file discovery from large document sets. Upload context files, query across all of them |
| `deepseek`   | Code reasoning with gap-fill loop. Iterates until the answer is complete                         |
| `qwen`       | Parallel reasoning to DeepSeek. Good for cross-validation                                        |
| `gemini`     | Synthesis and quality gate. Final answer generation and intent checking                          |
| `chatgpt`    | Final output generation                                                                          |
| `claude`     | Reasoning, analysis, writing                                                                     |

### Pipeline nodes

| Node              | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `research`        | Search + fetch up to 30 pages + clean + chunk into context files |
| `context_builder` | Chunks files into notebooks (batches of 50) for NotebookLM       |

### Utility nodes

| Node        | Description                                 |
| ----------- | ------------------------------------------- |
| `discord`   | Send messages or files to a Discord channel |
| `email`     | Send via Gmail or SMTP                      |
| `whatsapp`  | Send messages via WhatsApp                  |
| More coming | Open to contributions                       |

---

## The research pipeline

```
research → context_builder → notebooklm → query
```

Search → fetch up to 30 full pages → clean → chunk into notebooks → cross-reference with NotebookLM queries.

Better than Perplexity for deep research. Full page content, not snippets. Structured into notebooks, cross-referenceable across sources.

---

## AI validator

The validator is powered by a `.md` knowledge base describing every node — what it does, what it expects, what good workflows look like — plus example workflows. It's sent to Qwen on every validation call alongside the user's workflow JSON and their original goal.

**What it does:**

- Nodes that are redundant or misplaced → grayed out with explanation
- Nodes that are missing → added to canvas highlighted green with explanation
- Writes actual prompts for each AI node based on the user's goal
- Configures utility nodes (which channel, which address)
- Returns structured JSON so the frontend renders it directly

Improving the validator is just editing a markdown file — no code changes needed.

---

## Tech stack

- **Frontend** — Next.js, Tailwind CSS, custom canvas builder
- **Backend** — Node.js
- **Browser automation** — Playwright (persistent sessions, headless)
- **AI validator** — Qwen

---

## Build order

1. Finish core automators (NotebookLM, DeepSeek, Qwen, Gemini, ChatGPT)
2. Research + context builder pipeline
3. Visual canvas builder (drag, connect, configure nodes)
4. Sequential runner + gap-fill loop
5. AI validator
6. Final QA gate
7. Utility nodes (Discord, Email, WhatsApp)

---

## Disclaimer

Flowmind automates web interfaces on behalf of the user using their own accounts and credentials. Users are responsible for complying with the terms of service of any platforms they choose to automate. Flowmind does not store, harvest, or transmit any user credentials or data. This is a free, non-commercial, open-source tool.

---

## Contributing

Hobby project, fully open source. If you want to add a node, improve an automator, or fix something — PRs welcome. No contribution is too small.

---

## License

MIT
