---
title: MIT6.s081 2021 Lab4-Traps Optional challenge exercises 记录
date: 2026-1-4 12:54
categories:
  - 操作系统
tags:
  - xv6
featured: true

---



# Optional challenge exercises

## 题目解析

Print the names of the functions and line numbers in `backtrace()` instead of numerical addresses

在`backtrace()`中打印函数名称和行号，而不是数字地址

这个确实有点难，主要是题目要求将地址转换为符号信息（函数名）和源码行号。这需要处理调试信息，而xv6本身没有内置符号表支持。

## 前置知识

### 调试信息来源

编译器（gcc）在编译时可以用`-g`选项生成调试信息，调试信息通常以DWARF格式存储在可执行文件中，我们需要提取这些信息并建立地址到符号的映射

### 符号解析

第一步解析`.symtab`（符号表）

第二步建立按地址排序的符号数组

第三步实现二分查找：给定地址，找到包含它的函数

## 思路

略

## 步骤

略

## 思考

略