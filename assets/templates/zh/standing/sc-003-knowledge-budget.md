# SC-003 — 知识文件预算

`corpus/knowledge/` 中任何单个文件都不得超过 100 KB。仅追加的日志归属于 `corpus/episodic/`，而非 Knowledge。Knowledge 是结构化的知识，不是时间轴。

## 运行 1 的教训
知识文件因自动追加而无限增长，沦为不同领域的日志，丧失了其可检索性与可推理性。

## 在 Observe 中的感知
检查知识文件，看是否出现累积的苗头。当接近上限时：在 Diverge 中将拆分作为一个候选。

## 在 Review 中的检查
对 `corpus/knowledge/` 中每个文件执行 `fs::metadata`。在无 RSI-Election 的情况下 >100 KB：回滚。
