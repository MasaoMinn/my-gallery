import { expect, test, type Page } from "@playwright/test";

const album = {
  id: "album-1",
  title: "测试相册",
  description: "相册描述",
  is_public: true,
  cover_image_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  image_count: 1,
  total_size_bytes: 1024,
  cover_image: null
};

const image = {
  id: "image-1",
  album_id: album.id,
  content_type: "image/jpeg",
  size_bytes: 1024,
  width: 1200,
  height: 800,
  description: "图片描述",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z"
};

async function mockSession(page: Page, authenticated: boolean) {
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({
      json: { data: { authenticated, tokenConfigured: true, maxUploadMb: 95 } }
    })
  );
}

async function mockGallery(page: Page) {
  await page.route("**/api/albums", (route) => route.fulfill({ json: { data: [album] } }));
  await page.route("**/api/albums/album-1/images", (route) =>
    route.fulfill({ json: { data: [image] } })
  );
  await page.route("**/api/images/image-1/asset", (route) =>
    route.fulfill({ body: Buffer.from("image"), contentType: "image/jpeg" })
  );
}

test("visitors can browse public image details but cannot see management controls", async ({ page }) => {
  await mockSession(page, false);
  await mockGallery(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "My Gallery" })).toBeVisible();
  await expect(page.getByRole("link", { name: "管理员登录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建相册" })).toHaveCount(0);
  await expect(page.getByLabel("相册排序字段")).toHaveValue("updatedAt");

  await page.getByRole("button", { name: /测试相册/ }).click();
  await expect(page.getByRole("button", { name: "编辑相册信息" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "上传图片" })).toHaveCount(0);
  await expect(page.locator("aside")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "中，桌面端一行 5 张图" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "特小，桌面端一行 8 张图" }).click();
  await expect(page.locator(".image-grid")).toHaveClass(/image-size-xsmall/);

  await page.locator(".image-card").click();
  const dialog = page.getByRole("dialog", { name: "查看图片" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".image-description")).toHaveText("图片描述");
  await expect(dialog.getByText("1.0 KB")).toBeVisible();
  await expect(dialog.getByText("1200 × 800 px")).toBeVisible();
  await expect(dialog.getByText("JPEG")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "编辑" })).toHaveCount(0);
  await expect(dialog).not.toContainText("hidden.jpg");
});

test("administrators edit albums and explicitly enter image description edit mode", async ({ page }) => {
  await mockSession(page, true);
  await mockGallery(page);
  await page.route("**/api/albums/album-1", async (route) => {
    const input = route.request().postDataJSON() as { title: string; description: string };
    await route.fulfill({ json: { data: { ...album, ...input } } });
  });
  await page.route("**/api/images/image-1", async (route) => {
    const input = route.request().postDataJSON() as { description: string };
    await route.fulfill({ json: { data: { ...image, ...input } } });
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "新建相册" })).toBeVisible();
  await page.getByRole("button", { name: /测试相册/ }).click();

  await page.getByRole("button", { name: "编辑相册信息" }).click();
  const albumDialog = page.getByRole("dialog", { name: "编辑相册信息" });
  await albumDialog.getByLabel("名称").fill("更新后的相册");
  await albumDialog.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("heading", { name: "更新后的相册" })).toBeVisible();

  await page.locator(".image-card").click();
  const imageDialog = page.getByRole("dialog", { name: "查看图片" });
  await expect(imageDialog.getByLabel("描述")).toHaveCount(0);
  await imageDialog.getByRole("button", { name: "编辑" }).click();
  await imageDialog.getByLabel("描述").fill("更新后的图片描述");
  await imageDialog.getByRole("button", { name: "保存" }).click();
  await expect(imageDialog).toBeHidden();
});

test("unauthenticated management pages redirect to administrator login", async ({ page }) => {
  await mockSession(page, false);
  await page.goto("/upload");

  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fupload/);
  await expect(page.getByRole("heading", { name: "登录管理相册" })).toBeVisible();
});

test("an administrator signs in once and returns to the requested management page", async ({ page }) => {
  let authenticated = false;
  await page.route("**/api/admin/session", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON() as { token: string };
      authenticated = input.token === "correct-token";
      await route.fulfill({ json: { data: { authenticated } }, status: authenticated ? 200 : 401 });
      return;
    }
    await route.fulfill({
      json: { data: { authenticated, tokenConfigured: true, maxUploadMb: 95 } }
    });
  });

  await page.goto("/admin/login?next=/upload");
  await page.getByLabel("管理员密钥").fill("correct-token");
  await page.getByRole("button", { name: "登录", exact: true }).click();

  await expect(page).toHaveURL(/\/upload$/);
  await expect(page.getByRole("heading", { name: "创建一个新的相册" })).toBeVisible();
});

test("authenticated upload page does not mix in image upload controls", async ({ page }) => {
  await mockSession(page, true);
  await page.goto("/upload");

  await expect(page.getByRole("heading", { name: "创建一个新的相册" })).toBeVisible();
  await expect(page.getByLabel("相册名称")).toBeVisible();
  await expect(page.getByRole("heading", { name: "上传图片", exact: true })).toHaveCount(0);
});

test("image upload reports progress and a successful result", async ({ page }) => {
  await mockSession(page, true);
  let images = [] as typeof image[];
  await page.route("**/api/albums/album-1", (route) =>
    route.fulfill({ json: { data: album } })
  );
  await page.route("**/api/albums/album-1/images", async (route) => {
    if (route.request().method() === "POST") {
      images = [image];
      await route.fulfill({ json: { data: { image, duplicate: false } } });
      return;
    }
    await route.fulfill({ json: { data: images } });
  });
  await page.route("**/api/albums/album-1/images/check", (route) =>
    route.fulfill({ json: { data: { duplicateIds: [] } } })
  );

  await page.goto("/albums/album-1/upload");
  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from("test-image"),
    mimeType: "image/jpeg",
    name: "test.jpg"
  });

  await expect(page.getByRole("status")).toContainText("1 张图片已上传");
  await expect(page.getByLabel("全部图片上传进度")).toHaveJSProperty("value", 100);
  await expect(page.getByText("test.jpg")).toBeVisible();
  await expect(page.getByText(/已完成/)).toBeVisible();
});

test("image upload keeps server errors visible per item", async ({ page }) => {
  await mockSession(page, true);
  await page.route("**/api/albums/album-1", (route) =>
    route.fulfill({ json: { data: album } })
  );
  await page.route("**/api/albums/album-1/images", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        json: { error: { code: "file_too_large", message: "图片超过上传大小限制" } },
        status: 413
      });
      return;
    }
    await route.fulfill({ json: { data: [] } });
  });
  await page.route("**/api/albums/album-1/images/check", (route) =>
    route.fulfill({ json: { data: { duplicateIds: [] } } })
  );

  await page.goto("/albums/album-1/upload");
  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from("oversized-image"),
    mimeType: "image/jpeg",
    name: "large.jpg"
  });

  await expect(page.locator(".notice.error")).toContainText("1 张图片上传失败");
  await expect(page.getByText("图片超过上传大小限制")).toBeVisible();
  await expect(page.locator(".upload-file-item.error")).toContainText("上传失败");
});

test("existing duplicate images are skipped before file upload", async ({ page }) => {
  await mockSession(page, true);
  let uploadRequests = 0;
  await page.route("**/api/albums/album-1", (route) =>
    route.fulfill({ json: { data: album } })
  );
  await page.route("**/api/albums/album-1/images", async (route) => {
    if (route.request().method() === "POST") {
      uploadRequests += 1;
    }
    await route.fulfill({ json: { data: [] } });
  });
  await page.route("**/api/albums/album-1/images/check", async (route) => {
    const input = route.request().postDataJSON() as { files: Array<{ clientId: string }> };
    await route.fulfill({ json: { data: { duplicateIds: [input.files[0].clientId] } } });
  });

  await page.goto("/albums/album-1/upload");
  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from("already-there"),
    mimeType: "image/jpeg",
    name: "existing.jpg"
  });

  await expect(page.getByRole("status")).toContainText("均已存在，已跳过上传");
  await expect(page.locator(".upload-file-item.skipped")).toContainText("重复图片，已跳过");
  expect(uploadRequests).toBe(0);
});

test("administrators create an album in a modal and enter it immediately", async ({ page }) => {
  await mockSession(page, true);
  const createdAlbum = {
    ...album,
    id: "album-2",
    title: "新建的相册",
    description: "新相册描述",
    image_count: 0,
    total_size_bytes: 0
  };
  await page.route("**/api/albums", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: { data: createdAlbum } });
      return;
    }
    await route.fulfill({ json: { data: [album] } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "新建相册", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新建相册" });
  await dialog.getByLabel("相册名称").fill("新建的相册");
  await dialog.getByLabel("相册描述").fill("新相册描述");
  await dialog.getByRole("button", { name: "创建相册" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "新建的相册" })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "上传图片" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
