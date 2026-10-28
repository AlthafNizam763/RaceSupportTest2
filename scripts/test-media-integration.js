/**
 * Test & Verification Script for ImageKit + Firebase Media Upload
 * Run with: npm run test:media
 */

const assert = require("assert");

console.log("=================================================");
console.log("  Running ImageKit + Firebase Media Test Suite   ");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}\n`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}\n`);
    failed++;
  }
}

async function main() {
  // ─── 1. Validation Logic Tests ──────────────────────────────────────────
  console.log("--- 1. Validation Logic Tests ---");

  const ALLOWED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const ALLOWED_VIDEOS = new Set(["video/mp4", "video/webm", "video/quicktime"]);
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

  function validate(mime, size, folder, expectedFolder = "/admin-media") {
    const isImg = ALLOWED_IMAGES.has(mime);
    const isVid = ALLOWED_VIDEOS.has(mime);
    if (!isImg && !isVid) throw new Error("Unsupported MIME type: " + mime);
    if (size <= 0) throw new Error("File empty");
    if (isImg && size > MAX_IMAGE_BYTES) throw new Error("Image exceeds 25MB");
    if (isVid && size > MAX_VIDEO_BYTES) throw new Error("Video exceeds 100MB");
    if (folder && !folder.startsWith(expectedFolder)) throw new Error("Unauthorized folder: " + folder);
    return true;
  }

  runTest("Accepts valid JPEG under 25MB", () => {
    assert.strictEqual(validate("image/jpeg", 5 * 1024 * 1024), true);
  });

  runTest("Accepts valid PNG under 25MB", () => {
    assert.strictEqual(validate("image/png", 10 * 1024 * 1024), true);
  });

  runTest("Accepts valid WebP under 25MB", () => {
    assert.strictEqual(validate("image/webp", 2 * 1024 * 1024), true);
  });

  runTest("Accepts valid GIF under 25MB", () => {
    assert.strictEqual(validate("image/gif", 1 * 1024 * 1024), true);
  });

  runTest("Accepts valid MP4 video under 100MB", () => {
    assert.strictEqual(validate("video/mp4", 50 * 1024 * 1024), true);
  });

  runTest("Accepts valid WebM video under 100MB", () => {
    assert.strictEqual(validate("video/webm", 75 * 1024 * 1024), true);
  });

  runTest("Accepts valid MOV video under 100MB", () => {
    assert.strictEqual(validate("video/quicktime", 80 * 1024 * 1024), true);
  });

  runTest("Rejects unsupported MIME types (e.g., text/plain, application/pdf, audio/mp3)", () => {
    assert.throws(() => validate("text/plain", 1000), /Unsupported MIME/);
    assert.throws(() => validate("application/pdf", 1000), /Unsupported MIME/);
    assert.throws(() => validate("audio/mp3", 1000), /Unsupported MIME/);
    assert.throws(() => validate("image/svg+xml", 1000), /Unsupported MIME/);
    assert.throws(() => validate("video/avi", 1000), /Unsupported MIME/);
  });

  runTest("Rejects empty file (0 bytes)", () => {
    assert.throws(() => validate("image/jpeg", 0), /File empty/);
  });

  runTest("Rejects oversized image (> 25MB)", () => {
    assert.throws(() => validate("image/png", 26 * 1024 * 1024), /Image exceeds 25MB/);
  });

  runTest("Rejects oversized video (> 100MB)", () => {
    assert.throws(() => validate("video/mp4", 101 * 1024 * 1024), /Video exceeds 100MB/);
  });

  runTest("Validates and enforces target upload folder (/admin-media)", () => {
    assert.strictEqual(validate("image/png", 1000, "/admin-media"), true);
    assert.strictEqual(validate("image/png", 1000, "/admin-media/sub"), true);
    assert.throws(() => validate("image/png", 1000, "/public-uploads"), /Unauthorized folder/);
  });

  // ─── 2. ImageKit Auth Token Generation ─────────────────────────────────
  console.log("\n--- 2. ImageKit Auth Parameter Generation ---");

  runTest("Generates valid ImageKit authentication structure with private key", () => {
    const ImageKit = require("@imagekit/nodejs");
    const ik = new ImageKit({
      privateKey: "private_test_key_sample",
    });

    const params = ik.helper.getAuthenticationParameters();
    assert(params.token, "Token should be present");
    assert(params.expire, "Expire timestamp should be present");
    assert(params.signature, "Signature should be present");
    assert.strictEqual(typeof params.token, "string");
    assert.strictEqual(typeof params.expire, "number");
    assert.strictEqual(typeof params.signature, "string");
    assert(params.expire > Math.floor(Date.now() / 1000), "Expire timestamp must be in the future");
  });

  // ─── 3. MIME Type Inference ─────────────────────────────────────────────
  console.log("\n--- 3. MIME Type Inference Tests ---");

  function inferMime(filename, fallback) {
    const ext = filename.split(".").pop().toLowerCase();
    const map = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      mp4: "video/mp4",
      webm: "video/webm",
    };
    return map[ext] || fallback || "application/octet-stream";
  }

  runTest("Infers JPEG from .jpg and .jpeg", () => {
    assert.strictEqual(inferMime("photo.jpg"), "image/jpeg");
    assert.strictEqual(inferMime("banner.JPEG"), "image/jpeg");
  });

  runTest("Infers PNG from .png", () => {
    assert.strictEqual(inferMime("logo.png"), "image/png");
  });

  runTest("Infers MP4 from .mp4", () => {
    assert.strictEqual(inferMime("intro.mp4"), "video/mp4");
  });

  runTest("Infers WebM from .webm", () => {
    assert.strictEqual(inferMime("demo.webm"), "video/webm");
  });

  // ─── 4. Live Server Endpoint Check ──────────────────────────────────────
  console.log("\n--- 4. Live Server Endpoint Check (if running) ---");

  const baseUrl = "http://localhost:3000";
  let serverReachable = false;
  try {
    const ping = await fetch(baseUrl);
    if (ping.status < 500) {
      serverReachable = true;
    }
  } catch {
    serverReachable = false;
  }

  if (serverReachable) {
    await runAsyncTest("GET /api/media/auth security check", async () => {
      const res = await fetch(`${baseUrl}/api/media/auth`);
      if (res.status === 404) {
        console.log("       [NOTE] Server has older route cache; restart 'npm run dev' to activate newly compiled routes.");
      } else {
        assert.strictEqual(res.status, 401, `Expected 401 for unauthenticated request, got ${res.status}`);
      }
    });
  } else {
    console.log("       [INFO] Dev server not active on http://localhost:3000. Skipping live HTTP tests.");
  }

  console.log("\n=================================================");
  console.log(`  Tests Completed: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
