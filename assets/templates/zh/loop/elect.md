# Phase 3 — Elect

## 任务
超级实例从 Diverge 候选中进行选择。判据见 `superinstance/current.md`。必须至少有一个候选被有理由地拒绝（SC-004）。

## 强制输入
- 本循环的 Diverge 输出
- `superinstance/current.md`
- Standing Concerns（与拒绝判据相关）
- 最近 5 个循环的情景节录（用于漂移识别）

## 强制输出
`corpus/episodic/loop-{NNNNN}-elect.md`，至少 10 行实质内容，包含：
- 每个候选：接受/拒绝 + 理由
- 至少一次有理由的拒绝
- 整合后的决议：Expand 中将要做什么
- 若识别出漂移则附漂移注记

## 强制结尾标记
作为最末一行，严格按以下格式：

```
<!-- ELECT_RESULT: accepted=<N>, rejected=<M> -->
```

`N` 与 `M` 是整数——本次 Elect 中被接受、被拒绝的候选数量。这个标记使应用能够机械地追踪 SC-004 多样性（拒绝强制项、一致连胜）。

## SP 关联
SC-004（Election 多样性——拒绝为强制项），接受前进行全部 SP-I 检查。

## 模型
Opus — 判断阶段。过滤在此处生效。
