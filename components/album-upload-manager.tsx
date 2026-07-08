"use client";

import type { Album, GalleryImage } from "@/lib/db/gallery";
import {
  apiJson,
  appendAlbumAccessKey,
  createAdminHeaders,
  createAlbumAccessHeaders,
} from "@/components/gallery-client";
import { ArrowLeft, Folder, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

export function AlbumUploadManager({ albumId }: { albumId: string }) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [recentImages, setRecentImages] = useState<GalleryImage[]>([]);
  const [albumAccessKey, setAlbumAccessKey] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  function showError(error: unknown) {
    setNotice({
      tone: "error",
      text: error instanceof Error ? error.message : "操作失败"
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAlbum() {
      try {
        const [loadedAlbum, images] = await Promise.all([
          apiJson<Album>(`/api/albums/${albumId}`, {
            headers: createAlbumAccessHeaders(albumAccessKey)
          }),
          apiJson<GalleryImage[]>(`/api/albums/${albumId}/images`, {
            headers: createAlbumAccessHeaders(albumAccessKey)
          })
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
  }, [albumAccessKey, albumId]);

  async function refreshAlbum() {
    setLoading(true);
    try {
      const [loadedAlbum, images] = await Promise.all([
        apiJson<Album>(`/api/albums/${albumId}`, {
          headers: createAlbumAccessHeaders(albumAccessKey)
        }),
        apiJson<GalleryImage[]>(`/api/albums/${albumId}/images`, {
          headers: createAlbumAccessHeaders(albumAccessKey)
        })
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

    await mutate(async () => {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name.replace(/\.[^.]+$/, ""));
        formData.append("description", uploadDescription);

        await apiJson<GalleryImage>(`/api/albums/${albumId}/images`, {
          method: "POST",
          headers: createAdminHeaders(""),
          body: formData
        });
      }

      await refreshAlbum();
      setUploadDescription("");
      setNotice({ tone: "success", text: `${files.length} 张图片已上传到「${album?.title ?? "当前相册"}」` });
    });
  }

  async function mutate(action: () => Promise<void>) {
    setMutating(true);
    try {
      await action();
    } catch (error) {
      showError(error);
    } finally {
      setMutating(false);
    }
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

      {notice ? (
        <div className={`notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </div>
      ) : null}

      <section className="upload-layout">
        <div className="upload-card">
          <div className="panel-heading">
            <p className="section-label">访问</p>
            <h2>相册访问密钥</h2>
          </div>
          <label>
            相册访问密钥
            <input
              onChange={(event) => setAlbumAccessKey(event.target.value)}
              placeholder="非公开相册用于预览图片，可选"
              type="password"
              value={albumAccessKey}
            />
          </label>
        </div>

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
                    src={appendAlbumAccessKey(`/api/images/${image.id}/asset`, albumAccessKey)}
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
