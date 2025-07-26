# koishi-plugin-markdown-to-image-service

[![npm](https://img.shields.io/npm/v/koishi-plugin-markdown-to-image-service?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-markdown-to-image-service)

## 简介

Koishi 的 Markdown 转图片服务插件。支持 LaTeX、Mermaid、代码高亮等丰富的 Markdown 语法。

> **版本说明**
> 
> 本插件是 [araea/koishi-plugin-markdown-to-image-service](https://github.com/araea/koishi-plugin-markdown-to-image-service) 的一个分叉版本。
> 
> 在原插件的强大功能基础上，本版本进行了修改和增强，主要增加了以下功能。

## 新增功能

* **文件直接上传渲染**: 无需使用指令，在聊天中向机器人**直接发送 `.md` 文件**即可自动触发渲染并返回图片。
* **强大的兼容性**: 内置了对 `NapCat` 适配器的特殊文件处理逻辑，使其能够正确接收和处理上传的文件。
* **专为 Docker/WSL 设计的路径映射**: 通过简单的配置，完美解决 Koishi 与 OneBot 客户端（如 NapCat）在不同环境（例如 Windows 主机 + Docker 容器）下部署时的文件路径不匹配问题。

## 使用方式

1.  **直接上传文件 (推荐)**: 在任意聊天窗口向机器人发送一个 `.md` 文件。
2.  **使用指令**: 在聊天中发送 `markdown <你的MD文本>` 来转换纯文本内容。

## 插件配置

除了原有的多种渲染和主题配置外，本插件特别增加了以下用于处理文件上传的配置项：

### 跨环境路径映射设置 (Docker/WSL 用户必读)

如果您的 Koishi 和 OneBot 客户端（如 NapCat）不在同一个操作系统环境，您**必须**配置此项。

* `containerPathPrefix`
    * **作用**: OneBot 客户端（NapCat）所在的容器或环境提供的文件路径前缀。
    * **示例**: 根据我们的调试日志，您这里应填 `/app/.config/QQ/NapCat/temp`

* `hostPathPrefix`
    * **作用**: 与上述容器内路径相对应的、Koishi 所在主机或容器可以访问的路径前缀。
    * **示例**: `D:\koishi-data\napcat-files` (请确保此路径已通过 Docker/WSL 的数据卷正确挂载)

## 致谢

- [Koishi](https://koishi.chat/) - 机器人框架
- [crossnote](https://github.com/shd101wyy/crossnote) - Markdown 渲染引擎

## License

MIT License © 2024
