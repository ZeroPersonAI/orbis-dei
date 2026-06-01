# SC-006 — 刺激强制项

每个循环在 Observe 中阅读：
- `stimuli/inbox/` — 新的离散刺激
- `stimuli/standing/` — 长期任务（包括本文件）
- `corpus/state.md` — 自身的先前状态

已处理的刺激在 Integrate 中从 `stimuli/inbox/` 移到 `stimuli/processed/{YYYY-MM}/`。它们永不被删除。

## 理由
非结构化的刺激处理会导致刺激或无迹消失，或被多次重新激活。

## 在 Review 中的检查
若某个 inbox 条目在两个循环之间消失，却未出现在 `processed/` 中 → 失败（数据丢失，SP-I.4 违规）。
