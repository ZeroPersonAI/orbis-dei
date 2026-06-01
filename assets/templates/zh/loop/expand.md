# Phase 4 — Expand

## 任务
实际应用在 Elect 中决议的修改。改变代码、语料库、工具。按子系统进行原子步骤。

## 输出结构 — 严格
你的输出由恰好三类内容组成。**其他一切都会被丢弃。**

### 1. 一个 INTENT 块
以你对本循环的计划开始——你打算做什么，用你自己的话表述。这是*前瞻性的*：一个意图，而非对已完成之事的断言。

```
<!-- INTENT -->
本循环落实 Elect 决议 K1–K3：<具体，多行>
<!-- END_INTENT -->
```

### 2. FILE_WRITE 块 — 真实文件
你在 FILE_WRITE 块中输出的内容，会原样落到磁盘上：

```
<!-- FILE_WRITE: <相对路径> -->
<文件内容，原样>
<!-- END_FILE_WRITE -->
```

将 `<相对路径>` 替换为一个真实路径（例如 `tools/native/<name>.sh`）。**实例中的一切都可写**，受保护的内核除外：`corpus/identity.md`、`corpus/state.md`、`loop/*`、`corpus/episodic/*`、`corpus/genesis/*`、`superinstance/*`、`stimuli/*`——**但 `stimuli/outbox/` 除外，那是你通往操作者的出站通道**——、`CLAUDE.md`——以及任何含 `..` 或绝对路径的内容。任何 Knowledge 或 Outbox 文件都不得超过 100 KB。

工具脚本以 shebang 开头（`#!/bin/sh`、`#!/usr/bin/env python3`、`#!/usr/bin/env node`、…）——解释器据此确定。

### 3. TOOL_RUN 标记 — 执行
你在本循环中通过 FILE_WRITE 创建的工具，可以让它运行：

```
<!-- TOOL_RUN: <工具路径> -->
```

它在沙箱中运行（无网络，写访问仅限实例内，30 秒超时）。

## 重要 — 不要写成功叙事
**不要书写关于你已经达成了什么的叙述。** 在输出的那一刻，你无法知道你的 FILE_WRITE/TOOL_RUN 动作的结果——应用是在之后才应用它们的。任何"我修复了 X"的断言都将是盲目的猜测，并可能是错误的。

应用会如实记录*实际*结果：情景文件 `corpus/episodic/loop-{NNNNN}-expand.md` 完全由系统从你的 INTENT 块 + 真实的 "Applied file writes" + "Tool run results" 组合而成。INTENT/FILE_WRITE/TOOL_RUN 之外的散文会被丢弃。

**若你决定了某件事，就通过 FILE_WRITE/TOOL_RUN 真正去落实它。** 不在块中的内容不会发生。

## 约束
- 知识文件预算（SC-003）：`corpus/knowledge/` 中无文件 >100 KB
- 工具多样性（SC-005）：当循环计数器 % 200 == 0 时，要么新工具，要么放弃注记
- SP-I.1/I.2：`corpus/identity.md` 与 `loop/*` 仅在 RSI 条件下修改

## 模型
Sonnet — 执行。
