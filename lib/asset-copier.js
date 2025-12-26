const fs = require('fs-extra');
const path = require('path');

class AssetCopier {
  constructor(config) {
    this.config = config;
    this.sourceDir = path.join(process.cwd(), config.paths.source);
    this.outputDir = path.join(process.cwd(), config.paths.output);
    this.themeDir = path.join(__dirname, '..', 'themes', config.theme.name);
  }

  async copy() {
    // Copy theme assets (CSS, JS, images, etc.)
    await this.copyThemeAssets();

    // Copy source assets
    await this.copySourceAssets();
  }

  async copyThemeAssets() {
    const themeAssetsDir = path.join(this.themeDir, 'assets');

    if (await fs.pathExists(themeAssetsDir)) {
      const outputAssetsDir = path.join(this.outputDir, 'assets');
      await fs.copy(themeAssetsDir, outputAssetsDir);
      console.log('📦 Theme assets copied');
    }
  }

  async copySourceAssets() {
    const sourceAssetsDir = path.join(this.sourceDir, this.config.paths.assets);

    if (await fs.pathExists(sourceAssetsDir)) {
      const outputAssetsDir = path.join(this.outputDir, 'assets');
      await fs.copy(sourceAssetsDir, outputAssetsDir, { overwrite: true });
      console.log('📦 Source assets copied');
    }
  }
}

module.exports = AssetCopier;
