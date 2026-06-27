const state = {
  manifest: null,
  matches: [],
  filtered: [],
  selectedId: null,
  detail: null,
  tab: "transcript",
  filters: {
    search: "",
    domain: "",
    truthType: "",
    winner: "",
    agent: "",
  },
}

const elements = {
  status: document.querySelector("#ledger-status"),
  resultCount: document.querySelector("#result-count"),
  list: document.querySelector("#match-list"),
  loading: document.querySelector("#detail-loading"),
  content: document.querySelector("#detail-content"),
  search: document.querySelector("#search"),
  domain: document.querySelector("#domain-filter"),
  truthType: document.querySelector("#truth-filter"),
  agent: document.querySelector("#agent-filter"),
  clear: document.querySelector("#clear-filters"),
  detailId: document.querySelector("#detail-id"),
  detailTitle: document.querySelector("#detail-title"),
  detailMetadata: document.querySelector("#detail-metadata"),
  sourceLink: document.querySelector("#source-link"),
  rawJsonLink: document.querySelector("#raw-json-link"),
  proAgent: document.querySelector("#pro-agent"),
  conAgent: document.querySelector("#con-agent"),
  proModel: document.querySelector("#pro-model"),
  conModel: document.querySelector("#con-model"),
  winner: document.querySelector("#winner"),
  judgeSplit: document.querySelector("#judge-split"),
  panel: document.querySelector("#detail-panel"),
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function titleCase(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value, withTime = false) {
  const options = withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }
  return new Intl.DateTimeFormat("en", options).format(new Date(value))
}

function formatNumber(value) {
  return new Intl.NumberFormat("en").format(value ?? 0)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function populateSelect(select, values) {
  for (const value of values) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = titleCase(value)
    select.append(option)
  }
}

function applyFilters() {
  const query = state.filters.search.trim().toLowerCase()
  state.filtered = state.matches.filter((match) => {
    const agents = [match.pro_agent.name, match.con_agent.name]
    return (
      (!query
        || match.conjecture.statement.toLowerCase().includes(query)
        || match.match_id.toLowerCase().includes(query))
      && (!state.filters.domain || match.conjecture.domain === state.filters.domain)
      && (!state.filters.truthType || match.conjecture.truth_type === state.filters.truthType)
      && (!state.filters.winner || match.result.winner === state.filters.winner)
      && (!state.filters.agent || agents.includes(state.filters.agent))
    )
  })
  renderList()
}

function renderList() {
  elements.resultCount.textContent = `${state.filtered.length} of ${state.matches.length}`
  if (!state.filtered.length) {
    elements.list.replaceChildren(document.querySelector("#empty-template").content.cloneNode(true))
    return
  }
  elements.list.innerHTML = state.filtered.map((match) => {
    const split = match.result.judge_split
    const selected = match.match_id === state.selectedId
    return `
      <button class="match-row${selected ? " selected" : ""}" type="button" data-match-id="${escapeHtml(match.match_id)}" aria-pressed="${selected}">
        <span class="match-row-top">
          <time datetime="${escapeHtml(match.created_at)}">${escapeHtml(formatDate(match.created_at))}</time>
          <span class="winner-label ${escapeHtml(match.result.winner)}">${escapeHtml(match.result.winner)}</span>
        </span>
        <h3>${escapeHtml(match.conjecture.statement)}</h3>
        <span class="match-row-bottom">
          <span class="match-row-meta">${escapeHtml(titleCase(match.conjecture.domain))} · ${escapeHtml(match.pro_agent.name)} vs ${escapeHtml(match.con_agent.name)}</span>
          <span class="match-row-meta">${split.pro}-${split.con}-${split.tie}</span>
        </span>
      </button>
    `
  }).join("")
  for (const row of elements.list.querySelectorAll("[data-match-id]")) {
    row.addEventListener("click", () => selectMatch(row.dataset.matchId))
  }
}

async function selectMatch(matchId) {
  const summary = state.matches.find((match) => match.match_id === matchId)
  if (!summary) return
  state.selectedId = matchId
  state.tab = "transcript"
  renderList()
  elements.loading.hidden = false
  elements.loading.textContent = "Loading match artifacts..."
  elements.content.hidden = true
  try {
    const response = await fetch(`./db/${summary.paths.detail}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    state.detail = await response.json()
    renderDetail(summary)
  } catch (error) {
    elements.loading.innerHTML = `<div class="error-state">Could not load match detail: ${escapeHtml(error.message)}</div>`
  }
}

function renderDetail(summary) {
  const match = state.detail.match
  const split = match.result.judge_split
  elements.detailId.textContent = match.match_id
  elements.detailTitle.textContent = match.conjecture.statement
  elements.detailMetadata.innerHTML = [
    titleCase(match.conjecture.domain),
    titleCase(match.conjecture.truth_type),
    match.protocol.id,
    formatDate(match.created_at, true),
    `${formatNumber(summary.usage.total_tokens)} model tokens`,
  ].map((value) => `<span>${escapeHtml(value)}</span>`).join("")
  elements.sourceLink.href = state.detail.source_url
  elements.rawJsonLink.href = `./db/${summary.paths.detail}`
  elements.proAgent.textContent = match.agents.pro.name
  elements.conAgent.textContent = match.agents.con.name
  elements.proModel.textContent = summary.pro_agent.model ?? match.agents.pro.adapter
  elements.conModel.textContent = summary.con_agent.model ?? match.agents.con.adapter
  elements.winner.textContent = titleCase(match.result.winner)
  elements.winner.className = `winner-label ${match.result.winner}`
  elements.judgeSplit.textContent = `Pro ${split.pro} · Con ${split.con} · Tie ${split.tie}`
  for (const tab of document.querySelectorAll("[data-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === state.tab))
  }
  elements.loading.hidden = true
  elements.content.hidden = false
  renderPanel()
}

function paragraphs(text) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("")
}

function renderTranscript(match) {
  return match.transcript.map((turn) => `
    <section class="turn ${escapeHtml(turn.speaker)}">
      <div class="turn-label">
        <strong>${escapeHtml(turn.speaker.toUpperCase())}</strong>
        <span>${escapeHtml(titleCase(turn.phase))}</span>
        <small>${escapeHtml(turn.time_used_sec.toFixed(1))}s · ${formatNumber(turn.tokens_estimate)} tokens</small>
      </div>
      <div class="turn-body">${paragraphs(turn.text)}</div>
    </section>
  `).join("")
}

function renderScorecard(match) {
  const split = match.result.judge_split
  const judges = match.judge_votes.map((vote) => `
    <section class="judge-section">
      <h3>${escapeHtml(vote.judge_id)}</h3>
      <p><strong>${escapeHtml(titleCase(vote.winner))}</strong> at ${Math.round(vote.confidence * 100)}% confidence</p>
      <dl>
        ${Object.entries(vote.scores.pro).map(([name, score]) => `
          <dt>${escapeHtml(titleCase(name))}</dt>
          <dd>Pro ${escapeHtml(score)} · Con ${escapeHtml(vote.scores.con[name])}</dd>
        `).join("")}
      </dl>
    </section>
  `).join("")
  return `
    <div class="score-summary">
      <div><span>Judge split</span><strong>${split.pro}-${split.con}-${split.tie}</strong></div>
      <div><span>Mean confidence</span><strong>${Math.round(match.result.confidence_mean * 100)}%</strong></div>
      <div><span>Flags</span><strong>${match.result.flags.length}</strong></div>
    </div>
    ${judges}
  `
}

function renderJudges(match) {
  return match.judge_votes.map((vote) => `
    <section class="judge-section">
      <h3>${escapeHtml(vote.judge_id)}</h3>
      <p>Vote: <strong>${escapeHtml(titleCase(vote.winner))}</strong> · Confidence: ${Math.round(vote.confidence * 100)}%</p>
      <p>Model: ${escapeHtml(vote.metadata?.model ?? "not declared")}</p>
      <dl>
        ${vote.decisive_moments.map((moment) => `
          <dt>${escapeHtml(moment.turn_id)}</dt>
          <dd>${escapeHtml(moment.reason)}</dd>
        `).join("") || "<dt>Decisive moments</dt><dd>None recorded</dd>"}
      </dl>
    </section>
  `).join("")
}

function renderPanel() {
  if (!state.detail) return
  const match = state.detail.match
  elements.panel.innerHTML = state.tab === "transcript"
    ? renderTranscript(match)
    : state.tab === "scorecard"
      ? renderScorecard(match)
      : renderJudges(match)
}

function setWinnerFilter(value) {
  state.filters.winner = value
  for (const button of document.querySelectorAll("[data-winner]")) {
    button.classList.toggle("active", button.dataset.winner === value)
  }
  applyFilters()
}

function bindFilters() {
  elements.search.addEventListener("input", () => {
    state.filters.search = elements.search.value
    applyFilters()
  })
  elements.domain.addEventListener("change", () => {
    state.filters.domain = elements.domain.value
    applyFilters()
  })
  elements.truthType.addEventListener("change", () => {
    state.filters.truthType = elements.truthType.value
    applyFilters()
  })
  elements.agent.addEventListener("change", () => {
    state.filters.agent = elements.agent.value
    applyFilters()
  })
  for (const button of document.querySelectorAll("[data-winner]")) {
    button.addEventListener("click", () => setWinnerFilter(button.dataset.winner))
  }
  for (const tab of document.querySelectorAll("[data-tab]")) {
    tab.addEventListener("click", () => {
      state.tab = tab.dataset.tab
      for (const candidate of document.querySelectorAll("[data-tab]")) {
        candidate.setAttribute("aria-selected", String(candidate === tab))
      }
      renderPanel()
    })
  }
  elements.clear.addEventListener("click", () => {
    state.filters = { search: "", domain: "", truthType: "", winner: "", agent: "" }
    elements.search.value = ""
    elements.domain.value = ""
    elements.truthType.value = ""
    elements.agent.value = ""
    setWinnerFilter("")
  })
}

async function init() {
  bindFilters()
  try {
    const [manifestResponse, matchesResponse] = await Promise.all([
      fetch("./db/index.json"),
      fetch("./db/matches.json"),
    ])
    if (!manifestResponse.ok || !matchesResponse.ok) throw new Error("Public DB unavailable")
    state.manifest = await manifestResponse.json()
    state.matches = await matchesResponse.json()
    state.filtered = state.matches
    elements.status.textContent = `${state.manifest.match_count} matches · through ${formatDate(state.manifest.ledger_through)}`
    populateSelect(elements.domain, unique(state.matches.map((match) => match.conjecture.domain)))
    populateSelect(elements.truthType, unique(state.matches.map((match) => match.conjecture.truth_type)))
    populateSelect(elements.agent, unique(state.matches.flatMap((match) => [match.pro_agent.name, match.con_agent.name])))
    renderList()
    const requested = new URLSearchParams(window.location.search).get("match")
    await selectMatch(requested && state.matches.some((match) => match.match_id === requested)
      ? requested
      : state.manifest.default_match_id ?? state.matches.at(-1)?.match_id)
  } catch (error) {
    elements.status.textContent = "Ledger unavailable"
    elements.list.innerHTML = `<div class="error-state">Could not load the public match database: ${escapeHtml(error.message)}</div>`
  }
}

init()
