# 零点环线 · 私人版

一列每天回到零点小站的列车，经过微缩景观，让人安静地看风景。时间决定旅程进度，界面以观景为主。

**线上地址：** <https://colorful-white.github.io/midnight-railway/>

项目支持电脑浏览器、手机横竖屏、添加到主屏幕和首次联网准备后的离线观景。当前使用原生 HTML、CSS、JavaScript 和 WebGL 1，没有应用框架、服务端或运行时 npm 依赖。

“私人版”指独立的朋友定制版本。网站和仓库公开，页面有 `noindex, nofollow`，没有登录或口令；不在个人主页设置入口。另有保留的原版，本仓库不默认向原版同步修改。

## 从这里接手

| 文档 | 用途 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 给后续编程助手的持久工作约定 |
| [docs/HANDOFF.md](docs/HANDOFF.md) | 当前实现、版本依据、验证边界、新聊天开场提示 |
| [docs/PRODUCT.md](docs/PRODUCT.md) | 世界设定、配色、交互和已经确定的体验 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 实际代码结构、耦合点和后续框架规划 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 构建、预览、针对性检查、发布和回退 |

建议下一位维护者按表格顺序阅读。继续使用同一仓库即可，不需要为模型升级重新创建应用。

## 构建与预览

需要 Node.js；CI 使用 Node.js 24。核对环境后在仓库根目录运行：

```powershell
node --version
node build.mjs
```

构建输出是 `dist/`。用本地 HTTP 静态服务打开它；例如已安装 Python 3 时：

```powershell
py -3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

打开 <http://127.0.0.1:4173/>。Python 只是可选的预览工具，不是项目依赖；也可使用现有的其他静态服务器。详细检查方法见 [开发发布说明](docs/DEVELOPMENT.md)。

## 快速观景

左下角菜单 → **时段体验 → 薄荷海**，直接体验每天 **22:42** 的海底观景段，再选择车窗或俯视。

旧版用户可以在菜单里检查更新，等新版准备好后点击更新。主屏幕图标若仍是旧图，可从浏览器重新添加。
