---
title: MIT6.s081 2021 Lab4-Traps 实验记录
date: 2026-1-3 12:54
categories:
  - 操作系统
tags:
  - 虚拟内存
  - xv6
  - 内存管理
featured: false
---





## 前置知识

### 系统调用流程

对于XV6系统调用执行流程，当用户进程执行系统调用时，会执行以下流程

1. 用户态切换到内核态
2. 上下文保存，其中包括保存所有31个通用寄存器到 陷阱帧，切换到内核页表，切换到内核栈
3. 系统调用分发与执行，首先usertrap() 识别系统调用类型，然后`syscall()` 根据系统调用号分发，执行具体的系统调用处理函数，并且设置返回值到陷阱帧的 a0 寄存器
4. 上下文恢复与返回，`usertrapret()` 准备返回环境，`userret` 汇编代码恢复用户寄存器，执行 `sret` 指令返回用户态

### 关键步骤分析

**从底层视角看`ecall`做了什么？**

首先是权限级别提升

接下来是硬件自动保存上下文，也就是当CPU执行到`ecall`指令时，CPU的微架构硬件电路会自动完成一系列操作，这些操作由CPU设计固定，不需要软件指令来驱动。硬件只做了六件事：

1. 保存PC到SEPC（`sepc = pc`）
2. 设置原因到SCAUSE（`scause = 8`）
3. 保存模式到SSTATUS.SPP（`sstatus.SPP = mode`）
4. 禁用中断（`sstatus.SIE = 0`）
5. 切换模式到supervisor
6. 跳转到STVEC（`pc = stvec`）

硬件的工作就是这六件事，而操作系统软件需要完成下面这些工作

1. 在uservec.S中手动保存所有寄存器（因为硬件没有保存任何通用寄存器，内核代码需要使用这些寄存器，必须能够恢复用户程序执行）
2. 从trapframe加载内核satp
3. 切换到内核栈
4. 设置正确的执行环境
5. 分发处理不同类型的trap
6. 执行具体的系统调用
7. 处理中断和设备驱动
8. 进程调度检查
9. 准备返回用户空间
10. 恢复上下文
11. 返回用户空间

Why Only 6 Hardware Operations?

The answer is **RISC-V Philosophy: Minimize Hardware Responsibility**

- Hardware only saves: **PC + Cause + Mode**
- Everything else is delegated to software



 **uservec函数做了什么**

首先是获取陷阱帧地址，因为我们需要一个地方去存储31个用户寄存器的值，而且为了方便用户空间取回这些值，这个地址必须在用户页表中可访问（而且必须在内核中已知且固定），具体操作如下

1. 内核在切换到用户空间前设置：sscratch = TRAPFRAME地址
2. 用户程序对此不知情（sscratch是特权寄存器）
3. servec第一条指令通过交换获得这个地址
4. 现在a0指向trapframe，可以开始保存寄存器

接下来，就是保存用户寄存器的值，然后是切换到内核页表，切换到内核栈

值得一提的是，函数中有一句代码`ld t0, 16(a0)` 用于加载usertrap()地址，是为了接下来进入`usertrap`函数



**那么usertrap函数做了什么？**

当用户程序通过`ecall`进入内核后，经过`uservec`汇编代码的上下文保存和环境设置，最终跳转到这个C语言函数进行实际处理。

函数的第一步是**更改STVEC指向内核trap处理代码**，第二步是**获取进程信息**，然后是**保存用户程序计数器**

接着，读取scause判断trap类型，以此判断Trap原因，是系统调用还是外部中断导致的，亦或者是缺页异常导致的？

`usertrap`整个流程可以用下面这个流程图表示

```tex
usertrap入口
    ↓
设置stvec = kernelvec（内核trap处理）
    ↓
获取当前进程指针p = myproc()
    ↓
保存用户PC：p->trapframe->epc = r_sepc()
    ↓
读取scause判断trap类型
    ↓
如果是系统调用（scause == 8）：
    检查进程是否被杀死
    调整用户PC：p->trapframe->epc += 4
    打开中断：intr_on()
    调用syscall()处理
    设置返回值到trapframe->a0
    ↓
再次检查进程状态
    ↓
调用usertrapret准备返回
    ↓
通过userret和sret返回用户空间
```

在这个函数中，最值得关注的是这三个操作

第一个：保存用户PC到trapframe

```c
p->trapframe->epc = r_sepc();
```

第二个：判断陷阱原因，如果判断是系统调用时，调整用户PC，防止无尽循环

```c
p->trapframe->epc += 4; // 跳过ecall指令，防止无尽循环
```

第三个：重启中断（在`uservec`保存完所有寄存器**之后**才打开中断）

```c
intr_on();
```



### 栈帧

**什么是函数调用栈**

一个LIFO结构，每个函数调用都会在栈上分配一块内存区域，用于保存返回地址，保存局部变量，保存寄存器状态

**什么是栈帧**

单个函数调用在栈上占用的内存区域，包含函数的执行上下文，函数调用栈由多个栈帧组成，每个栈帧有固定的结构

**什么是栈指针和帧指针**

栈指针 (sp) → 总是指向当前栈顶（最低地址），函数调用时减，返回时加，定义了当前函数的可用栈空间边界
帧指针 (fp) → 指向当前栈帧的基址

每个栈帧包含的关键信息：

- **返回地址(ra)**: 位于 `fp - 8` 位置
- **上一个帧指针(fp)**: 位于 `fp - 16` 位置
- **当前函数的局部变量**: 位于更低地址



### 本实验中关键的特权寄存器

**STVEC**：陷阱处理程序的入口地址

**SEPC**：保存发生陷阱时的程序计数器

- 如果是ecall：保存ecall指令本身的地址
- 如果是中断：保存下一条未执行的指令地址
- 如果是异常：保存导致异常的指令地址

**SCAUSE**：记录陷阱原因

**SSTATUS**：记录CPU的全局状态和控制标志

**SSCRATCH**：临时存储寄存器，在陷阱处理中作为交换寄存器

如果仅展示寄存器作用不能让人直观感受，下面展示了系统调用流程中这些寄存器的变化，理解这些特权寄存器如何协同工作，是掌握xv6陷阱处理机制的关键

```tex
用户程序：write(fd, buf, size)
    ↓
执行ecall指令
    ↓
硬件自动执行：
    1. sepc = pc (ecall地址)
    2. scause = 8 (用户ecall)
    3. sstatus.SPP = 0 (来自用户模式)
    4. sstatus.SIE = 0 (禁用中断)
    5. 切换到supervisor模式
    6. pc = stvec (跳转到uservec)
    ↓
uservec汇编代码：
    1. csrrw a0, sscratch, a0  # 交换得到trapframe地址
    2. 保存所有寄存器到trapframe
    3. 恢复内核环境
    ↓
usertrap() C函数：
    1. 保存：p->trapframe->epc = r_sepc()
    2. 原因：if(r_scause() == 8) // 系统调用
    3. 调整：p->trapframe->epc += 4 // 跳过ecall
    4. 处理：syscall()
    ↓
usertrapret()准备返回：
    1. 恢复：w_sepc(p->trapframe->epc)
    2. 设置：w_sstatus(...)
    ↓
userret恢复寄存器
    ↓
sret指令返回用户空间：
    1. pc = sepc (从调整后的地址继续)
    2. 模式切换回用户模式
    3. 恢复中断状态
```



## 回溯追踪（中等）

### **实验目标**

本实验的核心目标是在xv6内核中实现一个**调试工具**：当程序出错时，能打印出当前调用栈的函数地址列表。Backtrace就是当程序执行到某个点时，**打印出当前函数调用链。**

### **实验原理**

首先要理解RISCV内存模型，栈帧结构

### 实验步骤

略

## 警报（困难）

### 实验目标

本实验的核心目标是**实现用户级的定时中断处理机制**，允许进程在消耗指定CPU时间后，执行自定义的处理函数。

实验要求实现用户级中断，值得一提的是，传统的中断由内核处理，而用户级中断（本实验中提到的）允许**用户程序**注册处理函数，在特定事件发生时被内核**回调**。这类似于信号机制。

### 实验原理

#### 保存与恢复上下文

当定时器中断发生时，需要完整保存用户程序的执行上下文。最后恢复上下文

不仅要恢复寄存器，还要恢复：

- **程序计数器**：从中断的指令继续
- **栈指针**：保持调用栈完整
- **所有通用寄存器**：确保计算正确性
- **内存状态**：处理函数可能修改了内存

#### 异步与事件驱动

同时我们需要明白以下四个概念解决的问题与体现的系统机制

| 概念               | 解决的问题     | 体现的系统机制           |
| ------------------ | -------------- | ------------------------ |
| **精确状态保存**   | "从哪里中断？" | 上下文切换、检查点、快照 |
| **安全上下文切换** | "谁有权处理？" | 系统调用、中断门、权限位 |
| **防止重入**       | "会不会冲突？" | 锁、信号屏蔽、原子操作   |
| **透明恢复**       | "是否被察觉？" | 虚拟化、抽象层、兼容性   |



#### 中断

需要辨析本实验中的中断与系统调用，硬件中断的区别

1. **硬件中断**：由硬件触发（如定时器、键盘）
   → 内核处理
2. **系统调用**：由程序主动调用
   → 内核处理
3. **本实验的警报**：由内核定时触发
   → **用户自定义的函数**处理
   → 类似"软件中断"



### 实验步骤

**进程结构体修改**

```c
// kernel/proc.h
struct proc {
  // ... 原有字段
    
  // alarm相关字段
  struct trapframe alarm_trapframe;
  int if_alarm_going;           // alarm
  int alarm_ticks;             // ticks passed since last alarm
  int alarm_return;
  int alarm_interval;        	// alarm interval in ticks
  uint64 handler_address;      // address of user-defined handler function
};
```

**按照实验要求添加系统调用**

```c
uint64
sys_sigalarm(void)
{
  int interval;
  uint64 handler;

  // get the arguments
  if((argint(0, &interval) < 0)||
     (argaddr(1, &handler) <0))
   {
    return -1;
   } 

  struct proc* p = myproc();
  p->handler_address = handler;
  p->alarm_ticks = interval;
  p->alarm_interval = interval;
  p->if_alarm_going = 0;
  return 0;
}

uint64
sys_sigreturn(void)
{
  struct proc* p = myproc();
  memmove(p->trapframe,&p->alarm_trapframe, sizeof(struct trapframe));
  p->if_alarm_going = 0;
  p->alarm_ticks = p->alarm_interval;
  printf("sigreturn called\n");
  return 0;
}
```

**编辑`usertrap`函数**

```c
  // give up the CPU if this is a timer interrupt.
  if(which_dev == 2)
  { 
    if (p->alarm_interval)
    {
      p->alarm_ticks--;
      if(!p->if_alarm_going)
      {
       
        if(p->alarm_ticks<=0)
        { 
          p->if_alarm_going = 1;
          memmove(&p->alarm_trapframe, p->trapframe, sizeof(struct trapframe));
          p->trapframe->epc = p->handler_address;
        }
      }
      else
      {
        // do nothing, prevent reentrant alarm
      }
    }
    yield();
    
  }
```



### 思考

本实验遇到了三个问题

第一个是没有考虑上下文保存与恢复的完整性

一开始不知道在哪里保存完整上下文（以为代码或者硬件已经帮我实现好了），只保存了epc（忽略了完整的trapframe）

第二点是不知道防止重入的标志位应该去怎么用，把这个和并发编程中的锁机制混淆了

犯了两种错误：

1. **过早设置**：在 ticks 还没到0时就设置标志 → 死锁
2. **过早清除**：在同一个中断处理中清除标志 → 重入

第三点是赋值错误，主要是trapframe 赋值错误

```c
// 这是错误的：改变trapframe指针本身！
p->trapframe = p->alarm_trapframe;  

// 正确：复制内容
memmove(p->trapframe, &p->alarm_trapframe, sizeof(struct trapframe));
```

