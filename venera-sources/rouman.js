class Rouman extends ComicSource {
  name = "肉漫屋"
  key = "rouman"
  version = "1.0.0"
  minAppVersion = "1.4.0"
  url = "https://raw.githubusercontent.com/7452323/QuantumultX/main/venera-sources/rouman.js"

  baseUrl = "https://rouman5.com"

  headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
    "Referer": "https://rouman5.com"
  }

  async fetchDocument(url) {
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw `HTTP ${res.status}`
    return new HtmlDocument(res.body)
  }

  parseComic(el) {
    let link = el.tagName === "A" ? el : el.querySelector("a")
    if (!link) return null
    let href = link.attributes["href"] || ""
    if (!href.startsWith("/books/")) return null
    let id = href.replace("/books/", "")
    let title = ""
    let titleEl = el.querySelector("h3, .font-bold, .text-sm, .text-xs")
    if (titleEl) title = titleEl.text || ""
    let cover = ""
    let img = el.querySelector("img")
    if (img) cover = img.attributes["src"] || ""
    return new Comic({ id, title: title.trim(), cover })
  }

  explore = [
    {
      title: this.name,
      type: "multiPartPage",
      load: async () => {
        let doc = await this.fetchDocument(this.baseUrl + "/home")
        let sections = []
        let currentTitle = null
        let currentComics = []

        for (let el of doc.querySelectorAll("main > *")) {
          let text = el.text || ""
          let tag = el.tagName || ""

          if (tag === "DIV" && (text.includes("正熱門") || text.includes("今日最佳") || text.includes("今日爆款") || text.includes("最近更新") || text.includes("每日多次"))) {
            if (currentTitle && currentComics.length > 0) {
              sections.push({ title: currentTitle, comics: currentComics, viewMore: null })
            }
            currentTitle = text.replace(/^\d+\.?\s*/, "").trim()
            currentComics = []
            continue
          }

          if (tag === "A" && el.attributes && el.attributes["href"] && el.attributes["href"].startsWith("/books/")) {
            let comic = this.parseComic(el)
            if (comic) currentComics.push(comic)
          }
        }

        if (currentTitle && currentComics.length > 0) {
          sections.push({ title: currentTitle, comics: currentComics, viewMore: null })
        }

        if (sections.length === 0) {
          let comics = []
          for (let el of doc.querySelectorAll("a[href*='/books/']")) {
            let comic = this.parseComic(el)
            if (comic) comics.push(comic)
          }
          if (comics.length > 0) sections.push({ title: "推薦", comics, viewMore: null })
        }

        return sections
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
          let comic = this.parseComic(el)
          if (comic) comics.push(comic)
        }
        let maxPage = page + 1
        for (let a of doc.querySelectorAll("a[href*='page=']")) {
          let m = (a.attributes["href"] || "").match(/page=(\d+)/)
          if (m) { let p = parseInt(m[1]); if (p > maxPage) maxPage = p }
        }
        return { comics, maxPage }
      }
    }
  ]

  search = {
    load: async (keyword, options, page) => {
      let doc = await this.fetchDocument(this.baseUrl + "/search?keyword=" + encodeURIComponent(keyword) + "&page=" + page)
      let comics = []
      for (let el of doc.querySelectorAll("a[href*='/books/']")) {
        let href = el.attributes["href"] || ""
        if (!href.startsWith("/books/") || href.split("/").length > 3) continue
        let comic = this.parseComic(el)
        if (comic) comics.push(comic)
      }
      let maxPage = page + 1
      for (let a of doc.querySelectorAll("a[href*='page=']")) {
        let m = (a.attributes["href"] || "").match(/page=(\d+)/)
        if (m) { let p = parseInt(m[1]); if (p > maxPage) maxPage = p }
      }
      return { comics, maxPage }
    }
  }

  comic = {
    loadInfo: async (id) => {
      let doc = await this.fetchDocument(this.baseUrl + "/books/" + id)
      let title = ""
      let cover = ""
      let author = ""
      let description = ""
      let tags = {}

      let titleEl = doc.querySelector("main > div > div > div > h1, main h1")
      if (!titleEl) titleEl = doc.querySelector("main h2, main .text-2xl")
      if (titleEl) title = titleEl.text || ""

      let img = doc.querySelector("main img")
      if (img) cover = img.attributes["src"] || ""

      for (let el of doc.querySelectorAll("main > *")) {
        let text = el.text || ""
        if (text.startsWith("作者:")) author = text.replace("作者:", "").trim()
        if (text.startsWith("簡介:")) description = text.replace("簡介:", "").trim()
      }

      if (!description) {
        for (let p of doc.querySelectorAll("main p")) {
          let t = (p.text || "").trim()
          if (t.length > 30) { description = t; break }
        }
      }

      let tagList = []
      for (let el of doc.querySelectorAll("main span, main .inline-block, main .tag")) {
        let text = (el.text || "").trim()
        if (text && text.length > 0 && text.length < 20 && !text.includes(" ") && !text.includes(":")) {
          tagList.push(text)
        }
      }
      if (author) tagList.push(author)
      if (tagList.length > 0) tags["标签"] = tagList

      // chapters: Map<chapterId, chapterTitle>
      let chapters = new Map()
      for (let a of doc.querySelectorAll("a[href*='/books/" + id + "/']")) {
        let href = a.attributes["href"] || ""
        let epMatch = href.match(/\/(\d+)$/)
        if (epMatch) {
          chapters.set(epMatch[1], a.text || ("第" + (parseInt(epMatch[1]) + 1) + "話"))
        }
      }

      return new ComicDetails({
        title: title,
        cover: cover,
        description: description,
        tags: tags,
        chapters: chapters
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
