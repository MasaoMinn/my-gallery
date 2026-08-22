"use client";

import type { Album, GalleryImage } from "@/lib/db/gallery";
import {
  sortAlbums,
  type AlbumSortField,
  type SortDirection
} from "@/lib/albums/sort";
import {
  ApiError,
  apiJson
} from "@/components/gallery-client";
import { useAdminSession } from "@/components/admin-session";
import { ImageMasonry } from "@/components/image-masonry";
import type { ImageSize } from "@/lib/images/masonry";
import {
  Folder,
  Globe2,
  ImageIcon,
  LoaderCircle,
  LogIn,
  LogOut,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Trash2,
  Upload,
  X
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

const IMAGE_SIZE_OPTIONS: Array<{ value: ImageSize; label: string; columns: number }> = [
  { value: "xlarge", label: "特大", columns: 3 },
  { value: "large", label: "大", columns: 4 },
  { value: "medium", label: "中", columns: 5 },
  { value: "small", label: "小", columns: 6 },
  { value: "xsmall", label: "特小", columns: 8 }
];

export function GalleryApp() {
  const { authenticated, loading: loadingAdmin, logout } = useAdminSession();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [selectedImageId, setSelectedImageId] = useState("");
  const [albumCreateOpen, setAlbumCreateOpen] = useState(false);
  const [albumEditOpen, setAlbumEditOpen] = useState(false);
  const [imageEditing, setImageEditing] = useState(false);
  const [albumEdit, setAlbumEdit] = useState({
    title: "",
    description: "",
    isPublic: true
  });
  const [albumCreate, setAlbumCreate] = useState({
    title: "",
    description: "",
    isPublic: true
  });
  const [imageEdit, setImageEdit] = useState({ description: "" });
  const [query, setQuery] = useState("");
  const [albumSortField, setAlbumSortField] = useState<AlbumSortField>("updatedAt");
  const [albumSortDirection, setAlbumSortDirection] = useState<SortDirection>("desc");
  const [imageSize, setImageSize] = useState<ImageSize>("medium");
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

  const visibleAlbums = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matchingAlbums = normalized ? albums.filter(
      (album) =>
        album.title.toLowerCase().includes(normalized) ||
        album.description.toLowerCase().includes(normalized)
    ) : albums;

    return sortAlbums(matchingAlbums, albumSortField, albumSortDirection);
  }, [albums, albumSortDirection, albumSortField, query]);

  function showError(error: unknown) {
    setNotice({
      tone: "error",
      text: error instanceof Error ? error.message : "操作失败"
    });
  }

  useEffect(() => {
    if (loadingAdmin) {
      return;
    }

    let cancelled = false;

    async function loadInitialAlbums() {
      try {
        const loadedAlbums = await apiJson<Album[]>("/api/albums");
        if (cancelled) {
          return;
        }

        setAlbums(loadedAlbums);
        setSelectedAlbumId("");
        setSelectedImageId("");
        setImages([]);
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
  }, [authenticated, loadingAdmin]);

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
        setImageEdit({ description: "" });
        setImages([]);
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoadingAlbums(false);
    }
  }

  async function refreshImages(albumId = selectedAlbumId) {
    if (!albumId) {
      return;
    }

    setLoadingImages(true);
    try {
      const loadedImages = await apiJson<GalleryImage[]>(`/api/albums/${albumId}/images`);
      setImages(loadedImages);
      applyImageSelection(null);
    } catch (error) {
      showError(error);
    } finally {
      setLoadingImages(false);
    }
  }

  function selectAlbum(album: Album) {
    applyAlbumSelection(album);
    setImages([]);
    applyImageSelection(null);
    void refreshImages(album.id);
  }

  function returnToAlbums() {
    setSelectedAlbumId("");
    setImages([]);
    setAlbumEditOpen(false);
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

  function applyImageSelection(image: GalleryImage | null) {
    setSelectedImageId(image?.id ?? "");
    setImageEdit({ description: image?.description ?? "" });
    setImageEditing(false);
  }

  function openImage(image: GalleryImage) {
    applyImageSelection(image);
  }

  function closeAlbumEdit() {
    if (selectedAlbum) {
      applyAlbumSelection(selectedAlbum);
    }
    setAlbumEditOpen(false);
  }

  function closeAlbumCreate() {
    setAlbumCreateOpen(false);
    setAlbumCreate({ title: "", description: "", isPublic: true });
  }

  async function createAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(async () => {
      const album = await apiJson<Album>("/api/albums", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(albumCreate)
      });

      setAlbums((current) => [album, ...current]);
      applyAlbumSelection(album);
      applyImageSelection(null);
      setImages([]);
      closeAlbumCreate();
      setNotice({ tone: "success", text: `相册「${album.title}」已创建` });
    });
  }

  async function saveAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAlbum) {
      return;
    }
    await mutate(async () => {
      const payload = {
        title: albumEdit.title,
        description: albumEdit.description,
        isPublic: albumEdit.isPublic
      };

      const album = await apiJson<Album>(`/api/albums/${selectedAlbum.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      setAlbums((current) => current.map((item) => (item.id === album.id ? album : item)));
      applyAlbumSelection(album);
      setAlbumEditOpen(false);
      setNotice({ tone: "success", text: "相册信息已保存" });
    });
  }

  async function removeAlbum() {
    if (!selectedAlbum || !window.confirm(`删除相册「${selectedAlbum.title}」及其中所有图片？`)) {
      return;
    }

    await mutate(async () => {
      await apiJson<void>(`/api/albums/${selectedAlbum.id}`, {
        method: "DELETE"
      });

      const remaining = albums.filter((album) => album.id !== selectedAlbum.id);
      setAlbums(remaining);
      setAlbumEditOpen(false);
      if (remaining[0]) {
        selectAlbum(remaining[0]);
      } else {
        setSelectedAlbumId("");
        setSelectedImageId("");
        setAlbumEdit({ title: "", description: "", isPublic: true });
        setImageEdit({ description: "" });
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify(imageEdit)
      });

      setImages((current) => current.map((item) => (item.id === image.id ? image : item)));
      applyImageSelection(null);
      setNotice({ tone: "success", text: "图片描述已保存" });
    });
  }

  async function removeImage() {
    if (!selectedImage || !window.confirm("删除这张图片？")) {
      return;
    }

    await mutate(async () => {
      await apiJson<void>(`/api/images/${selectedImage.id}`, {
        method: "DELETE"
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
      if (error instanceof ApiError && error.status === 401) {
        window.location.assign(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      showError(error);
    } finally {
      setMutating(false);
    }
  }

  async function signOut() {
    await logout();
    returnToAlbums();
    setNotice({ tone: "success", text: "已退出管理员会话" });
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
            <div className="album-title-row">
              <h2>{selectedAlbum?.title ?? "相册"}</h2>
              {selectedAlbum && authenticated ? (
                <button
                  aria-label="编辑相册信息"
                  className="secondary-button compact-button"
                  onClick={() => setAlbumEditOpen(true)}
                  type="button"
                >
                  <Pencil aria-hidden="true" size={15} />
                  编辑相册
                </button>
              ) : null}
            </div>
            <span>
              {selectedAlbum
                ? `${selectedAlbum.image_count} 张图片 · ${formatBytes(selectedAlbum.total_size_bytes)}`
                : "选择一个相册后浏览其中图片"}
            </span>
          </div>

          <div className="toolbar">
            {!selectedAlbum ? (
              <>
                <label className="search-box toolbar-search">
                  <Search aria-hidden="true" size={17} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索相册"
                    type="search"
                  />
                </label>
                <label className="sort-control">
                  <span>排序</span>
                  <select
                    aria-label="相册排序字段"
                    onChange={(event) => setAlbumSortField(event.target.value as AlbumSortField)}
                    value={albumSortField}
                  >
                    <option value="title">相册名字</option>
                    <option value="createdAt">创建时间</option>
                    <option value="updatedAt">更改时间</option>
                    <option value="size">相册大小</option>
                  </select>
                </label>
                <button
                  aria-label={albumSortDirection === "asc" ? "当前升序，切换为降序" : "当前降序，切换为升序"}
                  className="secondary-button sort-direction"
                  onClick={() =>
                    setAlbumSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                  }
                  title={albumSortDirection === "asc" ? "升序" : "降序"}
                  type="button"
                >
                  {albumSortDirection === "asc" ? (
                    <ArrowUp aria-hidden="true" size={16} />
                  ) : (
                    <ArrowDown aria-hidden="true" size={16} />
                  )}
                  {albumSortDirection === "asc" ? "升序" : "降序"}
                </button>
              </>
            ) : null}
            {selectedAlbum ? (
              <div aria-label="图片大小" className="image-size-control" role="group">
                <ImageIcon aria-hidden="true" size={17} />
                <span>图片大小</span>
                <div className="image-size-segments">
                  {IMAGE_SIZE_OPTIONS.map((option) => (
                    <button
                      aria-label={`${option.label}，桌面端一行 ${option.columns} 张图`}
                      aria-pressed={imageSize === option.value}
                      key={option.value}
                      onClick={() => setImageSize(option.value)}
                      title={`桌面端一行 ${option.columns} 张图`}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <button className="secondary-button" onClick={() => void refreshAlbums()} type="button">
              <RefreshCw aria-hidden="true" size={16} />
              刷新
            </button>
            {authenticated ? (
              <>
                {selectedAlbum ? (
                  <Link className="primary-button" href={`/album-upload?albumId=${encodeURIComponent(selectedAlbum.id)}`}>
                    <Upload aria-hidden="true" size={17} />
                    上传图片
                  </Link>
                ) : (
                  <button
                    className="primary-button"
                    onClick={() => setAlbumCreateOpen(true)}
                    type="button"
                  >
                    <Folder aria-hidden="true" size={17} />
                    新建相册
                  </button>
                )}
                <button className="secondary-button" onClick={() => void signOut()} type="button">
                  <LogOut aria-hidden="true" size={16} />
                  退出管理
                </button>
              </>
            ) : !loadingAdmin ? (
              <Link className="secondary-button" href="/admin/login">
                <LogIn aria-hidden="true" size={16} />
                管理员登录
              </Link>
            ) : null}
          </div>
        </header>

        {notice ? (
          <div className={`notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.text}
          </div>
        ) : null}

        {!selectedAlbum ? (
          <div className="album-gallery" aria-busy={loadingAlbums}>
            {loadingAlbums ? (
              Array.from({ length: 6 }).map((_, index) => <div className="album-card skeleton-card" key={index} />)
            ) : visibleAlbums.length > 0 ? (
              visibleAlbums.map((album) => (
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
                <h3>{authenticated ? "创建第一个相册" : "暂无公开相册"}</h3>
                <p>{authenticated ? "新建相册后即可上传和管理图片。" : "管理员发布公开相册后会显示在这里。"}</p>
                {authenticated ? (
                  <button className="primary-button" onClick={() => setAlbumCreateOpen(true)} type="button">
                    新建相册
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          loadingImages ? (
            <div className={`image-grid image-size-${imageSize}`} aria-busy="true">
              {Array.from({ length: 8 }).map((_, index) => <div className="image-skeleton" key={index} />)}
            </div>
          ) : images.length > 0 ? (
            <ImageMasonry
              formatSize={formatBytes}
              images={images}
              imageSize={imageSize}
              onOpenImage={openImage}
            />
          ) : (
            <div className={`image-grid image-size-${imageSize}`} aria-busy="false">
              <div className="empty-gallery">
                <ImageIcon aria-hidden="true" size={34} />
                <h3>最近上传</h3>
                <p>{authenticated ? "这个相册还没有图片，可以从当前相册上传。" : "这个相册目前没有公开图片。"}</p>
                {authenticated ? (
                  <Link className="primary-button" href={`/album-upload?albumId=${encodeURIComponent(selectedAlbum.id)}`}>
                    上传图片
                  </Link>
                ) : null}
              </div>
            </div>
          )
        )}
      </section>

      {authenticated && albumCreateOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form
            aria-labelledby="album-create-title"
            aria-modal="true"
            className="edit-dialog"
            onSubmit={createAlbum}
            role="dialog"
          >
            <div className="dialog-heading">
              <div className="panel-heading">
                <p className="section-label">相册</p>
                <h2 id="album-create-title">新建相册</h2>
              </div>
              <button aria-label="关闭新建相册" className="icon-button" onClick={closeAlbumCreate} type="button">
                <X aria-hidden="true" size={19} />
              </button>
            </div>
            <label>
              相册名称
              <input
                autoFocus
                onChange={(event) =>
                  setAlbumCreate((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="例如：2026 夏日旅行"
                required
                value={albumCreate.title}
              />
            </label>
            <label>
              相册描述
              <textarea
                onChange={(event) =>
                  setAlbumCreate((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="记录这个相册的背景、地点或说明"
                rows={5}
                value={albumCreate.description}
              />
            </label>
            <label className="check-row">
              <input
                checked={albumCreate.isPublic}
                onChange={(event) =>
                  setAlbumCreate((current) => ({ ...current, isPublic: event.target.checked }))
                }
                type="checkbox"
              />
              公开相册
            </label>
            {!albumCreate.isPublic ? <p className="empty-copy">非公开相册仅管理员登录后可见。</p> : null}
            <div className="button-row">
              <button className="secondary-button" disabled={mutating} onClick={closeAlbumCreate} type="button">
                取消
              </button>
              <button className="primary-button" disabled={mutating} type="submit">
                {mutating ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Plus aria-hidden="true" size={16} />}
                创建相册
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedAlbum && authenticated && albumEditOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form
            aria-labelledby="album-edit-title"
            aria-modal="true"
            className="edit-dialog"
            onSubmit={saveAlbum}
            role="dialog"
          >
            <div className="dialog-heading">
              <div className="panel-heading">
                <p className="section-label">相册</p>
                <h2 id="album-edit-title">编辑相册信息</h2>
              </div>
              <button aria-label="关闭相册编辑" className="icon-button" onClick={closeAlbumEdit} type="button">
                <X aria-hidden="true" size={19} />
              </button>
            </div>
          <label>
            名称
            <input
              autoFocus
              onChange={(event) => setAlbumEdit((current) => ({ ...current, title: event.target.value }))}
              value={albumEdit.title}
            />
          </label>
          <label>
            描述
            <textarea
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
              onChange={(event) =>
                setAlbumEdit((current) => ({ ...current, isPublic: event.target.checked }))
              }
              type="checkbox"
            />
            公开相册
          </label>
          {!albumEdit.isPublic ? <p className="empty-copy">非公开相册仅管理员登录后可见。</p> : null}
          <div className="button-row">
            <button className="secondary-button danger" disabled={mutating} onClick={removeAlbum} type="button">
              <Trash2 aria-hidden="true" size={16} />
              删除
            </button>
            <button className="primary-button" disabled={mutating} type="submit">
              {mutating ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Save aria-hidden="true" size={16} />}
              保存
            </button>
          </div>
        </form>
        </div>
      ) : null}

      {selectedImage ? (
        <div className="modal-backdrop image-modal-backdrop" role="presentation">
          <form
            aria-labelledby="image-edit-title"
            aria-modal="true"
            className="image-dialog"
            onSubmit={saveImage}
            role="dialog"
          >
            <div className="dialog-heading image-dialog-heading">
              <div className="panel-heading">
                <p className="section-label">图片</p>
                <h2 id="image-edit-title">查看图片</h2>
              </div>
              <button
                aria-label="关闭图片预览"
                className="icon-button"
                onClick={() => applyImageSelection(null)}
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <div className="enlarged-image-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={selectedImage.description || "相册图片"}
                height={selectedImage.height ?? undefined}
                src={`/api/images/${selectedImage.id}/asset`}
                width={selectedImage.width ?? undefined}
              />
            </div>
            <div className="image-dialog-editor">
              <div className="description-heading">
                <strong>图片描述</strong>
                {authenticated && !imageEditing ? (
                  <button className="secondary-button compact-button" onClick={() => setImageEditing(true)} type="button">
                    <Pencil aria-hidden="true" size={15} />
                    编辑
                  </button>
                ) : null}
              </div>
              {imageEditing ? (
                <>
                  <label>
                    描述
                    <textarea
                      autoFocus
                      onChange={(event) =>
                        setImageEdit((current) => ({ ...current, description: event.target.value }))
                      }
                      rows={4}
                      value={imageEdit.description}
                    />
                  </label>
                  <div className="button-row">
                    <button className="secondary-button danger" disabled={mutating} onClick={removeImage} type="button">
                      <Trash2 aria-hidden="true" size={16} />
                      删除
                    </button>
                    <button
                      className="secondary-button"
                      disabled={mutating}
                      onClick={() => {
                        setImageEdit({ description: selectedImage.description });
                        setImageEditing(false);
                      }}
                      type="button"
                    >
                      取消
                    </button>
                    <button className="primary-button" disabled={mutating} type="submit">
                      {mutating ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Save aria-hidden="true" size={16} />}
                      保存
                    </button>
                  </div>
                </>
              ) : (
                <p className="image-description">{selectedImage.description || "暂无图片描述"}</p>
              )}
              <dl className="image-metadata">
                <div><dt>文件大小</dt><dd>{formatBytes(selectedImage.size_bytes)}</dd></div>
                <div><dt>图片尺寸</dt><dd>{formatDimensions(selectedImage)}</dd></div>
                <div><dt>图片类型</dt><dd>{formatContentType(selectedImage.content_type)}</dd></div>
                <div><dt>上传时间</dt><dd>{formatDate(selectedImage.created_at)}</dd></div>
                <div><dt>最后更改</dt><dd>{formatDate(selectedImage.updated_at)}</dd></div>
              </dl>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
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

function formatDimensions(image: GalleryImage): string {
  return image.width && image.height ? `${image.width} × ${image.height} px` : "未知";
}

function formatContentType(contentType: string): string {
  return contentType.startsWith("image/") ? contentType.slice("image/".length).toUpperCase() : contentType;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
