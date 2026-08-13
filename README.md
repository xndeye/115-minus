# 115-

面向 115 网盘 Web 端的轻量用户脚本，专注下载、离线任务与界面体验。

## 功能

- 直链下载，支持浏览器/aria2/IDM
- 简化界面，提升使用体验

## 构建

需要 Node.js 24 和 pnpm 10。

```bash
pnpm install --frozen-lockfile
pnpm build
```

构建产物位于 `dist/115-minus.user.js`，使用用户脚本管理器安装即可。

## 致谢

本项目基于 [lvzhenbo/115-plus](https://github.com/lvzhenbo/115-plus) 修改。

文件下载直链方案参考 [kkHAIKE/fake115](https://github.com/kkHAIKE/fake115)。

IDM Integration Module 本地协议实现参考 [hmjz100/LinkSwift](https://github.com/hmjz100/LinkSwift)。

## 许可证

[MIT](./LICENSE)
