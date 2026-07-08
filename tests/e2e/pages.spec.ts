import { expect, test } from "@playwright/test";

test("gallery page opens on album view without a sidebar", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "My Gallery" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "相册", exact: true })).toBeVisible();
  await expect(page.getByLabel("相册导航")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "新建相册", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "上传管理", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "上传图片", exact: true })).toHaveCount(0);
});

test("create album page does not expose image upload controls", async ({ page }) => {
  await page.goto("/upload");

  await expect(page.getByRole("heading", { name: "创建一个新的相册" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回相册", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "新建相册", exact: true })).toBeVisible();
  await expect(page.getByLabel("相册名称")).toBeVisible();
  await expect(page.getByRole("heading", { name: "上传图片", exact: true })).toHaveCount(0);
  await expect(page.getByText("选择图片上传")).toHaveCount(0);
});

test("album upload page requires an existing album context", async ({ page }) => {
  await page.goto("/albums/not-found/upload");

  await expect(page.getByRole("heading", { name: "打开相册后上传图片" })).toBeVisible();
  await expect(page.getByText("请从相册页点开一个已创建相册")).toBeVisible();
});
