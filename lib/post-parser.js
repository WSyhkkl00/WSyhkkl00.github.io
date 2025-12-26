const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');

class PostParser {
  constructor(config, marked) {
    this.config = config;
    this.marked = marked;
  }

  async parsePosts(postsDir) {
    const posts = [];

    if (!await fs.pathExists(postsDir)) {
      return posts;
    }

    const files = await fs.readdir(postsDir);

    for (const file of files) {
      if (path.extname(file) === '.md') {
        const post = await this.parsePost(path.join(postsDir, file));
        if (post && post.published !== false) {
          posts.push(post);
        }
      }
    }

    return posts;
  }

  async parsePost(filepath) {
    const content = await fs.readFile(filepath, 'utf8');
    const { data, excerpt, content: markdownContent } = matter(content, {
      excerpt: true,
      excerpt_separator: '<!-- more -->'
    });

    // Parse date
    const date = data.date ? new Date(data.date) : await this.getFileDate(filepath);

    // Generate permalink
    const permalink = this.generatePermalink(data, filepath, date);

    // Fix markdown escape issues: replace \** with HTML entity
    const fixedContent = this.fixMarkdownEscapes(markdownContent);

    // Parse markdown content
    const htmlContent = this.marked.parse(fixedContent);

    // Generate excerpt
    let excerptHtml = excerpt || this.generateExcerpt(fixedContent);

    // Calculate reading time
    const readingTime = this.calculateReadingTime(markdownContent);

    return {
      title: data.title || path.basename(filepath, '.md'),
      date: date,
      updated: data.updated || data.date || date,
      author: data.author || this.config.site.author,
      categories: data.categories || [],
      tags: data.tags || [],
      excerpt: excerptHtml,
      content: htmlContent,
      readingTime: readingTime,
      layout: data.layout || this.config.posts.default_layout,
      published: data.published !== false,
      slug: data.slug || this.generateSlug(filepath, date),
      url: permalink,
      filepath: filepath
    };
  }

  generatePermalink(data, filepath, date) {
    const slug = data.slug || this.generateSlug(filepath, date);
    const permalink = this.config.permalink;

    let url = permalink
      .replace(':year', date.getFullYear())
      .replace(':month', String(date.getMonth() + 1).padStart(2, '0'))
      .replace(':day', String(date.getDate()).padStart(2, '0'))
      .replace(':title', slug);

    // Remove trailing slash
    return url.replace(/\/$/, '');
  }

  generateSlug(filepath, date) {
    const filename = path.basename(filepath, '.md');

    // If filename starts with date, remove it
    const datePattern = /^\d{4}-\d{2}-\d{2}-/;
    if (datePattern.test(filename)) {
      return filename.replace(datePattern, '');
    }

    return filename;
  }

  generateExcerpt(content) {
    const maxLength = this.config.posts.excerpt_length || 200;

    // Remove markdown syntax for plain text excerpt
    let text = content
      .replace(/^#{1,6}\s+/gm, '') // Remove headers
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italic
      .replace(/`/g, '') // Remove code
      .replace(/\n/g, ' ') // Replace newlines
      .trim();

    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }

    return text;
  }

  calculateReadingTime(content) {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes;
  }

  async getFileDate(filepath) {
    const stats = await fs.stat(filepath);
    return stats.mtime;
  }

  fixMarkdownEscapes(content) {
    // Fix the \** issue: replace escaped asterisks in bold context
    // Pattern: \** inside **...** gets converted to HTML entity
    return content
      .replace(/\\\*\*/g, '&#42;&#42;') // \** → &#42;&#42;
      .replace(/\\\*/g, '&#42;');       // \* → &#42;
  }
}

module.exports = PostParser;
