function sendTxtExport({ res, filename, transcript }) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(transcript);
}

module.exports = {
  sendTxtExport,
};
