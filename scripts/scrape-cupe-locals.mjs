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
const USER_AGENT = "Fortisia cartographie syndicale scraper (contact: ngendron@fortisia.com)"

const provinceFromOffice = [
  [/ONTARIO|MARKHAM|TORONTO|OTTAWA|HAMILTON|LONDON|THUNDER BAY|SUDBURY|WINDSOR|KINGSTON|NORTH BAY|PETERBOROUGH|SAULT STE/i, "Ontario"],
  [/BRITISH COLUMBIA|BURNABY|VANCOUVER|VICTORIA|KELOWNA|PRINCE GEORGE|NANAIMO|SURREY/i, "Colombie-Britannique"],
  [/ALBERTA|CALGARY|EDMONTON|RED DEER|LETHBRIDGE|FORT MCMURRAY/i, "Alberta"],
  [/SASKATCHEWAN|REGINA|SASKATOON|MOOSE JAW|PRINCE ALBERT/i, "Saskatchewan"],
  [/MANITOBA|WINNIPEG|BRANDON|THOMPSON/i, "Manitoba"],
  [/QUEBEC|QUÉBEC|MONTREAL|MONTRÉAL|LONGUEUIL|LAVAL|SHERBROOKE|GATINEAU|SCFP/i, "Québec"],
  [/NEW BRUNSWICK|NOUVEAU-BRUNSWICK|FREDERICTON|MONCTON|SAINT JOHN/i, "Nouveau-Brunswick"],
  [/NOVA SCOTIA|NOUVELLE-ÉCOSSE|HALIFAX|DARTMOUTH|SYDNEY/i, "Nouvelle-Écosse"],
  [/NEWFOUNDLAND|LABRADOR|ST\. JOHN|ST JOHN|TERRE-NEUVE/i, "Terre-Neuve-et-Labrador"],
  [/PRINCE EDWARD ISLAND|ÎLE-DU-PRINCE|CHARLOTTETOWN/i, "Île-du-Prince-Édouard"],
  [/YUKON|WHITEHORSE/i, "Yukon"],
  [/NORTHWEST TERRITORIES|TERRITOIRES DU NORD-OUEST|YELLOWKNIFE/i, "Territoires du Nord-Ouest"],
  [/NUNAVUT|IQALUIT/i, "Nunavut"],
]

function decodeHtml(input = "") {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function stripTags(input = "") {
  return decodeHtml(input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
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
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

function parseListPage(html, page) {
  const resultsText = stripTags(html.match(/Results\s+\d+\s+-\s+\d+\s+of\s+\d+/i)?.[0] || "")
  const totalMatch = resultsText.match(/of\s+(\d+)/i)
  const total = totalMatch ? Number(totalMatch[1]) : null

  const entries = []
  const linkRegex = /<a\s+[^>]*href="([^"]*\/locals\/[^"]+)"[^>]*>\s*(CUPE\s+[^<]+?)\s*<\/a>/gi
  let match
  while ((match = linkRegex.exec(html))) {
    const href = decodeHtml(match[1])
    const title = stripTags(match[2])
    if (!/^CUPE\s+/i.test(title)) continue
    const url = href.startsWith("http") ? href : `${BASE}${href}`
    const nearby = html.slice(match.index, match.index + 600)
    const site = nearby.match(/<a\s+[^>]*href="(https?:\/\/[^"]+)"[^>]*>[^<]*<\/a>/i)?.[1] || ""
    entries.push({ page, title, url, site: decodeHtml(site), ...parseTitle(title) })
  }

  const next = /rel="next"|>\s*Next\s*<\/a>/i.test(html)
  return { entries, total, next }
}

function parseDetailPage(html) {
  const title = stripTags(html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1] || "")
  const officeBlockMatch = html.match(/Your area office:\s*<\/[^>]+>([\s\S]*?)(?:<h2|<footer|Share this page)/i)
  const officeBlock = officeBlockMatch ? stripTags(officeBlockMatch[1]) : ""
  const areaOffice = officeBlock.replace(/View larger map.*$/i, "").trim()
  const province = inferProvince(`${title} ${areaOffice}`)
  const website = html.match(/Visit your local website[\s\S]*?href="(https?:\/\/[^"]+)"/i)?.[1] || ""
  const agreement = html.match(/Download your collective agreement[\s\S]*?href="([^"]+)"/i)?.[1] || ""
  return {
    title,
    area_office: areaOffice,
    province,
    local_website: decodeHtml(website),
    collective_agreement_url: agreement ? (agreement.startsWith("http") ? agreement : `${BASE}${agreement}`) : "",
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

function buildMarkdown(byProvince, uniques, rawCount) {
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
        const units = local.units.slice(0, 6).map((u) => u.employer_or_unit).join("; ")
        const more = local.units.length > 6 ? `; +${local.units.length - 6} autres unités` : ""
        const website = local.websites[0] || ""
        return `| ${local.name} | ${local.units.length} | ${units}${more} | ${website ? `[site](${website})` : "—"} |`
      }).join("\n")
      return `## ${province}\n\n| Local | Unités / conventions repérées | Employeurs ou unités | Site |\n|---|---:|---|---|\n${table}`
    })
    .join("\n\n")

  return `---\ntitle: SCFP / CUPE — sections locales par province\ndescription: Données générées depuis le répertoire officiel CUPE Find your local.\ntags: [cupe, scfp, sections-locales, donnees]\n---\n\n# SCFP / CUPE — sections locales par province\n\n> Données générées le ${generated} depuis [CUPE — Find your local](https://cupe.ca/locals). La source officielle expose des entrées par convention/unité. Cette page regroupe aussi les entrées par numéro de local pour éviter de confondre une section locale avec chacun de ses employeurs.\n\n## Résumé\n\n- Entrées brutes CUPE : **${rawCount}**\n- Locaux uniques estimés : **${uniques.length}**\n- Source : https://cupe.ca/locals\n\n| Province / territoire | Locaux uniques estimés | Entrées brutes |\n|---|---:|---:|\n${provinceRows}\n\n## Important\n\nCUPE publie souvent plusieurs entrées pour un même local lorsqu'il représente plusieurs employeurs ou conventions collectives. Pour Fortisia, le niveau utile est généralement le **local unique**, mais les employeurs/unités restent utiles pour la prospection.\n\n${sections}\n\n---\n\nRetour à [[sections-locales/index|Sections locales]].\n`
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
    if (!parsed.entries.length) break
    all.push(...parsed.entries)
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
    if ((i + 1) % 50 === 0) console.log(`Fetching details ${i + 1}/${listEntries.length}`)
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
  await fs.writeFile(path.join(CONTENT_DIR, "scfp-cupe.md"), buildMarkdown(byProvince, uniques, enriched.length))

  console.log(`Done. Raw entries: ${enriched.length}. Unique locals: ${uniques.length}. Provinces: ${Object.keys(byProvince).length}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
