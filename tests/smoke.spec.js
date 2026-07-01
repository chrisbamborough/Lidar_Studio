import { expect, test } from "@playwright/test";
import { inflateSync } from "node:zlib";

function readoutCount(text) {
  return Number.parseInt(text?.replace(/[^\d]/g, "") || "0", 10);
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function parsePng(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("Screenshot is not a PNG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format: bit depth ${bitDepth}, color type ${colorType}`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(height * stride);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const rowStart = y * stride;
    const previousRowStart = rowStart - stride;

    for (let x = 0; x < stride; x += 1) {
      const current = raw[rawOffset + x];
      const left = x >= bytesPerPixel ? pixels[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[previousRowStart + x] : 0;
      const upperLeft =
        y > 0 && x >= bytesPerPixel ? pixels[previousRowStart + x - bytesPerPixel] : 0;

      if (filter === 0) {
        pixels[rowStart + x] = current;
      } else if (filter === 1) {
        pixels[rowStart + x] = (current + left) & 255;
      } else if (filter === 2) {
        pixels[rowStart + x] = (current + up) & 255;
      } else if (filter === 3) {
        pixels[rowStart + x] = (current + Math.floor((left + up) / 2)) & 255;
      } else if (filter === 4) {
        pixels[rowStart + x] = (current + paethPredictor(left, up, upperLeft)) & 255;
      } else {
        throw new Error(`Unsupported PNG filter: ${filter}`);
      }
    }

    rawOffset += stride;
  }

  return {
    width,
    height,
    bytesPerPixel,
    pixels,
  };
}

function screenshotStats(buffer) {
  const image = parsePng(buffer);
  let litPixels = 0;
  let maxChannel = 0;

  for (let i = 0; i < image.pixels.length; i += image.bytesPerPixel) {
    const channel = Math.max(image.pixels[i], image.pixels[i + 1], image.pixels[i + 2]);
    if (channel > 20) litPixels += 1;
    maxChannel = Math.max(maxChannel, channel);
  }

  return {
    width: image.width,
    height: image.height,
    litPixels,
    maxChannel,
  };
}

test("demo mode loads and renders LiDAR visuals", async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.removeItem("lidar-studio-settings");
  });

  await page.goto("/");

  await expect(page).toHaveTitle("LiDAR Studio");
  await expect(page.getByRole("heading", { name: "LiDAR Studio" })).toBeVisible();
  await expect(page.locator("#status")).toHaveText("Demo");
  await expect(page.locator("#sourceLabel")).toHaveText("Synthetic source");
  await expect(page.locator("#renderMode")).toHaveValue("hybrid");
  await expect(page.locator("#frameSize")).toHaveText("180 x 120");
  await expect(page.locator("#error")).toHaveText("");

  await expect
    .poll(async () => readoutCount(await page.locator("#points").textContent()))
    .toBeGreaterThan(0);
  await expect
    .poll(async () => readoutCount(await page.locator("#trails").textContent()))
    .toBeGreaterThan(0);

  const canvasBox = await page.locator("#three").boundingBox();

  expect(canvasBox).not.toBeNull();
  expect(canvasBox.width).toBeGreaterThan(0);
  expect(canvasBox.height).toBeGreaterThan(0);

  const sampleWidth = Math.floor(Math.min(320, canvasBox.width));
  const sampleHeight = Math.floor(Math.min(240, canvasBox.height));
  const screenshot = await page.screenshot({
    clip: {
      x: Math.floor(canvasBox.x + (canvasBox.width - sampleWidth) / 2),
      y: Math.floor(canvasBox.y + (canvasBox.height - sampleHeight) / 2),
      width: sampleWidth,
      height: sampleHeight,
    },
  });
  const stats = screenshotStats(screenshot);

  expect(stats.width, JSON.stringify(stats)).toBeGreaterThan(0);
  expect(stats.height, JSON.stringify(stats)).toBeGreaterThan(0);
  expect(stats.litPixels, JSON.stringify(stats)).toBeGreaterThan(10);
  expect(stats.maxChannel, JSON.stringify(stats)).toBeGreaterThan(20);
  expect([...pageErrors, ...consoleErrors]).toEqual([]);
});
