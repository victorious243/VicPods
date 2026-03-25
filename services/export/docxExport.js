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
      text: `${sections.meta.seriesName} | ${sections.meta.themeName} | Theme Episode ${sections.meta.episodeNumberWithinTheme}${sections.meta.globalEpisodeNumber ? ` (Global ${sections.meta.globalEpisodeNumber})` : ''} | ${sections.meta.status}`,
      spacing: { after: 280 },
    }),
  ];

  if (sections.showNotes.summary) {
    children.push(new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_2 }));
    children.push(normalParagraph(sections.showNotes.summary));
  }

  if (sections.showNotes.description) {
    children.push(new Paragraph({ text: 'Description', heading: HeadingLevel.HEADING_2 }));
    children.push(normalParagraph(sections.showNotes.description));
  }

  if (sections.showNotes.keyTakeaways.length) {
    children.push(new Paragraph({ text: 'Key Takeaways', heading: HeadingLevel.HEADING_2 }));
    sections.showNotes.keyTakeaways.forEach((takeaway) => {
      children.push(new Paragraph({
        text: takeaway,
        bullet: { level: 0 },
        spacing: { after: 120 },
      }));
    });
  }

  if (sections.showNotes.listenerCTA) {
    children.push(new Paragraph({ text: 'Listener CTA', heading: HeadingLevel.HEADING_2 }));
    children.push(normalParagraph(sections.showNotes.listenerCTA));
  }

  children.push(new Paragraph({ text: 'Hook', heading: HeadingLevel.HEADING_2 }));
  children.push(normalParagraph(sections.hook));
  children.push(new Paragraph({ text: 'Intro', heading: HeadingLevel.HEADING_2 }));
  children.push(normalParagraph(sections.intro));
  children.push(new Paragraph({ text: 'Main Segments', heading: HeadingLevel.HEADING_2 }));

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

  if (sections.funSegment) {
    children.push(new Paragraph({ text: 'Fun Segment', heading: HeadingLevel.HEADING_2 }));
    children.push(normalParagraph(sections.funSegment));
  }
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
