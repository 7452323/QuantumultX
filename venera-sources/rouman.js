/** @type {import('./_venera_.js')} */

class Rouman extends ComicSource {
  name = "肉漫屋"
  key = "rouman"
  version = "1.0.0"
  minAppVersion = "1.4.0"
  url = "https://cdn.jsdelivr.net/gh/7452323/QuantumultX@main/venera-sources/rouman.js"

  baseUrl = "https://rouman5.com"

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
      "Referer": this.baseUrl
    }
  }

  async fetchDocument(url) {
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw `HTTP ${res.status}`
    return new HtmlDocument(res.body)
  }

  parseComicFromCard(el) {
    let link = el.querySelector("a")
    let href = link.attributes["href"] || ""
    let id = href.replace("/books/", "")
    let title = link.text || ""
    let cover = ""
    let img = link.querySelector("img")
    if (img) cover = img.attributes["src"] || ""
    let info = el.querySelector(".text-muted-foreground")
    let chapterText = info ? info.text : ""
    return new Comic({
      id: id,
      title: title.trim(),
      cover: cover
    })
  }

  // === Explore ===
  explore = [
    {
      title: this.name,
      type: "multiPartPage",
      load: async () => {
        let doc = await this.fetchDocument(this.baseUrl + "/home")
        let result = []
        // sections: 正熱門, 今日最佳, 最近更新
        let sections = doc.querySelectorAll("main > div, main > section")
        let currentSection = null
        let currentComics = []

        for (let el of doc.querySelectorAll("main > *")) {
          let text = el.text || ""
          let tag = el.tagName || ""

          if (tag === "DIV" && text.includes("正熱門") && !text.includes("當下")) {
            if (currentSection && currentComics.length > 0) {
              result.push({ title: currentSection, comics: currentComics, viewMore: null })
            }
            currentSection = text.replace(/^\d+\.?\s*/, "").trim() || "熱門"
            currentComics = []
            continue
          }

          if (tag === "DIV" && (text.includes("今日最佳") || text.includes("今日爆款") || text.includes("最近更新") || text.includes("每日多次"))) {
            if (currentSection && currentComics.length > 0) {
              result.push({ title: currentSection, comics: currentComics, viewMore: null })
            }
            currentSection = text.replace(/^\d+\.?\s*/, "").trim() || "推薦"
            currentComics = []
            continue
          }

          if (tag === "A" && el.attributes && el.attributes["href"] && el.attributes["href"].startsWith("/books/")) {
            let href = el.attributes["href"]
            let id = href.replace("/books/", "")
            let title = ""
            let cover = ""
            let titleEl = el.querySelector("h3, .font-bold, .text-sm")
            if (titleEl) title = titleEl.text || ""
            let img = el.querySelector("img")
            if (img) cover = img.attributes["src"] || ""
            currentComics.push(new Comic({ id, title: title.trim(), cover }))
          }
        }

        if (currentSection && currentComics.length > 0) {
          result.push({ title: currentSection, comics: currentComics, viewMore: null })
        }

        // fallback: if sections parsing failed, extract all comic cards
        if (result.length === 0) {
          let comics = []
          for (let el of doc.querySelectorAll("a[href*='/books/']")) {
            let href = el.attributes["href"] || ""
            if (!href.startsWith("/books/")) continue
            let id = href.replace("/books/", "")
            let title = ""
            let cover = ""
            let titleEl = el.querySelector("h3, .font-bold")
            if (titleEl) title = titleEl.text || ""
            let img = el.querySelector("img")
            if (img) cover = img.attributes["src"] || ""
            if (id) comics.push(new Comic({ id, title: title.trim(), cover }))
          }
          if (comics.length > 0) result.push({ title: "推薦", comics, viewMore: null })
        }

        return result
      }
    },
    {
      title: "全部漫畫",
      type: "multiPageComicList",
      load: async (page) => {
        let doc = await this.fetchDocument(this.baseUrl + "/books?page=" + page)
        let comics = []
        for (let el of doc.querySelectorAll("a[href*='/books/']")) {
          let href = el.attributes["href"] || ""
          if (!href.startsWith("/books/") || href.split("/").length > 3) continue
          let id = href.replace("/books/", "")
          let title = ""
          let cover = ""
          let titleEl = el.querySelector("h3, .font-bold, .text-sm")
          if (titleEl) title = titleEl.text || ""
          let img = el.querySelector("img")
          if (img) cover = img.attributes["src"] || ""
          if (id) comics.push(new Comic({ id, title: title.trim(), cover }))
        }
        // estimate maxPage from content
        let maxPage = page + 1
        let nextLinks = doc.querySelectorAll("a[href*='page=']")
        for (let a of nextLinks) {
          let m = (a.attributes["href"] || "").match(/page=(\d+)/)
          if (m) {
            let p = parseInt(m[1])
            if (p > maxPage) maxPage = p
          }
        }
        return { comics, maxPage }
      }
    }
  ]

  // === Search ===
  search = {
    load: async (keyword, options, page) => {
      let doc = await this.fetchDocument(this.baseUrl + "/search?keyword=" + encodeURIComponent(keyword) + "&page=" + page)
      let comics = []
      for (let el of doc.querySelectorAll("a[href*='/books/']")) {
        let href = el.attributes["href"] || ""
        if (!href.startsWith("/books/") || href.split("/").length > 3) continue
        let id = href.replace("/books/", "")
        let title = ""
        let cover = ""
        let titleEl = el.querySelector("h3, .font-bold, .text-sm")
        if (titleEl) title = titleEl.text || ""
        let img = el.querySelector("img")
        if (img) cover = img.attributes["src"] || ""
        if (id) comics.push(new Comic({ id, title: title.trim(), cover }))
      }
      let maxPage = page + 1
      for (let a of doc.querySelectorAll("a[href*='page=']")) {
        let m = (a.attributes["href"] || "").match(/page=(\d+)/)
        if (m) {
          let p = parseInt(m[1])
          if (p > maxPage) maxPage = p
        }
      }
      return { comics, maxPage }
    }
  }

  // === Comic Details ===
  comic = {
    loadInfo: async (id) => {
      let doc = await this.fetchDocument(this.baseUrl + "/books/" + id)
      let title = ""
      let cover = ""
      let author = ""
      let status = ""
      let description = ""
      let tags = []

      let titleEl = doc.querySelector("main > div > div > div > h1, main h1")
      if (!titleEl) titleEl = doc.querySelector("main h2, main .text-2xl")
      if (titleEl) title = titleEl.text || ""

      let img = doc.querySelector("main img")
      if (img) cover = img.attributes["src"] || ""

      // extract metadata
      for (let el of doc.querySelectorAll("main > *")) {
        let text = el.text || ""
        if (text.startsWith("作者:")) author = text.replace("作者:", "").trim()
        if (text.startsWith("狀態:")) status = text.replace("狀態:", "").trim()
        if (text.startsWith("簡介:")) description = text.replace("簡介:", "").trim()
        if (text.startsWith("標籤:") || text.startsWith("地區:")) {
          // tags may be in sibling elements
        }
      }

      // extract tags from inline elements
      for (let el of doc.querySelectorAll("main span, main .inline-block, main .tag")) {
        let text = (el.text || "").trim()
        if (text && text.length > 0 && text.length < 20 && !text.includes(" ") && !text.includes(":")) {
          tags.push(text)
        }
      }

      // fix description from paragraph
      if (!description) {
        for (let p of doc.querySelectorAll("main p")) {
          let t = (p.text || "").trim()
          if (t.length > 30) { description = t; break }
        }
      }

      // chapters
      let eps = []
      for (let a of doc.querySelectorAll("a[href*='/books/" + id + "/']")) {
        let href = a.attributes["href"] || ""
        let epMatch = href.match(/\/(\d+)$/)
        if (epMatch) {
          eps.push({
            id: epMatch[1],
            title: a.text || ("第" + (parseInt(epMatch[1]) + 1) + "話")
          })
        }
      }

      return new ComicDetails({
        title: title,
        cover: cover,
        authors: [author],
        status: status.includes("連載") ? "ongoing" : "completed",
        description: description,
        tags: tags.filter(t => t),
        eps: eps
      })
    },

    loadEp: async (comicId, epId) => {
      let doc = await this.fetchDocument(this.baseUrl + "/books/" + comicId + "/" + (epId || "0"))
      let images = []
      for (let img of doc.querySelectorAll("main img")) {
        let src = img.attributes["src"] || ""
        if (src && (src.includes("rmcdn") || src.includes("r5."))) {
          images.push(src)
        }
      }
      return { images }
    }
  }
}
