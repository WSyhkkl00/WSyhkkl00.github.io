const fs = require('fs-extra');
const path = require('path');

class TemplateEngine {
  constructor(config) {
    this.config = config;
    this.themeDir = path.join(__dirname, '..', 'themes', config.theme.name);
    this.cssPath = path.join(this.themeDir, 'assets', 'css', 'style.css');
    this.cachedCss = null;
  }

  async getCss() {
    if (this.cachedCss) return this.cachedCss;

    if (await fs.pathExists(this.cssPath)) {
      this.cachedCss = await fs.readFile(this.cssPath, 'utf8');
    } else {
      this.cachedCss = '';
    }
    return this.cachedCss;
  }

  async renderPost(post) {
    const site = this.config.site;
    const css = await this.getCss();

    const html = `<!DOCTYPE html>
<html lang="${site.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.title} - ${site.title}</title>
  <style>${css}</style>
</head>
<body class="post-page">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">${site.title}</a></h1>
      ${site.subtitle ? `<p class="site-subtitle">${site.subtitle}</p>` : ''}
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <article class="post">
        <header class="post-header">
          <h1 class="post-title">${post.title}</h1>
          <div class="post-meta">
            <time datetime="${this.formatDate(post.date)}">${this.formatDate(post.date)}</time>
            ${post.author ? `<span class="post-author">by ${post.author}</span>` : ''}
            ${post.readingTime ? `<span class="post-reading-time">${post.readingTime} min read</span>` : ''}
          </div>
          ${post.categories && post.categories.length > 0 ? `
          <div class="post-categories">
            ${post.categories.map(cat => `<a href="/categories/${cat}/" class="category-tag">${cat}</a>`).join('')}
          </div>
          ` : ''}
        </header>

        <div class="post-main">
          <div class="post-content">
            ${post.content}
          </div>

          ${post.tags && post.tags.length > 0 ? `
          <footer class="post-footer">
            <div class="post-tags">
              ${post.tags.map(tag => `<a href="/tags/${tag}/" class="tag">#${tag}</a>`).join('')}
            </div>
          </footer>
          ` : ''}
        </div>

        ${post.toc && post.toc.length > 0 ? `
        <aside class="post-sidebar">
          <nav class="post-toc">
            <div class="post-toc-title">目录</div>
            <ul class="post-toc-list">
              ${this.renderTOCItems(post.toc)}
            </ul>
          </nav>
        </aside>
        ` : ''}
      </article>
    </main>

    <footer class="site-footer">
      <p>&copy; ${site.author} - Powered by Shiori</p>
    </footer>
  </div>
</body>
</html>`;

    return html;
  }

  async renderIndex(posts, pagination) {
    const site = pagination.site || this.config.site;
    const css = await this.getCss();

    const postsList = posts.map(post => `
      <article class="post-item">
        <header class="post-item-header">
          <h2 class="post-item-title">
            <a href="/${post.url}/">${post.title}</a>
          </h2>
          <time class="post-item-date" datetime="${this.formatDate(post.date)}">${this.formatDate(post.date)}</time>
        </header>
        ${post.tags && post.tags.length > 0 ? `
        <div class="post-item-tags">
          ${post.tags.map(tag => `<a href="/tags/${tag}/" class="tag">#${tag}</a>`).join('')}
        </div>
        ` : ''}
      </article>
    `).join('');

    const paginationHtml = (pagination && pagination.totalPages > 1) ? `
      <nav class="pagination">
        ${pagination.hasPrev ? `<a href="${pagination.currentPage === 2 ? '/' : `/page/${pagination.currentPage - 1}/`}" class="prev">&larr; Previous</a>` : ''}
        <span class="page-info">Page ${pagination.currentPage} of ${pagination.totalPages}</span>
        ${pagination.hasNext ? `<a href="/page/${pagination.currentPage + 1}/" class="next">Next &rarr;</a>` : ''}
      </nav>
    ` : '';

    const sidebarHtml = pagination.featuredPosts && pagination.featuredPosts.length > 0 ? `
    <aside class="sidebar">
      <div class="sidebar-card">
        <!-- Author Section -->
        <div class="author-card">
          ${site.avatar ? `<img src="${site.avatar}" alt="${site.author}" class="author-avatar">` : ''}
          <h3 class="author-name">${site.author}</h3>
          ${site.bio ? `<p class="author-bio">${site.bio}</p>` : ''}
        </div>

        <!-- Featured Posts Section -->
        <div class="featured-card">
          <h3 class="sidebar-title">Featured Posts</h3>
          <ul class="featured-list">
            ${pagination.featuredPosts.map(post => `
              <li class="featured-item">
                <a href="/${post.url}/" class="featured-link">
                  <span class="featured-title">${post.title}</span>
                  <time class="featured-date">${this.formatDate(post.date)}</time>
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    </aside>
    ` : '';

    const html = `<!DOCTYPE html>
<html lang="${site.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${site.title}</title>
  <style>${css}</style>
</head>
<body class="home-page">
  <div class="container home-layout">
    <header class="site-header">
      <h1 class="site-title"><a href="/">${site.title}</a></h1>
      ${site.subtitle ? `<p class="site-subtitle">${site.subtitle}</p>` : ''}
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <div class="home-grid">
      <main class="main-content">
        <div class="posts-list">
          ${postsList}
        </div>
        ${paginationHtml}
      </main>

      ${sidebarHtml}
    </div>

    <footer class="site-footer">
      <p>&copy; ${site.author} - Powered by Shiori</p>
    </footer>
  </div>
</body>
</html>`;

    return html;
  }

  async renderCategory(category, posts) {
    const site = this.config.site;
    const css = await this.getCss();

    const postsList = posts.map(post => `
      <article class="post-item">
        <h2><a href="/${post.url}/">${post.title}</a></h2>
        <time>${this.formatDate(post.date)}</time>
      </article>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="${site.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Category: ${category} - ${site.title}</title>
  <style>${css}</style>
</head>
<body class="category-page">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">${site.title}</a></h1>
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <h1>Category: ${category}</h1>
      <div class="posts-list">
        ${postsList}
      </div>
    </main>
  </div>
</body>
</html>`;

    return html;
  }

  async renderTag(tag, posts) {
    const site = this.config.site;
    const css = await this.getCss();

    const postsList = posts.map(post => `
      <article class="post-item">
        <h2><a href="/${post.url}/">${post.title}</a></h2>
        <time>${this.formatDate(post.date)}</time>
      </article>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="${site.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tag: ${tag} - ${site.title}</title>
  <style>${css}</style>
</head>
<body class="tag-page">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">${site.title}</a></h1>
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <h1>Tag: ${tag}</h1>
      <div class="posts-list">
        ${postsList}
      </div>
    </main>
  </div>
</body>
</html>`;

    return html;
  }

  async renderArchive(posts) {
    const site = this.config.site;
    const css = await this.getCss();

    // Group posts by year and month
    const grouped = {};
    posts.forEach(post => {
      const date = new Date(post.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];
      grouped[year][month].push(post);
    });

    const archiveHtml = Object.entries(grouped).map(([year, months]) => `
      <div class="archive-year">
        <h2>${year}</h2>
        ${Object.entries(months).map(([month, monthPosts]) => `
        <div class="archive-month">
          <h3>${month}</h3>
          <ul>
            ${monthPosts.map(post => `
            <li><time>${this.formatDate(post.date)}</time> - <a href="/${post.url}/">${post.title}</a></li>
            `).join('')}
          </ul>
        </div>
        `).join('')}
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="${site.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Archives - ${site.title}</title>
  <style>${css}</style>
</head>
<body class="archive-page">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">${site.title}</a></h1>
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <h1>Archives</h1>
      <div class="archive">
        ${archiveHtml}
      </div>
    </main>
  </div>
</body>
</html>`;

    return html;
  }

  async renderCategoriesIndex(categories) {
    const site = this.config.site;
    const css = await this.getCss();

    // Generate categories list HTML
    let categoriesListHtml = '';
    if (categories && Object.keys(categories).length > 0) {
      categoriesListHtml = '<div class="categories-list">';
      for (const [category, posts] of Object.entries(categories)) {
        categoriesListHtml += `
          <div class="category-item">
            <a href="/categories/${category}/" class="category-link">
              <span class="category-name">${category}</span>
              <span class="category-count">${posts.length}</span>
            </a>
          </div>
        `;
      }
      categoriesListHtml += '</div>';
    } else {
      categoriesListHtml = '<p class="text-muted">No categories yet.</p>';
    }

    const html = `<!DOCTYPE html>
<html lang="${site.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Categories - ${site.title}</title>
  <style>${css}</style>
</head>
<body class="categories-page">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">${site.title}</a></h1>
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <h1>Categories</h1>
      <p>Browse posts by category</p>
      ${categoriesListHtml}
    </main>

    <footer class="site-footer">
      <p>&copy; ${new Date().getFullYear()} ${site.title}. Powered by Shiori.</p>
    </footer>
  </div>
</body>
</html>`;

    return html;
  }

  async renderTagsIndex(tags) {
    const site = this.config.site;
    const css = await this.getCss();

    // Generate tags list HTML
    let tagsListHtml = '';
    if (tags && Object.keys(tags).length > 0) {
      tagsListHtml = '<div class="tags-list">';
      for (const [tag, posts] of Object.entries(tags)) {
        tagsListHtml += `
          <div class="tag-item">
            <a href="/tags/${tag}/" class="tag-link">
              <span class="tag-name">${tag}</span>
              <span class="tag-count">${posts.length}</span>
            </a>
          </div>
        `;
      }
      tagsListHtml += '</div>';
    } else {
      tagsListHtml = '<p class="text-muted">No tags yet.</p>';
    }

    const html = `<!DOCTYPE html>
<html lang="${site.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tags - ${site.title}</title>
  <style>${css}</style>
</head>
<body class="tags-page">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">${site.title}</a></h1>
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <h1>Tags</h1>
      <p>Browse posts by tag</p>
      ${tagsListHtml}
    </main>

    <footer class="site-footer">
      <p>&copy; ${new Date().getFullYear()} ${site.title}. Powered by Shiori.</p>
    </footer>
  </div>
</body>
</html>`;

    return html;
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  renderTOCItems(toc) {
    let html = '';
    let i = 0;

    while (i < toc.length) {
      const item = toc[i];

      if (item.level === 2) {
        html += `<li class="toc-item"><a href="#${item.id}" class="toc-link">${item.text}</a>`;

        // Check if there are h3 items following this h2
        const h3Items = [];
        let j = i + 1;
        while (j < toc.length && toc[j].level === 3) {
          h3Items.push(toc[j]);
          j++;
        }

        if (h3Items.length > 0) {
          html += '<ul class="toc-sublist">';
          h3Items.forEach(h3 => {
            html += `<li class="toc-item"><a href="#${h3.id}" class="toc-link">${h3.text}</a></li>`;
          });
          html += '</ul>';
        }

        html += '</li>';
        i = j;
      } else {
        i++;
      }
    }

    return html;
  }
}

module.exports = TemplateEngine;
