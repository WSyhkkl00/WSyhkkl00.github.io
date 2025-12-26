const fs = require('fs-extra');
const path = require('path');

// Load config - try JSON first, then fallback to defaults
let config = {};

try {
  const configPath = path.join(__dirname, '..', 'shiori.config.json');
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configContent);
  } else {
    console.warn('Config file not found, using defaults');
    config = getDefaultConfig();
  }
} catch (error) {
  console.warn('Warning: Could not load config file, using defaults');
  console.warn('Error:', error.message);
  config = getDefaultConfig();
}

function getDefaultConfig() {
  return {
    site: {
      title: 'Shiori Blog',
      subtitle: '',
      description: '',
      author: '',
      language: 'en',
      timezone: 'UTC'
    },
    url: '',
    permalink: ':year/:month/:day/:title/',
    paths: {
      source: 'source',
      output: 'dist',
      posts: '_posts',
      categories: 'categories',
      tags: 'tags',
      assets: 'assets'
    },
    theme: {
      name: 'minimalist',
      colors: {
        background: '#FAFAF9',
        surface: '#FFFFFF',
        text_primary: '#1C1917',
        text_secondary: '#57534E',
        accent: '#292524',
        border: '#E7E5E4',
        code_bg: '#1C1917',
        code_text: '#E7E5E4'
      }
    },
    pagination: {
      posts_per_page: 10,
      path: 'page'
    },
    posts: {
      default_layout: 'post',
      excerpt_length: 200,
      show_excerpt: true,
      date_format: 'YYYY-MM-DD',
      show_reading_time: true
    },
    syntax: {
      theme: 'github-dark',
      line_numbers: true
    },
    preview: {
      port: 4000,
      live_reload: true
    },
    build: {
      minify: false,
      source_maps: true
    }
  };
}

module.exports = config;
