---
title: MIT6.s081 2021 Lab3-Page Table 实验记录
date: 2026-1-3 12:54
categories:
  - 操作系统
tags:
  - 虚拟内存
  - xv6
  - 内存管理
featured: false
---



## 实验一：加速系统调用（简单）

### **实验目标**

通过**用户-内核共享内存页**来加速 `getpid()` 系统调用，避免内核态切换的开销。

### **实验原理**

#### 1.系统调用开销分析

在着手做实验之前，先对之前的实验内容进行回顾：

对于传统系统调用执行流程，当用户进程执行系统调用时

1. 用户态切换到内核态
2. 上下文保存，其中包括保存所有31个通用寄存器到 陷阱帧，切换到内核页表，切换到内核栈
3. 系统调用分发与执行，首先usertrap() 识别系统调用类型，然后`syscall()` 根据系统调用号分发，执行具体的系统调用处理函数，并且设置返回值到陷阱帧的 a0 寄存器
4. 上下文恢复与返回，`usertrapret()` 准备返回环境，`userret` 汇编代码恢复用户寄存器，执行 `sret` 指令返回用户态

实际上，对于 `getpid()` 这类系统调用，仅需读取进程控制块中的字段（纯查询而不修改系统状态），而且可能被库函数或应用程序多次调用。我们可以改进此类方案（也就是实验题目要求）将进程PID等只读信息通过**只读内存映射**暴露给用户空间，使用户程序能够直接读取，规避完整的系统调用流程。

#### 2.共享只读页

在内核中创建包含进程信息的页面，在进程创建时（`allocproc()`），内核分配一个物理页面。

```c
p->usyscall = (struct usyscall *)kalloc();
```

`kalloc()` 从物理内存分配器获取4KB对齐的页面，返回内核虚拟地址，对应唯一的物理帧

#### 3.用户空间映射

选择固定的用户虚拟地址 `USYSCALL`，位于用户地址空间的高端

```c
#define TRAMPOLINE (MAXVA - PGSIZE)      // 最高页：0x3ffffff000
#define TRAPFRAME (TRAMPOLINE - PGSIZE)   // 次高页：0x3fffffe000  
#define USYSCALL (TRAPFRAME - PGSIZE)     // 本次实验要使用的页：0x3fffffd000
```

将该页面映射到用户空间的固定地址（`USYSCALL`），这个地址高于用户栈顶，能避免与用户地址发生冲突。且由于是固定地址，可以在代码里编写用户库函数硬编码访问

#### 4.直接读取

用户程序直接从共享页面读取数据，无需系统调用

```c
uint64 ugetpid(void) {
    struct usyscall *us = (struct usyscall *)USYSCALL;
    return us->pid;
}
```

### 实现步骤

**第一步**：打开`memlayout.h`，理解其中定义的数据

```c
#define TRAMPOLINE (MAXVA - PGSIZE)      // 最高页：0x3ffffff000
#define TRAPFRAME (TRAMPOLINE - PGSIZE)   // 次高页：0x3fffffe000  
#define USYSCALL (TRAPFRAME - PGSIZE)     // 本次实验要使用的页：0x3fffffd000

struct usyscall {
  int pid;  // Process ID
};
```

**第二步**：修改进程结构体，新增：USYSCALL页面指针

```c
struct proc {
  // ... 已有字段
  struct usyscall *usyscall;  // USYSCALL页面指针
};
```

**第三步**：修改`allocproc`函数，在`trapframe`分配之后，`pagetable`创建之前创建

```c
#ifdef LAB_PGTBL
if((p->usyscall = (struct usyscall *)kalloc()) == 0){
    freeproc(p);
    release(&p->lock);
    return 0;
}
p->usyscall->pid = p->pid;
#endif
#ifdef LAB_PGTBL
if((p->usyscall = (struct usyscall *)kalloc()) == 0){
    freeproc(p);
    release(&p->lock);
    return 0;
}
p->usyscall->pid = p->pid;
#endif
```

**第四步**，建立页表映射

首先打开 `kernel/proc.c`，找到 `proc_pagetable()` 函数

```c
pagetable_t
proc_pagetable(struct proc *p)
{
  // ... 已有代码（建立trampoline和trapframe映射）
  
  // 在trapframe映射之后添加：
#ifdef LAB_PGTBL
  // 映射USYSCALL页面（用户只读）
  if(mappages(pagetable, USYSCALL, PGSIZE,
              (uint64)(p->usyscall), PTE_R | PTE_U) < 0){
    // 如果失败，需要清理已建立的映射
    uvmunmap(pagetable, TRAPFRAME, 1, 0);
    uvmunmap(pagetable, TRAMPOLINE, 1, 0);
    uvmfree(pagetable, 0);
    return 0;
  }
#endif
  
  return pagetable;
}
```

> [!IMPORTANT]
>
> 权限标志为 `PTE_R | PTE_U`（用户可读）

**第五步**，在同一个文件中找到 `proc_freepagetable()`，添加USYSCALL映射的清理：

```c
void
proc_freepagetable(pagetable_t pagetable, uint64 sz)
{
  // 移除用户内存映射
  uvmunmap(pagetable, 0, PGROUNDUP(sz)/PGSIZE, 1);
  // 移除TRAMPOLINE映射
  uvmunmap(pagetable, TRAMPOLINE, 1, 0);
  // 移除TRAPFRAME映射
  uvmunmap(pagetable, TRAPFRAME, 1, 0);
  
  // 添加：移除USYSCALL映射
#ifdef LAB_PGTBL
  uvmunmap(pagetable, USYSCALL, 1, 0);
#endif
  
  // 释放页表本身
  freewalk(pagetable);
}
```

**第六步**，在同一个文件中找到 `freeproc()`，释放USYSCALL物理页面：

```c
static void
freeproc(struct proc *p)
{
  if(p->trapframe)
    kfree((void*)p->trapframe);
  p->trapframe = 0;
  
  // 添加：释放USYSCALL页面
#ifdef LAB_PGTBL
  if(p->usyscall)
    kfree((void*)p->usyscall);
  p->usyscall = 0;
#endif
  
  if(p->pagetable)
    proc_freepagetable(p->pagetable, p->sz);
  p->pagetable = 0;
  
  // ... 其他清理代码
}
```

这样看来，本实验中与函数代码相关的修改遵循着“有借有还”的原则——

```tex
分配内存 (allocproc)
   ↓        对应
释放内存 (freeproc)

建立映射 (proc_pagetable)
   ↓        对应  
移除映射 (proc_freepagetable)
```

### 思考

#### 1.Linux中有类似于USYSCALL的设计吗？

答案是有的，Linux不仅实现了类似USYSCALL的功能，还将其发展成了一个**完整的虚拟动态共享对象（VDSO）框架**。

Linux最初引入的vsyscall机制与xv6的USYSCALL高度相似：

- **固定地址映射**：`0xffffffffff600000`作为所有进程共享的系统调用页
- **静态内容**：包含`gettimeofday`、`time`等少数几个常用系统调用
- **直接访问**：用户程序通过固定地址直接调用或读取数据

尽管vsyscall带来了性能提升，但暴露出严重问题：

1. 由于所有进程的 vsyscall 页面都映射到完全相同的虚拟地址，攻击者可以轻易预测关键代码的位置，为面向返回编程等攻击技术提供了便利。
2. 每个系统调用无论实际需要多少存储空间，都会独占一个完整的物理页面，通常为 4KB，而实际代码往往只有几十字节，这种粗粒度的内存管理导致了严重的空间浪费。
3. vsyscall 的内容在内核编译时便已静态确定，无法在运行时根据不同的 CPU 特性提供优化版本，也无法灵活适应各种硬件架构的差异，这限制了其优化潜力和适用范围。

vDSO彻底解决了vsyscall的地址固定问题：

首先，vDSO 从根本上改变了共享页面的映射方式，它不再使用固定地址，而是借助**地址空间布局随机化技术**，为每个进程独立分配随机的加载地址。这种随机化使得攻击者无法预先得知目标代码的位置，有效增强了系统的安全性。

其次，vDSO 被设计为一个标准的 ELF 格式动态共享对象，它能够像普通共享库一样参与系统的动态链接过程，从而实现了真正的动态性与灵活性。

与此同时，vDSO 可以根据运行时的 CPU 特性提供最优的实现版本，并且支持以模块化的方式扩展新的加速系统调用

#### 2.还有哪些 xv6 系统调用可以通过这个共享页面加速？请解释如何实现（题目中的思考题）

1. **getppid()** - 父进程ID
2. **getuid()/getgid()** - 用户身份
3. **uptime()** - 系统启动时间
4. **uname()** - 系统信息

#### 3.为什么物理页面的生命周期与页表映射的生命周期是分离的

**一是实现共享**。同一物理页可被多个进程映射，如共享库、进程间通信。物理页需独立于任一进程的映射而存在。

**二是支持高级功能**。写时复制（COW）在fork时共享物理页，写入时才复制并更新映射。内存映射文件让文件缓存页被多进程共享。这些都需要映射可独立变更。

**三是优化管理**。操作系统可独立管理物理资源：按需调页延迟建立映射，页面缓存保留已释放映射的物理页，内存回收时只解除映射不立即释放物理页。

这样设计的本质是**解耦**：物理页是硬件资源，映射是进程视图。分离后，操作系统能灵活调度物理内存，同时为进程提供一致的虚拟地址空间。



## 实验二：打印页表（简单）

### **实验目标**

实现一个函数 `vmprint()`，用于可视化 RISC-V 页表的内容。该函数将页表以层级结构的形式打印出来，帮助理解和调试页表结构。

### **实验原理**

#### 1. RISC-V 页表结构

RISC-V 采用三级页表结构（Sv39），将 64 位虚拟地址映射到 56 位物理地址：

```
虚拟地址：| VPN[2] (9 bits) | VPN[1] (9 bits) | VPN[0] (9 bits) | offset (12 bits) |
页表查找：顶级页表 → 二级页表 → 三级页表 → 物理页
```

每个页表页包含 512 个页表项（PTE），每个 PTE 8 字节。有效 PTE 的低位包含这些权限标志：

- `PTE_V`：有效位
- `PTE_R`：可读
- `PTE_W`：可写
- `PTE_X`：可执行
- `PTE_U`：用户可访问

#### 2.页表项标志位

| 字母  | 全称                             | 位值      | 含义             |
| ----- | -------------------------------- | --------- | ---------------- |
| **V** | **Valid** (有效位)               | `1L << 0` | PTE是否有效      |
| **R** | **Readable** (可读)              | `1L << 1` | 页面是否可读     |
| **W** | **Writable** (可写)              | `1L << 2` | 页面是否可写     |
| **X** | **eXecutable** (可执行)          | `1L << 3` | 页面是否可执行   |
| **U** | **User-accessible** (用户可访问) | `1L << 4` | 用户模式能否访问 |

### **实现步骤**

太简单了直接贴代码，但是个人认为这个代码结果虽然能通过，但是逻辑冗余且硬编码，只处理了三级页表，如果页表层级变化就需要重写，后面回过头来再改一下吧

```c
void vmprint(pagetable_t pagetable) // pagetable is a pointer to the page table
{
  printf("page table %p\n", pagetable);
  for(int i=0;i<512;i++)
  {
     pte_t pte_L2 = pagetable[i];
     if((pte_L2 & PTE_V) && (pte_L2 & (PTE_R|PTE_W|PTE_X)) == 0)
     {
        uint64* child = (uint64*)PTE2PA(pte_L2);
        printf("..%d: pte %p pa %p\n",i,pte_L2,child);
        for (int j = 0; j < 512; j++)
        {
          pte_t pte_L1 = child[j];
          if((pte_L1& PTE_V) && (pte_L1 & (PTE_R|PTE_W|PTE_X)) == 0)
          {
              uint64* child_ = (uint64*)PTE2PA(pte_L1);
              printf(".. ..%d: pte %p pa %p\n",j,pte_L1,child_);
              for (int k = 0; k < 512; k++)
              {
                pte_t pte_L0 = child_[k];
                if((pte_L0& PTE_V))
                {
                  uint64* child__ = (uint64*)PTE2PA(pte_L0);
                  printf(".. .. ..%d: pte %p pa %p\n",k,pte_L0,child__);
                }

              }

          }
        }
       
     }
  }

}
```



### 思考

个人认为在题目一完成后，题目二的实现是非常简单的

只是在最后一层循环时遇到了问题

```c
if((pte_L0& PTE_V))
                {
                  uint64* child__ = (uint64*)PTE2PA(pte_L0);
                  printf(".. .. ..%d: pte %p pa %p\n",k,pte_L0,child__);
                }
```

为什么最后一个循环不需要判断(PTE_R|PTE_W|PTE_X) == 0？

因为L0（第三级）页表直接包含叶子PTE（**叶子PTE是页表中直接指向用户数据/代码页面的页表项，是地址转换的"终点站"。**），这些PTE必须有R/W/X标志位才能被用户访问。如果L0的PTE没有R/W/X，那么它要么无效（PTE_V=0），要么是错误的页表结构。

而且硬件要求用户页面必须有R/W/X才能访问，因此：正常的L0 PTE一定有R/W/X，所以不需要额外检查，检查PTE_V就够了



## 实验三：检测已访问的页面（困难）

### **实验目标**：

实现一个系统调用 `pgaccess()`，用于检测用户页面是否被访问过。RISC-V 硬件页表遍历器在解析 TLB 缺失时会自动设置页表项中的访问位（PTE_A）。本实验需要利用这一硬件特性，向用户空间报告哪些页面曾被访问。

### **实验原理**：

#### 1. RISC-V 页表访问位机制

RISC-V 页表项（PTE）包含两个重要的状态位：

- **PTE_A (Access bit)**：访问位，指示页面是否被访问过（读/写/取指）
- **PTE_D (Dirty bit)**：脏位，指示页面是否被修改过

#### 2. 系统调用接口设计

`pgaccess()` 系统调用需要三个参数：

1. **起始虚拟地址**：要检查的第一个用户页面的虚拟地址
2. **页面数量**：需要检查的连续页面数
3. **结果缓冲区**：用户空间地址，用于存储位掩码结果

**位掩码格式**：每个页面对应一个比特位，第一个页面对应最低有效位（LSB）。

例如，检查3个页面：

- 页面0被访问 → 位掩码第0位 = 1
- 页面1未访问 → 位掩码第1位 = 0
- 页面2被访问 → 位掩码第2位 = 1
  结果位掩码：二进制 `101` = 十进制 `5`

#### 3. 内核-用户空间数据交换

使用 `copyout()` 函数安全地将内核数据拷贝到用户空间：

```c
int copyout(pagetable_t pagetable, uint64 dstva, char *src, uint64 len);
```

- **关键点**：内核不能直接解引用用户虚拟地址
- **解决方法**：通过页表翻译，找到对应的物理地址再拷贝

### **实现步骤**

**第一步：定义 PTE_A 访问位**

在 `kernel/riscv.h` 中添加定义（根据 RISC-V 手册，PTE_A 是第 6 位）：

```c
#define PTE_A (1L << 6)  // 访问位
```

**第二步：添加系统调用框架**