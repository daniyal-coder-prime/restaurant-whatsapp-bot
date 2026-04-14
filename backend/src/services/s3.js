const AWS = require('aws-sdk');
const config = require('../config');

const s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region,
});

async function uploadScreenshot(fileBuffer, fileName, mimeType) {
  const params = {
    Bucket: config.aws.s3Bucket,
    Key: `screenshots/${Date.now()}_${fileName}`,
    Body: fileBuffer,
    ContentType: mimeType,
  };

  const result = await s3.upload(params).promise();
  return result.Location;
}

function getSignedUrl(key, expiresIn = 3600) {
  return s3.getSignedUrl('getObject', {
    Bucket: config.aws.s3Bucket,
    Key: key,
    Expires: expiresIn,
  });
}

module.exports = { uploadScreenshot, getSignedUrl };
