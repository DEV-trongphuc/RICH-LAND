const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const docxPath = 'D:\\Downloads\\60 test case.docx';
const tempDir = path.join(__dirname, 'temp_docx_extract');

try {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  execSync(`powershell -Command "Expand-Archive -LiteralPath '${docxPath}' -DestinationPath '${tempDir}' -Force"`, { stdio: 'inherit' });

  const docXmlPath = path.join(tempDir, 'word', 'document.xml');
  if (fs.existsSync(docXmlPath)) {
    const xml = fs.readFileSync(docXmlPath, 'utf8');
    const cleanText = xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tr>/g, '\n---ROW---\n')
      .replace(/<w:tc>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');

    fs.writeFileSync(path.join(__dirname, 'parsed_60_test_cases.txt'), cleanText, 'utf8');
    console.log('Successfully parsed docx! Output length: ' + cleanText.length);
  } else {
    console.error('word/document.xml not found!');
  }
} catch (err) {
  console.error('Error:', err);
} finally {
  if (fs.existsSync(tempDir)) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
  }
}
