"use client";

import type { Album, GalleryImage } from "@/lib/db/gallery";
import {
  apiJson,
  appendAlbumAccessKey,
  createAdminHeaders,
  createAlbumAccessHeaders
} from "@/components/gallery-client";
import {
  Folder,
  Globe2,
  ImageIcon,
  LoaderCircle,
  Lock,
  RefreshCw,
  Save,
  Search,
  ArrowLeft,
  Trash2,
  Upload
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

export function GalleryApp() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [selectedImageId, setSelectedImageId] = useState("");
  const [suppressedOverlayImageId, setSuppressedOverlayImageId] = useState("");
  const [privateAlbumAccessKey, setPrivateAlbumAccessKey] = useState("");
  const [privateAlbumAccessKeyDraft, setPrivateAlbumAccessKeyDraft] = useState("");
  const [hasPrivateAlbumAccessKey, setHasPrivateAlbumAccessKey] = useState(false);
  const [albumEdit, setAlbumEdit] = useState({
    title: "",
    description: "",
    isPublic: true
  });
  const [imageEdit, setImageEdit] = useState({ title: "", description: "" });
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [mutating, setMutating] = useState(false);

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.id === selectedAlbumId) ?? null,
    [albums, selectedAlbumId]
  );

  const selectedImage = useMemo(
    () => images.find((image) => image.id === selectedImageId) ?? null,
    [images, selectedImageId]
  );

  const filteredAlbums = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return albums;
    }

    return albums.filter(
      (album) =>
        album.title.toLowerCase().includes(normalized) ||
        album.description.toLowerCase().includes(normalized)
    );
  }, [albums, query]);

  function showError(error: unknown) {
    setNotice({
      tone: "error",
      text: error instanceof Error ? error.message : "操作失败"
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialAlbums() {
      try {
        const [loadedAlbums, accessKeySetting] = await Promise.all([
          apiJson<Album[]>("/api/albums"),
          apiJson<{ hasAccessKey: boolean }>("/api/settings/private-album-access-key")
        ]);
        if (cancelled) {
          return;
        }

        setAlbums(loadedAlbums);
        setHasPrivateAlbumAccessKey(accessKeySetting.hasAccessKey);
      } catch (error) {
        showError(error);
      } finally {
        if (!cancelled) {
          setLoadingAlbums(false);
        }
      }
    }

    void loadInitialAlbums();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshAlbums(preferredAlbumId = selectedAlbumId) {
    setLoadingAlbums(true);
    try {
      const loadedAlbums = await apiJson<Album[]>("/api/albums");
      const nextAlbum = loadedAlbums.find((album) => album.id === preferredAlbumId) ?? null;

      setAlbums(loadedAlbums);
      if (nextAlbum) {
        applyAlbumSelection(nextAlbum);
        await refreshImages(nextAlbum.id);
      } else {
        setSelectedAlbumId("");
        setSelectedImageId("");
        setAlbumEdit({ title: "", description: "", isPublic: true });
        setImageEdit({ title: "", description: "" });
        setImages([]);
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoadingAlbums(false);
    }
  }

  async function refreshImages(albumId = selectedAlbumId, accessKey = privateAlbumAccessKey) {
    if (!albumId) {
      return;
    }

    setLoadingImages(true);
    try {
      const loadedImages = await apiJson<GalleryImage[]>(`/api/albums/${albumId}/images`, {
        headers: createAlbumAccessHeaders(accessKey)
      });
      setImages(loadedImages);
      applyImageSelection(null);
    } catch (error) {
      showError(error);
    } finally {
      setLoadingImages(false);
    }
  }

  function selectAlbum(album: Album) {
    const accessKey = readAlbumAccessForSelection(album);
    if (accessKey === null) {
      return;
    }

    applyAlbumSelection(album);
    setImages([]);
    applyImageSelection(null);
    void refreshImages(album.id, accessKey);
  }

  function returnToAlbums() {
    setSelectedAlbumId("");
    setImages([]);
    setAlbumEdit({ title: "", description: "", isPublic: true });
    applyImageSelection(null);
  }

  function applyAlbumSelection(album: Album) {
    setSelectedAlbumId(album.id);
    setAlbumEdit({
      title: album.title,
      description: album.description,
      isPublic: album.is_public
    });
  }

  function readAlbumAccessForSelection(album: Album): string | null {
    if (album.is_public) {
      return "";
    }

    if (privateAlbumAccessKey) {
      return privateAlbumAccessKey;
    }

    const accessKey = window.prompt("请输入非公开相册密钥");
    if (!accessKey?.trim()) {
      return null;
    }

    const normalizedAccessKey = accessKey.trim();
    setPrivateAlbumAccessKey(normalizedAccessKey);
    setPrivateAlbumAccessKeyDraft(normalizedAccessKey);
    return normalizedAccessKey;
  }

  function selectedAlbumAccessKey(): string {
    return selectedAlbum?.is_public ? "" : privateAlbumAccessKey;
  }

  function applyImageSelection(image: GalleryImage | null) {
    setSuppressedOverlayImageId("");
    setSelectedImageId(image?.id ?? "");
    setImageEdit({
      title: image?.title ?? "",
      description: image?.description ?? ""
    });
  }

  function toggleImageSelection(image: GalleryImage) {
    if (image.id === selectedImageId) {
      applyImageSelection(null);
      setSuppressedOverlayImageId(image.id);
      return;
    }

    applyImageSelection(image);
  }

  async function saveAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAlbum) {
      return;
    }

    await mutate(async () => {
      const album = await apiJson<Album>(`/api/albums/${selectedAlbum.id}`, {
        method: "PATCH",
        headers: createAdminHeaders("", { "content-type": "application/json" }),
        body: JSON.stringify({
          title: albumEdit.title,
          description: albumEdit.description,
          isPublic: albumEdit.isPublic
        })
      });

      setAlbums((current) => current.map((item) => (item.id === album.id ? album : item)));
      applyAlbumSelection(album);
      setNotice({ tone: "success", text: "相册信息已保存" });
    });
  }

  async function savePrivateAlbumAccessKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await mutate(async () => {
      const setting = await apiJson<{ hasAccessKey: boolean }>("/api/settings/private-album-access-key", {
        method: "PATCH",
        headers: createAdminHeaders("", { "content-type": "application/json" }),
        body: JSON.stringify({ accessKey: privateAlbumAccessKeyDraft })
      });

      setHasPrivateAlbumAccessKey(setting.hasAccessKey);
      setPrivateAlbumAccessKey(privateAlbumAccessKeyDraft.trim());
      setNotice({ tone: "success", text: "非公开相册密钥已保存" });
    });
  }

  async function removeAlbum() {
    if (!selectedAlbum || !window.confirm(`删除相册「${selectedAlbum.title}」及其中所有图片？`)) {
      return;
    }

    await mutate(async () => {
      await apiJson<void>(`/api/albums/${selectedAlbum.id}`, {
        method: "DELETE",
        headers: createAdminHeaders("")
      });

      const remaining = albums.filter((album) => album.id !== selectedAlbum.id);
      setAlbums(remaining);
      if (remaining[0]) {
        selectAlbum(remaining[0]);
      } else {
        setSelectedAlbumId("");
        setSelectedImageId("");
        setAlbumEdit({ title: "", description: "", isPublic: true });
        setImageEdit({ title: "", description: "" });
        setImages([]);
      }
      setNotice({ tone: "success", text: "相册和图片已删除" });
    });
  }

  async function saveImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedImage) {
      return;
    }

    await mutate(async () => {
      const image = await apiJson<GalleryImage>(`/api/images/${selectedImage.id}`, {
        method: "PATCH",
        headers: createAdminHeaders("", { "content-type": "application/json" }),
        body: JSON.stringify(imageEdit)
      });

      setImages((current) => current.map((item) => (item.id === image.id ? image : item)));
      applyImageSelection(image);
      setNotice({ tone: "success", text: "图片描述已保存" });
    });
  }

  async function removeImage() {
    if (!selectedImage || !window.confirm("删除这张图片？")) {
      return;
    }

    await mutate(async () => {
      await apiJson<void>(`/api/images/${selectedImage.id}`, {
        method: "DELETE",
        headers: createAdminHeaders("")
      });

      const remaining = images.filter((image) => image.id !== selectedImage.id);
      setImages(remaining);
      applyImageSelection(null);
      await refreshAlbums(selectedAlbumId);
      setNotice({ tone: "success", text: "图片已删除" });
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
    <main className={`app-shell ${selectedAlbum ? "image-view" : "album-view"}`}>
      <section className="workspace" aria-label="图片浏览区">
        <header className="workspace-header">
          <div className="workspace-title">
            <div className="brand inline-brand">
              <div className="brand-mark">
                <ImageIcon aria-hidden="true" size={22} />
              </div>
              <div>
                <h1>My Gallery</h1>
                <p>Cloudflare 相册</p>
              </div>
            </div>
            {selectedAlbum ? (
              <button className="secondary-button compact-button" onClick={returnToAlbums} type="button">
                <ArrowLeft aria-hidden="true" size={16} />
                返回相册
              </button>
            ) : null}
            <p className="section-label">{selectedAlbum ? "图片" : "相册"}</p>
            <h2>{selectedAlbum?.title ?? "相册"}</h2>
            <span>
              {selectedAlbum
                ? `${selectedAlbum.image_count} 张图片 · ${formatBytes(selectedAlbum.total_size_bytes)}`
                : "选择一个相册后浏览其中图片"}
            </span>
          </div>

          <div className="toolbar">
            {!selectedAlbum ? (
              <label className="search-box toolbar-search">
                <Search aria-hidden="true" size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索相册"
                  type="search"
                />
              </label>
            ) : null}
            <button className="secondary-button" onClick={() => void refreshAlbums()} type="button">
              <RefreshCw aria-hidden="true" size={16} />
              刷新
            </button>
            {selectedAlbum ? (
              <Link className="primary-button" href={`/albums/${selectedAlbum.id}/upload`}>
                <Upload aria-hidden="true" size={17} />
                上传图片
              </Link>
            ) : (
              <Link className="primary-button" href="/upload">
                <Folder aria-hidden="true" size={17} />
                新建相册
              </Link>
            )}
          </div>
        </header>

        {notice ? (
          <div className={`notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.text}
          </div>
        ) : null}

        {!selectedAlbum ? (
          <form className="album-key-panel" onSubmit={savePrivateAlbumAccessKey}>
            <div>
              <p className="section-label">非公开相册</p>
              <h3>访问密钥</h3>
              <span>{hasPrivateAlbumAccessKey ? "已设置。更新后所有非公开相册使用新密钥。" : "尚未设置。非公开相册需要这个密钥才能访问。"}</span>
            </div>
            <label>
              密钥
              <input
                onChange={(event) => setPrivateAlbumAccessKeyDraft(event.target.value)}
                placeholder="设置所有非公开相册共用的访问密钥"
                type="password"
                value={privateAlbumAccessKeyDraft}
              />
            </label>
            <button className="secondary-button" disabled={mutating} type="submit">
              {hasPrivateAlbumAccessKey ? "更新密钥" : "设置密钥"}
            </button>
          </form>
        ) : null}

        {!selectedAlbum ? (
          <div className="album-gallery" aria-busy={loadingAlbums}>
            {loadingAlbums ? (
              Array.from({ length: 6 }).map((_, index) => <div className="album-card skeleton-card" key={index} />)
            ) : filteredAlbums.length > 0 ? (
              filteredAlbums.map((album) => (
                <button className="album-card" key={album.id} onClick={() => selectAlbum(album)} type="button">
                  <span className="album-cover">
                    {album.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" loading="lazy" src={`/api/images/${album.cover_image.id}/asset`} />
                    ) : (
                      <Folder aria-hidden="true" size={34} />
                    )}
                  </span>
                  <span className="album-card-body">
                    <strong>{album.title}</strong>
                  <small>{album.image_count} 张图片 · {formatBytes(album.total_size_bytes)}</small>
                  <span className={`status-pill ${album.is_public ? "public" : "private"}`}>
                    {album.is_public ? (
                      <Globe2 aria-hidden="true" size={13} />
                    ) : (
                      <Lock aria-hidden="true" size={13} />
                    )}
                    {album.is_public ? "公开" : "非公开"}
                  </span>
                  {album.description ? <span>{album.description}</span> : null}
                </span>
                </button>
              ))
            ) : (
              <div className="empty-gallery">
                <Folder aria-hidden="true" size={34} />
                <h3>创建第一个相册</h3>
                <p>请先新建相册。创建完成后回到相册视图，点开相册即可浏览和上传图片。</p>
                <Link className="primary-button" href="/upload">
                  新建相册
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="image-grid" aria-busy={loadingImages}>
            {loadingImages ? (
              Array.from({ length: 8 }).map((_, index) => <div className="image-skeleton" key={index} />)
            ) : images.length > 0 ? (
              images.map((image) => (
                <button
                  className={`image-card ${image.id === selectedImageId ? "selected" : ""} ${
                    image.id === suppressedOverlayImageId ? "suppress-overlay" : ""
                  }`}
                  key={image.id}
                  onClick={() => toggleImageSelection(image)}
                  onMouseLeave={() => {
                    if (image.id === suppressedOverlayImageId) {
                      setSuppressedOverlayImageId("");
                    }
                  }}
                  style={{ aspectRatio: getAspectRatio(image) }}
                  type="button"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={image.description || image.title || "相册图片"}
                    height={image.height ?? undefined}
                    loading="lazy"
                    src={appendAlbumAccessKey(`/api/images/${image.id}/asset`, selectedAlbumAccessKey())}
                    width={image.width ?? undefined}
                  />
                  <span className="image-overlay">
                    <strong>{image.description || "暂无图片描述"}</strong>
                    <small>{formatBytes(image.size_bytes)}</small>
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-gallery">
                <ImageIcon aria-hidden="true" size={34} />
                <h3>最近上传</h3>
                <p>这个相册还没有图片。只有打开相册后才能上传，浏览页会按稳定比例网格展示。</p>
                <Link className="primary-button" href={`/albums/${selectedAlbum.id}/upload`}>
                  上传图片
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {selectedAlbum ? (
      <aside className="detail-panel" aria-label="描述编辑">
        <form onSubmit={saveAlbum}>
          <div className="panel-heading">
            <p className="section-label">描述</p>
            <h2>相册信息</h2>
          </div>
          <label>
            名称
            <input
              disabled={!selectedAlbum}
              onChange={(event) => setAlbumEdit((current) => ({ ...current, title: event.target.value }))}
              value={albumEdit.title}
            />
          </label>
          <label>
            描述
            <textarea
              disabled={!selectedAlbum}
              onChange={(event) =>
                setAlbumEdit((current) => ({ ...current, description: event.target.value }))
              }
              rows={5}
              value={albumEdit.description}
            />
          </label>
          <label className="check-row">
            <input
              checked={albumEdit.isPublic}
              disabled={!selectedAlbum}
              onChange={(event) =>
                setAlbumEdit((current) => ({ ...current, isPublic: event.target.checked }))
              }
              type="checkbox"
            />
            公开相册
          </label>
          <div className="button-row">
            <button className="secondary-button danger" disabled={!selectedAlbum || mutating} onClick={removeAlbum} type="button">
              <Trash2 aria-hidden="true" size={16} />
              删除
            </button>
            <button className="primary-button" disabled={!selectedAlbum || mutating} type="submit">
              {mutating ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Save aria-hidden="true" size={16} />}
              保存
            </button>
          </div>
        </form>

        <form className="image-detail" onSubmit={saveImage}>
          <div className="panel-heading">
            <p className="section-label">图片</p>
            <h2>{selectedImage ? "图片描述" : "选择图片"}</h2>
          </div>

          {selectedImage ? (
            <>
              <label>
                描述
                <textarea
                  onChange={(event) =>
                    setImageEdit((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={5}
                  value={imageEdit.description}
                />
              </label>
              <div className="button-row">
                <button className="secondary-button danger" disabled={mutating} onClick={removeImage} type="button">
                  <Trash2 aria-hidden="true" size={16} />
                  删除
                </button>
                <button className="primary-button" disabled={mutating} type="submit">
                  {mutating ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Save aria-hidden="true" size={16} />}
                  保存
                </button>
              </div>
            </>
          ) : (
            <p className="empty-copy">在中间网格选择一张图片后编辑描述。</p>
          )}
        </form>
      </aside>
      ) : null}
    </main>
  );
}

function getAspectRatio(image: GalleryImage): string {
  if (image.width && image.height) {
    return `${image.width} / ${image.height}`;
  }

  return "4 / 3";
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
