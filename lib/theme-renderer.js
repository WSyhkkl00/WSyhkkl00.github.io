const fs = require('fs-extra');
const path = require('path');

class ThemeRenderer {
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
    const template = await this.getTemplate('post');
    const site = this.config.site;
    const css = await this.getCss();

    return this.compileTemplate(template, {
      site: site,
      page: post,
      config: this.config,
      body_class: 'post-page',
      styles: css
    });
  }

  async renderIndex(posts, pagination) {
    const template = await this.getTemplate('index');
    const site = this.config.site;
    const css = await this.getCss();

    return this.compileTemplate(template, {
      site: site,
      posts: posts,
      pagination: pagination,
      config: this.config,
      body_class: 'home-page',
      styles: css
    });
  }

  async renderCategory(category, posts) {
    const template = await this.getTemplate('category');
    const site = this.config.site;
    const css = await this.getCss();

    return this.compileTemplate(template, {
      site: site,
      category: category,
      posts: posts,
      config: this.config,
      body_class: 'category-page',
      styles: css
    });
  }

  async renderTag(tag, posts) {
    const template = await this.getTemplate('tag');
    const site = this.config.site;
    const css = await this.getCss();

    return this.compileTemplate(template, {
      site: site,
      tag: tag,
      posts: posts,
      config: this.config,
      body_class: 'tag-page',
      styles: css
    });
  }

  async renderArchive(posts) {
    const template = await this.getTemplate('archive');
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

    return this.compileTemplate(template, {
      site: site,
      posts: posts,
      grouped_posts: grouped,
      config: this.config,
      body_class: 'archive-page',
      styles: css
    });
  }

  async renderCategoriesIndex() {
    const template = await this.getTemplate('categories');
    const site = this.config.site;
    const css = await this.getCss();

    return this.compileTemplate(template, {
      site: site,
      config: this.config,
      body_class: 'categories-page',
      styles: css
    });
  }

  async renderTagsIndex() {
    const template = await this.getTemplate('tags');
    const site = this.config.site;
    const css = await this.getCss();

    return this.compileTemplate(template, {
      site: site,
      config: this.config,
      body_class: 'tags-page',
      styles: css
    });
  }

  async getTemplate(name) {
    const templatePath = path.join(this.themeDir, `${name}.html`);

    if (await fs.pathExists(templatePath)) {
      return await fs.readFile(templatePath, 'utf8');
    }

    // Return default template
    return this.getDefaultTemplate(name);
  }

  getDefaultTemplate(name) {
    const defaults = {
      post: this.getDefaultPostTemplate(),
      index: this.getDefaultIndexTemplate(),
      category: this.getDefaultCategoryTemplate(),
      tag: this.getDefaultTagTemplate(),
      archive: this.getDefaultArchiveTemplate(),
      categories: this.getDefaultCategoriesTemplate(),
      tags: this.getDefaultTagsTemplate()
    };

    return defaults[name] || defaults.index;
  }

  compileTemplate(template, data) {
    let result = template;

    // Helper function to get nested property value
    const getValue = (obj, path) => {
      const keys = path.split('.');
      let value = obj;
      for (const key of keys) {
        value = value && value[key];
      }
      return value !== undefined && value !== null ? value : '';
    };

    // Format date
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    };

    // Replace {% for %}...{% endfor %} loops first
    result = result.replace(/\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
      (match, itemName, arrayName, content) => {
        const items = data[arrayName];
        if (!Array.isArray(items)) return '';

        return items.map(item => {
          let itemContent = content;

          // Replace {{ item.property }} with actual values
          itemContent = itemContent.replace(/\{\{\s*" + itemName + "\.([^}]+)\s*\}\}/g,
            (m, prop) => {
              const value = prop.split('.').reduce((obj, key) => obj && obj[key], item);
              return value !== undefined && value !== null ? String(value) : '';
            });

          // Replace simple {{ itemName }} references
          itemContent = itemContent.replace(/\{\{\s*" + itemName + "\s*\}\}/g,
            () => {
              return String(item);
            });

          return itemContent;
        }).join('');
      }
    );

    // Handle {% if %}...{% endif %} conditionals
    result = result.replace(/\{%\s*if\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g,
      (match, varName, content) => {
        const value = data[varName];
        if (value && (Array.isArray(value) ? value.length > 0 : true)) {
          return content;
        }
        return '';
      }
    );

    // Replace {{ variable }} patterns (simple variables)
    result = result.replace(/\{\{\s*(\w+(?:\.\w+)*)\s*\}\}/g, (match, varPath) => {
      const value = getValue(data, varPath);
      if (varPath.includes('date') && value) {
        return formatDate(value);
      }
      return String(value);
    });

    return result;
  }

  getDefaultPostTemplate() {
    return `<!DOCTYPE html>
<html lang="{{site.language}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{page.title}} - {{site.title}}</title>
  <style>{{styles}}</style>
</head>
<body class="{{body_class}}">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">{{site.title}}</a></h1>
      <p class="site-subtitle">{{site.subtitle}}</p>
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
          <h1 class="post-title">{{page.title}}</h1>
          <div class="post-meta">
            <time datetime="{{page.date}}">{{page.date}}</time>
            {% if page.author %}
            <span class="post-author">by {{page.author}}</span>
            {% endif %}
            {% if page.readingTime %}
            <span class="post-reading-time">{{page.readingTime}} min read</span>
            {% endif %}
          </div>
          {% if page.categories %}
          <div class="post-categories">
            {% for category in page.categories %}
            <a href="/categories/{{category}}/" class="category-tag">{{category}}</a>
            {% endfor %}
          </div>
          {% endif %}
        </header>

        <div class="post-content">
          {{page.content}}
        </div>

        {% if page.tags %}
        <footer class="post-footer">
          <div class="post-tags">
            {% for tag in page.tags %}
            <a href="/tags/{{tag}}/" class="tag">#{{tag}}</a>
            {% endfor %}
          </div>
        </footer>
        {% endif %}
      </article>
    </main>

    <footer class="site-footer">
      <p>&copy; {{site.author}} - Powered by Shiori</p>
    </footer>
  </div>
</body>
</html>`;
  }

  getDefaultIndexTemplate() {
    return `<!DOCTYPE html>
<html lang="{{site.language}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{site.title}}</title>
  <style>{{styles}}</style>
</head>
<body class="{{body_class}}">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">{{site.title}}</a></h1>
      <p class="site-subtitle">{{site.subtitle}}</p>
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <div class="posts-list">
        {% for post in posts %}
        <article class="post-item">
          <header class="post-item-header">
            <h2 class="post-item-title">
              <a href="/{{post.url}}/">{{post.title}}</a>
            </h2>
            <time class="post-item-date" datetime="{{post.date}}">{{post.date}}</time>
          </header>
          {% if post.excerpt %}
          <div class="post-item-excerpt">
            {{post.excerpt}}
          </div>
          {% endif %}
          <a href="/{{post.url}}/" class="read-more">Read more &rarr;</a>
        </article>
        {% endfor %}
      </div>

      {% if pagination %}
      {% if pagination.totalPages > 1 %}
      <nav class="pagination">
        {% if pagination.hasPrev %}
        <a href="{% if pagination.currentPage == 2 %}/{% else %}/page/{{pagination.currentPage - 1}}/{% endif %}" class="prev">&larr; Previous</a>
        {% endif %}
        <span class="page-info">Page {{pagination.currentPage}} of {{pagination.totalPages}}</span>
        {% if pagination.hasNext %}
        <a href="/page/{{pagination.currentPage + 1}}/" class="next">Next &rarr;</a>
        {% endif %}
      </nav>
      {% endif %}
      {% endif %}
    </main>

    <footer class="site-footer">
      <p>&copy; {{site.author}} - Powered by Shiori</p>
    </footer>
  </div>
</body>
</html>`;
  }

  getDefaultCategoryTemplate() {
    return `<!DOCTYPE html>
<html lang="{{site.language}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Category: {{category}} - {{site.title}}</title>
  <style>{{styles}}</style>
</head>
<body class="{{body_class}}">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">{{site.title}}</a></h1>
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <h1>Category: {{category}}</h1>
      <div class="posts-list">
        {% for post in posts %}
        <article class="post-item">
          <h2><a href="/{{post.url}}/">{{post.title}}</a></h2>
          <time>{{post.date}}</time>
        </article>
        {% endfor %}
      </div>
    </main>
  </div>
</body>
</html>`;
  }

  getDefaultTagTemplate() {
    return `<!DOCTYPE html>
<html lang="{{site.language}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tag: {{tag}} - {{site.title}}</title>
  <style>{{styles}}</style>
</head>
<body class="{{body_class}}">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">{{site.title}}</a></h1>
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <h1>Tag: {{tag}}</h1>
      <div class="posts-list">
        {% for post in posts %}
        <article class="post-item">
          <h2><a href="/{{post.url}}/">{{post.title}}</a></h2>
          <time>{{post.date}}</time>
        </article>
        {% endfor %}
      </div>
    </main>
  </div>
</body>
</html>`;
  }

  getDefaultArchiveTemplate() {
    return `<!DOCTYPE html>
<html lang="{{site.language}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Archives - {{site.title}}</title>
  <style>{{styles}}</style>
</head>
<body class="{{body_class}}">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">{{site.title}}</a></h1>
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
        {% for year in grouped_posts %}
        <div class="archive-year">
          <h2>{{year}}</h2>
          {% for month in grouped_posts.year %}
          <div class="archive-month">
            <h3>{{month}}</h3>
            <ul>
              {% for post in grouped_posts.year.month %}
              <li><time>{{post.date}}</time> - <a href="/{{post.url}}/">{{post.title}}</a></li>
              {% endfor %}
            </ul>
          </div>
          {% endfor %}
        </div>
        {% endfor %}
      </div>
    </main>
  </div>
</body>
</html>`;
  }

  getDefaultCategoriesTemplate() {
    return `<!DOCTYPE html>
<html lang="{{site.language}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Categories - {{site.title}}</title>
  <style>{{styles}}</style>
</head>
<body class="{{body_class}}">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">{{site.title}}</a></h1>
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <h1>Categories</h1>
      <div class="categories-list">
        <p>Categories listing...</p>
      </div>
    </main>
  </div>
</body>
</html>`;
  }

  getDefaultTagsTemplate() {
    return `<!DOCTYPE html>
<html lang="{{site.language}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tags - {{site.title}}</title>
  <style>{{styles}}</style>
</head>
<body class="{{body_class}}">
  <div class="container">
    <header class="site-header">
      <h1 class="site-title"><a href="/">{{site.title}}</a></h1>
      <nav class="site-nav">
        <a href="/">Home</a>
        <a href="/archives/">Archives</a>
        <a href="/categories/">Categories</a>
        <a href="/tags/">Tags</a>
      </nav>
    </header>

    <main class="main-content">
      <h1>Tags</h1>
      <div class="tags-list">
        <p>Tags listing...</p>
      </div>
    </main>
  </div>
</body>
</html>`;
  }
}

module.exports = ThemeRenderer;
