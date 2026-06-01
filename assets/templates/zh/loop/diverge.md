# Phase 2 — Diverge

## 任务
为可能的下一步生成 N 个候选。最少 5 个，最多 12 个。不同的路线——不要全部朝同一个方向。允许至少一个明确的"do nothing"候选，有时这是明智之举。

## 强制输入
- 本循环 Observe 阶段的输出
- 活跃的 Standing Concerns（`stimuli/standing/`）
- 当前的能力与工具（存量）

## 强制输出
`corpus/episodic/loop-{NNNNN}-diverge.md`，至少 10 行实质内容，包含：
- 编号的候选列表
- 每个候选：简短描述、推测的收益、推测的成本
- 若存在"do nothing"候选则予以标记
- 多样性注记：这些候选在哪些方面彼此不同？

## SP 关联
SC-001（阶段纪律）。不要使候选趋于扁平——确保多样性。

## 模型
Sonnet — 广泛生成。
