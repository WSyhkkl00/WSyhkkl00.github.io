const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');
const Marked = require('marked');
const hljs = require('highlight.js');
const chokidar = require('chokidar');
const express = require('express');

const PostParser = require('./post-parser');
const TemplateEngine = require('./template-engine');
const AssetCopier = require('./asset-copier');

class Shiori {
  constructor(config) {
    this.config = config;
    this.rootDir = process.cwd();
    this.sourceDir = path.join(this.rootDir, config.paths.source);
    this.outputDir = path.join(this.rootDir, config.paths.output);
    this.postsDir = path.join(this.sourceDir, config.paths.posts);

    // Initialize marked with highlight.js
    Marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {}
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true,
      mangle: false, // 不混淆电子邮件地址
      headerIds: false // 不自动生成标题ID
    });

    this.postParser = new PostParser(config, Marked);
    this.templateEngine = new TemplateEngine(config);
    this.assetCopier = new AssetCopier(config);
  }

  async build() {
    // Clean output directory
    await this.clean();

    // Create output directory
    await fs.ensureDir(this.outputDir);

    // Parse all posts
    const posts = await this.postParser.parsePosts(this.postsDir);

    // Sort posts by date (newest first)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Generate pages
    await this.generatePosts(posts);
    await this.generateIndex(posts);
    await this.generateArchives(posts);
    await this.generatePages(posts);
    await this.generateAssets();

    console.log(`📄 Generated ${posts.length} posts`);
  }

  async generatePosts(posts) {
    for (const post of posts) {
      const html = await this.templateEngine.renderPost(post);
      const outputPath = path.join(this.outputDir, post.url, 'index.html');

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, html);
    }
  }

  async generateIndex(posts) {
    const postsPerPage = this.config.pagination.posts_per_page;
    const totalPages = Math.ceil(posts.length / postsPerPage);

    for (let page = 1; page <= totalPages; page++) {
      const start = (page - 1) * postsPerPage;
      const end = start + postsPerPage;
      const pagePosts = posts.slice(start, end);

      const html = await this.templateEngine.renderIndex(pagePosts, {
        currentPage: page,
        totalPages: totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      });

      const outputPath = page === 1
        ? path.join(this.outputDir, 'index.html')
        : path.join(this.outputDir, this.config.pagination.path, String(page), 'index.html');

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, html);
    }
  }

  async generateArchives(posts) {
    // Generate categories
    const categories = {};
    posts.forEach(post => {
      (post.categories || []).forEach(cat => {
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(post);
      });
    });

    for (const [category, categoryPosts] of Object.entries(categories)) {
      const html = await this.templateEngine.renderCategory(category, categoryPosts);
      const outputPath = path.join(this.outputDir, this.config.paths.categories, category, 'index.html');
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, html);
    }

    // Generate tags
    const tags = {};
    posts.forEach(post => {
      (post.tags || []).forEach(tag => {
        if (!tags[tag]) tags[tag] = [];
        tags[tag].push(post);
      });
    });

    for (const [tag, tagPosts] of Object.entries(tags)) {
      const html = await this.templateEngine.renderTag(tag, tagPosts);
      const outputPath = path.join(this.outputDir, this.config.paths.tags, tag, 'index.html');
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, html);
    }
  }

  async generatePages(posts) {
    // Generate archive page
    const archiveHtml = await this.templateEngine.renderArchive(posts);
    const archivePath = path.join(this.outputDir, 'archives', 'index.html');
    await fs.ensureDir(path.dirname(archivePath));
    await fs.writeFile(archivePath, archiveHtml);

    // Generate categories index
    const categoriesHtml = await this.templateEngine.renderCategoriesIndex();
    const categoriesPath = path.join(this.outputDir, this.config.paths.categories, 'index.html');
    await fs.ensureDir(path.dirname(categoriesPath));
    await fs.writeFile(categoriesPath, categoriesHtml);

    // Generate tags index
    const tagsHtml = await this.templateEngine.renderTagsIndex();
    const tagsPath = path.join(this.outputDir, this.config.paths.tags, 'index.html');
    await fs.ensureDir(path.dirname(tagsPath));
    await fs.writeFile(tagsPath, tagsHtml);
  }

  async generateAssets() {
    await this.assetCopier.copy();
  }

  async clean() {
    if (await fs.pathExists(this.outputDir)) {
      await fs.remove(this.outputDir);
    }
  }

  async preview() {
    await this.build();

    const app = express();
    app.use(express.static(this.outputDir));

    const port = this.config.preview.port;
    app.listen(port, () => {
      console.log(`\n🌐 Preview server running at http://localhost:${port}\n`);
      console.log('Press Ctrl+C to stop');
    });
  }

  async serve() {
    await this.build();

    const app = express();
    app.use(express.static(this.outputDir));

    const port = this.config.preview.port;
    const server = app.listen(port, () => {
      console.log(`\n🚀 Development server running at http://localhost:${port}\n`);
      console.log('Watching for changes...\n');
    });

    // Watch for file changes
    const watcher = chokidar.watch([
      path.join(this.sourceDir, '**/*.md'),
      path.join(this.rootDir, 'shiori.config.yml')
    ], {
      ignored: /node_modules/
    });

    watcher.on('change', async () => {
      console.log('📝 Changes detected, rebuilding...');
      try {
        await this.build();
        console.log('✅ Rebuild complete!');
      } catch (error) {
        console.error('❌ Build error:', error.message);
      }
    });

    process.on('SIGINT', () => {
      watcher.close();
      server.close();
      console.log('\n👋 Server stopped');
      process.exit(0);
    });
  }

  async newPost(title) {
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const filename = `${year}-${month}-${day}-${slug}.md`;
    const filepath = path.join(this.postsDir, filename);

    const content = `---
title: ${title}
date: ${year}-${month}-${day} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}
categories:
tags:
---

# ${title}

Write your content here...
`;

    await fs.ensureDir(this.postsDir);
    await fs.writeFile(filepath, content);
    console.log(`📝 Created: ${filepath}`);
  }
}

module.exports = Shiori;
