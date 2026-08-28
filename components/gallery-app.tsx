"use client";

import type { Album, AlbumType, GalleryImage } from "@/lib/db/gallery";
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
import { AlbumFieldsEditor } from "@/components/album-fields-editor";
import type { ImageSize } from "@/lib/images/masonry";
import {
  Folder,
  BookOpen,
  Cloud,
  Globe2,
  ImageIcon,
  LoaderCircle,
  Link2,
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
  ChevronDown,
  Eraser,
  Trash2,
  Upload,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const IMAGE_SIZE_OPTIONS: Array<{ value: ImageSize; label: string; columns: number }> = [
  { value: "xlarge", label: "特大", columns: 3 },
  { value: "large", label: "大", columns: 4 },
  { value: "medium", label: "中", columns: 5 },
  { value: "small", label: "小", columns: 6 },
  { value: "xsmall", label: "特小", columns: 8 }
];

type AlbumTypeFilter = "all" | AlbumType;

export function GalleryApp({ initialRouteId }: { initialRouteId?: string }) {
  const router = useRouter();
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
    routeId: "",
    isPublic: true
  });
  const [albumCreate, setAlbumCreate] = useState({
    title: "",
    description: "",
    albumType: "album" as AlbumType,
    isPublic: true
  });
  const [imageEdit, setImageEdit] = useState({ description: "" });
  const [query, setQuery] = useState("");
  const [albumTypeFilter, setAlbumTypeFilter] = useState<AlbumTypeFilter>("all");
  const [albumSortField, setAlbumSortField] = useState<AlbumSortField>("updatedAt");
  const [albumSortDirection, setAlbumSortDirection] = useState<SortDirection>("desc");
  const [imageSize, setImageSize] = useState<ImageSize>("medium");
  const [imageCacheVersion, setImageCacheVersion] = useState(0);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  const [mutating, setMutating] = useState(false);
  const refreshMenuRef = useRef<HTMLDetailsElement>(null);

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
    const matchingAlbums = albums.filter((album) => {
      const matchesType = albumTypeFilter === "all" || album.album_type === albumTypeFilter;
      const matchesQuery = !normalized ||
        album.title.toLowerCase().includes(normalized) ||
        album.description.toLowerCase().includes(normalized);
      return matchesType && matchesQuery;
    });

    return sortAlbums(matchingAlbums, albumSortField, albumSortDirection);
  }, [albums, albumSortDirection, albumSortField, albumTypeFilter, query]);

  function showError(error: unknown) {
    toast.error(error instanceof Error ? error.message : "操作失败", { duration: 6_000 });
  }

  useEffect(() => {
    if (loadingAdmin) {
      return;
    }

    let cancelled = false;

    async function loadInitialAlbums() {
      try {
        const albumListPromise = apiJson<Album[]>("/api/albums");
        const routedAlbumPromise = initialRouteId
          ? apiJson<Album>(`/api/albums/by-route/${encodeURIComponent(initialRouteId)}`)
          : Promise.resolve(null);
        const [loadedAlbums, routedAlbum] = await Promise.all([
          albumListPromise,
          routedAlbumPromise
        ]);
        if (cancelled) {
          return;
        }

        const initialAlbums = routedAlbum
          ? [routedAlbum, ...loadedAlbums.filter((album) => album.id !== routedAlbum.id)]
          : loadedAlbums;
        setAlbums(initialAlbums);
        setRouteUnavailable(false);
        if (routedAlbum) {
          applyAlbumSelection(routedAlbum);
          setLoadingImages(true);
          const loadedImages = await apiJson<GalleryImage[]>(
            `/api/albums/${routedAlbum.id}/images`
          );
          if (!cancelled) {
            setImages(loadedImages);
            applyImageSelection(null);
          }
        } else {
          setSelectedAlbumId("");
          setSelectedImageId("");
          setImages([]);
        }
      } catch (error) {
        if (initialRouteId && error instanceof ApiError && error.status === 404) {
          setAlbums([]);
          setSelectedAlbumId("");
          setImages([]);
          setRouteUnavailable(true);
        } else {
          showError(error);
        }
      } finally {
        if (!cancelled) {
          setLoadingAlbums(false);
          setLoadingImages(false);
        }
      }
    }

    void loadInitialAlbums();

    return () => {
      cancelled = true;
    };
  }, [authenticated, initialRouteId, loadingAdmin]);

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
        setAlbumEdit({ title: "", description: "", routeId: "", isPublic: true });
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

  async function clearImageCache() {
    refreshMenuRef.current?.removeAttribute("open");
    setImageCacheVersion((current) => Math.max(current + 1, Date.now()));
    toast.success("图片缓存已清除，正在刷新");
    await refreshAlbums();
  }

  function selectAlbum(album: Album) {
    router.push(`/${encodeURIComponent(album.route_id)}`);
  }

  function returnToAlbums() {
    setSelectedAlbumId("");
    setImages([]);
    setAlbumEditOpen(false);
    setAlbumEdit({ title: "", description: "", routeId: "", isPublic: true });
    applyImageSelection(null);
    setRouteUnavailable(false);
    router.push("/");
  }

  function applyAlbumSelection(album: Album) {
    setSelectedAlbumId(album.id);
    setAlbumEdit({
      title: album.title,
      description: album.description,
      routeId: album.route_id,
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
    setAlbumCreate({ title: "", description: "", albumType: "album", isPublic: true });
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
      toast.success(`${albumTypeLabel(album.album_type)}「${album.title}」已创建`);
      router.push(`/${encodeURIComponent(album.route_id)}`);
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
        routeId: albumEdit.routeId,
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
      if (album.route_id !== selectedAlbum.route_id) {
        router.replace(`/${encodeURIComponent(album.route_id)}`);
      }
      toast.success("相册信息已保存");
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
        setAlbumEdit({ title: "", description: "", routeId: "", isPublic: true });
        setImageEdit({ description: "" });
        setImages([]);
      }
      toast.success("相册和图片已删除");
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
      toast.success("图片描述已保存");
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
      toast.success("图片已删除");
    });
  }

  async function mutate(action: () => Promise<void>) {
    setMutating(true);
    try {
      await action();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
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
    toast.success("已退出管理员会话");
  }

  async function copyAlbumLink() {
    if (!selectedAlbum) {
      return;
    }

    const directUrl = new URL(
      `/${encodeURIComponent(selectedAlbum.route_id)}`,
      window.location.origin
    ).toString();
    try {
      await navigator.clipboard.writeText(directUrl);
      toast.success("直达链接已复制");
    } catch {
      toast.error("无法复制链接，请从地址栏复制", { duration: 6_000 });
    }
  }

  if (routeUnavailable) {
    return (
      <main className="route-not-found-page">
        <section aria-labelledby="route-not-found-title" className="route-not-found-card">
          <div className="brand route-not-found-brand">
            <div className="brand-mark cloudflare-brand-mark">
              <Cloud aria-hidden="true" size={23} strokeWidth={2.2} />
            </div>
            <strong>Cloudflare Album</strong>
          </div>
          <p className="route-not-found-code">404</p>
          <h1 id="route-not-found-title">相册不存在或不可访问</h1>
          <p>请检查链接是否正确。非公开相册和设定集仅管理员登录后可以访问。</p>
          <Link className="primary-button route-not-found-back" href="/">
            <ArrowLeft aria-hidden="true" size={17} />
            返回相册首页
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell ${selectedAlbum ? "image-view" : "album-view"}`}>
      <section className="workspace" aria-label="图片浏览区">
        <header className="workspace-header">
          <div className="top-navigation">
            <div className="brand inline-brand">
              <div className="brand-mark cloudflare-brand-mark">
                <Cloud aria-hidden="true" size={23} strokeWidth={2.2} />
              </div>
              <h1>Cloudflare Album</h1>
            </div>
            <nav aria-label="管理菜单" className="top-navigation-actions">
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
                      <Plus aria-hidden="true" size={17} />
                      新建内容
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
            </nav>
          </div>

          {selectedAlbum ? (
            <div className="content-context">
              <button className="back-button" onClick={returnToAlbums} type="button">
                <span className="back-button-icon">
                  <ArrowLeft aria-hidden="true" size={17} />
                </span>
                <span>返回首页</span>
              </button>
              <div className="album-context-copy">
                <div className="album-context-badges">
                  <span className={`type-pill ${selectedAlbum.album_type}`}>
                    {selectedAlbum.album_type === "setting" ? (
                      <BookOpen aria-hidden="true" size={13} />
                    ) : (
                      <Folder aria-hidden="true" size={13} />
                    )}
                    {albumTypeLabel(selectedAlbum.album_type)}
                  </span>
                  <span className={`status-pill ${selectedAlbum.is_public ? "public" : "private"}`}>
                    {selectedAlbum.is_public ? (
                      <Globe2 aria-hidden="true" size={13} />
                    ) : (
                      <Lock aria-hidden="true" size={13} />
                    )}
                    {selectedAlbum.is_public ? "公开" : "非公开"}
                  </span>
                </div>
                <div className="album-title-row">
                  <h2>{selectedAlbum.title}</h2>
                  {selectedAlbum.is_public ? (
                    <button
                      className="secondary-button album-copy-button"
                      onClick={() => void copyAlbumLink()}
                      type="button"
                    >
                      <Link2 aria-hidden="true" size={16} />
                      复制相册链接
                    </button>
                  ) : null}
                  {authenticated ? (
                    <button
                      aria-label="编辑相册信息"
                      className="icon-button album-edit-button"
                      onClick={() => setAlbumEditOpen(true)}
                      title="编辑相册信息"
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={17} />
                    </button>
                  ) : null}
                </div>
                {selectedAlbum.description ? (
                  <p className="album-context-description">{selectedAlbum.description}</p>
                ) : null}
                <span className="album-context-meta">
                  {selectedAlbum.image_count} 张图片 · {formatBytes(selectedAlbum.total_size_bytes)}
                </span>
              </div>
            </div>
          ) : null}

          <div className={`toolbar toolbar-panel ${selectedAlbum ? "image-toolbar" : "album-toolbar"}`}>
            {!selectedAlbum ? (
              <>
                <label className="search-box toolbar-search">
                  <Search aria-hidden="true" size={17} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索相册或设定集"
                    type="search"
                  />
                </label>
                <div aria-label="内容类型筛选" className="type-filter" role="group">
                  {([
                    ["all", "全部"],
                    ["album", "相册"],
                    ["setting", "设定集"]
                  ] as const).map(([value, label]) => (
                    <button
                      aria-pressed={albumTypeFilter === value}
                      key={value}
                      onClick={() => setAlbumTypeFilter(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="sort-menu-group">
                  <label className="sort-control">
                    <span>排序</span>
                    <select
                      aria-label="相册排序字段"
                      onChange={(event) => setAlbumSortField(event.target.value as AlbumSortField)}
                      value={albumSortField}
                    >
                      <option value="title">名称</option>
                      <option value="createdAt">创建时间</option>
                      <option value="updatedAt">更改时间</option>
                      <option value="size">内容大小</option>
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
                </div>
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
            <div
              className="refresh-dropdown"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  refreshMenuRef.current?.removeAttribute("open");
                }
              }}
              onMouseLeave={() => refreshMenuRef.current?.removeAttribute("open")}
            >
              <button className="secondary-button refresh-main-button" onClick={() => void refreshAlbums()} type="button">
                <RefreshCw aria-hidden="true" size={16} />
                刷新
              </button>
              <details ref={refreshMenuRef}>
                <summary aria-label="打开刷新菜单" className="secondary-button refresh-menu-trigger">
                  <ChevronDown aria-hidden="true" size={16} />
                </summary>
                <div className="refresh-menu" role="menu">
                  <button onClick={() => void clearImageCache()} role="menuitem" type="button">
                    <Eraser aria-hidden="true" size={16} />
                    清除缓存
                  </button>
                </div>
              </details>
            </div>
          </div>
        </header>

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
                      <img alt="" loading="lazy" src={imageAssetUrl(album.cover_image.id, imageCacheVersion)} />
                    ) : (
                      <Folder aria-hidden="true" size={34} />
                    )}
                  </span>
                  <span className="album-card-body">
                    <strong>{album.title}</strong>
                    <small>{album.image_count} 张图片 · {formatBytes(album.total_size_bytes)}</small>
                    <span className="album-badges">
                      <span className={`type-pill ${album.album_type}`}>
                        {album.album_type === "setting" ? (
                          <BookOpen aria-hidden="true" size={13} />
                        ) : (
                          <Folder aria-hidden="true" size={13} />
                        )}
                        {albumTypeLabel(album.album_type)}
                      </span>
                      <span className={`status-pill ${album.is_public ? "public" : "private"}`}>
                        {album.is_public ? (
                          <Globe2 aria-hidden="true" size={13} />
                        ) : (
                          <Lock aria-hidden="true" size={13} />
                        )}
                        {album.is_public ? "公开" : "非公开"}
                      </span>
                    </span>
                    {album.description ? <span>{album.description}</span> : null}
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-gallery">
                <Folder aria-hidden="true" size={34} />
                <h3>{emptyGalleryTitle(albumTypeFilter, authenticated)}</h3>
                <p>{authenticated ? "新建相册或设定集后即可上传和管理图片。" : "管理员发布公开内容后会显示在这里。"}</p>
                {authenticated ? (
                  <button className="primary-button" onClick={() => setAlbumCreateOpen(true)} type="button">
                    新建内容
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <>
            {selectedAlbum.album_type === "setting" ? (
              <AlbumFieldsEditor
                albumId={selectedAlbum.id}
                authenticated={authenticated}
                key={selectedAlbum.id}
                onUpdated={() => {
                  const now = new Date().toISOString();
                  setAlbums((current) =>
                    current.map((album) =>
                      album.id === selectedAlbum.id ? { ...album, updated_at: now } : album
                    )
                  );
                }}
              />
            ) : null}
            {loadingImages ? (
              <div className={`image-grid image-size-${imageSize}`} aria-busy="true">
                {Array.from({ length: 8 }).map((_, index) => <div className="image-skeleton" key={index} />)}
              </div>
            ) : images.length > 0 ? (
              <ImageMasonry
                cacheVersion={imageCacheVersion}
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
                  <p>{authenticated ? "这个内容还没有图片，可以从当前页面上传。" : "这里目前没有公开图片。"}</p>
                  {authenticated ? (
                    <Link className="primary-button" href={`/album-upload?albumId=${encodeURIComponent(selectedAlbum.id)}`}>
                      上传图片
                    </Link>
                  ) : null}
                </div>
              </div>
            )}
          </>
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
                <p className="section-label">内容管理</p>
                <h2 id="album-create-title">新建内容</h2>
              </div>
              <button aria-label="关闭新建内容" className="icon-button" onClick={closeAlbumCreate} type="button">
                <X aria-hidden="true" size={19} />
              </button>
            </div>
            <fieldset className="content-type-fieldset">
              <legend>类型</legend>
              <div className="content-type-selector">
                {([
                  ["album", "相册", "适合旅行、活动和摄影作品"],
                  ["setting", "设定集", "包含可编辑的角色基础信息"],
                ] as const).map(([value, label, description]) => (
                  <label className={albumCreate.albumType === value ? "selected" : ""} key={value}>
                    <input
                      checked={albumCreate.albumType === value}
                      name="albumType"
                      onChange={() =>
                        setAlbumCreate((current) => ({ ...current, albumType: value }))
                      }
                      type="radio"
                      value={value}
                    />
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              名称
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
              描述
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
              公开展示
            </label>
            {!albumCreate.isPublic ? <p className="empty-copy">非公开内容仅管理员登录后可见。</p> : null}
            {albumCreate.albumType === "setting" ? (
              <p className="setting-create-hint">
                创建后可在详情页维护名字、物种、性别、性格等基础信息。
              </p>
            ) : null}
            <div className="button-row">
              <button className="secondary-button" disabled={mutating} onClick={closeAlbumCreate} type="button">
                取消
              </button>
              <button className="primary-button" disabled={mutating} type="submit">
                {mutating ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Plus aria-hidden="true" size={16} />}
                创建{albumTypeLabel(albumCreate.albumType)}
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
                <p className="section-label">{albumTypeLabel(selectedAlbum.album_type)}</p>
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
          <label>
            路由 ID
            <input
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={64}
              onChange={(event) =>
                setAlbumEdit((current) => ({
                  ...current,
                  routeId: event.target.value.toLowerCase()
                }))
              }
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              spellCheck={false}
              value={albumEdit.routeId}
            />
            <small className="field-hint">
              公开地址：gallery.tangetsu.top/{albumEdit.routeId || "..."}，只能使用小写字母、数字和连字符。
            </small>
          </label>
          <label className="check-row">
            <input
              checked={albumEdit.isPublic}
              onChange={(event) =>
                setAlbumEdit((current) => ({ ...current, isPublic: event.target.checked }))
              }
              type="checkbox"
            />
            公开展示
          </label>
          {!albumEdit.isPublic ? <p className="empty-copy">非公开内容仅管理员登录后可见。</p> : null}
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
                src={imageAssetUrl(selectedImage.id, imageCacheVersion)}
                width={selectedImage.width ?? undefined}
              />
            </div>
            <div className="image-dialog-editor">
              <div className="description-heading">
                <strong>图片描述</strong>
                {authenticated ? (
                  <div className="image-detail-actions">
                    <button
                      className="secondary-button compact-button danger"
                      disabled={mutating}
                      onClick={removeImage}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                      删除
                    </button>
                    {!imageEditing ? (
                      <button className="secondary-button compact-button" onClick={() => setImageEditing(true)} type="button">
                        <Pencil aria-hidden="true" size={15} />
                        编辑
                      </button>
                    ) : null}
                  </div>
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

function albumTypeLabel(albumType: AlbumType): string {
  return albumType === "setting" ? "设定集" : "相册";
}

function emptyGalleryTitle(filter: AlbumTypeFilter, authenticated: boolean): string {
  if (filter === "setting") {
    return authenticated ? "创建第一个设定集" : "暂无公开设定集";
  }
  if (filter === "album") {
    return authenticated ? "创建第一个相册" : "暂无公开相册";
  }
  return authenticated ? "创建第一个内容" : "暂无公开内容";
}

function imageAssetUrl(imageId: string, cacheVersion: number): string {
  const path = `/api/images/${imageId}/asset`;
  return cacheVersion > 0 ? `${path}?cache=${cacheVersion}` : path;
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
