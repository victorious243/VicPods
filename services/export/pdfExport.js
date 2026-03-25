const PDFDocument = require('pdfkit');
const { buildSections } = require('../transcript/buildTranscript');

function addHeading(doc, text) {
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(12).text(text.toUpperCase());
  doc.moveDown(0.2);
}

function sendPdfExport({ res, filename, series, theme, episode }) {
  const sections = buildSections({ series, theme, episode });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(20).text(sections.title, { align: 'left' });
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10).fillColor('#555').text(
    `${sections.meta.seriesName}  |  ${sections.meta.themeName}  |  Theme Episode ${sections.meta.episodeNumberWithinTheme}${sections.meta.globalEpisodeNumber ? ` (Global ${sections.meta.globalEpisodeNumber})` : ''}  |  ${sections.meta.status}`
  );
  doc.fillColor('#000');

  if (sections.showNotes.summary) {
    addHeading(doc, 'Summary');
    doc.font('Helvetica').fontSize(11).text(sections.showNotes.summary);
  }

  if (sections.showNotes.description) {
    addHeading(doc, 'Description');
    doc.font('Helvetica').fontSize(11).text(sections.showNotes.description);
  }

  if (sections.showNotes.keyTakeaways.length) {
    addHeading(doc, 'Key Takeaways');
    sections.showNotes.keyTakeaways.forEach((takeaway) => {
      doc.text(`- ${takeaway}`, { indent: 12 });
    });
  }

  if (sections.showNotes.listenerCTA) {
    addHeading(doc, 'Listener CTA');
    doc.font('Helvetica').fontSize(11).text(sections.showNotes.listenerCTA);
  }

  addHeading(doc, 'Hook');
  doc.font('Helvetica').fontSize(11).text(sections.hook);

  addHeading(doc, 'Intro');
  doc.text(sections.intro);

  addHeading(doc, 'Main Segments');
  sections.segments.forEach((segment) => {
    doc.font('Helvetica-Bold').text(segment.heading);
    doc.font('Helvetica').text(segment.body, { indent: 12 });
    doc.moveDown(0.3);
  });

  addHeading(doc, 'Host Questions');
  if (sections.hostQuestions.length) {
    sections.hostQuestions.forEach((question) => {
      doc.text(`- ${question}`, { indent: 12 });
    });
  } else {
    doc.text('- What is one practical move listeners can try immediately?', { indent: 12 });
  }

  if (sections.funSegment) {
    addHeading(doc, 'Fun Segment');
    doc.text(sections.funSegment);
  }

  addHeading(doc, 'Outro');
  doc.text(sections.outro);

  doc.end();
}

module.exports = {
  sendPdfExport,
};
