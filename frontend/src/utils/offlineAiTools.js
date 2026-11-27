/**
 * Client-side offline study tool generator.
 * Produces structured Summary, Flashcards, Mind Map, and Quiz payloads
 * matching the backend AI schemas when offline or for offline-uploaded files.
 */

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'are', 'was', 'were',
  'have', 'has', 'had', 'not', 'but', 'can', 'will', 'all', 'one', 'two',
  'use', 'used', 'using', 'into', 'also', 'than', 'then', 'when', 'where',
  'which', 'who', 'what', 'how', 'why', 'its', 'their', 'they', 'them',
  'these', 'those', 'more', 'most', 'such', 'only', 'other', 'about', 'between',
]);

function splitSentences(text) {
  return (text || '')
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[\s•\-–—*>\d.)]+/, '').trim())
    .filter((s) => s.length >= 18 && s.length <= 320);
}

function extractSectionsFromText(text, title) {
  const clean = (text || '').trim();
  if (!clean) {
    return [
      {
        section_title: title || 'Core Study Topic',
        slide_range: 'Offline Overview',
        summary: `This offline study card was created for "${title || 'your uploaded note'}". Connect to the internet to run deep cloud AI analysis on full document formatting.`,
        key_takeaways: [
          `Review the core principles and definitions of ${title || 'this topic'}.`,
          'Write down 3 key formulas, processes, or comparisons from the material.',
        ],
        highlight: `Focus on main definitions and real-world applications of ${title || 'this material'}.`,
      },
    ];
  }

  // Slide-based split for PPTX
  if (/^Slide\s+\d+/m.test(clean)) {
    const slides = clean.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    const groupSize = Math.max(1, Math.ceil(slides.length / 4));
    const sections = [];

    for (let i = 0; i < slides.length && sections.length < 5; i += groupSize) {
      const chunk = slides.slice(i, i + groupSize);
      const firstLines = chunk[0].split('\n').map((l) => l.trim()).filter(Boolean);
      const rawHeading = (firstLines[0] || `Module ${sections.length + 1}`).replace(/^Slide\s+\d+:\s*/i, '');
      const bullets = chunk
        .flatMap((s) => s.split('\n').slice(1))
        .map((l) => l.replace(/^[\s•\-–—*]+/, '').trim())
        .filter((l) => l.length >= 10);

      const startSlide = i + 1;
      const endSlide = Math.min(slides.length, i + chunk.length);
      sections.push({
        section_title: rawHeading.slice(0, 75),
        slide_range: startSlide === endSlide ? `Slide ${startSlide}` : `Slides ${startSlide}-${endSlide}`,
        summary: bullets.slice(0, 2).join(' ') || `Covers key concepts in ${rawHeading}.`,
        key_takeaways: bullets.slice(0, 4).length
          ? bullets.slice(0, 4)
          : [`Understand the core ideas behind ${rawHeading}.`],
        highlight: bullets[0] || `Key concept: ${rawHeading}`,
      });
    }
    return sections;
  }

  // Paragraph / heading split for documents & transcripts
  const blocks = clean.split(/\n{2,}/).map((b) => b.trim()).filter((b) => b.length >= 25);
  const chosenBlocks = blocks.length >= 2 ? blocks : splitSentences(clean);
  const bucketCount = Math.min(4, Math.max(1, chosenBlocks.length));
  const perBucket = Math.ceil(chosenBlocks.length / bucketCount);
  const sections = [];

  for (let i = 0; i < chosenBlocks.length && sections.length < 4; i += perBucket) {
    const groupText = chosenBlocks.slice(i, i + perBucket).join('\n');
    const lines = groupText.split('\n').map((l) => l.trim()).filter(Boolean);
    const sentences = splitSentences(groupText);
    const headingCandidate = lines[0] && lines[0].length <= 65
      ? lines[0].replace(/^#+\s*/, '')
      : `${title || 'Topic'} — Part ${sections.length + 1}`;

    sections.push({
      section_title: headingCandidate,
      slide_range: `Part ${sections.length + 1}`,
      summary: sentences.slice(0, 2).join(' ') || groupText.slice(0, 220),
      key_takeaways: sentences.slice(0, 3).length
        ? sentences.slice(0, 3)
        : [groupText.slice(0, 140)],
      highlight: sentences[0] || headingCandidate,
    });
  }

  return sections;
}

function extractDefinitionsFromText(text, title, sections) {
  const defs = [];
  const seen = new Set();
  const lines = (text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (defs.length >= 6) break;
    // Pattern 1: "Term: definition" or "Term - definition"
    const colonMatch = line.match(/^([A-Za-z][A-Za-z0-9\s/()-]{2,40})\s*[:–—-]\s+(.{15,200})$/);
    if (colonMatch) {
      const term = colonMatch[1].trim();
      const definition = colonMatch[2].trim();
      if (!/^slide\s+\d+$/i.test(term) && !seen.has(term.toLowerCase())) {
        seen.add(term.toLowerCase());
        defs.push({ term, definition });
        continue;
      }
    }

    // Pattern 2: "X is/are/refers to Y"
    const isMatch = line.match(/^([A-Z][A-Za-z0-9\s-]{2,36})\s+(?:is|are|refers to|means)\s+(.{18,180})[.!?]?$/);
    if (isMatch) {
      const term = isMatch[1].trim();
      const definition = isMatch[2].trim();
      if (!seen.has(term.toLowerCase())) {
        seen.add(term.toLowerCase());
        defs.push({ term, definition: `${term} is ${definition}`.replace(/\s+/g, ' ') });
      }
    }
  }

  // Fallback definitions from extracted keywords & sections
  if (defs.length < 3) {
    const words = (text || '')
      .toLowerCase()
      .match(/\b[a-z]{5,18}\b/g) || [];
    const freq = {};
    for (const w of words) {
      if (!STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
    }
    const topWords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

    const sentences = splitSentences(text);
    for (const kw of topWords) {
      if (defs.length >= 5) break;
      if (seen.has(kw.toLowerCase())) continue;
      const matchSentence = sentences.find((s) => s.toLowerCase().includes(kw.toLowerCase()));
      if (matchSentence) {
        seen.add(kw.toLowerCase());
        defs.push({ term: kw, definition: matchSentence });
      }
    }
  }

  if (defs.length === 0) {
    sections.forEach((sec) => {
      if (defs.length < 4 && !seen.has(sec.section_title.toLowerCase())) {
        seen.add(sec.section_title.toLowerCase());
        defs.push({
          term: sec.section_title,
          definition: sec.summary || sec.key_takeaways?.[0] || `Core concept in ${title || 'this note'}.`,
        });
      }
    });
  }

  return defs;
}

export function generateOfflineSummary(note) {
  const title = note?.title || 'Study Material';
  const unitCode = note?.unit_code || 'General';
  const rawText = (note?.extracted_text || '').trim();
  const isPresentation = ['pptx', 'ppt'].includes(note?.file_type) || /^Slide\s+\d+/m.test(rawText);

  const sections = extractSectionsFromText(rawText, title);
  const sentences = splitSentences(rawText);
  const definitions = extractDefinitionsFromText(rawText, title, sections);

  const keyPoints = sentences
    .filter((s) => s.length >= 25 && s.length <= 190)
    .slice(0, 5);
  if (keyPoints.length === 0) {
    sections.forEach((sec) => {
      if (sec.key_takeaways?.[0]) keyPoints.push(sec.key_takeaways[0]);
    });
  }

  const overview = sentences.length >= 2
    ? `${sentences[0]} ${sentences[1]}`
    : (sections[0]?.summary || `Offline study summary generated for ${title} (${unitCode}).`);

  const detailedSummary = sentences.length
    ? sentences.slice(0, 5).join(' ')
    : overview;

  const examHighlights = sections
    .map((s) => s.highlight)
    .filter(Boolean)
    .slice(0, 3);

  const quickQuiz = definitions.slice(0, 3).map((d) => `Define and explain "${d.term}" in your own words.`);
  if (quickQuiz.length < 2) {
    quickQuiz.push(`What are the main takeaways from "${title}"?`);
  }

  return {
    title,
    doc_type: isPresentation ? 'Presentation Deck (Offline)' : 'Offline Study Summary',
    deck_overview: overview,
    summary: detailedSummary,
    key_points: keyPoints.slice(0, 5),
    sections,
    exam_highlights: examHighlights.length ? examHighlights : keyPoints.slice(0, 2),
    definitions,
    quick_quiz: quickQuiz,
    offline_generated: true,
  };
}

export function generateOfflineFlashcards(note) {
  const title = note?.title || 'Study Material';
  const summary = generateOfflineSummary(note);
  const cards = [];
  const seenFront = new Set();

  for (const def of summary.definitions || []) {
    const front = `What is ${def.term}?`;
    if (!seenFront.has(front.toLowerCase())) {
      seenFront.add(front.toLowerCase());
      cards.push({ front, back: def.definition });
    }
  }

  for (const sec of summary.sections || []) {
    if (cards.length >= 10) break;
    const front = `Explain the key idea in "${sec.section_title}"`;
    const back = sec.summary || sec.key_takeaways?.join(' • ') || sec.highlight;
    if (back && !seenFront.has(front.toLowerCase())) {
      seenFront.add(front.toLowerCase());
      cards.push({ front, back });
    }
  }

  (summary.key_points || []).forEach((pt, idx) => {
    if (cards.length >= 10) return;
    const front = `${title}: Key Concept #${idx + 1}`;
    if (!seenFront.has(front.toLowerCase())) {
      seenFront.add(front.toLowerCase());
      cards.push({ front, back: pt });
    }
  });

  if (cards.length === 0) {
    cards.push({
      front: `What is the main topic of "${title}"?`,
      back: summary.deck_overview || `Core concepts for ${note?.unit_code || 'this unit'}.`,
    });
  }

  return {
    flashcards: cards.slice(0, 10),
    offline_generated: true,
  };
}

export function generateOfflineMindMap(note) {
  const summary = generateOfflineSummary(note);
  const branches = (summary.sections || []).map((sec) => ({
    label: sec.section_title,
    children: (sec.key_takeaways && sec.key_takeaways.length ? sec.key_takeaways : [sec.summary]).slice(0, 4),
  }));

  if (summary.definitions?.length) {
    branches.push({
      label: 'Key Terms & Definitions',
      children: summary.definitions.slice(0, 4).map((d) => `${d.term}: ${d.definition}`),
    });
  }

  return {
    root: summary.title || note?.title || 'Study Topic',
    branches: branches.length
      ? branches
      : [{ label: 'Overview', children: [summary.deck_overview || 'Main study concepts'] }],
    offline_generated: true,
  };
}

export function generateOfflineQuiz(note, numQuestions = 5) {
  const summary = generateOfflineSummary(note);
  const questions = [];
  const defs = summary.definitions || [];

  if (defs.length >= 2) {
    defs.forEach((d, idx) => {
      const distractors = defs
        .filter((_, j) => j !== idx)
        .map((other) => other.term)
        .slice(0, 3);
      while (distractors.length < 3) {
        distractors.push(`Concept ${distractors.length + 1}`);
      }
      const options = [d.term, ...distractors].sort((a, b) => a.localeCompare(b));
      questions.push({
        type: 'multiple_choice',
        question: `Which term best matches this explanation: "${d.definition}"`,
        options,
        correct_answer: d.term,
        explanation: `${d.term}: ${d.definition}`,
      });
    });
  }

  (summary.quick_quiz || []).forEach((q, idx) => {
    const ans = summary.key_points?.[idx] || summary.deck_overview || 'Review your summary key points.';
    questions.push({
      type: 'text_answer',
      question: q,
      options: [],
      correct_answer: ans,
      explanation: ans,
    });
  });

  if (questions.length === 0) {
    questions.push({
      type: 'text_answer',
      question: `Summarize the core concept of "${summary.title}" in your own words.`,
      options: [],
      correct_answer: summary.deck_overview,
      explanation: summary.summary,
    });
  }

  return {
    quiz_title: `${summary.title} (Offline Practice Quiz)`,
    questions: questions.slice(0, Number(numQuestions) || 5),
    offline_generated: true,
  };
}
