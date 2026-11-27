/**
 * Client-side document text extraction for offline uploads & offline viewing.
 * Supports TXT/MD, DOCX (via mammoth), PPTX (via jszip), and text-based PDFs
 * (via browser-native DecompressionStream). Always resolves cleanly without throwing.
 */

async function decompressPdfStream(bytes) {
  if (typeof DecompressionStream === 'undefined') return null;

  for (const format of ['deflate', 'deflate-raw']) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();

      const reader = ds.readable.getReader();
      const chunks = [];
      let totalLen = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          totalLen += value.byteLength;
        }
      }
      const out = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.byteLength;
      }
      return new TextDecoder('latin1').decode(out);
    } catch {
      // try next deflate format
    }
  }
  return null;
}

function decodePdfLiteralStrings(contentStream) {
  const parts = [];
  // Match text-showing blocks / literal strings followed by Tj, TJ, ', "
  const tjArrayOrLiteral = /\((?:\\.|[^\\()])*\)\s*(?:Tj|'|")|\[(?:[^[\]]|\((?:\\.|[^\\()])*\))*\]\s*TJ/g;
  const matches = contentStream.match(tjArrayOrLiteral) || [];

  for (const block of matches) {
    const innerLiterals = block.match(/\((?:\\.|[^\\()])*\)/g) || [];
    const lineTokens = [];
    for (const lit of innerLiterals) {
      let s = lit.slice(1, -1);
      s = s
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')
        .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));

      // Keep printable characters only
      const printable = s.replace(/[^\x20-\x7E\n]/g, ' ');
      if (printable.trim()) {
        lineTokens.push(printable);
      }
    }
    if (lineTokens.length) {
      parts.push(lineTokens.join(''));
    }
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(buffer);
  const rawLatin1 = new TextDecoder('latin1').decode(rawBytes);
  const extractedChunks = [];

  let cursor = 0;
  let streamCount = 0;
  while (cursor < rawLatin1.length && streamCount < 250) {
    const startTag = rawLatin1.indexOf('stream', cursor);
    if (startTag === -1) break;

    let dataStart = startTag + 6;
    if (rawLatin1[dataStart] === '\r' && rawLatin1[dataStart + 1] === '\n') {
      dataStart += 2;
    } else if (rawLatin1[dataStart] === '\n' || rawLatin1[dataStart] === '\r') {
      dataStart += 1;
    } else {
      cursor = dataStart;
      continue;
    }

    const endTag = rawLatin1.indexOf('endstream', dataStart);
    if (endTag === -1) break;

    streamCount++;
    let dataEnd = endTag;
    if (rawLatin1[dataEnd - 1] === '\n') dataEnd--;
    if (rawLatin1[dataEnd - 1] === '\r') dataEnd--;

    const dictHeader = rawLatin1.slice(Math.max(0, startTag - 250), startTag);
    const slice = rawBytes.slice(dataStart, dataEnd);

    let decodedStream = null;
    if (/\/FlateDecode/i.test(dictHeader)) {
      decodedStream = await decompressPdfStream(slice);
    } else if (slice.length > 0 && slice.length < 400000) {
      decodedStream = rawLatin1.slice(dataStart, dataEnd);
    }

    if (decodedStream && (decodedStream.includes('Tj') || decodedStream.includes('TJ'))) {
      const txt = decodePdfLiteralStrings(decodedStream);
      if (txt && txt.length >= 4) {
        extractedChunks.push(txt);
      }
    }

    cursor = endTag + 9;
  }

  const combined = extractedChunks.join('\n\n').trim();
  // Filter out completely garbled streams where most chars aren't letters/spaces
  const alphaRatio = combined ? (combined.match(/[A-Za-z0-9\s.,;:?!()-]/g) || []).length / combined.length : 0;
  return alphaRatio > 0.65 && combined.length >= 25 ? combined : '';
}

async function extractDocxText(file) {
  const mammoth = (await import('mammoth')).default;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result?.value || '').trim();
}

async function extractPptxText(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return na - nb;
    });

  const slideBlocks = [];
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;

  for (let i = 0; i < slideNames.length; i++) {
    const xml = await zip.files[slideNames[i]].async('string');
    const lines = [];

    if (parser) {
      const doc = parser.parseFromString(xml, 'application/xml');
      const paragraphs = doc.getElementsByTagName('a:p');
      for (let p = 0; p < paragraphs.length; p++) {
        const textNodes = paragraphs[p].getElementsByTagName('a:t');
        let line = '';
        for (let t = 0; t < textNodes.length; t++) {
          line += textNodes[t].textContent || '';
        }
        const trimmed = line.replace(/\s+/g, ' ').trim();
        if (trimmed) lines.push(trimmed);
      }
    } else {
      const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
      for (const m of matches) {
        const clean = m.replace(/<[^>]+>/g, '').trim();
        if (clean) lines.push(clean);
      }
    }

    const slideNum = i + 1;
    if (lines.length) {
      const title = lines[0];
      const body = lines.slice(1).join('\n');
      slideBlocks.push(`Slide ${slideNum}: ${title}${body ? `\n${body}` : ''}`);
    } else {
      slideBlocks.push(`Slide ${slideNum}`);
    }
  }

  return slideBlocks.join('\n\n').trim();
}

export async function extractTextFromFileClient(file) {
  if (!file) return '';
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  try {
    if (name.endsWith('.txt') || name.endsWith('.md') || type.startsWith('text/')) {
      return (await file.text()).trim();
    }
    if (name.endsWith('.docx') || type.includes('wordprocessingml')) {
      return await extractDocxText(file);
    }
    if (name.endsWith('.pptx') || type.includes('presentationml')) {
      return await extractPptxText(file);
    }
    if (name.endsWith('.pdf') || type === 'application/pdf') {
      return await extractPdfText(file);
    }
  } catch {
    return '';
  }

  return '';
}
