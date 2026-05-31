---
name: Bug report
about: Something behaves incorrectly or crashes
labels: bug
---

**What happened**

<!-- One or two sentences. -->

**What did you expect**

<!-- The behaviour you assumed. -->

**Repro**

1. ...
2. ...
3. ...

**Environment**

- OS + version (macOS / Linux / Windows):
- Node.js version (`node -v`):
- How started (`npm start` / `npm run dev`):
- Routing mode (Anthropic / OpenAI / Gemini / custom) and model:
- Anything in the data dir worth mentioning (loop counter, last loop outcome,
  instance status):

**Logs**

<!--
Paste the relevant tail from the server's stdout/stderr. With the global crash
handler, unhandled errors print as [unhandledRejection] / [uncaughtException]
with a stack — include those if present. Trim unrelated lines.
-->

```
```

**Hypothesis (optional)**

<!-- A theory speeds triage: "I think this fails because X, look at Y". -->
