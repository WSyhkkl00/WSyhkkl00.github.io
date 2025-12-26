# Shiori

A minimalist static blog generator designed for GitHub Pages. Shiori (栞) means "bookmark" in Japanese - a simple way to mark your thoughts and share them with the world.

## Features

- **Minimalist Design**: Clean, technical aesthetic with gray, white, beige, and black color palette
- **Markdown Support**: Write posts in Markdown with full syntax highlighting
- **Zero Dependencies on Build Tools**: Pure Node.js implementation, no complex frameworks
- **Fast & Lightweight**: Built for speed and simplicity
- **GitHub Pages Ready**: Deploy with GitHub Actions
- **Live Preview**: Built-in development server with hot reload
- **Categories & Tags**: Organize your content effortlessly
- **Reading Time**: Automatic reading time calculation
- **Archive Pages**: Built-in archive by year and month

## Installation

```bash
# Clone or create your blog directory
cd your-blog-directory

# Install dependencies
npm install
```

## Quick Start

```bash
# Create a new post
node cli.js new "My First Post"

# Build the blog
npm run build

# Preview locally
npm run preview

# Start development server with live reload
npm run serve
```

## Configuration

Edit `shiori.config.json` to customize your blog:

```json
{
  "site": {
    "title": "Your Blog Title",
    "subtitle": "Your subtitle",
    "description": "Blog description",
    "author": "Your Name",
    "language": "en",
    "timezone": "UTC"
  },
  "url": "https://username.github.io",
  "permalink": ":year/:month/:day/:title/",
  "theme": {
    "name": "minimalist",
    "colors": {
      "background": "#FAFAF9",
      "surface": "#FFFFFF",
      "text_primary": "#1C1917",
      "text_secondary": "#57534E",
      "accent": "#292524",
      "border": "#E7E5E4",
      "code_bg": "#1C1917",
      "code_text": "#E7E5E4"
    }
  }
}
```

## Directory Structure

```
.
├── cli.js                  # Command-line interface
├── shiori.config.json      # Configuration file
├── package.json            # Dependencies
├── README.md               # Documentation
├── lib/                    # Core library
│   ├── shiori.js          # Main generator class
│   ├── post-parser.js     # Markdown parser
│   ├── theme-renderer.js  # Theme engine
│   ├── asset-copier.js    # Asset manager
│   └── config.js          # Config loader
├── themes/                 # Theme files
│   └── minimalist/        # Default theme
│       └── assets/
│           └── css/
│               └── style.css
├── .github/
│   └── workflows/
│       └── deploy.yml     # GitHub Actions deployment
└── source/                 # Your content
    ├── _posts/            # Markdown posts
    ├── categories/        # Category pages
    ├── tags/              # Tag pages
    └── assets/            # Images, fonts, etc.
```

## Writing Posts

Posts are written in Markdown with YAML front matter:

```markdown
---
title: My Post Title
date: 2025-12-26 14:30
categories:
  - Technology
  - Programming
tags:
  - javascript
  - nodejs
---

# My Post Title

Write your content here using **Markdown**.

## Code Example

\`\`\`javascript
console.log('Hello, Shiori!');
\`\`\`
```

### Post Excerpts

Add `<!-- more -->` in your post to create a custom excerpt:

```markdown
This is the excerpt that will appear on the index page.

<!-- more -->

This content will only appear on the full post page.
```

## Deployment

### GitHub Actions (Recommended)

1. Push your code to GitHub
2. Enable GitHub Pages in repository settings
3. Select "GitHub Actions" as the source
4. Push changes - automatic deployment!

The workflow file at `.github/workflows/deploy.yml` handles everything.

### Manual Deployment

```bash
# Build
npm run build

# Deploy dist/ folder to your GitHub Pages branch
```

### Custom Domain

Add a `CNAME` file in the `source/` directory:

```
yourdomain.com
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build the blog to `dist/` directory |
| `npm run preview` | Build and start preview server on port 4000 |
| `npm run serve` | Start development server with live reload |
| `npm run clean` | Clean the `dist/` directory |
| `node cli.js new "Title"` | Create a new post |

## Theme Customization

The default theme is `minimalist`. You can customize:

1. **Colors**: Edit `shiori.config.json` under `theme.colors`
2. **CSS**: Edit `themes/minimalist/assets/css/style.css`
3. **Templates**: Add custom HTML templates in `themes/minimalist/`

### Creating Custom Themes

1. Create a new directory in `themes/your-theme/`
2. Add `assets/css/style.css`
3. Add template files: `post.html`, `index.html`, etc.
4. Update `shiori.config.json`: `theme.name: "your-theme"`

## Syntax Highlighting

Shiori uses Highlight.js for syntax highlighting. Supported languages include JavaScript, Python, Java, C++, Go, Rust, and many more.

```markdown
\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`
```

## License

MIT License - feel free to use and modify for your projects.

## Credits

Created by WSyhkkl00

Built with:
- [Marked](https://marked.js.org/) - Markdown parser
- [Highlight.js](https://highlightjs.org/) - Syntax highlighting
- [gray-matter](https://github.com/jonschlinkert/gray-matter) - Front matter parser
- [Express](https://expressjs.com/) - Web server
- [Chokidar](https://github.com/paulmillr/chokidar) - File watcher
