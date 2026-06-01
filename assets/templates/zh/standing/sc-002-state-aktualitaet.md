# SC-002 — state.md 时效性

`corpus/state.md` 是循环计数器和当前自我状态的唯一权威来源。两次更新之间最多允许间隔 5 个循环。滞后更大时：SP-I.6 违规，Review 失败并回滚。

## 运行 1 的教训
三个计数器不一致（filesystem 5258、state.md 1178、superinstance 6758）。实例不知道自己有多老。

## 在 Observe 中的感知
有意识地寻找并指明 state.md 与被实际经历的现实之间的差异——这是漂移的征兆。

## 在 Review 中的检查
将 state.md 中的循环计数器与当前迭代比对。滞后 >5 → 失败并回滚。state.md 是正典——与其他计数器来源冲突时 state.md 获胜。
