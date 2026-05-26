#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"

const BASE = "https://cupe.ca"
const START_URL = `${BASE}/locals`
const OUT_DIR = "data/cupe"
const STATIC_DIR = "quartz/static/data"
const CONTENT_DIR = "content/sections-locales"
const MAX_PAGES = Number(process.env.CUPE_MAX_PAGES || 999)
const DETAIL_CONCURRENCY = Number(process.env.CUPE_DETAIL_CONCURRENCY || 6)
const DEBUG = process.env.CUPE_DEBUG === "1"
const USER_AGENT = "Mozilla/5.0 (compatible; Fortisia-CUPE-Scraper/1.1; +https://fortisia.com)"

const provinceFromOffice = [
  [/ONTARIO|\bON\b|MARKHAM|TORONTO|OTTAWA|HAMILTON|LONDON|THUNDER BAY|SUDBURY|WINDSOR|KINGSTON|NORTH BAY|PETERBOROUGH|SAULT STE/i, "Ontario"],
  [/BRITISH COLUMBIA|\bBC\b|BURNABY|VANCOUVER|VICTORIA|KELOWNA|PRINCE GEORGE|NANAIMO|SURREY/i, "Colombie-Britannique"],
  [/ALBERTA|\bAB\b|CALGARY|EDMONTON|RED DEER|LETHBRIDGE|FORT MCMURRAY/i, "Alberta"],
  [/SASKATCHEWAN|\bSK\b|REGINA|SASKATOON|MOOSE JAW|PRINCE ALBERT/i, "Saskatchewan"],
  [/MANITOBA|\bMB\b|WINNIPEG|BRANDON|THOMPSON/i, "Manitoba"],
  [/QUEBEC|QUÉBEC|\bQC\b|MONTREAL|MONTRÉAL|LONGUEUIL|LAVAL|SHERBROOKE|GATINEAU|SCFP/i, "Québec"],
  [/NEW BRUNSWICK|NOUVEAU-BRUNSWICK|\bNB\b|FREDERICTON|MONCTON|SAINT JOHN/i, "Nouveau-Brunswick"],
  [/NOVA SCOTIA|NOUVELLE-ÉCOSSE|\bNS\b|HALIFAX|DARTMOUTH|SYDNEY/i, "Nouvelle-Écosse"],
  [/NEWFOUNDLAND|LABRADOR|\bNL\b|ST\. JOHN|ST JOHN|TERRE-NEUVE/i, "Terre-Neuve-et-Labrador"],
  [/PRINCE EDWARD ISLAND|ÎLE-DU-PRINCE|\bPE\b|CHARLOTTETOWN/i, "Île-du-Prince-Édouard"],
  [/YUKON|\bYT\b|WHITEHORSE/i, "Yukon"],
  [/NORTHWEST TERRITORIES|TERRITOIRES DU NORD-OUEST|\bNT\b|YELLOWKNIFE/i, "Territoires du Nord-Ouest"],
  [/NUNAVUT|\bNU\b|IQALUIT/i, "Nunavut"],
]

function decodeHtml(input = "") {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&eacute;/g, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&agrave;/g, "à")
    .replace(/&ccedil;/g, "ç")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function stripTags(input = "") {
  return decodeHtml(input.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
}

function csvEscape(value) {
  const text = String(value ?? "")
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function parseTitle(title) {
  const clean = title.replace(/\s+/g, " ").trim()
  const m = clean.match(/^CUPE\s+([A-Za-z0-9.-]+)\s+-\s+(.+)$/i)
  return {
    local_number: m ? m[1] : "",
    employer_or_unit: m ? m[2].trim() : clean,
  }
}

function inferProvince(text) {
  for (const [regex, province] of provinceFromOffice) {
    if (regex.test(text)) return province
  }
  return "À vérifier"
}

async function fetchText(url, attempt = 1) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-CA,en;q=0.9,fr-CA;q=0.8,fr;q=0.7",
    },
  })
  if (!res.ok) {
    if (attempt <= 3 && [429, 500, 502, 503, 504].includes(res.status)) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500))
      return fetchText(url, attempt + 1)
    }
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  return await res.text()
}

function absolutize(href) {
  const clean = decodeHtml(href || "").trim()
  if (!clean) return ""
  if (clean.startsWith("http")) return clean
  if (clean.startsWith("/")) return `${BASE}${clean}`
  return `${BASE}/${clean}`
}

function extractAnchors(html) {
  const anchors = []
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let match
  while ((match = anchorRegex.exec(html))) {
    const attrs = match[1]
    const inner = match[2]
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] || ""
    const text = stripTags(inner)
    anchors.push({ href: decodeHtml(href), text, index: match.index })
  }
  return anchors
}

function parseListPage(html, page) {
  const plain = stripTags(html)
  const totalMatch = plain.match(/Results\s+\d+\s+-\s+\d+\s+of\s+(\d+)/i)
  const total = totalMatch ? Number(totalMatch[1]) : null

  const entries = []
  const seen = new Set()
  const anchors = extractAnchors(html)

  for (const anchor of anchors) {
    const href = anchor.href
    const title = anchor.text.replace(/\s+/g, " ").trim()
    if (!href.includes("/locals/")) continue
    if (!/^CUPE\s+\S+\s+-\s+/i.test(title)) continue
    const url = absolutize(href)
    if (seen.has(url)) continue
    seen.add(url)

    const nearby = html.slice(anchor.index, anchor.index + 900)
    const nearbyAnchors = extractAnchors(nearby)
    const siteAnchor = nearbyAnchors.find((a) => /^https?:\/\//i.test(a.href) && !a.href.includes("cupe.ca") && !/collective agreement|download/i.test(a.text))

    entries.push({
      page,
      title,
      url,
      site: siteAnchor ? decodeHtml(siteAnchor.href) : "",
      ...parseTitle(title),
    })
  }

  const next = /Page\s+\d+\s+of\s+\d+/i.test(plain)
    ? !new RegExp(`Page\\s+${Math.ceil((total || 0) / 20)}\\s+of\\s+${Math.ceil((total || 0) / 20)}`, "i").test(plain)
    : /rel=["']next["']|>\s*Next\s*<\/a>/i.test(html)

  return { entries, total, next }
}

function textBetween(text, start, end) {
  const s = text.toLowerCase().indexOf(start.toLowerCase())
  if (s === -1) return ""
  const from = s + start.length
  const e = text.toLowerCase().indexOf(end.toLowerCase(), from)
  return (e === -1 ? text.slice(from) : text.slice(from, e)).replace(/\s+/g, " ").trim()
}

function parseDetailPage(html) {
  const plain = stripTags(html)
  const title = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "")
  const anchors = extractAnchors(html)
  const websiteAnchor = anchors.find((a) => /Visit your local website/i.test(a.text) && /^https?:\/\//i.test(a.href))
  const agreementAnchor = anchors.find((a) => /Download your collective agreement/i.test(a.text))
  const areaOffice = textBetween(plain, "Your area office:", "Share this page")
    .replace(/View larger map.*$/i, "")
    .trim()
  const province = inferProvince(`${title} ${areaOffice}`)

  return {
    title,
    area_office: areaOffice,
    province,
    local_website: websiteAnchor ? decodeHtml(websiteAnchor.href) : "",
    collective_agreement_url: agreementAnchor ? absolutize(agreementAnchor.href) : "",
  }
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length)
  let index = 0
  async function run() {
    while (index < items.length) {
      const current = index++
      out[current] = await worker(items[current], current)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return out
}

function groupByProvince(entries) {
  const provinces = {}
  for (const entry of entries) {
    const province = entry.province || "À vérifier"
    provinces[province] ||= []
    provinces[province].push(entry)
  }
  for (const province of Object.keys(provinces)) {
    provinces[province].sort((a, b) => {
      const an = Number(String(a.local_number).replace(/\D/g, "")) || 999999
      const bn = Number(String(b.local_number).replace(/\D/g, "")) || 999999
      return an - bn || a.title.localeCompare(b.title, "fr")
    })
  }
  return provinces
}

function uniqueLocals(entries) {
  const map = new Map()
  for (const entry of entries) {
    const key = `${entry.province}::${entry.local_number || entry.title}`
    const existing = map.get(key) || {
      province: entry.province,
      local_number: entry.local_number,
      name: entry.local_number ? `CUPE ${entry.local_number}` : entry.title,
      websites: new Set(),
      area_offices: new Set(),
      units: [],
    }
    if (entry.local_website || entry.site) existing.websites.add(entry.local_website || entry.site)
    if (entry.area_office) existing.area_offices.add(entry.area_office)
    existing.units.push({ employer_or_unit: entry.employer_or_unit, title: entry.title, url: entry.url })
    map.set(key, existing)
  }
  return Array.from(map.values()).map((item) => ({
    ...item,
    websites: Array.from(item.websites),
    area_offices: Array.from(item.area_offices),
  }))
}

function buildCsv(entries) {
  const header = ["province", "local_number", "title", "employer_or_unit", "local_website", "area_office", "cupe_url", "collective_agreement_url"]
  const rows = entries.map((e) => header.map((key) => csvEscape(e[key])).join(","))
  return [header.join(","), ...rows].join("\n") + "\n"
}

function buildMarkdown(byProvince, uniques, rawCount, expectedTotal) {
  const generated = new Date().toISOString().slice(0, 10)
  const provinceRows = Object.entries(byProvince)
    .sort((a, b) => a[0].localeCompare(b[0], "fr"))
    .map(([province, entries]) => {
      const uniqueCount = new Set(entries.map((e) => e.local_number || e.title)).size
      return `| ${province} | ${uniqueCount} | ${entries.length} |`
    })
    .join("\n")

  const sections = Object.entries(byProvince)
    .sort((a, b) => a[0].localeCompare(b[0], "fr"))
    .map(([province, entries]) => {
      const locals = uniqueLocals(entries).sort((a, b) => {
        const an = Number(String(a.local_number).replace(/\D/g, "")) || 999999
        const bn = Number(String(b.local_number).replace(/\D/g, "")) || 999999
        return an - bn || a.name.localeCompare(b.name, "fr")
      })
      const table = locals.map((local) => {
        const units = local.units.slice(0, 6).map((u) => u.employer_or_unit.replace(/\|/g, "/")).join("; ")
        const more = local.units.length > 6 ? `; +${local.units.length - 6} autres unités` : ""
        const website = local.websites[0] || ""
        return `| ${local.name} | ${local.units.length} | ${units}${more} | ${website ? `[site](${website})` : "—"} |`
      }).join("\n")
      return `## ${province}\n\n| Local | Unités / conventions repérées | Employeurs ou unités | Site |\n|---|---:|---|---|\n${table}`
    })
    .join("\n\n")

  return `---\ntitle: SCFP / CUPE — sections locales par province\ndescription: Données générées depuis le répertoire officiel CUPE Find your local.\ntags: [cupe, scfp, sections-locales, donnees]\n---\n\n# SCFP / CUPE — sections locales par province\n\n> Données générées le ${generated} depuis [CUPE — Find your local](https://cupe.ca/locals). La source officielle expose des entrées par convention/unité. Cette page regroupe aussi les entrées par numéro de local pour éviter de confondre une section locale avec chacun de ses employeurs.\n\n## Résumé\n\n- Entrées brutes CUPE extraites : **${rawCount}**\n- Total annoncé par CUPE : **${expectedTotal || "non détecté"}**\n- Locaux uniques estimés : **${uniques.length}**\n- Source : https://cupe.ca/locals\n\n| Province / territoire | Locaux uniques estimés | Entrées brutes |\n|---|---:|---:|\n${provinceRows}\n\n## Important\n\nCUPE publie souvent plusieurs entrées pour un même local lorsqu'il représente plusieurs employeurs ou conventions collectives. Pour Fortisia, le niveau utile est généralement le **local unique**, mais les employeurs/unités restent utiles pour la prospection.\n\n${sections}\n\n---\n\nRetour à [[sections-locales/index|Sections locales]].\n`
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.mkdir(STATIC_DIR, { recursive: true })
  await fs.mkdir(CONTENT_DIR, { recursive: true })

  const all = []
  let expectedTotal = null

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = page === 0 ? START_URL : `${START_URL}?page=${page}`
    console.log(`Fetching list page ${page + 1}: ${url}`)
    const html = await fetchText(url)
    const parsed = parseListPage(html, page)

    if (parsed.total) expectedTotal = parsed.total

    if (DEBUG || page === 0) {
      console.log(`Page ${page + 1}: extracted ${parsed.entries.length} entries; total announced: ${parsed.total || "unknown"}`)
      if (parsed.entries[0]) console.log(`First entry: ${parsed.entries[0].title}`)
    }

    if (!parsed.entries.length) {
      const debugPath = path.join(OUT_DIR, `debug-cupe-page-${page + 1}.html`)
      await fs.writeFile(debugPath, html)
      throw new Error(`No entries extracted from ${url}. Saved debug HTML to ${debugPath}`)
    }

    all.push(...parsed.entries)
    if (expectedTotal && all.length >= expectedTotal) break
    if (!parsed.next) break
  }

  const seen = new Map()
  for (const entry of all) {
    const key = entry.url
    if (!seen.has(key)) seen.set(key, entry)
  }
  const listEntries = Array.from(seen.values())
  console.log(`List entries: ${all.length}; unique detail pages: ${listEntries.length}; expected total: ${expectedTotal || "unknown"}`)

  const enriched = await mapLimit(listEntries, DETAIL_CONCURRENCY, async (entry, i) => {
    if ((i + 1) % 50 === 0 || i === 0) console.log(`Fetching details ${i + 1}/${listEntries.length}`)
    try {
      const html = await fetchText(entry.url)
      const detail = parseDetailPage(html)
      return { ...entry, ...detail, source: "CUPE Find your local" }
    } catch (error) {
      return { ...entry, province: "À vérifier", error: error.message, source: "CUPE Find your local" }
    }
  })

  const byProvince = groupByProvince(enriched)
  const uniques = uniqueLocals(enriched)
  const generatedAt = new Date().toISOString()
  const payload = { generated_at: generatedAt, source: START_URL, expected_total: expectedTotal, raw_count: enriched.length, unique_local_count: uniques.length, entries: enriched }
  const groupedPayload = { generated_at: generatedAt, source: START_URL, expected_total: expectedTotal, raw_count: enriched.length, unique_local_count: uniques.length, provinces: byProvince, unique_locals: uniques }

  await fs.writeFile(path.join(OUT_DIR, "cupe-locals-raw.json"), JSON.stringify(payload, null, 2))
  await fs.writeFile(path.join(OUT_DIR, "cupe-locals-by-province.json"), JSON.stringify(groupedPayload, null, 2))
  await fs.writeFile(path.join(OUT_DIR, "cupe-locals.csv"), buildCsv(enriched))
  await fs.writeFile(path.join(STATIC_DIR, "cupe-locals.json"), JSON.stringify(groupedPayload))
  await fs.writeFile(path.join(CONTENT_DIR, "scfp-cupe.md"), buildMarkdown(byProvince, uniques, enriched.length, expectedTotal))

  console.log("Done.")
  console.log(`Raw entries: ${enriched.length}`)
  console.log(`Expected total from CUPE: ${expectedTotal || "unknown"}`)
  console.log(`Unique locals: ${uniques.length}`)
  console.log(`Provinces / territories: ${Object.keys(byProvince).length}`)
  console.log("Outputs:")
  console.log("- data/cupe/cupe-locals.csv")
  console.log("- data/cupe/cupe-locals-raw.json")
  console.log("- data/cupe/cupe-locals-by-province.json")
  console.log("- quartz/static/data/cupe-locals.json")
  console.log("- content/sections-locales/scfp-cupe.md")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
