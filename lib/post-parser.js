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

    // Preprocess markdown to fix common bold formatting issues
    const processedMarkdown = this.fixBoldFormatting(markdownContent);

    // Parse markdown content
    const htmlContent = this.marked.parse(processedMarkdown);

    // Generate TOC and add IDs to headings
    const { content: contentWithIds, toc } = this.generateTOC(htmlContent);

    // Generate excerpt
    let excerptHtml = excerpt || this.generateExcerpt(markdownContent);

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
      content: contentWithIds,
      toc: toc,
      readingTime: readingTime,
      layout: data.layout || this.config.posts.default_layout,
      published: data.published !== false,
      featured: data.featured || false,
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

  fixBoldFormatting(content) {
    // Fix unclosed ** markers by adding closing ** before punctuation or line breaks
    // This handles cases where Chinese punctuation immediately follows unclosed bold text
    // Split into lines to process each line independently
    const lines = content.split('\n');
    const fixedLines = lines.map(line => {
      // Find all ** positions in this line
      const positions = [];
      let match;
      const regex = /\*\*/g;
      while ((match = regex.exec(line)) !== null) {
        positions.push(match.index);
      }

      // If odd number of ** markers, we need to fix it
      if (positions.length % 2 !== 0) {
        // Find the last ** and check what follows
        const lastPos = positions[positions.length - 1];

        // Look ahead for Chinese punctuation or line end
        const restOfLine = line.slice(lastPos + 2);
        const punctuationMatch = restOfLine.match(/^([^，。、：；？！\n]*?)([，。、：；？！]|\n|$)/);

        if (punctuationMatch && !punctuationMatch[0].startsWith('**')) {
          // Insert closing ** before the punctuation
          const insertPos = lastPos + 2 + punctuationMatch[1].length;
          return line.slice(0, insertPos) + '**' + line.slice(insertPos);
        }
      }

      return line;
    });

    return fixedLines.join('\n');
  }

  async getFileDate(filepath) {
    const stats = await fs.stat(filepath);
    return stats.mtime;
  }

  generateTOC(htmlContent) {
    const headingRegex = /<h([2-3])>(.*?)<\/h\1>/gi;
    const toc = [];
    let match;
    let counter = 1;

    // First pass: collect headings and generate IDs
    while ((match = headingRegex.exec(htmlContent)) !== null) {
      const level = parseInt(match[1]);
      const text = this.stripHtmlTags(match[2]);
      const id = this.generateHeadingId(text, counter);

      toc.push({
        level,
        text,
        id,
        count: counter
      });

      counter++;
    }

    // Second pass: replace headings with IDs
    let modifiedContent = htmlContent.replace(
      /<h([2-3])>(.*?)<\/h\1>/gi,
      (match, level, text) => {
        const headingText = this.stripHtmlTags(text);
        const tocItem = toc.find(item => item.text === headingText);
        if (tocItem) {
          return `<h${level} id="${tocItem.id}">${text}</h${level}>`;
        }
        return match;
      }
    );

    return {
      content: modifiedContent,
      toc: toc.length > 0 ? toc : null
    };
  }

  stripHtmlTags(str) {
    return str.replace(/<[^>]*>/g, '').trim();
  }

  generateHeadingId(text, counter) {
    // Generate a slug-like ID from the heading text
    const slug = text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s-]/gi, '') // Keep Chinese, letters, numbers, spaces, hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();

    // Add counter to ensure uniqueness
    return slug || `heading-${counter}`;
  }
}

module.exports = PostParser;
