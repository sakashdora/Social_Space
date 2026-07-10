import axios from "axios";
import crypto from "crypto";
import dns from "dns";

// Force IPv4 resolution to prevent node v17+ IPv6 DNS resolution hang in restricted environments
dns.setDefaultResultOrder("ipv4first");

const ALB_URL = "http://veil-alb-2042746512.eu-north-1.elb.amazonaws.com";

const client = axios.create({
  baseURL: ALB_URL,
  timeout: 20000 // 20 seconds timeout on all requests
});

async function runTests() {
  console.log("=========================================");
  console.log("VEIL SHINE DEPLOYMENT SMOKE TEST RUNNER");
  console.log("ALB URL:", ALB_URL);
  console.log("=========================================\n");

  const results = {};

  // 1. Health check & Database connectivity
  try {
    const res = await client.get("/healthz");
    results.health = {
      status: res.status === 200 ? "SUCCESS" : "FAILED",
      data: res.data
    };
  } catch (err) {
    results.health = { status: "FAILED", error: err.message };
  }

  // 2. Security headers (via Helmet)
  try {
    const res = await client.get("/");
    const headers = res.headers;
    results.securityHeaders = {
      status: "SUCCESS",
      "x-dns-prefetch-control": headers["x-dns-prefetch-control"],
      "x-frame-options": headers["x-frame-options"],
      "strict-transport-security": headers["strict-transport-security"],
      "x-content-type-options": headers["x-content-type-options"],
      "content-security-policy": headers["content-security-policy"] ? "Present" : "Missing"
    };
  } catch (err) {
    results.securityHeaders = { status: "FAILED", error: err.message };
  }

  // Generate unique credentials for registration/login
  const testHandle = `user-${crypto.randomBytes(4).toString("hex")}`;
  const testPassphrase = `passphrase-${crypto.randomBytes(8).toString("hex")}-32chars-long-minimum`;

  let token = null;
  let postId = null;

  // 3. User Registration
  try {
    const res = await client.post("/v1/auth/register", {
      handle: testHandle,
      passphrase: testPassphrase
    });
    results.registration = {
      status: res.status === 201 || res.status === 200 ? "SUCCESS" : "FAILED",
      data: res.data
    };
  } catch (err) {
    results.registration = { status: "FAILED", error: err.response?.data || err.message };
  }

  // 4. User Login & Authentication (JWT retrieval)
  try {
    const res = await client.post("/v1/auth/login", {
      handle: testHandle,
      passphrase: testPassphrase
    });
    token = res.data.token;
    results.login = {
      status: token ? "SUCCESS" : "FAILED",
      tokenPresent: !!token
    };
  } catch (err) {
    results.login = { status: "FAILED", error: err.response?.data || err.message };
  }

  // Check auth endpoints
  if (token) {
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 5. Create a Post
    try {
      const res = await client.post("/v1/posts", {
        content: "Testing post creation from deployment smoke test runner.",
        category: "general"
      }, { headers: authHeaders });
      postId = res.data.id;
      results.createPost = {
        status: postId ? "SUCCESS" : "FAILED",
        postId
      };
    } catch (err) {
      results.createPost = { status: "FAILED", error: err.response?.data || err.message };
    }

    // 6. Create a Comment
    if (postId) {
      try {
        const res = await client.post(`/v1/posts/${postId}/comments`, {
          content: "Testing comment on the smoke test post."
        }, { headers: authHeaders });
        results.createComment = {
          status: res.status === 201 || res.status === 200 ? "SUCCESS" : "FAILED",
          commentId: res.data.id
        };
      } catch (err) {
        results.createComment = { status: "FAILED", error: err.response?.data || err.message };
      }
    }

    // 7. Media Upload
    try {
      // Create a valid 1-pixel PNG buffer
      const pngBuffer = Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
        "hex"
      );
      const boundary = `----SmokeTestBoundary${crypto.randomBytes(8).toString("hex")}`;
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;
      const body = Buffer.concat([
        Buffer.from(header, "utf-8"),
        pngBuffer,
        Buffer.from(footer, "utf-8")
      ]);

      const res = await client.post("/api/media/upload", body, {
        headers: {
          ...authHeaders,
          "Content-Type": `multipart/form-data; boundary=${boundary}`
        }
      });

      results.mediaUpload = {
        status: res.status === 200 || res.status === 201 ? "SUCCESS" : "FAILED",
        mediaId: res.data.mediaId,
        url: res.data.url
      };
    } catch (err) {
      results.mediaUpload = { status: "FAILED", error: err.response?.data || err.message };
    }
  } else {
    results.createPost = { status: "SKIPPED", reason: "No auth token" };
    results.createComment = { status: "SKIPPED", reason: "No auth token" };
    results.mediaUpload = { status: "SKIPPED", reason: "No auth token" };
  }

  // 8. Rate Limiting Test (Make 15 rapid calls to login endpoint with bad credentials to trigger 429)
  results.rateLimiter = { status: "FAILED", message: "Did not trigger 429 after 15 calls." };
  let count429 = 0;
  for (let i = 0; i < 15; i++) {
    try {
      await client.post("/v1/auth/login", {
        handle: "non_existent_user_for_rate_limiting_test",
        passphrase: "bad_passphrase_value_to_fail_quickly"
      });
    } catch (err) {
      if (err.response?.status === 429) {
        count429++;
        results.rateLimiter = {
          status: "SUCCESS",
          statusCode: 429,
          attemptsToTrigger: i + 1,
          message: err.response.data?.error || "Rate limited successfully"
        };
        break;
      }
    }
  }

  console.log("=========================================");
  console.log("SMOKE TEST RESULTS:");
  console.log(JSON.stringify(results, null, 2));
  console.log("=========================================");
}

runTests();
