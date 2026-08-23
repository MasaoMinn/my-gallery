"use client";

import { ApiError, apiJson } from "@/components/gallery-client";
import type { AlbumField } from "@/lib/db/gallery";
import { LoaderCircle, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type DraftField = {
  clientId: string;
  label: string;
  value: string;
};

type AlbumFieldsEditorProps = {
  albumId: string;
  authenticated: boolean;
  onUpdated: () => void;
};

export function AlbumFieldsEditor({
  albumId,
  authenticated,
  onUpdated
}: AlbumFieldsEditorProps) {
  const router = useRouter();
  const [fields, setFields] = useState<AlbumField[]>([]);
  const [draft, setDraft] = useState<DraftField[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isEditing = editing && authenticated;

  useEffect(() => {
    let cancelled = false;

    async function loadFields() {
      try {
        const result = await apiJson<AlbumField[]>(`/api/albums/${albumId}/fields`);
        if (!cancelled) {
          setFields(result);
          setDraft(toDraft(result));
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "基础信息加载失败", {
            duration: 6_000
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFields();
    return () => {
      cancelled = true;
    };
  }, [albumId]);

  function startEditing() {
    setDraft(toDraft(fields));
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(toDraft(fields));
    setEditing(false);
  }

  function addField() {
    setDraft((current) => [
      ...current,
      { clientId: crypto.randomUUID(), label: "", value: "" }
    ]);
  }

  function removeField(clientId: string) {
    setDraft((current) => current.filter((field) => field.clientId !== clientId));
  }

  async function saveFields(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiJson<AlbumField[]>(`/api/albums/${albumId}/fields`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fields: draft.map((field) => ({ label: field.label, value: field.value }))
        })
      });
      setFields(result);
      setDraft(toDraft(result));
      setEditing(false);
      onUpdated();
      toast.success("基础信息已保存");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      toast.error(error instanceof Error ? error.message : "基础信息保存失败", {
        duration: 6_000
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="setting-fields-panel" aria-labelledby="setting-fields-title">
      <div className="setting-fields-heading">
        <div>
          <h3 id="setting-fields-title">基础信息</h3>
          <p>{isEditing ? "字段和内容均可修改，保存后对访客只读展示。" : "设定集的角色与背景资料。"}</p>
        </div>
        {authenticated && !isEditing && !loading ? (
          <button className="secondary-button compact-button" onClick={startEditing} type="button">
            <Pencil aria-hidden="true" size={15} />
            编辑基础信息
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="loading-block">
          <LoaderCircle aria-hidden="true" className="spin" size={17} />
          正在加载基础信息
        </div>
      ) : isEditing ? (
        <form className="setting-fields-form" onSubmit={saveFields}>
          <div className="setting-fields-table setting-fields-table-header" aria-hidden="true">
            <strong>字段</strong>
            <strong>内容</strong>
            <span />
          </div>
          {draft.map((field, index) => (
            <div className="setting-fields-table setting-fields-edit-row" key={field.clientId}>
              <input
                aria-label={`第 ${index + 1} 项字段`}
                maxLength={80}
                onChange={(event) =>
                  setDraft((current) =>
                    current.map((item) =>
                      item.clientId === field.clientId
                        ? { ...item, label: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="例如：物种"
                required
                value={field.label}
              />
              <input
                aria-label={`第 ${index + 1} 项内容`}
                maxLength={500}
                onChange={(event) =>
                  setDraft((current) =>
                    current.map((item) =>
                      item.clientId === field.clientId
                        ? { ...item, value: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="填写内容"
                value={field.value}
              />
              <button
                aria-label={`删除第 ${index + 1} 项基础信息`}
                className="icon-button danger"
                onClick={() => removeField(field.clientId)}
                title="删除"
                type="button"
              >
                <Trash2 aria-hidden="true" size={17} />
              </button>
            </div>
          ))}
          {draft.length === 0 ? <p className="setting-fields-empty">尚未添加基础信息。</p> : null}
          <div className="setting-fields-actions">
            <button className="secondary-button" onClick={addField} type="button">
              <Plus aria-hidden="true" size={16} />
              添加信息
            </button>
            <div className="button-row">
              <button className="secondary-button" disabled={saving} onClick={cancelEditing} type="button">
                <X aria-hidden="true" size={16} />
                取消
              </button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Save aria-hidden="true" size={16} />}
                保存更改
              </button>
            </div>
          </div>
        </form>
      ) : fields.length > 0 ? (
        <dl className="setting-fields-readonly">
          {fields.map((field) => (
            <div key={field.id}>
              <dt>{field.label}</dt>
              <dd>{field.value || "未填写"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="setting-fields-empty">
          {authenticated ? "尚未添加基础信息，可以进入编辑模式添加。" : "暂无基础信息。"}
        </p>
      )}
    </section>
  );
}

function toDraft(fields: AlbumField[]): DraftField[] {
  return fields.map((field) => ({
    clientId: field.id,
    label: field.label,
    value: field.value
  }));
}
