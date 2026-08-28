"use client";

import type { Album, AlbumType } from "@/lib/db/gallery";
import { apiJson } from "@/components/gallery-client";
import { ArrowLeft, LoaderCircle, Plus } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export function CreateAlbumManager() {
  const [albumDraft, setAlbumDraft] = useState({
    title: "",
    description: "",
    albumType: "album" as AlbumType,
    isPublic: true
  });
  const [createdAlbum, setCreatedAlbum] = useState<Album | null>(null);
  const [mutating, setMutating] = useState(false);

  function showError(error: unknown) {
    toast.error(error instanceof Error ? error.message : "操作失败", { duration: 6_000 });
  }

  async function createAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!albumDraft.title.trim()) {
      toast.error("请填写相册名称", { duration: 6_000 });
      return;
    }
    setMutating(true);
    try {
      const album = await apiJson<Album>("/api/albums", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(albumDraft)
      });

      setCreatedAlbum(album);
      setAlbumDraft({ title: "", description: "", albumType: "album", isPublic: true });
      toast.success(`${albumTypeLabel(album.album_type)}已创建。请返回首页，打开后上传图片。`);
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
          返回首页
        </Link>
        <div>
          <p className="section-label">新建内容</p>
          <h1>创建相册或设定集</h1>
          <span>图片上传只能在打开某个已创建内容后进行。</span>
        </div>
      </header>

      <section className="upload-layout">
        <form className="upload-card" onSubmit={createAlbum}>
          <div className="panel-heading">
            <p className="section-label">内容管理</p>
            <h2>选择内容类型</h2>
          </div>
          <fieldset className="content-type-fieldset">
            <legend>类型</legend>
            <div className="content-type-selector">
              {([
                ["album", "相册", "适合旅行、活动和摄影作品"],
                ["setting", "设定集", "包含可编辑的角色基础信息"]
              ] as const).map(([value, label, description]) => (
                <label className={albumDraft.albumType === value ? "selected" : ""} key={value}>
                  <input
                    checked={albumDraft.albumType === value}
                    name="albumType"
                    onChange={() =>
                      setAlbumDraft((current) => ({ ...current, albumType: value }))
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
              onChange={(event) => setAlbumDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="例如：2026 夏日旅行"
              value={albumDraft.title}
            />
          </label>
          <label>
            描述
            <textarea
              onChange={(event) =>
                setAlbumDraft((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="记录这个相册的背景、地点或说明"
              rows={5}
              value={albumDraft.description}
            />
          </label>
          <label className="check-row">
            <input
              checked={albumDraft.isPublic}
              onChange={(event) =>
                setAlbumDraft((current) => ({
                  ...current,
                  isPublic: event.target.checked
                }))
              }
              type="checkbox"
            />
            公开展示
          </label>
          {!albumDraft.isPublic ? <p className="empty-copy">非公开内容仅管理员登录后可见。</p> : null}
          {albumDraft.albumType === "setting" ? (
            <p className="setting-create-hint">
              创建后可在详情页维护名字、物种、性别、性格等基础信息。
            </p>
          ) : null}
          <button className="primary-button" disabled={mutating} type="submit">
            {mutating ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Plus aria-hidden="true" size={16} />}
            新建{albumTypeLabel(albumDraft.albumType)}
          </button>
        </form>

        <div className="upload-card upload-wide">
          <div className="panel-heading">
            <p className="section-label">下一步</p>
            <h2>{createdAlbum ? `打开「${createdAlbum.title}」后上传` : "先创建内容"}</h2>
            <span>上传入口会出现在内容详情页顶部，仅在选中后可用。</span>
          </div>
          <Link
            className="primary-button"
            href={createdAlbum ? `/${encodeURIComponent(createdAlbum.route_id)}` : "/"}
          >
            {createdAlbum ? "打开新建内容" : "返回首页"}
          </Link>
        </div>
      </section>
    </main>
  );
}

function albumTypeLabel(albumType: AlbumType): string {
  return albumType === "setting" ? "设定集" : "相册";
}
