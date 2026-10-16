"use strict";

/* ---------- Configuration ---------- */
const CONFIG = {
  useMock: true,
  apiKey: ENV.NEWS_API_KEY,
  endpoint: "https://newsapi.org/v2/top-headlines",
  searchEndpoint: "https://newsapi.org/v2/everything",
  pageSize: 30,
  placeholderImage: "https://placehold.co/600x400?text=No+Image",
  defaults: { country: "us", category: "sports" },
};

const COUNTRY_CODES = [
  "ae", "ar", "at", "au", "be", "bg", "br", "ca", "ch", "cn", "co", "cu", "cz",
  "de", "dz", "eg", "fr", "gb", "gh", "gr", "hk", "hu", "id", "ie", "il", "in",
  "iq", "it", "jo", "jp", "ke", "kr", "kw", "lb", "lt", "lv", "ly", "ma", "mx",
  "my", "ng", "nl", "no", "nz", "pk", "ph", "pl", "pt", "qa", "ro", "rs", "ru",
  "sa", "se", "sg", "si", "sk", "th", "tn", "tr", "tw", "ua", "us", "ve", "za",
];

const CATEGORIES = [
  "business", "entertainment", "general", "health", "science", "sports", "technology",
];

/* ---------- State ---------- */
const state = {
  country: CONFIG.defaults.country,
  category: CONFIG.defaults.category,
  articles: [],
  strategy: null,
  page: 1,
  loaded: 0,
  total: 0,
};

/* ---------- DOM references ---------- */
const els = {
  form: document.getElementById("filterForm"),
  country: document.getElementById("countrySelect"),
  category: document.getElementById("categorySelect"),
  reset: document.getElementById("resetBtn"),
  news: document.getElementById("news"),
  status: document.getElementById("status"),
  info: document.getElementById("resultInfo"),
  loadMore: document.getElementById("loadMoreBtn"),
};

/* ---------- Helpers ---------- */
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const escapeHtml = (text = "") =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getCountryName = (() => {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return (code) => names.of(code.toUpperCase());
})();

const buildUrl = (endpoint, params, page = 1) => {
  const query = new URLSearchParams({
    ...params,
    page,
    pageSize: CONFIG.pageSize,
    apiKey: CONFIG.apiKey,
  });
  return `${endpoint}?${query}`;
};

const isValidArticle = (article) => article.title && article.title !== "[Removed]";

// Ordered list of attempts. The first one that returns articles wins.
const getStrategies = ({ country, category }) => {
  const countryName = getCountryName(country);
  const topic = category === "general" ? "" : ` AND ${category}`;

  return [
    { url: (page) => buildUrl(CONFIG.endpoint, { country, category }, page) },
    { url: (page) => buildUrl(CONFIG.endpoint, { country }, page) },
    {
      url: (page) =>
        buildUrl(CONFIG.searchEndpoint, {
          q: `"${countryName}"${topic}`,
          language: "en",
          sortBy: "publishedAt",
        }, page),
    },
  ];
};

/* ---------- API (AJAX with XMLHttpRequest) ---------- */
const fetchArticles = (url) =>
  
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);

    request.onload = () => {
      let body;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        reject(new Error("Invalid response from server."));
        return;
      }

      if (request.status === 200) {
        resolve({ articles: body.articles ?? [], total: body.totalResults ?? 0 });
      } else {
        reject(new Error(body.message || `Request failed (status ${request.status}).`));
      }
    };

    request.onerror = () => reject(new Error("Network error. Check your connection."));
    request.ontimeout = () => reject(new Error("The request timed out."));
    request.timeout = 10000;

    request.send();
  });

/* ---------- Rendering ---------- */
const showStatus = (html) => {
  els.status.innerHTML = html;
};

const skeletonCard = () => `
  <div class="col-12 col-md-6 col-lg-4">
    <div class="card news-card h-100 shadow-sm" aria-hidden="true">
      <div class="placeholder-glow">
        <span class="placeholder w-100 d-block" style="height: 200px"></span>
      </div>
      <div class="card-body placeholder-glow">
        <span class="placeholder col-4 d-block mb-2"></span>
        <span class="placeholder col-12 d-block mb-2"></span>
        <span class="placeholder col-10 d-block mb-2"></span>
        <span class="placeholder col-3 d-block"></span>
      </div>
    </div>
  </div>`;

const showLoading = () => {
  els.info.textContent = "";
  showStatus("");
  els.loadMore.classList.add("d-none");
  els.news.innerHTML = skeletonCard().repeat(6);
};

const showError = (message) => {
  els.news.innerHTML = "";
  els.info.textContent = "";
  showStatus(`<div class="alert alert-danger">${escapeHtml(message)}</div>`);
};

const createCard = (article) => {
  const image = article.urlToImage || CONFIG.placeholderImage;
  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString()
    : "";

  return `
    <div class="col-12 col-md-6 col-lg-4">
      <div class="card news-card h-100 shadow-sm">
        <img src="${escapeHtml(image)}" class="card-img-top" alt="" loading="lazy">
        <div class="card-body d-flex flex-column">
          <span class="news-source text-primary mb-1">${escapeHtml(article.source?.name ?? "Unknown")}</span>
          <h5 class="card-title">${escapeHtml(article.title)}</h5>
          <p class="card-text">${escapeHtml(article.description ?? "")}</p>
          <div class="mt-auto d-flex justify-content-between align-items-center">
            <small class="text-muted">${date}</small>
            <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Read more</a>
          </div>
        </div>
      </div>
    </div>
  `;
};

const showInfo = () => {
  els.info.textContent = `${state.articles.length} articles · ${getCountryName(state.country)} · ${capitalize(state.category)}`;
};

const updateLoadMore = () => {
  els.loadMore.classList.toggle("d-none", state.loaded >= state.total);
  els.loadMore.disabled = false;
  els.loadMore.textContent = "Load more";
};

const renderArticles = () => {
  if (state.articles.length === 0) {
    els.news.innerHTML = "";
    els.info.textContent = "";
    showStatus('<div class="alert alert-info">No articles found for this selection.</div>');
    return;
  }

  showStatus("");
  showInfo();
  els.news.innerHTML = state.articles.map(createCard).join("");
  updateLoadMore();
};

/* ---------- Controller ---------- */
const loadNews = async () => {
  showLoading();

  try {
    for (const strategy of getStrategies(state)) {
      const { articles, total } = await fetchArticles(strategy.url(1));
      state.strategy = strategy;
      state.page = 1;
      state.loaded = articles.length;
      state.total = total;
      state.articles = articles.filter(isValidArticle);
      if (state.articles.length > 0) break;
    }
    renderArticles();
  } catch (error) {
    showError(error.message);
  }
};

const loadMore = async () => {
  els.loadMore.disabled = true;
  els.loadMore.textContent = "Loading...";

  try {
    const { articles, total } = await fetchArticles(state.strategy.url(state.page + 1));
    const fresh = articles.filter(isValidArticle);
    state.page += 1;
    state.loaded += articles.length;
    state.total = total;
    state.articles.push(...fresh);
    els.news.insertAdjacentHTML("beforeend", fresh.map(createCard).join(""));
    showInfo();
    updateLoadMore();
  } catch (error) {
    els.loadMore.classList.add("d-none");
    showStatus(`<div class="alert alert-warning">${escapeHtml(error.message)}</div>`);
  }
};

const populateSelect = (select, options, selectedValue) => {
  select.innerHTML = options
    .map(({ value, label }) => `
      <option value="${value}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>
    `)
    .join("");
};

const initFilters = () => {
  const countries = COUNTRY_CODES
    .map((code) => ({ value: code, label: getCountryName(code) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const categories = CATEGORIES.map((c) => ({ value: c, label: capitalize(c) }));

  populateSelect(els.country, countries, state.country);
  populateSelect(els.category, categories, state.category);
};

const applyFilters = () => {
  state.country = els.country.value;
  state.category = els.category.value;
  loadNews();
};

const resetFilters = () => {
  els.country.value = CONFIG.defaults.country;
  els.category.value = CONFIG.defaults.category;
  applyFilters();
};

/* ---------- Init ---------- */
const init = () => {
  initFilters();

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });
  els.country.addEventListener("change", applyFilters);
  els.category.addEventListener("change", applyFilters);
  els.reset.addEventListener("click", resetFilters);
  els.loadMore.addEventListener("click", loadMore);

  // Fallback image if an article image fails to load (error events don't bubble)
  els.news.addEventListener(
    "error",
    (event) => {
      if (event.target.tagName === "IMG" && event.target.src !== CONFIG.placeholderImage) {
        event.target.src = CONFIG.placeholderImage;
      }
    },
    true
  );

  loadNews();
};

document.addEventListener("DOMContentLoaded", init);