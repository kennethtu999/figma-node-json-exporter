const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const templatePath = path.join(rootDir, 'ui.template.html')
const outputPath = path.join(rootDir, 'ui.html')

const moduleOrder = [
  'ui/shared.js',
  'ui/pages.js',
  'ui/exporters.js',
  'ui/app.js',
]

function stripModuleSyntax(source) {
  return source
    .replace(/^import\s+[^;]+;\n?/gm, '')
    .replace(/\bexport\s+/g, '')
    .trim()
}

function buildBundle() {
  const moduleChunks = moduleOrder.map((relativePath) => {
    const filePath = path.join(rootDir, relativePath)
    const source = fs.readFileSync(filePath, 'utf8')
    return `// ${relativePath}\n${stripModuleSyntax(source)}`
  })

  return [
    ';(() => {',
    ...moduleChunks,
    '})();',
    '',
  ].join('\n\n')
}

function main() {
  const template = fs.readFileSync(templatePath, 'utf8')
  const bundle = buildBundle()

  if (!template.includes('<!-- BUILD:UI_SCRIPT -->')) {
    throw new Error('ui.template.html 缺少 <!-- BUILD:UI_SCRIPT --> 標記。')
  }

  const output = template.replace(
    '<!-- BUILD:UI_SCRIPT -->',
    `<script>\n${bundle}</script>`,
  )

  fs.writeFileSync(outputPath, output)
  process.stdout.write(`Built ${path.relative(rootDir, outputPath)}\n`)
}

main()
