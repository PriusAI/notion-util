import { markdownToBlocks } from '@tryfabric/martian'
import { fromHtml } from 'hast-util-from-html'
import { toMdast } from 'hast-util-to-mdast'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

/**
 * 判断一个字符串是否为有效的http或https协议的URL
 *
 * @param {string} string 待判断的字符串
 * @returns 返回布尔值，表示是否为有效的URL
 */
function isValidURL(string) {
  try {
    const url = new URL(string)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (_) {
    return false
  }
}

/**
 * @typedef Params
 * @prop {string} url HTML 内容的 URL
 * @prop {string} html 待转换的 HTML 内容
 * @prop {boolean} readable 是否提取可读内容
 */

/**
 * 将 HTML 转换为 Markdown 格式
 *
 * @param {Params} params 转换所需的参数对象
 * @returns {string}
 */
export function html2markdown(params) {
  const { url, html, readable } = params
  const doc = new JSDOM(html, { url })
  const reader = new Readability(doc.window.document)
  const article = reader.parse()

  if (readable) {
    html = article.content
  }

  const hast = fromHtml(html)
  const mdast = toMdast(hast, {
    handlers: {
      base(state, node) {
        if (!state.baseFound) {
          let potentialUrl = String(
            (node.properties && node.properties.href) || ''
          )
          if (!isValidURL(potentialUrl)) {
            console.error('Invalid URL:', potentialUrl)
            potentialUrl = null
          }
          state.frozenBaseUrl = potentialUrl || undefined
          state.baseFound = true
        }
      },

      img(state, node) {
        const properties = node.properties || {}
        let url = properties.src ? String(properties.src) : null
        if (!isValidURL(url)) {
          url = properties.dataSrc ? String(properties.dataSrc) : null
        }
        url = state.resolve(url || '')
        const result = {
          type: 'image',
          url: url,
          title: properties.title ? String(properties.title) : null,
          alt: properties.alt ? String(properties.alt) : ''
        }
        state.patch(node, result)
        return result
      },

      a(state, node) {
        const properties = node.properties || {}
        const children = state.all(node)

        const result = {
          type: 'link',
          url: state.resolve(String(properties.href || '') || null),
          title: properties.title ? String(properties.title) : null,
          children
        }
        state.patch(node, result)
        return result
      }
    }
  })
  const markdown = toMarkdown(mdast, { extensions: [gfmToMarkdown()] })

  return markdown
}

/**
 * @typedef Markdown2blocksParams
 * @prop {string} url HTML 内容的 URL
 * @prop {string} markdown 待转换的 Markdown 文本
 */
/**
 * 将Markdown文本转换为块级元素数组
 *
 * @param {Markdown2blocksParams} params 转换所需的参数对象
 */
export function markdown2blocks(params) {
  const { markdown } = params
  try {
    const blocks = markdownToBlocks(markdown, { strictImageUrls: false })
    return blocks
  } catch (err) {
    return []
  }
}
