const MOCK_ARTICLES = Array.from({ length: 60 }, (_, i) => ({
  source: { name: ["BBC Sport", "ESPN", "Reuters", "CNN"][i % 4] },
  title: `Sample headline number ${i + 1}`,
  description: "Placeholder text used to test the layout without calling the API.",
  url: "https://example.com",
  urlToImage: `https://picsum.photos/seed/${i}/600/400`,
  publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
}));

const mockFetch = (url) =>
  new Promise((resolve) => {
    const page = Number(new URL(url).searchParams.get("page")) || 1;
    const start = (page - 1) * CONFIG.pageSize;
    setTimeout(() => resolve({
      articles: MOCK_ARTICLES.slice(start, start + CONFIG.pageSize),
      total: MOCK_ARTICLES.length,
    }), 800);
  });