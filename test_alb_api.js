import fs from 'fs';
import path from 'path';

const ALB_BASE = 'http://veil-alb-2042746512.eu-north-1.elb.amazonaws.com';

async function runTests() {
  const results = {};
  console.log('--- STARTING VEIL SOCIAL PRODUCTION API INTEGRATION SMOKE TEST ---');

  // Test 1: Healthz Check
  try {
    const res = await fetch(`${ALB_BASE}/healthz`);
    results.healthz = {
      status: res.status,
      body: await res.json(),
    };
    console.log('✓ Healthz endpoint passed.');
  } catch (err) {
    results.healthz = { error: err.message };
    console.error('✗ Healthz check failed:', err.message);
  }

  // Test 2: User Registration
  const username = `smoke${Math.floor(Math.random() * 100000)}`;
  const password = `correct horse battery staple ${username}!`;
  let token = null;

  try {
    const res = await fetch(`${ALB_BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: username, passphrase: password }),
    });
    const data = await res.json();
    results.registration = {
      status: res.status,
      body: data,
    };
    if (res.ok && data.token) {
      token = data.token;
      console.log(`✓ Registration passed for user: ${username}`);
    } else {
      console.error('✗ Registration failed:', data);
    }
  } catch (err) {
    results.registration = { error: err.message };
    console.error('✗ Registration request error:', err.message);
  }

  // Test 3: User Login
  if (token) {
    try {
      const res = await fetch(`${ALB_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: username, passphrase: password }),
      });
      const data = await res.json();
      results.login = {
        status: res.status,
        body: data,
      };
      if (res.ok) {
        console.log('✓ Login passed.');
      } else {
        console.error('✗ Login failed:', data);
      }
    } catch (err) {
      results.login = { error: err.message };
      console.error('✗ Login request error:', err.message);
    }

    // Test 4: Get Me (JWT authentication check)
    try {
      const res = await fetch(`${ALB_BASE}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      results.getMe = {
        status: res.status,
        body: data,
      };
      if (res.ok) {
        console.log('✓ JWT authentication (Get Me) passed.');
      } else {
        console.error('✗ JWT auth failed:', data);
      }
    } catch (err) {
      results.getMe = { error: err.message };
      console.error('✗ Get Me request error:', err.message);
    }

    // Test 5: Feed Loading
    try {
      const res = await fetch(`${ALB_BASE}/api/v1/posts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      results.feed = {
        status: res.status,
        body: data,
      };
      if (res.ok) {
        console.log('✓ Feed loading passed.');
      } else {
        console.error('✗ Feed loading failed:', data);
      }
    } catch (err) {
      results.feed = { error: err.message };
      console.error('✗ Feed request error:', err.message);
    }

    // Test 6: Create Post
    let postId = null;
    try {
      const res = await fetch(`${ALB_BASE}/api/v1/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Live smoke test post content!',
          category: 'General',
          mode: 'pseudo',
        }),
      });
      const data = await res.json();
      results.createPost = {
        status: res.status,
        body: data,
      };
      if (res.ok && data.id) {
        postId = data.id;
        console.log(`✓ Post creation passed (Post ID: ${postId}).`);
      } else {
        console.error('✗ Post creation failed:', data);
      }
    } catch (err) {
      results.createPost = { error: err.message };
      console.error('✗ Create post request error:', err.message);
    }

    // Test 7: Comment Creation
    if (postId) {
      try {
        const res = await fetch(`${ALB_BASE}/api/v1/posts/${postId}/comments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: 'Live smoke test comment content!',
            mode: 'pseudo',
          }),
        });
        const data = await res.json();
        results.comment = {
          status: res.status,
          body: data,
        };
        if (res.ok) {
          console.log('✓ Comment creation passed.');
        } else {
          console.error('✗ Comment creation failed:', data);
        }
      } catch (err) {
        results.comment = { error: err.message };
        console.error('✗ Comment request error:', err.message);
      }
    }

    // Test 8: Media Upload - Option A (/api/media/upload)
    const testFileContent = 'fake image binary content';
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const bodyParts = [
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="file"; filename="test.png"\r\n',
      'Content-Type: image/png\r\n\r\n',
      testFileContent,
      `\r\n--${boundary}--\r\n`
    ].join('');

    try {
      const res = await fetch(`${ALB_BASE}/api/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyParts,
      });
      const data = await res.json();
      results.mediaUploadOptionA = {
        status: res.status,
        body: data,
      };
      if (res.ok) {
        console.log('✓ Media upload Option A (/api/media/upload) passed.');
      } else {
        console.log(`✗ Media upload Option A failed (status: ${res.status}):`, data);
      }
    } catch (err) {
      results.mediaUploadOptionA = { error: err.message };
      console.log('✗ Media upload Option A request error:', err.message);
    }

    // Test 9: Media Upload - Option B (/api/api/media/upload)
    try {
      const res = await fetch(`${ALB_BASE}/api/api/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyParts,
      });
      const data = await res.json().catch(() => ({ message: 'Non-JSON response' }));
      results.mediaUploadOptionB = {
        status: res.status,
        body: data,
      };
      if (res.ok) {
        console.log('✓ Media upload Option B (/api/api/media/upload) passed.');
      } else {
        console.log(`✗ Media upload Option B failed (status: ${res.status}):`, data);
      }
    } catch (err) {
      results.mediaUploadOptionB = { error: err.message };
      console.log('✗ Media upload Option B request error:', err.message);
    }
  }

  // Save the report file
  fs.writeFileSync('smoke_test_results.json', JSON.stringify(results, null, 2));
  console.log('\n--- REPORT WRITTEN TO smoke_test_results.json ---');
}

runTests();
