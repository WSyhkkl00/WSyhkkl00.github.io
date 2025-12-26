---
title: Freertos源码学习日志
date: 2024-11-24
tags:
    - 操作系统
    - 嵌入式原理
Categories: 操作系统
---
# FreeRTOS源码学习日志
## 静态分配和动态分配

### 静态分配

用户在**编译期或初始化时**提供任务堆栈和任务控制块（TCB）的内存，FreeRTOS 不会动态分配。

**优点：**

1. 实时性高：无运行时内存分配的延迟。
2. 无碎片风险：内存固定分配，不会产生碎片化问题。
3. 高可靠性：避免动态分配中可能的内存不足风险。

**缺点：**

1. 灵活性差：任务数量和大小在编译期必须确定。
2. 潜在浪费：未使用的固定内存无法回收。

### 动态分配

内存由Freerots管理，用户**无需手动管理内存分配**，调用 xTaskCreate() 时 ，通过 FreeRTOS 的堆管理器（如 pvPortMalloc），在运行时分配任务堆栈和 TCB 的内存。

**优点：**

灵活性高：可根据运行时需求动态调整任务数量和内存使用。

**缺点：**

1. 存在碎片化风险：堆内存释放后可能产生碎片。
2. 存在分配失败的风险：堆内存不足会导致任务创建失败。
3. 实时性较低：分配内存的时间不可控。

### 问题

**问题一：动态分配和静态分配的任务堆栈管理上，为什么静态分配不存在内存碎片的风险？**

**1.固定的内存规划**：

- 静态分配完全由用户在编译期或初始化时提供内存，堆栈和任务控制块的大小是固定的。
- 由于内存不会被频繁分配和释放，因此不会出现内存碎片化的问题。

**2.无动态管理**：

- 静态分配不使用堆内存（heap）或 `pvPortMalloc` 进行内存分配，因此避免了动态分配中的碎片化问题。

**问题二：如果系统仅启用了静态分配，但没有动态分配支持，会对系统的任务管理造成哪些限制？**

所有任务、队列、信号量等内核对象必须通过静态分配方式创建。
系统无法使用动态分配，即无法调用 `xTaskCreate` 等依赖堆内存的 API。

这样会导致：

- **任务数量固定：**

​	所有任务的堆栈和控制块必须在编译期或初始化时分配，无法根据运行时需求增加任务数量。

- **内存需求不可变：**

​	每个任务的堆栈大小和控制块的大小必须在静态分配时固定，运行时无法调整内存需求。

- **无法动态调整任务：**

​	动态分配允许根据任务运行时的需求创建和销毁任务，而静态分配不支持运行时的灵活调整。

- **需用户手动管理内存：**

​	用户需要为每个任务提供专用的堆栈和控制块，增加了内存规划的复杂性。

### 相关宏定义

`configSUPPORT_STATIC_ALLOCATION` / `configSUPPORT_DYNAMIC_ALLOCATION` 

① config表示这是在 `FreeRTOSConfig.h` 文件中定义，控制 FreeRTOS 的功能启用与否

② SUPPORT表明该配置宏是用来**决定是否支持某种功能**，而不是直接实现功能

③ STATIC（DYNAMIC）_ALLOCATION强调此选项是控制是否支持静态（动态）内存分配的开关

在 FreeRTOS 中，`configSUPPORT_STATIC_ALLOCATION` 是一个配置选项，用于启用或禁用静态任务和队列的创建方式。静态分配是 FreeRTOS 提供的内存分配方式之一，与动态分配方式（依赖堆分配）相对。

**取值：0 或 1**
0：禁用静态分配，所有任务、队列等对象必须通过动态分配方式创建。
1：启用静态分配，允许使用静态分配方式创建任务、队列等对象。

与 `configSUPPORT_DYNAMIC_ALLOCATION` 的关系：

`configSUPPORT_STATIC_ALLOCATION` 和 `configSUPPORT_DYNAMIC_ALLOCATION` 可以同时设置为 `1`，以支持静态和动态分配。

如果两者均为 `0`，任务或对象无法创建，系统将无法运行。

### 部分代码

**静态分配方式**

```c
#include "FreeRTOS.h"
#include "task.h"

// 静态分配的任务堆栈和任务控制块
static StackType_t xTaskStack[configMINIMAL_STACK_SIZE];//#define configMINIMAL_STACK_SIZE  ((uint16_t)128)
static StaticTask_t xTaskBuffer;

void vTaskFunction(void *pvParameters)
{
    for (;;)
    {
        // 任务逻辑
    }
}

void main(void)
{
    // 创建任务（静态分配）
    TaskHandle_t xTaskHandle = xTaskCreateStatic(
        vTaskFunction,             // 任务函数
        "TaskName",                // 任务名称
        configMINIMAL_STACK_SIZE,  // 堆栈大小
        NULL,                      // 任务参数
        tskIDLE_PRIORITY,          // 优先级
        xTaskStack,                // 用户提供的堆栈
        &xTaskBuffer               // 用户提供的控制块
    );

    // 启动调度器
    vTaskStartScheduler();

}
```

**动态分配方式**

```c
#include "FreeRTOS.h"
#include "task.h"

void vTaskFunction(void *pvParameters)
{
    for (;;)
    {
        // 任务逻辑
    }
}

void main(void)
{
    // 创建任务（动态分配）
    TaskHandle_t xTaskHandle = NULL;
    xTaskCreate(
        vTaskFunction,             // 任务函数
        "TaskName",                // 任务名称
        configMINIMAL_STACK_SIZE,  // 堆栈大小
        NULL,                      // 任务参数
        tskIDLE_PRIORITY,          // 优先级
        &xTaskHandle               // 任务句柄
    );

    // 启动调度器
    vTaskStartScheduler();

}
```



### `os_thread_def`结构体作用

```c
  osThreadDef(LED_RED, red_led_task, osPriorityNormal, 0, 128);		//osPriorityNormal 是 0
  LED_REDHandle = osThreadCreate(osThread(LED_RED), NULL);

	const osThreadDef_t os_thread_def_##name = \
{ #name, (thread), (priority), (instances), (stacksz), NULL, NULL }
```

`osThreadDef`用于定义线程属性，

`name`线程名，用于生成一个唯一标识符变量，在这里是LED_RED，该名称只是用于标识，便于代码管理

`thread`线程的入口函数名称，当线程启动时，系统会调用该函数

`priority`，这里是默认优先级0

`instances`，允许的线程实例数，这里是0

`stacksz`，定义线程运行所需的堆栈空间大小，单位是字节



```c
typedef struct os_thread_def {
  char                   *name;        //线程名
  os_pthread             pthread;      //指向线程入口函数的函数指针
  osPriority             tpriority;    //< Initial thread priority
  uint32_t               instances;    //< Maximum number of instances of that thread function
  uint32_t               stacksize;    //< Stack size requirements in bytes; 0 is default stack size
#if( configSUPPORT_STATIC_ALLOCATION == 1 )
  uint32_t               *buffer;      //指向一个静态分配的堆栈缓冲区 NULL for dynamic allocation
 osStaticThreadDef_t *controlblock;	   //指向一个静态分配控制块，用于存储线程运行状态信息NULL for dynamic allocation
#endif
} osThreadDef_t;
```

```c
typedef void (*os_pthread) (void const *argument);
```

os_pthread 定义一个函数指针A,那么这个A可以指向任何符合 void 函数(void const *argument) 形式的函数

假设这个A指向的函数是B，那么B的返回值是void，参数是任意类型的const修饰的变量

#### 补充：

**什么是函数指针？**

函数的本质：我们平时写的函数，本质上在内存中占用了一块区域，存储了它的指令代码。函数名其实是这个代码区域的入口地址。

```c
#include <stdio.h>

// 定义一个简单函数
void sayHello() {
    printf("Hello, world!\n");
}

int main() {
    // 直接调用函数
    sayHello(); // 输出：Hello, world!
    return 0;
}
```

函数 sayHello 存储在内存中某个位置。
sayHello() 是在调用函数，实际上是跳到这个内存地址去执行代码。
函数指针就是用来保存函数的地址的。通过函数指针，你可以动态决定要调用哪个函数

函数指针的写法

```c
返回值类型 (*指针名)(参数列表);
```








