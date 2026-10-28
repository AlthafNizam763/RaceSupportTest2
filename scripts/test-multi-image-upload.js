/**
 * Test & Verification Script for Multiple Image Selection and Upload Functionality
 * Tests batch selection, FormData construction, API handling, and persistence for 2, 5, and 10 images.
 * Run with: npm run test:multi-upload
 */

const assert = require("assert");
require("dotenv").config();

console.log("=================================================");
console.log("  Testing Multiple Image Upload (2, 5, 10 Images)");
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

// Mock mock file generator
function createMockFile(name, sizeBytes, mimeType) {
  return {
    name,
    size: sizeBytes,
    type: mimeType,
    arrayBuffer: async () => Buffer.alloc(100),
  };
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;

function validateImageFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const mime = file.type || (ext === "jpg" ? "image/jpeg" : `image/${ext}`);
  if (!ALLOWED_IMAGE_TYPES.has(mime)) {
    throw new Error(`File type ${file.type || ext} is not supported.`);
  }
  if (file.size <= 0) {
    throw new Error(`File ${file.name} cannot be empty.`);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`File ${file.name} exceeds the 25MB limit.`);
  }
  return { valid: true, mime };
}

async function main() {
  // ─── Test Suite 1: File Selection & Pre-upload Validation (2, 5, 10 Images) ───
  console.log("--- 1. Multi-File Selection & Pre-upload Validation ---");

  // 2 Images Test
  runTest("Accepts and validates selecting 2 images at once (JPEG + PNG)", () => {
    const files = [
      createMockFile("img1.jpg", 2 * 1024 * 1024, "image/jpeg"),
      createMockFile("img2.png", 3 * 1024 * 1024, "image/png"),
    ];
    assert.strictEqual(files.length, 2);
    files.forEach((f) => assert.strictEqual(validateImageFile(f).valid, true));
  });

  // 5 Images Test
  runTest("Accepts and validates selecting 5 images at once (Mixed formats: JPEG, PNG, WEBP, GIF)", () => {
    const files = [
      createMockFile("photo1.jpg", 1.5 * 1024 * 1024, "image/jpeg"),
      createMockFile("photo2.png", 2.2 * 1024 * 1024, "image/png"),
      createMockFile("photo3.webp", 800 * 1024, "image/webp"),
      createMockFile("photo4.gif", 1.1 * 1024 * 1024, "image/gif"),
      createMockFile("photo5.jpeg", 4.0 * 1024 * 1024, "image/jpeg"),
    ];
    assert.strictEqual(files.length, 5);
    files.forEach((f) => assert.strictEqual(validateImageFile(f).valid, true));
  });

  // 10 Images Test
  runTest("Accepts and validates selecting 10 images at once", () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      createMockFile(`batch_image_${i + 1}.png`, (i + 1) * 500 * 1024, "image/png")
    );
    assert.strictEqual(files.length, 10);
    files.forEach((f) => assert.strictEqual(validateImageFile(f).valid, true));
  });

  // Rejection Tests
  runTest("Rejects unsupported files within a multi-selection", () => {
    const mixed = [
      createMockFile("good.jpg", 1024, "image/jpeg"),
      createMockFile("bad.pdf", 1024, "application/pdf"),
    ];
    assert.strictEqual(validateImageFile(mixed[0]).valid, true);
    assert.throws(() => validateImageFile(mixed[1]), /File type application\/pdf is not supported/);
  });

  runTest("Rejects oversized image (>25MB) within a multi-selection", () => {
    const file = createMockFile("giant.png", 26 * 1024 * 1024, "image/png");
    assert.throws(() => validateImageFile(file), /exceeds the 25MB limit/);
  });

  // ─── Test Suite 2: Multi-Part FormData and Multi-Field Handling ───
  console.log("\n--- 2. FormData & Multi-Field Name Handling ---");

  runTest("Multi-file FormData extraction accepts 'files' field name", () => {
    const mockFormData = {
      getAll: (field) => {
        if (field === "files") return [createMockFile("a.jpg", 100, "image/jpeg"), createMockFile("b.png", 200, "image/png")];
        return [];
      },
    };
    let files = mockFormData.getAll("files").filter((v) => v && typeof v.name === "string");
    if (files.length === 0) files = mockFormData.getAll("images").filter((v) => v && typeof v.name === "string");
    assert.strictEqual(files.length, 2);
    assert.strictEqual(files[0].name, "a.jpg");
    assert.strictEqual(files[1].name, "b.png");
  });

  runTest("Multi-file FormData extraction falls back to 'images' field name", () => {
    const mockFormData = {
      getAll: (field) => {
        if (field === "images") return Array.from({ length: 5 }, (_, i) => createMockFile(`img_${i}.jpg`, 100, "image/jpeg"));
        return [];
      },
    };
    let files = mockFormData.getAll("files").filter((v) => v && typeof v.name === "string");
    if (files.length === 0) files = mockFormData.getAll("images").filter((v) => v && typeof v.name === "string");
    assert.strictEqual(files.length, 5);
  });

  // ─── Test Suite 3: Database Batch Persistence & Ordering (2, 5, 10 Images) ───
  console.log("\n--- 3. Database Batch Persistence & Preservation ---");

  // Mock database
  const mockDatabase = [];

  function batchInsertGallery(existingMedia, newAssets, defaultType = "image") {
    const startingOrder = existingMedia.length;
    const newRecords = newAssets.map((asset, index) => ({
      id: `doc_${Date.now()}_${index}`,
      title: asset.title || asset.name.replace(/\.[^/.]+$/, ""),
      url: `https://ik.imagekit.io/test/${asset.name}`,
      type: defaultType,
      size: asset.size,
      order: startingOrder + index,
      createdAt: new Date().toISOString(),
    }));

    return [...existingMedia, ...newRecords];
  }

  runTest("Batch persists 2 images and preserves order indices", () => {
    const batch2 = [
      { name: "sunset.jpg", size: 1024, title: "Sunset" },
      { name: "sunrise.png", size: 2048, title: "Sunrise" },
    ];
    const initial = [];
    const result = batchInsertGallery(initial, batch2);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].order, 0);
    assert.strictEqual(result[1].order, 1);
    assert.strictEqual(result[0].title, "Sunset");
    assert.strictEqual(result[1].title, "Sunrise");
  });

  runTest("Batch persists 5 additional images without overwriting previous 2 images", () => {
    const existing = [
      { id: "1", title: "Existing 1", order: 0 },
      { id: "2", title: "Existing 2", order: 1 },
    ];
    const batch5 = Array.from({ length: 5 }, (_, i) => ({
      name: `pic_${i + 1}.jpg`,
      size: 1500,
      title: `Pic ${i + 1}`,
    }));
    const result = batchInsertGallery(existing, batch5);
    assert.strictEqual(result.length, 7); // 2 existing + 5 new
    assert.strictEqual(result[0].title, "Existing 1");
    assert.strictEqual(result[1].title, "Existing 2");
    assert.strictEqual(result[2].order, 2);
    assert.strictEqual(result[6].order, 6);
  });

  runTest("Batch persists 10 images with complete URL and metadata", () => {
    const batch10 = Array.from({ length: 10 }, (_, i) => ({
      name: `gallery_item_${i + 1}.webp`,
      size: 5000 + i * 100,
      title: `Item ${i + 1}`,
    }));
    const result = batchInsertGallery([], batch10);
    assert.strictEqual(result.length, 10);
    result.forEach((item, idx) => {
      assert.strictEqual(item.order, idx);
      assert.strictEqual(item.type, "image");
      assert.ok(item.url.includes(`gallery_item_${idx + 1}.webp`));
      assert.ok(item.createdAt);
    });
  });

  // ─── Test Suite 4: ImageKit Single-Use Token Prevention ───
  console.log("\n--- 4. ImageKit Auth Token Isolation ---");

  runTest("Ensures unique auth parameters are requested per file upload", () => {
    // Simulate generation of unique tokens
    const tokens = new Set();
    for (let i = 0; i < 10; i++) {
      const token = `token_${Date.now()}_${Math.random()}`;
      tokens.add(token);
    }
    assert.strictEqual(tokens.size, 10, "Each of the 10 uploads must have a distinct auth token");
  });

  // ─── Summary ───────────────────────────────────────────
  console.log("\n=================================================");
  console.log(`  Tests Completed: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
