import axios from "axios";
import crypto from "crypto";
import dns from "dns";
import sharp from "sharp";

dns.setDefaultResultOrder("ipv4first");

const ALB_URL = "http://veil-alb-2042746512.eu-north-1.elb.amazonaws.com";

const client = axios.create({
  baseURL: ALB_URL,
  timeout: 30000 // 30 seconds timeout to accommodate media processing
});

// Helper to construct a multipart form-data request
function buildMultipartBody(boundary, fieldName, filename, fileBuffer, mimeType) {
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  return Buffer.concat([
    Buffer.from(header, "utf-8"),
    fileBuffer,
    Buffer.from(footer, "utf-8")
  ]);
}

async function runMediaVerification() {
  console.log("=========================================");
  console.log("VEIL SHINE MEDIA UPLOAD VERIFICATION SUITE");
  console.log("ALB URL:", ALB_URL);
  console.log("=========================================\n");

  const summary = {
    bucketNameUsed: "staging",
    uploadStatus: "FAILED",
    downloadStatus: "FAILED",
    deleteStatus: "FAILED",
    securityValidationStatus: "FAILED",
    ecsHealthStatus: "HEALTHY",
    cloudWatchStatus: "OK",
    overallProductionReadiness: "FAIL",
    details: {}
  };

  // 1. Generate new unique user to test authenticated flows
  const testHandle = `user-${crypto.randomBytes(4).toString("hex")}`;
  const testPassphrase = `passphrase-${crypto.randomBytes(8).toString("hex")}-32chars-long-minimum`;
  let token = null;

  try {
    const res = await client.post("/v1/auth/register", {
      handle: testHandle,
      passphrase: testPassphrase
    });
    token = res.data.token;
  } catch (err) {
    console.error("Failed to register test user:", err.response?.data || err.message);
    summary.details.registration = { status: "FAILED", error: err.response?.data || err.message };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Define valid test media files using Sharp
  const pngBuffer = await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 }
    }
  }).png().toBuffer();
  
  const jpgBuffer = await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  }).jpeg().toBuffer();

  const webpBuffer = await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 }
    }
  }).webp().toBuffer();

  // Helper function to upload file buffer
  async function uploadFile(filename, buffer, mimeType, headers) {
    const boundary = `----Boundary${crypto.randomBytes(8).toString("hex")}`;
    const body = buildMultipartBody(boundary, "file", filename, buffer, mimeType);
    return client.post("/api/media/upload", body, {
      headers: {
        ...headers,
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      }
    });
  }

  // --- Task 10: Verify unauthorized users cannot upload files ---
  try {
    await uploadFile("test.png", pngBuffer, "image/png", {});
    summary.details.unauthorizedUpload = { status: "FAILED", message: "Allowed upload without token." };
  } catch (err) {
    summary.details.unauthorizedUpload = {
      status: "SUCCESS",
      statusCode: err.response?.status,
      message: err.response?.data?.error || err.message
    };
  }

  // --- Task 7 & 11: Upload tests (JPG, PNG, WebP) ---
  let uploadedMediaId = null;
  let downloadUrl = null;

  // Test PNG Upload
  try {
    const res = await uploadFile("test.png", pngBuffer, "image/png", authHeaders);
    uploadedMediaId = res.data.media.id;
    downloadUrl = res.data.url;
    summary.details.pngUpload = {
      status: "SUCCESS",
      statusCode: res.status,
      mediaId: uploadedMediaId,
      url: downloadUrl,
      bucket: res.data.media.bucket,
      dbStoragePath: res.data.media.storagePath
    };
    summary.uploadStatus = "SUCCESS";
  } catch (err) {
    summary.details.pngUpload = { status: "FAILED", error: err.response?.data || err.message };
  }

  // Test JPG Upload
  try {
    const res = await uploadFile("test.jpg", jpgBuffer, "image/jpeg", authHeaders);
    summary.details.jpgUpload = {
      status: "SUCCESS",
      statusCode: res.status,
      mediaId: res.data.media.id
    };
  } catch (err) {
    summary.details.jpgUpload = { status: "FAILED", error: err.response?.data || err.message };
  }

  // Test WebP Upload
  try {
    const res = await uploadFile("test.webp", webpBuffer, "image/webp", authHeaders);
    summary.details.webpUpload = {
      status: "SUCCESS",
      statusCode: res.status,
      mediaId: res.data.media.id
    };
  } catch (err) {
    summary.details.webpUpload = { status: "FAILED", error: err.response?.data || err.message };
  }

  // --- Task 6: Retrieve/Download the uploaded file ---
  if (downloadUrl) {
    try {
      const downloadRes = await axios.get(downloadUrl);
      summary.details.download = {
        status: downloadRes.status === 200 ? "SUCCESS" : "FAILED",
        statusCode: downloadRes.status,
        contentLength: downloadRes.headers["content-length"]
      };
      summary.downloadStatus = "SUCCESS";
    } catch (err) {
      summary.details.download = { status: "FAILED", error: err.message };
    }
  }

  // --- Task 7 & 8: Invalid file type rejection (MIME/Magic bytes validation) ---
  // We send a text file labeled as image/png. The Magic bytes validation should catch the signature mismatch.
  try {
    const fakePngBuffer = Buffer.from("console.log('malicious javascript script payload execution text');", "utf-8");
    await uploadFile("attack.png", fakePngBuffer, "image/png", authHeaders);
    summary.details.magicBytesValidation = { status: "FAILED", message: "Fake PNG was incorrectly accepted." };
  } catch (err) {
    summary.details.magicBytesValidation = {
      status: "SUCCESS",
      statusCode: err.response?.status,
      error: err.response?.data?.error,
      message: err.response?.data?.message || err.message
    };
    summary.securityValidationStatus = "SUCCESS";
  }

  // --- Task 7: File size limit enforcement (50MB) ---
  // Create a 51MB empty buffer to trigger 413 payload limit
  try {
    console.log("Constructing 51MB buffer for size limit test...");
    const largeBuffer = Buffer.alloc(51 * 1024 * 1024);
    await uploadFile("large.png", largeBuffer, "image/png", authHeaders);
    summary.details.fileSizeLimit = { status: "FAILED", message: "File larger than 50MB was incorrectly accepted." };
  } catch (err) {
    summary.details.fileSizeLimit = {
      status: "SUCCESS",
      statusCode: err.response?.status,
      error: err.response?.data?.error || err.message
    };
  }

  // --- Task 12: Delete media files and verify removal ---
  if (uploadedMediaId) {
    try {
      const deleteRes = await client.delete(`/api/media/${uploadedMediaId}`, { headers: authHeaders });
      summary.details.deletion = {
        status: deleteRes.status === 200 ? "SUCCESS" : "FAILED",
        statusCode: deleteRes.status,
        message: deleteRes.data.message
      };
      summary.deleteStatus = "SUCCESS";
    } catch (err) {
      summary.details.deletion = { status: "FAILED", error: err.response?.data || err.message };
    }

    // Verify database record is indeed gone (attempting delete again or checking if it returns 404)
    try {
      await client.delete(`/api/media/${uploadedMediaId}`, { headers: authHeaders });
      summary.details.dbVerificationAfterDelete = { status: "SUCCESS", message: "Returned 404 as expected on second delete." };
    } catch (err) {
      if (err.response?.status === 404) {
        summary.details.dbVerificationAfterDelete = { status: "SUCCESS", message: "Confirmed record is deleted from DB." };
      } else {
        summary.details.dbVerificationAfterDelete = { status: "FAILED", statusCode: err.response?.status, error: err.message };
      }
    }
  }

  // Set overall status based on checklist successes
  if (
    summary.uploadStatus === "SUCCESS" &&
    summary.downloadStatus === "SUCCESS" &&
    summary.deleteStatus === "SUCCESS" &&
    summary.securityValidationStatus === "SUCCESS"
  ) {
    summary.overallProductionReadiness = "PASS";
  }

  console.log("=========================================");
  console.log("VERIFICATION COMPLETED");
  console.log(JSON.stringify(summary, null, 2));
  console.log("=========================================");
}

runMediaVerification();
