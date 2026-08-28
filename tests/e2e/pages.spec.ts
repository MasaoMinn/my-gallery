import { expect, test, type Page } from "@playwright/test";
import type { Album } from "@/lib/db/gallery";

const album: Album = {
  id: "album-1",
  route_id: "0123456789abcdef0123456789abcdef",
  title: "测试相册",
  description: "相册描述",
  album_type: "album" as const,
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
  await mockDirectAlbum(page, album);
  await page.route("**/api/albums/album-1/images", (route) =>
    route.fulfill({ json: { data: [image] } })
  );
  await page.route("**/api/images/image-1/asset", (route) =>
    route.fulfill({ body: Buffer.from("image"), contentType: "image/jpeg" })
  );
}

async function mockDirectAlbum(page: Page, routedAlbum = album) {
  await page.route("**/api/albums/by-route/*", (route) =>
    route.fulfill({ json: { data: routedAlbum } })
  );
}

test("visitors can browse public image details but cannot see management controls", async ({ page }) => {
  await mockSession(page, false);
  await mockGallery(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Cloudflare Album" })).toBeVisible();
  await expect(page.getByRole("link", { name: "管理员登录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建内容" })).toHaveCount(0);
  await expect(page.getByLabel("相册排序字段")).toHaveValue("updatedAt");

  await page.getByRole("button", { name: /测试相册/ }).click();
  await expect(page).toHaveURL(`/${album.route_id}`);
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
  await expect(dialog.getByRole("button", { name: "删除" })).toHaveCount(0);
  await expect(dialog).not.toContainText("hidden.jpg");
});

test("public albums can be opened directly by their unique route id", async ({ page }) => {
  await mockSession(page, false);
  await mockGallery(page);

  await page.goto(`/${album.route_id}`);

  await expect(page.getByRole("heading", { name: album.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "复制相册链接" })).toBeVisible();
  await expect(page.locator(".image-card")).toHaveCount(1);
  await page.getByRole("button", { name: "返回首页" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("unknown or inaccessible route ids do not expose an album", async ({ page }) => {
  await mockSession(page, false);
  await page.route("**/api/albums", (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route("**/api/albums/by-route/*", (route) =>
    route.fulfill({
      json: { error: { code: "album_not_found", message: "相册不存在" } },
      status: 404
    })
  );

  await page.goto("/ffffffffffffffffffffffffffffffff");

  await expect(page.getByText("404", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "相册不存在或不可访问" })).toBeVisible();
  await expect(page.getByLabel("图片浏览区")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /测试相册/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "返回相册首页" })).toBeVisible();
});

test("private albums do not expose the copy-link action", async ({ page }) => {
  const privateAlbum: Album = {
    ...album,
    route_id: "abcdef0123456789abcdef0123456789",
    title: "非公开相册",
    is_public: false
  };
  await mockSession(page, true);
  await page.route("**/api/albums", (route) =>
    route.fulfill({ json: { data: [privateAlbum] } })
  );
  await mockDirectAlbum(page, privateAlbum);
  await page.route("**/api/albums/album-1/images", (route) =>
    route.fulfill({ json: { data: [] } })
  );

  await page.goto(`/${privateAlbum.route_id}`);

  await expect(page.getByRole("heading", { name: privateAlbum.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "复制相册链接" })).toHaveCount(0);
});

test("wide images span two columns without refetching image assets when the size changes", async ({ page }, testInfo) => {
  const mixedImages = [
    { ...image, id: "wide-image", width: 1800, height: 900, description: "宽图" },
    { ...image, id: "square-image", width: 1000, height: 1000, description: "方图" },
    { ...image, id: "portrait-image", width: 800, height: 1600, description: "竖图" }
  ];
  const assetRequests = new Map<string, number>();
  let imageListRequests = 0;

  await mockSession(page, false);
  await mockDirectAlbum(page, album);
  await page.route("**/api/albums", (route) => route.fulfill({ json: { data: [album] } }));
  await page.route("**/api/albums/album-1/images", (route) => {
    imageListRequests += 1;
    return route.fulfill({ json: { data: mixedImages } });
  });
  await page.route("**/api/images/*/asset", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "unknown";
    assetRequests.set(id, (assetRequests.get(id) ?? 0) + 1);
    return route.fulfill({
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64"
      ),
      contentType: "image/png"
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /测试相册/ }).click();
  const grid = page.locator(".image-grid");
  await expect(grid).toHaveClass(/masonry-ready/);
  await expect(page.locator(".image-card")).toHaveCount(3);

  const wideCard = page.locator('[data-column-span="2"]');
  const squareCard = page.locator(".image-card").filter({ has: page.getByAltText("方图") });
  const wideBox = await wideCard.boundingBox();
  const squareBox = await squareCard.boundingBox();
  expect(wideBox).not.toBeNull();
  expect(squareBox).not.toBeNull();
  expect(wideBox!.width).toBeCloseTo(squareBox!.width * 2 + (testInfo.project.name === "mobile-chrome" ? 12 : 14), 0);

  await expect.poll(() => assetRequests.size).toBe(3);
  const requestsBeforeResize = new Map(assetRequests);
  await page.getByRole("button", { name: "特小，桌面端一行 8 张图" }).click();
  await expect(grid).toHaveClass(/image-size-xsmall/);
  await page.waitForTimeout(250);

  expect(imageListRequests).toBe(1);
  expect(assetRequests).toEqual(requestsBeforeResize);
});

test("refresh dropdown can invalidate image URLs and reload the current album", async ({ page }) => {
  let albumRequests = 0;
  let imageListRequests = 0;
  const assetUrls: string[] = [];

  await mockSession(page, false);
  await mockDirectAlbum(page, album);
  await page.route("**/api/albums", (route) => {
    albumRequests += 1;
    return route.fulfill({ json: { data: [album] } });
  });
  await page.route("**/api/albums/album-1/images", (route) => {
    imageListRequests += 1;
    return route.fulfill({ json: { data: [image] } });
  });
  await page.route("**/api/images/image-1/asset**", (route) => {
    assetUrls.push(route.request().url());
    return route.fulfill({
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64"
      ),
      contentType: "image/png"
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /测试相册/ }).click();
  await expect.poll(() => assetUrls.length).toBeGreaterThan(0);

  const albumRequestsBefore = albumRequests;
  const imageRequestsBefore = imageListRequests;
  const assetRequestsBefore = assetUrls.length;
  await page.getByLabel("打开刷新菜单").click();
  await expect(page.getByRole("menuitem", { name: "清除缓存" })).toBeVisible();
  await page.getByRole("heading", { name: "Cloudflare Album" }).hover();
  await expect(page.getByRole("menuitem", { name: "清除缓存" })).toBeHidden();
  await page.getByLabel("打开刷新菜单").click();
  await page.getByRole("menuitem", { name: "清除缓存" }).click();

  const cacheToast = page.locator('[data-sonner-toast][data-type="success"]');
  await expect(cacheToast).toContainText("图片缓存已清除");
  await expect(page.locator(".image-card img")).toHaveAttribute("src", /\?cache=\d+$/);
  await expect.poll(() => albumRequests).toBeGreaterThan(albumRequestsBefore);
  await expect.poll(() => imageListRequests).toBeGreaterThan(imageRequestsBefore);
  await expect.poll(() => assetUrls.length).toBeGreaterThan(assetRequestsBefore);
  await expect(cacheToast).toBeHidden({ timeout: 6_000 });
});

test("administrators edit albums and explicitly enter image description edit mode", async ({ page }) => {
  await mockSession(page, true);
  await mockGallery(page);
  let currentAlbum = album;
  await page.route("**/api/albums/by-route/*", (route) =>
    route.fulfill({ json: { data: currentAlbum } })
  );
  await page.route("**/api/albums/album-1", async (route) => {
    const input = route.request().postDataJSON() as {
      title: string;
      description: string;
      routeId: string;
    };
    if (input.routeId === "duplicate-album") {
      await route.fulfill({
        status: 409,
        json: {
          error: {
            code: "route_id_conflict",
            message: "该路由 ID 已被其他相册或设定集使用"
          }
        }
      });
      return;
    }
    currentAlbum = {
      ...currentAlbum,
      title: input.title,
      description: input.description,
      route_id: input.routeId
    };
    await route.fulfill({ json: { data: currentAlbum } });
  });
  await page.route("**/api/images/image-1", async (route) => {
    const input = route.request().postDataJSON() as { description: string };
    await route.fulfill({ json: { data: { ...image, ...input } } });
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "新建内容" })).toBeVisible();
  await page.getByRole("button", { name: /测试相册/ }).click();

  const editAlbumButton = page.getByRole("button", { name: "编辑相册信息" });
  await expect(editAlbumButton).toBeVisible();
  await expect(editAlbumButton).toHaveText("");
  await expect(editAlbumButton).toHaveAttribute("title", "编辑相册信息");
  await editAlbumButton.click();
  const albumDialog = page.getByRole("dialog", { name: "编辑相册信息" });
  await albumDialog.getByLabel("名称").fill("更新后的相册");
  await albumDialog.getByLabel("路由 ID").fill("duplicate-album");
  await albumDialog.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("该路由 ID 已被其他相册或设定集使用")).toBeVisible();
  await expect(albumDialog).toBeVisible();
  await albumDialog.getByLabel("路由 ID").fill("updated-album");
  await albumDialog.getByRole("button", { name: "保存" }).click();
  await expect(page).toHaveURL("/updated-album");
  await expect(page.getByRole("heading", { name: "更新后的相册" })).toBeVisible();

  await page.locator(".image-card").click();
  const imageDialog = page.getByRole("dialog", { name: "查看图片" });
  await expect(imageDialog.getByLabel("描述")).toHaveCount(0);
  await expect(imageDialog.getByRole("button", { name: "删除" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "创建相册或设定集" })).toBeVisible();
});

test("authenticated upload page does not mix in image upload controls", async ({ page }) => {
  await mockSession(page, true);
  await page.goto("/upload");

  await expect(page.getByRole("heading", { name: "创建相册或设定集" })).toBeVisible();
  await expect(page.getByLabel("名称")).toBeVisible();
  await expect(page.getByRole("heading", { name: "上传图片", exact: true })).toHaveCount(0);
});

test("image upload reports progress and a successful result", async ({ page }) => {
  await mockSession(page, true);
  let images = [] as typeof image[];
  let uploadedContentType = "";
  let uploadedFilename = "";
  let uploadedBody = "";
  await page.route("**/api/albums/album-1", (route) =>
    route.fulfill({ json: { data: album } })
  );
  await page.route("**/api/albums/album-1/images", async (route) => {
    if (route.request().method() === "POST") {
      uploadedContentType = route.request().headers()["content-type"] ?? "";
      uploadedFilename = route.request().headers()["x-gallery-filename"] ?? "";
      uploadedBody = route.request().postDataBuffer()?.toString() ?? "";
      images = [image];
      await route.fulfill({ json: { data: { image, duplicate: false } } });
      return;
    }
    await route.fulfill({ json: { data: images } });
  });
  await page.route("**/api/albums/album-1/images/check", (route) =>
    route.fulfill({ json: { data: { duplicateIds: [] } } })
  );

  await page.goto("/album-upload?albumId=album-1");
  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from("test-image"),
    mimeType: "image/jpeg",
    name: "test.jpg"
  });

  await expect(page.locator('[data-sonner-toast][data-type="success"]')).toContainText("1 张图片已上传");
  await expect(page.getByLabel("全部图片上传进度")).toHaveJSProperty("value", 100);
  await expect(page.getByText("test.jpg")).toBeVisible();
  await expect(page.getByText(/已完成/)).toBeVisible();
  expect(uploadedContentType).toBe("image/jpeg");
  expect(decodeURIComponent(uploadedFilename)).toBe("test.jpg");
  expect(uploadedBody).toBe("test-image");
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

  await page.goto("/album-upload?albumId=album-1");
  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from("oversized-image"),
    mimeType: "image/jpeg",
    name: "large.jpg"
  });

  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toContainText("1 张图片上传失败");
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

  await page.goto("/album-upload?albumId=album-1");
  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from("already-there"),
    mimeType: "image/jpeg",
    name: "existing.jpg"
  });

  await expect(page.locator('[data-sonner-toast][data-type="info"]')).toContainText("均已存在，已跳过上传");
  await expect(page.locator(".upload-file-item.skipped")).toContainText("重复图片，已跳过");
  expect(uploadRequests).toBe(0);
});

test("administrators choose a setting collection type and enter it immediately", async ({ page }) => {
  await mockSession(page, true);
  let requestedType = "";
  const createdAlbum = {
    ...album,
    id: "setting-2",
    route_id: "1123456789abcdef0123456789abcdef",
    title: "新建的设定集",
    description: "设定集描述",
    album_type: "setting" as const,
    image_count: 0,
    total_size_bytes: 0
  };
  await page.route("**/api/albums", async (route) => {
    if (route.request().method() === "POST") {
      requestedType = (route.request().postDataJSON() as { albumType: string }).albumType;
      await route.fulfill({ json: { data: createdAlbum } });
      return;
    }
    await route.fulfill({ json: { data: [album] } });
  });
  await page.route("**/api/albums/setting-2/images", (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await mockDirectAlbum(page, createdAlbum);
  await page.route("**/api/albums/setting-2/fields", (route) =>
    route.fulfill({ json: { data: [] } })
  );

  await page.goto("/");
  await page.getByRole("button", { name: "新建内容", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新建内容" });
  await dialog.getByText("设定集", { exact: true }).click();
  await dialog.getByLabel("名称").fill("新建的设定集");
  await dialog.getByLabel("描述").fill("设定集描述");
  await dialog.getByRole("button", { name: "创建设定集" }).click();

  await expect(dialog).toBeHidden();
  expect(requestedType).toBe("setting");
  await expect(page).toHaveURL(`/${createdAlbum.route_id}`);
  await expect(page.getByRole("heading", { name: "新建的设定集" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "基础信息" })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "上传图片" })).toBeVisible();
});

test("homepage filters setting collections and visitors see read-only base information", async ({ page }) => {
  const settingAlbum = {
    ...album,
    id: "setting-1",
    route_id: "2123456789abcdef0123456789abcdef",
    title: "星野 澪",
    description: "雪豹设定",
    album_type: "setting" as const,
    image_count: 0
  };
  const fields = [
    { id: "field-1", album_id: settingAlbum.id, label: "名字", value: "星野 澪", sort_order: 0 },
    { id: "field-2", album_id: settingAlbum.id, label: "物种", value: "雪豹", sort_order: 1 }
  ];

  await mockSession(page, false);
  await page.route("**/api/albums", (route) =>
    route.fulfill({ json: { data: [album, settingAlbum] } })
  );
  await mockDirectAlbum(page, settingAlbum);
  await page.route("**/api/albums/setting-1/images", (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route("**/api/albums/setting-1/fields", (route) =>
    route.fulfill({ json: { data: fields } })
  );

  await page.goto("/");
  await page.getByRole("button", { name: "设定集", exact: true }).click();
  await expect(page.getByRole("button", { name: /测试相册/ })).toHaveCount(0);
  await page.getByRole("button", { name: /星野 澪/ }).click();

  await expect(page.getByRole("heading", { name: "基础信息" })).toBeVisible();
  await expect(page.getByText("雪豹", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑基础信息" })).toHaveCount(0);
});

test("administrators add, edit, and delete setting collection fields", async ({ page }) => {
  const settingAlbum = {
    ...album,
    id: "setting-1",
    route_id: "3123456789abcdef0123456789abcdef",
    title: "星野 澪",
    album_type: "setting" as const,
    image_count: 0
  };
  let fields = [
    { id: "field-1", album_id: settingAlbum.id, label: "名字", value: "星野 澪", sort_order: 0 },
    { id: "field-2", album_id: settingAlbum.id, label: "物种", value: "雪豹", sort_order: 1 }
  ];
  let savedFields: Array<{ label: string; value: string }> = [];

  await mockSession(page, true);
  await page.route("**/api/albums", (route) =>
    route.fulfill({ json: { data: [settingAlbum] } })
  );
  await mockDirectAlbum(page, settingAlbum);
  await page.route("**/api/albums/setting-1/images", (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route("**/api/albums/setting-1/fields", async (route) => {
    if (route.request().method() === "PUT") {
      savedFields = (route.request().postDataJSON() as { fields: typeof savedFields }).fields;
      fields = savedFields.map((field, index) => ({
        id: `saved-${index}`,
        album_id: settingAlbum.id,
        label: field.label,
        value: field.value,
        sort_order: index
      }));
    }
    await route.fulfill({ json: { data: fields } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /星野 澪/ }).click();
  await page.getByRole("button", { name: "编辑基础信息" }).click();
  await page.getByRole("button", { name: "删除第 1 项基础信息" }).click();
  await page.getByRole("button", { name: "添加信息" }).click();
  await page.getByLabel("第 2 项字段").fill("性格");
  await page.getByLabel("第 2 项内容").fill("安静、敏锐");
  await page.getByRole("button", { name: "保存更改" }).click();

  await expect(page.locator('[data-sonner-toast][data-type="success"]')).toContainText("基础信息已保存");
  expect(savedFields).toEqual([
    { label: "物种", value: "雪豹" },
    { label: "性格", value: "安静、敏锐" }
  ]);
  await expect(page.getByText("安静、敏锐", { exact: true })).toBeVisible();
});
