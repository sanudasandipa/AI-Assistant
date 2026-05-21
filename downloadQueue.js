// Track pending download requests per user
const pendingDownloads = new Map();

function addPendingDownload(phoneNumber, url) {
  pendingDownloads.set(phoneNumber, {
    url: url,
    timestamp: Date.now()
  });
  console.log(`⏳ Pending download for ${phoneNumber}: ${url}`);
}

function getPendingDownload(phoneNumber) {
  return pendingDownloads.get(phoneNumber);
}

function removePendingDownload(phoneNumber) {
  pendingDownloads.delete(phoneNumber);
  console.log(`✓ Cleared pending download for ${phoneNumber}`);
}

function hasPendingDownload(phoneNumber) {
  return pendingDownloads.has(phoneNumber);
}

module.exports = {
  addPendingDownload,
  getPendingDownload,
  removePendingDownload,
  hasPendingDownload
};
