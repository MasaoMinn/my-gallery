"use client";

import type { Album } from "@/lib/db/gallery";
import { apiJson, createAdminHeaders } from "@/components/gallery-client";
import { ArrowLeft, LoaderCircle, Plus } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

export function CreateAlbumManager() {
  const [albumDraft, setAlbumDraft] = useState({
    title: "",
    description: "",
    isPublic: true,
    accessKey: ""
  });
  const [createdAlbum, setCreatedAlbum] = useState<Album | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mutating, setMutating] = useState(false);

  function showError(error: unknown) {
    setNotice({
      tone: "error",
      text: error instanceof Error ? error.message : "操作失败"
    });
  }

  async function createAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!albumDraft.title.trim()) {
      setNotice({ tone: "error", text: "请填写相册名称" });
      return;
    }

    setMutating(true);
    try {
      const album = await apiJson<Album>("/api/albums", {
        method: "POST",
        headers: createAdminHeaders("", { "content-type": "application/json" }),
        body: JSON.stringify(albumDraft)
      });

      setCreatedAlbum(album);
      setAlbumDraft({ title: "", description: "", isPublic: true, accessKey: "" });
      setNotice({ tone: "success", text: "相册已创建。请返回相册页，点开该相册后上传图片。" });
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
          <p className="section-label">新建相册</p>
          <h1>创建一个新的相册</h1>
          <span>图片上传只能在打开某个已创建相册后进行。</span>
        </div>
      </header>

      {notice ? (
        <div className={`notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </div>
      ) : null}

      <section className="upload-layout">
        <form className="upload-card" onSubmit={createAlbum}>
          <div className="panel-heading">
            <p className="section-label">相册</p>
            <h2>新建相册</h2>
          </div>
          <label>
            相册名称
            <input
              onChange={(event) => setAlbumDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="例如：2026 夏日旅行"
              value={albumDraft.title}
            />
          </label>
          <label>
            相册描述
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
                setAlbumDraft((current) => ({ ...current, isPublic: event.target.checked }))
              }
              type="checkbox"
            />
            公开相册
          </label>
          {!albumDraft.isPublic ? (
            <label>
              访问密钥
              <input
                onChange={(event) =>
                  setAlbumDraft((current) => ({ ...current, accessKey: event.target.value }))
                }
                placeholder="访问非公开相册时需要输入"
                type="password"
                value={albumDraft.accessKey}
              />
            </label>
          ) : null}
          <button className="primary-button" disabled={mutating} type="submit">
            {mutating ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Plus aria-hidden="true" size={16} />}
            新建相册
          </button>
        </form>

        <div className="upload-card upload-wide">
          <div className="panel-heading">
            <p className="section-label">下一步</p>
            <h2>{createdAlbum ? `打开「${createdAlbum.title}」后上传` : "先创建相册"}</h2>
            <span>上传入口会出现在相册浏览页顶部，仅在选中相册后可用。</span>
          </div>
          <Link className="primary-button" href="/">
            返回相册页
          </Link>
        </div>
      </section>
    </main>
  );
}
