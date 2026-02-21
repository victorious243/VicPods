const {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} = require('docx');
const { buildSections } = require('../transcript/buildTranscript');

function normalParagraph(text) {
  return new Paragraph({
    children: [new TextRun({ text })],
    spacing: { after: 180 },
  });
}

async function sendDocxExport({ res, filename, series, theme, episode }) {
  const sections = buildSections({ series, theme, episode });

  const children = [
    new Paragraph({
      text: sections.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 180 },
    }),
    new Paragraph({
      text: `${sections.meta.seriesName} | ${sections.meta.themeName} | Theme Episode ${sections.meta.episodeNumberWithinTheme}${sections.meta.globalEpisodeNumber ? ` (Global ${sections.meta.globalEpisodeNumber})` : ''}`,
      spacing: { after: 280 },
    }),
    new Paragraph({ text: 'Hook', heading: HeadingLevel.HEADING_2 }),
    normalParagraph(sections.hook),
    new Paragraph({ text: 'Intro', heading: HeadingLevel.HEADING_2 }),
    normalParagraph(sections.intro),
    new Paragraph({ text: 'Main Segments', heading: HeadingLevel.HEADING_2 }),
  ];

  sections.segments.forEach((segment) => {
    children.push(new Paragraph({ text: segment.heading, heading: HeadingLevel.HEADING_3 }));
    children.push(normalParagraph(segment.body));
  });

  children.push(new Paragraph({ text: 'Host Questions', heading: HeadingLevel.HEADING_2 }));
  if (sections.hostQuestions.length) {
    sections.hostQuestions.forEach((question) => {
      children.push(new Paragraph({
        text: question,
        bullet: { level: 0 },
        spacing: { after: 120 },
      }));
    });
  } else {
    children.push(new Paragraph({
      text: 'What is one practical move listeners can try immediately?',
      bullet: { level: 0 },
      spacing: { after: 120 },
    }));
  }

  children.push(new Paragraph({ text: 'Fun Segment', heading: HeadingLevel.HEADING_2 }));
  children.push(normalParagraph(sections.funSegment));
  children.push(new Paragraph({ text: 'Outro', heading: HeadingLevel.HEADING_2 }));
  children.push(normalParagraph(sections.outro));

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  return res.status(200).send(buffer);
}

module.exports = {
  sendDocxExport,
};
