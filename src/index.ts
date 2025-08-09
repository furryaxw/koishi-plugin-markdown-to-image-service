import {Context, h, Schema, Service} from 'koishi'
import {} from 'koishi-plugin-puppeteer'

import * as fs from "fs";
import path from "node:path";
import {promisify} from 'util';
import {Notebook} from "crossnote"
import find from 'puppeteer-finder';

const MIME_TYPES: { [key: string]: string } = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export const inject = {
  required: ['puppeteer'],
}
export const name = 'markdown-to-image-service'
export const usage = `## 使用方式

1.  **直接上传文件**: 在聊天中直接发送一个 \`.md\` 文件，机器人会自动将其转换为图片。
2.  **使用指令**: 输入 \`markdown <你的MD文本>\` 来转换纯文本内容。

---
### Docker/WSL 用户（重要！）
如果您的 Koishi 和 OneBot 实现（如 NapCat）在不同的 Docker 容器中，您 **必须** 配置“跨环境路径映射设置”，否则**无法处理上传的文件**。

- **容器内路径前缀**: 填入 NapCat 返回的路径前缀，例如 \`/app/.config/QQ/NapCat/temp\`
- **主机/Koishi容器路径前缀**: 填入与上述路径对应的、Koishi 可以访问的路径，例如 \`/koishi/data/shared_files\`
`

export interface Config {
  width: number;
  height: number;
  deviceScaleFactor: number;
  waitUntil: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  timeout: number;
  enableAutoCacheClear: boolean
  enableRunAllCodeChunks: boolean;
  defaultImageFormat: "png" | "jpeg" | "webp";
  mermaidTheme: 'default' | 'dark' | 'forest';
  codeBlockTheme: "auto.css" | "default.css" | "atom-dark.css" | "atom-light.css" | "atom-material.css" | "coy.css" | "darcula.css" | "dark.css" | "funky.css" | "github.css" | "github-dark.css" | "hopscotch.css" | "monokai.css" | "okaidia.css" | "one-dark.css" | "one-light.css" | "pen-paper-coffee.css" | "pojoaque.css" | "solarized-dark.css" | "solarized-light.css" | "twilight.css" | "vue.css" | "vs.css" | "xonokai.css";
  previewTheme: "atom-dark.css" | "atom-light.css" | "atom-material.css" | "github-dark.css" | "github-light.css" | "gothic.css" | "medium.css" | "monokai.css" | "newsprint.css" | "night.css" | "none.css" | "one-dark.css" | "one-light.css" | "solarized-dark.css" | "solarized-light.css" | "vue.css";
  revealjsTheme: "beige.css" | "black.css" | "blood.css" | "league.css" | "moon.css" | "night.css" | "serif.css" | "simple.css" | "sky.css" | "solarized.css" | "white.css" | "none.css";
  breakOnSingleNewLine: boolean;
  enableLinkify: boolean;
  enableWikiLinkSyntax: boolean;
  enableEmojiSyntax: boolean;
  enableExtendedTableSyntax: boolean;
  enableCriticMarkupSyntax: boolean;
  frontMatterRenderingOption: 'none' | 'table' | 'code';
  enableScriptExecution: boolean;
  enableHTML5Embed: boolean;
  HTML5EmbedUseImageSyntax: boolean;
  HTML5EmbedUseLinkSyntax: boolean;
  HTML5EmbedIsAllowedHttp: boolean;
  HTML5EmbedAudioAttributes: string;
  HTML5EmbedVideoAttributes: string;
  mathRenderingOption: "KaTeX" | "MathJax" | "None";
  mathInlineDelimiters: [string, string][];
  mathBlockDelimiters: [string, string][];
  mathRenderingOnlineService: string;
  mathjaxV3ScriptSrc: string;
  enableOffline: boolean;
  printBackground: boolean;
  chromePath: string;
  puppeteerArgs: string[];
  protocolsWhiteList: string;
  containerPathPrefix?: string;
  hostPathPrefix?: string;
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    width: Schema.number().default(800).description(`视图宽度。`),
    height: Schema.number().default(100).description(`视图高度。`),
    deviceScaleFactor: Schema.number().default(1).description(`设备的缩放比率。`),
    enableAutoCacheClear: Schema.boolean().default(true).description('是否启动自动删除缓存功能。此项控制插件自身生成的临时文件。'),
    defaultImageFormat: Schema.union(['png', 'jpeg', 'webp']).default('jpeg').description('文本转图片时默认渲染的图片格式。'),
    waitUntil: Schema.union(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).default('load').description('指定页面何时认为导航完成。如果渲染复杂图表时超时，可尝试切换为 `load`。'),
    timeout: Schema.number().default(60000).description('Puppeteer 页面渲染超时时间（毫秒）。如果渲染复杂内容时卡死或报错，请尝试增加此值。'),
    enableRunAllCodeChunks: Schema.boolean().default(false).description('文本转图片时是否执行代码块里的代码。'),
  }).description('基础设置'),
  Schema.object({
    mermaidTheme: Schema.union(['default', 'dark', 'forest']).default('default').description('Mermaid 主题。'),
    codeBlockTheme: Schema.union(['auto.css','default.css','atom-dark.css','atom-light.css','atom-material.css','coy.css','darcula.css','dark.css','funky.css','github.css','github-dark.css','hopscotch.css','monokai.css','okaidia.css','one-dark.css','one-light.css','pen-paper-coffee.css','pojoaque.css','solarized-dark.css','solarized-light.css','twilight.css','vue.css','vs.css','xonokai.css']).default('auto.css').description('代码块主题。如果选择 `auto.css`，那么将选择与当前预览主题最匹配的代码块主题。'),
    previewTheme: Schema.union(['atom-dark.css','atom-light.css','atom-material.css','github-dark.css','github-light.css','gothic.css','medium.css','monokai.css','newsprint.css','night.css','none.css','one-dark.css','one-light.css','solarized-dark.css','solarized-light.css','vue.css']).default('github-light.css').description('预览主题。'),
    revealjsTheme: Schema.union(['beige.css','black.css','blood.css','league.css','moon.css','night.css','serif.css','simple.css','sky.css','solarized.css','white.css','none.css',]).default('white.css').description('Revealjs 演示主题。')
  }).description('主题相关设置'),
  Schema.object({
    breakOnSingleNewLine: Schema.boolean().default(true).description('在 Markdown 中，单个换行符不会在生成的 HTML 中导致换行。在 GitHub Flavored Markdown 中，情况并非如此。启用此配置选项以在渲染的 HTML 中为 Markdown 源中的单个换行符插入换行。'),
    enableLinkify: Schema.boolean().default(true).description('启用将类似 URL 的文本转换为 Markdown 预览中的链接。'),
    enableWikiLinkSyntax: Schema.boolean().default(true).description('启用 Wiki 链接语法支持。更多信息可以在 https://help.github.com/articles/adding-links-to-wikis/ 找到。如果选中，我们将使用 GitHub 风格的管道式 Wiki 链接，即 [[linkText|wikiLink]]。否则，我们将使用 [[wikiLink|linkText]] 作为原始 Wikipedia 风格。'),
    enableEmojiSyntax: Schema.boolean().default(true).description('启用 emoji 和 font-awesome 插件。这仅适用于 markdown-it 解析器，而不适用于 pandoc 解析器。'),
    enableExtendedTableSyntax: Schema.boolean().default(false).description('启用扩展表格语法以支持合并表格单元格。'),
    enableCriticMarkupSyntax: Schema.boolean().default(false).description('启用 CriticMarkup 语法。仅适用于 markdown-it 解析器。'),
    frontMatterRenderingOption: Schema.union(['none', 'table', 'code']).default('none').description('Front matter 渲染选项。'),
    enableScriptExecution: Schema.boolean().default(false).description('启用执行代码块和导入 javascript 文件。这也启用了侧边栏目录。⚠ ️ 请谨慎使用此功能，因为它可能会使您的安全受到威胁！如果在启用脚本执行的情况下，有人让您打开带有恶意代码的 markdown，您的计算机可能会被黑客攻击。'),
    enableHTML5Embed: Schema.boolean().default(false).description('启用将音频视频链接转换为 html5 嵌入音频视频标签。内部启用了 markdown-it-html5-embed 插件。'),
    HTML5EmbedUseImageSyntax: Schema.boolean().default(true).description(`使用 ! [] () 语法启用视频/音频嵌入（默认）。`),
    HTML5EmbedUseLinkSyntax: Schema.boolean().default(false).description('使用 [] () 语法启用视频/音频嵌入。'),
    HTML5EmbedIsAllowedHttp: Schema.boolean().default(false).description('当 URL 中有 http:// 协议时嵌入媒体。当为 false 时忽略并且不嵌入它们。'),
    HTML5EmbedAudioAttributes: Schema.string().default('controls preload="metadata" width="320"').description('传递给音频标签的 HTML 属性。'),
    HTML5EmbedVideoAttributes: Schema.string().default('controls preload="metadata" width="320" height="240"').description('传递给视频标签的 HTML 属性。'),
  }).description('Markdown 解析相关设置'),
  Schema.object({
    mathRenderingOption: Schema.union(['KaTeX', 'MathJax', 'None']).default('KaTeX').description('数学渲染引擎。'),
    mathInlineDelimiters: Schema.array(Schema.array(String)).collapse().default([["$", "$"], ["\\(", "\\)"]]).description('数学公式行内分隔符。'),
    mathBlockDelimiters: Schema.array(Schema.array(String)).collapse().default([["$", "$"], ["\\[", "\\]"]]).description('数学公式块分隔符。'),
    mathRenderingOnlineService: Schema.union(['https://latex.codecogs.com/gif.latex', 'https://latex.codecogs.com/svg.latex', 'https://latex.codecogs.com/png.latex']).default('https://latex.codecogs.com/gif.latex').description('数学公式渲染在线服务。'),
    mathjaxV3ScriptSrc: Schema.string().role('link').default('https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js').description('MathJax 脚本资源。')
  }).description('数学公式渲染设置'),
  Schema.object({
    enableOffline: Schema.boolean().default(false).description('是否离线使用 html。'),
    printBackground: Schema.boolean().default(true).description('是否为文件导出打印背景。如果设置为 `false`，则将使用 `github-light` 预览主题。您还可以为单个文件设置 `print_background`。'),
    chromePath: Schema.string().default('').description('Chrome / Edge 可执行文件路径，用于 Puppeteer 导出。留空表示路径将自动找到。'),
    puppeteerArgs: Schema.array(String).default([]).description('传递给 puppeteer.launch({args: $puppeteerArgs}) 的参数，例如 `[\'--no-sandbox\', \'--disable-setuid-sandbox\']`。'),
  }).description('导出与渲染设置'),
  Schema.object({
    protocolsWhiteList: Schema.string().default('http://, https://, atom://, file://, mailto:, tel:').description('链接的接受协议白名单。'),
  }).description('其他设置'),
  Schema.object({
    containerPathPrefix: Schema.string().description('【文件上传专用】OneBot 实现 (如 NapCat) 所在的容器或环境提供的路径前缀。例如: `/app/.config/QQ/NapCat/temp`。'),
    hostPathPrefix: Schema.string().description('【文件上传专用】与上述路径对应的、Koishi 所在的容器或主机可以访问的路径前缀。例如: `/koishi/data/shared_temp`。'),
  }).description('跨环境路径映射设置 (用于处理文件上传)'),
]) as any

declare module 'koishi' {
  interface Context {
    markdownToImage: MarkdownToImageService
  }
}

// @ts-ignore
class MarkdownToImageService extends Service {
  private readonly config: Config;
  private browser: any = null;
  private loggerForService: any;
  private readonly notebookDirPath: string;
  private notebook: any;

  constructor(ctx: Context, config: Config) {
    super(ctx, 'markdownToImage', true);
    this.config = config;
    this.loggerForService = ctx.logger('markdownToImage');
    this.notebookDirPath = path.join(ctx.baseDir, 'data', 'notebook');
  }

  private async initBrowser(): Promise<void> {
    this.ctx.inject(['puppeteer'], (ctx) => {
      this.browser = ctx.puppeteer.browser;
    });
  }

  private async initNotebook(): Promise<void> {
    const {
      breakOnSingleNewLine, enableLinkify, mathRenderingOption,
      mathInlineDelimiters, mathBlockDelimiters, mathRenderingOnlineService,
      mathjaxV3ScriptSrc, enableWikiLinkSyntax, enableEmojiSyntax,
      enableExtendedTableSyntax, enableCriticMarkupSyntax,
      frontMatterRenderingOption, mermaidTheme, codeBlockTheme,
      previewTheme, revealjsTheme, protocolsWhiteList, printBackground,
      chromePath, enableScriptExecution, enableHTML5Embed,
      HTML5EmbedUseImageSyntax, HTML5EmbedUseLinkSyntax, HTML5EmbedIsAllowedHttp,
      HTML5EmbedAudioAttributes, HTML5EmbedVideoAttributes, puppeteerArgs,
    } = this.config;

    const resolvedChromePath = chromePath || await find();

    this.notebook = await Notebook.init({
      notebookPath: this.notebookDirPath,
      config: {
        breakOnSingleNewLine, enableLinkify, mathRenderingOption,
        mathInlineDelimiters, mathBlockDelimiters, mathRenderingOnlineService,
        mathjaxV3ScriptSrc, enableWikiLinkSyntax, enableEmojiSyntax,
        enableExtendedTableSyntax, enableCriticMarkupSyntax,
        frontMatterRenderingOption, mermaidTheme, codeBlockTheme,
        previewTheme, revealjsTheme, protocolsWhiteList, printBackground,
        chromePath: resolvedChromePath, enableScriptExecution, enableHTML5Embed,
        HTML5EmbedUseImageSyntax, HTML5EmbedUseLinkSyntax, HTML5EmbedIsAllowedHttp,
        HTML5EmbedAudioAttributes, HTML5EmbedVideoAttributes, puppeteerArgs,
      },
    });
  }

  private async ensureDirExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, {recursive: true});
    }
  }

  private getCurrentTimeNumberString(): string {
    const now = new Date();
    const dateString = now.toISOString().replace(/[-:]/g, '').split('.')[0];
    const randomString = Math.random().toString(36).substring(2, 8);
    return `${dateString}_${randomString}`;
  }

  private async generateAndRenderImage(markdownText: string): Promise<Buffer> {
    const {
      height, width, deviceScaleFactor, waitUntil, timeout,
      enableOffline, enableRunAllCodeChunks, defaultImageFormat, enableAutoCacheClear
    } = this.config;

    const currentTimeString = this.getCurrentTimeNumberString();
    const readmeFilePath = path.join(this.notebookDirPath, `${currentTimeString}.md`);
    const readmeHtmlPath = path.join(this.notebookDirPath, `${currentTimeString}.html`);
    await fs.promises.writeFile(readmeFilePath, markdownText);

    // 步骤 1: 使用已知的、稳定的 htmlExport 方法生成临时 HTML 文件
    const engine = this.notebook.getNoteMarkdownEngine(readmeFilePath);
    await engine.htmlExport({ offline: enableOffline, runAllCodeChunks: enableRunAllCodeChunks });

    // 步骤 2: 将生成的 HTML 文件内容读回内存
    let html = await fs.promises.readFile(readmeHtmlPath, 'utf-8');

    // 步骤 3: 将 HTML 中的本地图片引用转换为 Base64 Data URI
    const imgRegex = /<img src="(?!(https?|data):)([^"]+)"/g;
    const replacements = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      const originalSrc = match[0];
      const imagePath = match[2];
      const absoluteImagePath = path.resolve(this.notebookDirPath, imagePath);
      if (fs.existsSync(absoluteImagePath)) {
        try {
          const imageBuffer = await fs.promises.readFile(absoluteImagePath);
          const ext = path.extname(imagePath).toLowerCase();
          const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
          const base64 = imageBuffer.toString('base64');
          const newSrc = `<img src="data:${mimeType};base64,${base64}"`;
          replacements.push({ find: originalSrc, replace: newSrc });
        } catch (error) {
            this.loggerForService.warn(`读取本地图片失败: ${absoluteImagePath}`, error);
        }
      }
    }
    for (const rep of replacements) {
      html = html.replace(rep.find, rep.replace);
    }

    // 步骤 4: 使用 page.setContent 直接加载 HTML 字符串
    const context = await this.browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({width, height, deviceScaleFactor});
    await page.setContent(html, { waitUntil, timeout });

    const imageBuffer = await page.screenshot({fullPage: true, type: defaultImageFormat});
    await page.close();
    await context.close();

    // 步骤 5: 清理所有临时文件
    if (enableAutoCacheClear) {
      await Promise.all([
        fs.promises.unlink(readmeFilePath),
        fs.promises.unlink(readmeHtmlPath) // 确保 html 文件也被删除
      ]);
    }
    return imageBuffer;
  }

  async convertToImage(markdownText: string): Promise<Buffer> {
    if (!this.browser) await this.initBrowser();
    if (!this.notebook) await this.initNotebook();
    await this.ensureDirExists(this.notebookDirPath);
    try {
      return await this.generateAndRenderImage(markdownText);
    } catch (error) {
      this.loggerForService.error('Error converting markdown to image:', error);
      throw error;
    }
  }
}

export async function apply(ctx: Context, config: Config) {
  ctx.plugin(MarkdownToImageService, config);
  const logger = ctx.logger('markdownToImage');

  ctx.inject(['markdownToImage'], (ctx) => {
    ctx.middleware(async (session, next) => {
      if (session.elements && session.elements.length === 1 && (session.elements[0].type === 'asset' || session.elements[0].type === 'file')) {
        const fileElement = session.elements[0];
        const originalFilename = fileElement.attrs.file || fileElement.attrs.src || '';
        if (originalFilename.endsWith('.md')) {
          logger.info(`[中间件] 检测到 Markdown 文件上传: ${originalFilename}`);
          await session.send('接收到 Markdown 文件，正在处理...');
          let content: string = '';
          const fileId = fileElement.attrs.fileId;
          // @ts-ignore
          if (fileId && session.onebot?._request) {
            try {
              // @ts-ignore
              const { retcode, data, message } = await session.onebot._request('get_file', { file_id: fileId });
              if (retcode === 0 && data?.file) {
                let localFilePath = data.file;
                logger.info(`[中间件] OneBot 实现返回路径: ${localFilePath}`);

                // 如果配置了路径映射，则进行转换
                if (config.containerPathPrefix && config.hostPathPrefix) {
                  if (localFilePath.startsWith(config.containerPathPrefix)) {
                    const relativePath = path.relative(config.containerPathPrefix, localFilePath);
                    const hostPath = path.join(config.hostPathPrefix, relativePath);
                    logger.info(`[中间件] 应用路径映射，转换后路径为: ${hostPath}`);
                    localFilePath = hostPath;
                  } else {
                    logger.warn(`[中间件] 文件路径 '${localFilePath}' 不以前缀 '${config.containerPathPrefix}' 开头，映射未生效。`);
                  }
                }
                content = await fs.promises.readFile(localFilePath, 'utf-8');
              } else {
                return session.send(`请求文件下载失败: ${message || '未知错误'}`);
              }
            } catch (error: any) {
              if (error.code === 'ENOENT') {
                return session.send(`处理文件时发生错误：找不到文件或目录。\n这通常意味着路径映射配置不正确或文件挂载未生效。\n尝试读取的路径: ${error.path}`);
              }
              return session.send(`处理文件时发生内部错误: ${error.message}`);
            }
          } else {
            return session.send('抱歉，当前环境不支持处理文件上传（未找到 onebot._request 方法）。');
          }
          if (content) {
            try {
              await session.send('文件内容已获取，正在生成图片...');
              const imageBuffer = await ctx.markdownToImage.convertToImage(content);
              return h.image(imageBuffer, `image/${config.defaultImageFormat}`);
            } catch (error: any) {
              return session.send(`转换 Markdown 时发生错误：\n${error.message}`);
            }
          } else {
            return session.send('未能成功读取文件内容，操作中止。');
          }
        }
      }
      return next();
    });

    ctx.command('markdown <markdownText:text>', '将 Markdown 纯文本内容转换为图片')
      .alias('markdownToImage')
      .action(async ({ session }, markdownText) => {
        if (!session) return '该指令无法在无会话上下文的环境中执行。';
        if (!markdownText) return '请直接在指令后输入要转换的 Markdown 文本，或直接上传一个 .md 文件。';
        try {
          await session.send('接收到文本内容，正在生成图片...');
          const imageBuffer = await ctx.markdownToImage.convertToImage(markdownText);
          return h.image(imageBuffer, `image/${config.defaultImageFormat}`);
        } catch (error: any) {
          return `转换 Markdown 时发生错误：\n${error.message}`;
        }
      });
  });
}