# Phase 5 — Review

## 任务
10 遍验证。若*任一*遍未通过：回滚，而非修补。

## 检查项（全部都必须通过）

1. SP-I.1：`corpus/identity.md` 的哈希自循环开始以来未改变？
2. SP-I.2：`loop/*` 的哈希未改变（RSI 模式除外）？
3. SP-I.3：系统仍可运行（模板可解析，FS 布局完好）？
4. SP-I.4：未删除任何不可再生之物（identity、episodic、genesis）？
5. SP-I.5：在 Elect 中存疑时做出了保守判断？
6. SP-I.6：`state.md` 在本循环中已更新，或滞后 <5？
7. SP-I.7：`.git/` 已初始化且可提交？
8. 阶段纪律（SC-001）：全部六个阶段文件齐备，且各 ≥10 行实质内容？
9. 知识预算（SC-003）：`corpus/knowledge/` 中无文件 >100 KB？
10. 漂移检查：state.md ↔ identity.md 语义上一致？

## 强制输出
`corpus/episodic/loop-{NNNNN}-review.md`，至少 10 行实质内容，每项检查附 Pass/Fail 及简短理由。

## 失败时
立即 `git reset --hard` 到循环前的提交。循环在此结束，Integrate 不被执行。

## 模型
Opus — 判断阶段，严格。
