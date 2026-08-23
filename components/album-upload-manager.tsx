"use client";

import type { Album, GalleryImage } from "@/lib/db/gallery";
import { imageIdentityKey } from "@/lib/images/identity";
import {
  apiJson,
  uploadImageFile,
} from "@/components/gallery-client";
import { readImageDimensions } from "@/lib/images/dimensions";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleMinus,
  Clock3,
  Folder,
  LoaderCircle,
  RefreshCw,
  Upload
} from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type UploadItem = {
  id: string;
  filename: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "success" | "skipped" | "error";
  error?: string;
};

type UploadEntry = {
  file: File;
  item: UploadItem;
};

type UploadApiResult = {
  image: GalleryImage;
  duplicate: boolean;
};

const UPLOAD_CONCURRENCY = 3;

export function AlbumUploadManager({ albumId }: { albumId: string }) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [recentImages, setRecentImages] = useState<GalleryImage[]>([]);
  const [uploadDescription, setUploadDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);

  const totalProgress = useMemo(() => {
    const totalBytes = uploadItems.reduce((total, item) => total + item.size, 0);
    if (totalBytes === 0) {
      return 0;
    }

    const uploadedBytes = uploadItems.reduce(
      (total, item) => total + item.size * (item.progress / 100),
      0
    );
    return Math.round((uploadedBytes / totalBytes) * 100);
  }, [uploadItems]);

  function showError(error: unknown) {
    toast.error(error instanceof Error ? error.message : "操作失败", { duration: 6_000 });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAlbum() {
      try {
        const [loadedAlbum, images] = await Promise.all([
          apiJson<Album>(`/api/albums/${albumId}`),
          apiJson<GalleryImage[]>(`/api/albums/${albumId}/images`)
        ]);

        if (cancelled) {
          return;
        }

        setAlbum(loadedAlbum);
        setRecentImages(images.slice(0, 12));
      } catch (error) {
        showError(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAlbum();

    return () => {
      cancelled = true;
    };
  }, [albumId]);

  async function refreshAlbum() {
    setLoading(true);
    try {
      const [loadedAlbum, images] = await Promise.all([
        apiJson<Album>(`/api/albums/${albumId}`),
        apiJson<GalleryImage[]>(`/api/albums/${albumId}/images`)
      ]);
      setAlbum(loadedAlbum);
      setRecentImages(images.slice(0, 12));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function uploadImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const batchId = Date.now();
    const seenKeys = new Set<string>();
    const entries: UploadEntry[] = files.map((file, index) => {
      const key = imageIdentityKey({
        filename: file.name,
        sizeBytes: file.size,
        contentType: file.type
      });
      const duplicateInBatch = seenKeys.has(key);
      seenKeys.add(key);

      return {
        file,
        item: {
          id: `${batchId}-${index}`,
          filename: file.name,
          size: file.size,
          progress: duplicateInBatch ? 100 : 0,
          status: duplicateInBatch ? "skipped" : "queued"
        }
      };
    });
    const items = entries.map((entry) => entry.item);
    setUploadItems(items);
    const progressToastId = toast.loading(`正在检查 ${files.length} 张图片是否重复`);
    setMutating(true);

    let succeeded = 0;
    let failed = 0;
    let skipped = entries.filter((entry) => entry.item.status === "skipped").length;

    try {
      const candidates = entries.filter((entry) => entry.item.status === "queued");
      if (candidates.length > 0) {
        let duplicateIds: string[];
        try {
          const check = await apiJson<{ duplicateIds: string[] }>(
            `/api/albums/${albumId}/images/check`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                files: candidates.map(({ file, item }) => ({
                  clientId: item.id,
                  filename: file.name,
                  sizeBytes: file.size,
                  contentType: file.type
                }))
              })
            }
          );
          duplicateIds = check.duplicateIds;
        } catch (error) {
          const message = error instanceof Error ? error.message : "重复检查失败";
          for (const { item } of candidates) {
            updateUploadItem(item.id, { status: "error", error: message });
          }
          toast.error(`无法检查重复图片：${message}`, {
            duration: 6_000,
            id: progressToastId
          });
          return;
        }

        const duplicateIdSet = new Set(duplicateIds);
        for (const { item } of candidates) {
          if (duplicateIdSet.has(item.id)) {
            skipped += 1;
            updateUploadItem(item.id, { progress: 100, status: "skipped" });
          }
        }

        const uploadEntries = candidates.filter(({ item }) => !duplicateIdSet.has(item.id));
        let nextIndex = 0;

        async function uploadNext(): Promise<void> {
          while (nextIndex < uploadEntries.length) {
            const entry = uploadEntries[nextIndex];
            nextIndex += 1;
            await uploadEntry(entry);
          }
        }

        async function uploadEntry({ file, item }: UploadEntry): Promise<void> {
          updateUploadItem(item.id, { status: "uploading" });

          try {
            const dimensions = readImageDimensions(
              await file.slice(0, 512 * 1024).arrayBuffer()
            );
            const result = await uploadImageFile<UploadApiResult>(
              `/api/albums/${albumId}/images`,
              file,
              {
                title: file.name.replace(/\.[^.]+$/, ""),
                description: uploadDescription,
                width: dimensions?.width ?? null,
                height: dimensions?.height ?? null
              },
              (progress) => updateUploadItem(item.id, { progress })
            );
            if (result.duplicate) {
              skipped += 1;
              updateUploadItem(item.id, { progress: 100, status: "skipped" });
            } else {
              succeeded += 1;
              updateUploadItem(item.id, { progress: 100, status: "success" });
            }
          } catch (error) {
            failed += 1;
            updateUploadItem(item.id, {
              status: "error",
              error: error instanceof Error ? error.message : "上传失败"
            });
          }
        }

        await Promise.all(
          Array.from(
            { length: Math.min(UPLOAD_CONCURRENCY, uploadEntries.length) },
            () => uploadNext()
          )
        );
      }

      if (succeeded > 0) {
        await refreshAlbum();
        setUploadDescription("");
      }

      if (failed === 0 && succeeded > 0) {
        toast.success(
          skipped > 0
            ? `${succeeded} 张上传成功，${skipped} 张重复图片已跳过`
            : `${succeeded} 张图片已上传到「${album?.title ?? "当前相册"}」`,
          { id: progressToastId }
        );
      } else if (failed === 0) {
        toast.info(`${skipped} 张图片均已存在，已跳过上传`, { id: progressToastId });
      } else {
        toast.error(
          succeeded === 0 && skipped === 0
            ? `${failed} 张图片上传失败，请查看下方详情`
            : `${succeeded} 张成功，${skipped} 张重复已跳过，${failed} 张失败，请查看详情`,
          { duration: 6_000, id: progressToastId }
        );
      }
    } finally {
      setMutating(false);
    }
  }

  function updateUploadItem(id: string, changes: Partial<UploadItem>) {
    setUploadItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item))
    );
  }

  return (
    <main className="upload-page">
      <header className="upload-topbar">
        <Link className="secondary-button" href="/">
          <ArrowLeft aria-hidden="true" size={16} />
          返回相册
        </Link>
        <div>
          <p className="section-label">上传图片</p>
          <h1>{album ? `上传到「${album.title}」` : "打开相册后上传图片"}</h1>
          <span>只能向已创建并选中的相册上传图片。</span>
        </div>
        <button className="secondary-button" onClick={() => void refreshAlbum()} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          刷新
        </button>
      </header>

      <section className="upload-layout">
        <div className="upload-card">
          <div className="panel-heading">
            <p className="section-label">目标相册</p>
            <h2>{album?.title ?? (loading ? "正在加载" : "相册不存在")}</h2>
            <span>{album?.description || "图片会写入 R2，元数据写入 D1。"}</span>
          </div>
        </div>

        <div className="upload-card upload-wide">
          <div className="panel-heading">
            <p className="section-label">图片</p>
            <h2>选择图片上传</h2>
            <span>支持 JPEG、PNG、WebP、AVIF、GIF。上传描述会作为本次批量图片的初始描述。</span>
          </div>

          <label>
            上传描述
            <textarea
              onChange={(event) => setUploadDescription(event.target.value)}
              placeholder="可选，作为本次上传图片 hover 遮罩上的初始描述"
              rows={4}
              value={uploadDescription}
            />
          </label>

          <label className={`drop-zone ${!album ? "disabled" : ""}`}>
            <Upload aria-hidden="true" size={28} />
            <strong>{mutating ? "正在上传" : "选择图片上传"}</strong>
            <span>{album ? `上传到「${album.title}」` : "请从相册页点开一个已创建相册"}</span>
            <input
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              disabled={!album || mutating}
              multiple
              onChange={uploadImages}
              type="file"
            />
          </label>

          {uploadItems.length > 0 ? (
            <section className="upload-progress-panel" aria-live="polite">
              <div className="upload-progress-heading">
                <div>
                  <strong>{mutating ? "正在上传" : "上传结果"}</strong>
                  <span>{uploadItems.length} 张图片 · {totalProgress}%</span>
                </div>
                <progress aria-label="全部图片上传进度" max={100} value={totalProgress} />
              </div>
              <ol className="upload-file-list">
                {uploadItems.map((item) => (
                  <li className={`upload-file-item ${item.status}`} key={item.id}>
                    <span className="upload-status-icon" aria-hidden="true">
                      {item.status === "success" ? <CheckCircle2 size={18} /> : null}
                      {item.status === "skipped" ? <CircleMinus size={18} /> : null}
                      {item.status === "error" ? <AlertCircle size={18} /> : null}
                      {item.status === "uploading" ? <LoaderCircle className="spin" size={18} /> : null}
                      {item.status === "queued" ? <Clock3 size={18} /> : null}
                    </span>
                    <div>
                      <strong>{item.filename}</strong>
                      <span>{formatBytes(item.size)} · {formatUploadStatus(item)}</span>
                      {item.error ? <p>{item.error}</p> : null}
                    </div>
                    <progress
                      aria-label={`${item.filename} 上传进度`}
                      max={100}
                      value={item.progress}
                    />
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <div className="upload-card upload-wide">
          <div className="panel-heading">
            <p className="section-label">最近上传</p>
            <h2>{album?.title ?? "当前相册"}</h2>
          </div>

          {recentImages.length > 0 ? (
            <div className="compact-gallery">
              {recentImages.map((image) => (
                <figure key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={image.description || "相册图片"}
                    loading="lazy"
                    src={`/api/images/${image.id}/asset`}
                  />
                  <figcaption>{image.description || "暂无图片描述"}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="empty-gallery compact-empty">
              {loading ? <LoaderCircle aria-hidden="true" className="spin" size={32} /> : <Folder aria-hidden="true" size={32} />}
              <h3>{loading ? "正在加载" : "暂无图片"}</h3>
              <p>上传成功后，这里会展示当前相册的最近图片。</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function formatUploadStatus(item: UploadItem): string {
  if (item.status === "success") {
    return "已完成";
  }
  if (item.status === "error") {
    return "上传失败";
  }
  if (item.status === "skipped") {
    return "重复图片，已跳过";
  }
  if (item.status === "uploading") {
    return `上传中 ${item.progress}%`;
  }
  return "等待上传";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
