# UCAS Course Sign in

UCAS 课程查询与签到二维码生成工具。

在线访问：[UCAS Course Sign in (Vercel)](https://ucas-sign-in.vercel.app/)

>[!CAUTION]
> **本项目仅供学习交流使用，请勿用于任何商业用途或非法用途。**

本项目用于复现 XXXX 的课程查询与签到链路，帮助用户在网页端完成以下流程：

1. 输入学号、密码和日期，查询当天课程
2. 选择课程，生成可实时刷新的签到二维码
3. 在可签到时间内直接发起签到
4. 手动输入课程 ID 或 UUID，生成对应签到码

## 运行截图

![亮色模式](./doc/img/light-mode.png)

![暗色模式](./doc/img/dark-mode.png)

![课程列表与二维码](./doc/img/course-list-qr.png)

## 快速开始

### 在线访问（推荐）

[UCAS Course Sign in (Vercel)](https://ucas-sign-in.vercel.app/)

### 本地运行

1. 克隆仓库并安装依赖

```bash
git clone https://github.com/lccipher/UCAS-Course-Sign-in
cd UCAS-Course-Sign-in
npm install
```

2. 启动开发环境

```bash
npm run dev
```

默认访问地址：`http://localhost:3000`

3. 生产构建与启动

```bash
npm run build
npm run start
```

4. 代码检查

```bash
npm run lint
```

5. 审计日志测试

```bash
npm test
```

### 部署上线（可选）

推荐使用 Vercel 进行部署，步骤如下：

1. Fork 本仓库到你的 GitHub 账号
2. 在 Vercel 导入项目
3. Framework 自动识别为 Next.js
4. Build Command 使用默认的 `npm run build`
5. 部署完成后访问生成的域名

### 审计日志数据库（Neon）

审计日志将永久记录完整学号、课程信息、操作结果和安全错误码；不会记录密码、`sessionId`、签到链接或二维码内容。日志仅供管理员直接查询数据库。

1. 在 Vercel 项目的 **Storage** 页面通过 Marketplace 连接 **Neon** PostgreSQL。连接完成后，Vercel 会为项目注入 `DATABASE_URL`。
2. 本地开发时，使用 Vercel CLI 拉取环境变量，或自行在终端设置 `DATABASE_URL`：

```bash
vercel env pull .env.local
```

3. 使用该环境变量初始化可重复执行的表和索引：

```bash
node --env-file=.env.local scripts/init-audit-db.mjs
```

线上部署会从 `DATABASE_URL` 自动写入 `audit_events`；未配置数据库时，查询和签到功能不会中断，但不会持久保存审计记录。

管理员可在 Neon SQL Editor 中使用只读查询，例如：

```sql
SELECT created_at, username, action, outcome, course_name, error_code
FROM audit_events
ORDER BY created_at DESC
LIMIT 100;
```

## 工作流程

```text
Browser
	-> POST /api/course-uuid/query
		-> login.action (上游登录)
		-> get_stu_course_sched.action (上游课表)
	<- 返回课程列表（已脱敏整理）
Browser
	-> 选择课程 / 手动输入课程 ID 或 UUID
	-> 本地生成签到 URL + QR Code
	-> POST /api/course-uuid/sign（可选，直接签到）
```

说明：

- 上游 `sessionId` 只在服务端请求链路中短暂使用，不回传前端。
- 前端二维码和下载二维码都由本地生成，不依赖额外前端存储。
- 直接签到时，服务端会先登录，再调用上游签到接口。

## 项目结构

```text
.
├─ src/
│  └─ app/
│     ├─ api/
│     │  └─ course-uuid/
│     │     ├─ query/
│     │     │  └─ route.ts      # 登录 + 课表查询接口
│     │     └─ sign/
│     │        └─ route.ts      # 登录 + 直接签到接口
│     ├─ globals.css            # 全局样式与主题变量
│     ├─ layout.tsx             # 字体、元信息、主题初始化
│     └─ page.tsx               # 主页面（查询、列表、二维码、签到）
├─ public/
├─ doc/
├─ package.json
└─ README.md
```

## API 说明

### POST /api/course-uuid/query

查询课程列表。

请求头：

- `Content-Type: application/json`

请求体：

```json
{
	"username": "2025xxxxxxxxxx",
	"password": "your-password",
	"date": "20260325"
}
```

字段说明：

- `username`：学号，必填
- `password`：密码，必填
- `date`：查询日期，支持 `yyyyMMdd` 或 `yyyy-MM-dd`

成功响应示例：

```json
{
	"date": "20260325",
	"total": 2,
	"courses": [
		{
			"id": "114xxxx",
			"uuid": "CADD27F17ACC44EDAFxxxxxxxxxxxxxx",
			"courseName": "xxxxxxx",
			"teacherName": "xxx",
			"weekDay": "周三",
			"classBeginTime": "2026-03-25 10:25:00",
			"classEndTime": "2026-03-25 12:00:00",
			"signStatus": "1"
		}
	]
}
```

常见错误响应：

```json
{
	"message": "登录接口请求超时",
	"code": "UPSTREAM_LOGIN_TIMEOUT"
}
```

### POST /api/course-uuid/sign

发起直接签到。

请求头：

- `Content-Type: application/json`

请求体：

```json
{
	"username": "2025xxxxxxxxxx",
	"password": "your-password",
	"timeTableId": "CADD27F17ACC44EDAFxxxxxxxxxxxxxx"
}
```

字段说明：

- `username`：学号，必填
- `password`：密码，必填
- `timeTableId`：课程 UUID，必填，必须是 32 位十六进制字符串

成功响应示例：

```json
{
	"success": true,
	"message": "签到成功",
	"upstreamStatus": "0",
	"result": {
		"stuSignId": "123456",
		"stuSignStatus": "1"
	}
}
```

可能的失败响应：

```json
{
	"success": false,
	"message": "签到失败，请稍后重试",
	"upstreamStatus": "1",
	"result": {
		"stuSignId": "123456",
		"stuSignStatus": "0"
	}
}
```

## 错误码与排查

### HTTP 状态码

- `400`：请求体或参数格式错误
- `401`：登录失败（账号密码错误或上游鉴权失败）
- `403`：非同源请求
- `409`：签到请求已提交，但状态未完成
- `415`：Content-Type 不是 JSON
- `429`：触发限流
- `502`：上游接口异常或返回异常
- `504`：上游接口超时
- `500`：服务内部异常

### 常见 `code`

- `RATE_LIMITED`
- `UPSTREAM_LOGIN_HTTP`
- `UPSTREAM_LOGIN_BAD_JSON`
- `UPSTREAM_LOGIN_TIMEOUT`
- `UPSTREAM_LOGIN_NETWORK`
- `UPSTREAM_SCHEDULE_HTTP`
- `UPSTREAM_SCHEDULE_BAD_JSON`
- `UPSTREAM_SCHEDULE_TIMEOUT`
- `UPSTREAM_SCHEDULE_NETWORK`
- `UPSTREAM_SIGN_HTTP`
- `UPSTREAM_SIGN_BAD_JSON`
- `UPSTREAM_SIGN_TIMEOUT`
- `UPSTREAM_SIGN_NETWORK`
- `UNEXPECTED_ERROR`

## 技术栈

### 前端

- Next.js 16.2.1（App Router）
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- next/font（Noto Sans SC / Noto Serif SC / IBM Plex Mono）

### 服务端

- Next.js Route Handler（Node.js runtime）
- 原生 Fetch + AbortController 超时控制
- 内存级限流（5 分钟窗口 + 每日上限）

### 工具链

- ESLint 9 + eslint-config-next
- qrcode 1.5.4（前端二维码生成）

## License

[AGPL-3.0 License](./LICENSE)
