#!/usr/bin/env node

const Shiori = require('./lib/shiori');
const config = require('./lib/config');
const command = process.argv[2];

const shiori = new Shiori(config);

async function main() {
  try {
    switch (command) {
      case 'build':
        console.log('📝 Building Shiori blog...');
        await shiori.build();
        console.log('✅ Build complete!');
        break;

      case 'preview':
        console.log('👀 Starting preview server...');
        await shiori.preview();
        break;

      case 'serve':
        console.log('🚀 Starting development server...');
        await shiori.serve();
        break;

      case 'clean':
        console.log('🧹 Cleaning build directory...');
        await shiori.clean();
        console.log('✅ Clean complete!');
        break;

      case 'new':
        const title = process.argv[3];
        if (!title) {
          console.error('❌ Please provide a post title');
          process.exit(1);
        }
        await shiori.newPost(title);
        console.log(`✅ New post created: ${title}`);
        break;

      default:
        console.log(`
Shiori - A minimalist static blog generator

Usage:
  shiori build     Build the blog
  shiori preview   Preview the blog
  shiori serve     Start development server with live reload
  shiori clean     Clean build directory
  shiori new       Create a new post

Examples:
  shiori build
  shiori preview
  shiori serve
  shiori new "My Post Title"
        `);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
