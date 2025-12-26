#!/bin/bash
echo "=== Shiori 博客部署诊断 ==="
echo ""
echo "1. 检查本地构建..."
if [ -f "dist/index.html" ]; then
    echo "   ✅ dist/index.html 存在"
    echo "   文件大小: $(du -h dist/index.html | cut -f1)"
else
    echo "   ❌ dist/index.html 不存在"
fi
echo ""
echo "2. 检查 GitHub Actions 配置..."
if [ -f ".github/workflows/deploy.yml" ]; then
    echo "   ✅ workflow 文件存在"
else
    echo "   ❌ workflow 文件不存在"
fi
echo ""
echo "3. 检查最近的提交..."
git log -1 --oneline
echo ""
echo "4. 检查远程分支..."
git remote show origin | grep "HEAD branch"
echo ""
echo "5. 检查未推送的提交..."
if [ -z "$(git log origin/master..master)" ]; then
    echo "   ✅ 所有提交已推送"
else
    echo "   ⚠️  有未推送的提交:"
    git log origin/master..master --oneline
fi
echo ""
echo "6. 请访问以下链接查看部署状态:"
echo "   Actions: https://github.com/WSyhkkl00/WSyhkkl00.github.io/actions"
echo "   Deployments: https://github.com/WSyhkkl00/WSyhkkl00.github.io/deployments"
echo "   Pages: https://github.com/WSyhkkl00/WSyhkkl00.github.io/settings/pages"
