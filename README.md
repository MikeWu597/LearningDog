# 🐕 LearningDog - 在线自习室

互相监督的在线学习平台，支持摄像头共享、屏幕共享和控件共享。

## 项目结构

| 项目 | 路径 | 技术栈 |
|---|---|---|
| 服务端 | `LearningDog/` | Node.js + Express + SQLite (better-sqlite3) + Socket.IO |
| PC客户端 | `LearningDog_PC/` | Electron + React + Ant Design + WebRTC |
| iOS客户端 | `LearningDog_iOS/` | Capacitor + React + Ant Design Mobile + WebRTC |
| Android客户端 | `LearningDog_Android/` | Capacitor + React + Ant Design Mobile + WebRTC |

## 功能说明

### 摄像头共享（全平台）
- 调用设备摄像头上传视频流，分发给自习室内所有用户
- 客户端压缩 + 降帧（移动端 360p/10fps，PC端 480p/12fps）
- WebRTC Mesh P2P 传输，服务端仅做信令中转

### 屏幕共享（仅 PC）
- 支持 Electron desktopCapturer 和浏览器 getDisplayMedia
- 可选高斯模糊（Canvas filter `blur()` 实现）
- 1280px/10fps 压缩

### 控件共享（全平台）
- **Emoji 控件**：在用户画面上显示 emoji，16 种学习相关 emoji 可选
- **时钟控件**：正计时/倒计时，可暂停、重置
- 所有控件以元数据分发，客户端渲染

### 画面布局
- 自动适配 2/4/9 宫格
- 左下角显示用户名，右下角显示网络状态（红黄绿圆点）

### 身份认证
- 客户端生成 UUID，用户可自定义/查看/复制
- 服务端无鉴权，UUID + 用户名即可登录
- 重装后输入原 UUID 可恢复账户

### 服务器配置
- 用户首次启动需输入服务器域名（如 `https://example.com`）
- 登录页显示当前连接延迟
- 可随时退出当前域，切换服务器

### 学习记录
- 日历热度图展示每日专注时间（90天/365天）
- 统计卡片：总时长、平均时长、连续天数
- 专注详细日志
- 海报导出功能（生成 PNG 图片，包含用户名、日期、专注时长）

## 启动方式

### 服务端
```bash
cd LearningDog
npm install
node src/index.js
# 默认监听 http://0.0.0.0:3000
# PowerShell 自定义启动:
# $env:HOST="0.0.0.0"; $env:PORT="3000"; node src/index.js
```

### PC 客户端（开发模式）
```bash
cd LearningDog_PC
npm install
npm run electron:dev
```

### PC 客户端（构建）
```bash
cd LearningDog_PC
npm run electron:build
```

### iOS 客户端
```bash
cd LearningDog_iOS
npm install
npm run dev          # 浏览器开发
npx cap sync ios     # 同步到 Xcode
npx cap open ios     # 打开 Xcode
```

### Android 客户端
```bash
cd LearningDog_Android
npm install
npm run dev          # 浏览器开发
npx cap sync android # 同步到 Android Studio
npx cap open android # 打开 Android Studio
```

## 架构设计

```
客户端 ←→ Socket.IO ←→ 服务端（信令）
客户端 ←→ WebRTC P2P ←→ 客户端（音视频流）
客户端 → HTTP API → 服务端（登录、房间管理、学习记录）
```

- **WebRTC Mesh 拓扑**：每个用户与房间内其他用户建立 P2P 连接，适合 2-9 人小型自习室
- **信令服务器**：通过 Socket.IO 交换 SDP offer/answer 和 ICE candidates
- **控件元数据**：通过 Socket.IO 广播，不编码进视频流

## 技术选型

| 组件 | 选型 |
|---|---|
| 服务端运行时 | Node.js |
| HTTP 框架 | Express |
| 数据库 | SQLite (better-sqlite3) |
| 实时通信 | Socket.IO |
| 流媒体 | WebRTC (Mesh P2P) |
| PC 客户端框架 | Electron |
| PC UI 库 | Ant Design |
| 移动端 UI 库 | Ant Design Mobile |
| 移动端打包 | Capacitor |
| 前端构建 | Vite + React |
