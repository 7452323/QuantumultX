/**
 * 🐣 UnStamp - Scripting App
 * iOS 去水印解析工具
 * 
 * 用法:
 * 1. 在 Scripting App 中创建新项目
 * 2. 把本文件内容粘贴到 index.tsx
 * 3. 运行即可
 * 
 * 支持: 抖音 / Twitter / 小红书 / Instagram / Bilibili
 */

import {
  Text, TextField, Button, List, Section, HStack, VStack, ZStack,
  Image, Rectangle, Spacer,
  NavigationStack, Navigation, ScrollView, ScrollViewReader,
  ProgressView, Tab, TabView,
  fetch, useState, useEffect, useRef, useObservable,
  Script, Intent
} from "scripting"

declare function alert(message: string): Promise<void>
declare function alert(options: { message: string; title?: string; buttonLabel?: string }): Promise<void>

declare const Pasteboard: {
  getString(): Promise<string | null>
  setString(text: string): void
}
declare const Photos: {
  saveVideo(data_or_path: Data | string, options?: { fileName?: string; shouldMoveFile?: boolean }): Promise<boolean>
  savePhoto(data: Data | string, options?: { fileName?: string; shouldMoveFile?: boolean }): Promise<boolean>
}
declare const FileManager: {
  documentsDirectory: string
  temporaryDirectory: string
  writeAsBytes(path: string, data: Data): Promise<void>
  removeSync(path: string): void
}
declare const openURL: (url: string) => Promise<boolean>
declare const ShareSheet: {
  present(items: any[]): Promise<boolean>
}
declare const Dialog: {
  actionSheet(options: {
    title: string
    message?: string
    cancelButton?: boolean
    actions: { label: string; destructive?: boolean }[]
  }): Promise<number | null>
  prompt(options: {
    title: string
    message?: string
    defaultValue?: string
    obscureText?: boolean
    selectAll?: boolean
    placeholder?: string
    cancelLabel?: string
    confirmLabel?: string
    keyboardType?: string
  }): Promise<string | null>
}

// ─── 解析器 ────────────────────────────────────────────

interface MediaResult {
  success: boolean
  platform?: string
  title?: string
  author?: string
  video_url?: string | null
  images?: string[]
  cover_url?: string | null
  link?: string
  error?: string
  videoId?: string
  /** 所有候选视频 URL（多 CDN 镜像），仅抖音使用 */
  videoUrls?: string[]
  /** 抖音视频 URI（play_addr.uri），用于通过 aweme.snssdk.com 获取指定画质 */
  videoUri?: string
}

const PLATFORMS: [string, RegExp[]][] = [
  ['douyin',      [/douyin\.com/i, /iesdouyin/i, /v\.douyin/i]],
  ['twitter',     [/twitter\.com/i, /x\.com\//i]],
  ['xiaohongshu', [/xiaohongshu\.com/i, /xhslink\.com/i]],
  ['instagram',   [/instagram\.com/i]],
  ['bilibili',    [/bilibili\.com/i, /b23\.tv/i]],
]

function detectPlatform(text: string): { platform: string; url: string } | null {
  for (const [platform, patterns] of PLATFORMS) {
    for (const p of patterns) {
      const m = text.match(p)
      if (m) {
        const start = Math.max(0, (m.index || 0) - 50)
        const urlMatch = text.slice(start).match(/https?:\/\/[^\s<>"']+/)
        if (urlMatch) {
          let clean = urlMatch[0].replace(/[\?&]s=\d+/g, '').replace(/[\?&]$/, '')
          return { platform, url: clean }
        }
      }
    }
  }
  return null
}

// ─── 工具 ──────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ─── Twitter / X ──────────────────────────────────────
const TWITTER_BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

async function parseTwitter(url: string): Promise<MediaResult> {
  const result: MediaResult = { success: false, error: '' }
  result.platform = 'twitter'
  result.link = url
  try {
    const tweetId = url.match(/status\/(\d+)/)?.[1]
    if (!tweetId) { result.error = '无法提取推文ID'; return result }

    // ─── 策略 1: Twitter GraphQL API ─────────────────────
    try {
      // 获取 guest token
      const guestResp = await fetch('https://x.com/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        timeout: 10
      })
      const guestHtml = await guestResp.text()
      const guestToken = guestHtml.match(/cookie="gt=(\d+)/)?.[1]
        || guestHtml.match(/"gt=(\d+)/)?.[1]
        || guestHtml.match(/gt=(\d+)/)?.[1]

      if (guestToken) {
        const features = JSON.stringify({
          creator_subscriptions_tweet_preview_api_enabled: true,
          communities_web_enable_tweet_community_results_fetch: true,
          c9s_tweet_anatomy_moderator_badge_enabled: true,
          tweetypie_unmention_optimization_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
          view_counts_everywhere_api_enabled: true,
          longform_notetweets_consumption_enabled: true,
          responsive_web_twitter_article_tweet_consumption_enabled: true,
          tweet_awards_web_tipping_enabled: false,
          creator_subscriptions_quote_tweet_preview_enabled: false,
          freedom_of_speech_not_reach_fetch_enabled: true,
          standardized_nudges_misinfo: true,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
          tweet_with_visibility_results_prefer_gql_media_interstitial_enabled: false,
          rweb_video_timestamps_enabled: true,
          longform_notetweets_rich_text_read_enabled: true,
          longform_notetweets_inline_media_enabled: true,
          rweb_tipjar_consumption_enabled: true,
          responsive_web_graphql_exclude_directive_enabled: true,
          verified_phone_label_enabled: false,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
          responsive_web_graphql_timeline_navigation_enabled: true,
          responsive_web_enhance_cards_enabled: false,
        })
        const variables = JSON.stringify({
          tweetId, withCommunity: false, includePromotedContent: false, withVoice: false
        })
        const fieldToggles = JSON.stringify({ withArticleRichContentState: true, withArticlePlainText: false })

        const gqlUrl = `https://api.twitter.com/graphql/kPLTRmMnzbPTv70___D06w/TweetResultByRestId?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}&fieldToggles=${encodeURIComponent(fieldToggles)}`
        const gqlResp = await fetch(gqlUrl, {
          headers: {
            'authorization': `Bearer ${TWITTER_BEARER}`,
            'x-guest-token': guestToken,
            'x-twitter-active-user': 'yes',
            'x-twitter-client-language': 'zh-cn',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          timeout: 12,
        })
        const gqlData = await gqlResp.json()

        if (!gqlData.errors) {
          const tweetResult = gqlData?.data?.tweetResult?.result
          const tweet = tweetResult?.tweet || tweetResult
          const legacy = tweet?.legacy

          if (legacy) {
            // 提取文本
            const noteTweet = tweet?.note_tweet
            result.title = noteTweet?.note_tweet_results?.result?.text
              || legacy.full_text || ''
            result.title = (result.title || '').replace(/https?:\/\/t\.co\/[^\s,]+$/g, '').trim()

            // 提取媒体
            const mediaEntities = legacy.entities?.media || legacy.extended_entities?.media || []
            for (const m of mediaEntities) {
              if (m.type === 'video' || m.type === 'animated_gif') {
                const variants = m.video_info?.variants || []
                // 选择最高码率的 mp4
                const mp4s = variants.filter((v: any) => v.content_type === 'video/mp4' && v.url)
                if (mp4s.length) {
                  mp4s.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
                  result.video_url = mp4s[0].url
                  result.cover_url = result.cover_url || m.media_url_https
                }
              }
              if (m.type === 'photo' && m.media_url_https) {
                if (!result.images) result.images = []
                result.images.push(`${m.media_url_https}?name=orig`)
                result.cover_url = result.cover_url || m.media_url_https
              }
            }
            result.author = tweetResult?.core?.user_results?.result?.legacy?.screen_name
              || tweet?.core?.user_results?.result?.legacy?.screen_name || ''
            result.success = !!(result.video_url || result.images?.length)
            if (result.success) return result
          }
        }
      }
    } catch {
      // GraphQL 失败 → 继续 fxtwitter
    }

    // ─── 策略 2: fxtwitter 备用 ──────────────────────────
    try {
      const resp = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10,
      })
      const data = await resp.json()
      const tweet = data.tweet || data

      result.title = result.title || tweet.text || ''
      result.author = result.author || tweet.author?.screen_name || tweet.user_screen_name || ''

      const all = tweet.media?.all || tweet.media_extended || []
      for (const m of all) {
        if ((m.type === 'video' || m.type === 'gif') && m.url) {
          result.video_url = result.video_url || m.url.replace(/\?tag=\d+/, '')
          result.cover_url = result.cover_url || m.thumbnail_url
        }
        if (m.type === 'photo' && m.url) {
          if (!result.images) result.images = []
          result.images.push(m.url)
          result.cover_url = result.cover_url || m.url
        }
      }
      if (!result.video_url && tweet.mediaURLs?.length) result.video_url = tweet.mediaURLs[0]
      result.success = !!(result.video_url || result.images?.length)
    } catch {
      // fxtwitter 也失败
    }

    // ─── 策略 3: og:video 兜底 ───────────────────────────
    if (!result.success) {
      try {
        const pageResp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          timeout: 10,
        })
        const html = await pageResp.text()
        const ogVideo = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i)
        if (ogVideo) { result.video_url = ogVideo[1]; result.success = true }
      } catch {}
    }
  } catch (e: any) { result.error = e.message || String(e) }
  return result
}
