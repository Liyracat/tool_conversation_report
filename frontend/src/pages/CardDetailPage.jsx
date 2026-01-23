import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const apiBase = import.meta.env.VITE_API_BASE || "/api";

export default function CardDetailPage() {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  const [context, setContext] = useState({ items: [] });
  const [links, setLinks] = useState([]);
  const [detailForm, setDetailForm] = useState(null);
  const [saveState, setSaveState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    const loadCard = async () => {
      if (!cardId) return;
      try {
        const res = await fetch(`${apiBase}/cards/${cardId}`);
        const data = await res.json();
        setCard(data.card);
        setContext(data.context_messages || { items: [] });
        setDetailForm({
          thread_id: data.card?.thread_id ?? "",
          message_id: data.card?.message_id ?? "",
          text_id: data.card?.text_id ?? "",
          split_key: data.card?.split_key ?? "",
          split_version: data.card?.split_version ?? "",
          speaker_id: data.card?.speaker_id ?? "",
          conversation_at: data.card?.conversation_at ?? "",
          contents: data.card?.contents ?? "",
          is_edited: data.card?.is_edited ?? "",
          card_role_id: data.card?.card_role_id ?? "",
          card_role_confidence: data.card?.card_role_confidence ?? "",
          visibility: data.card?.visibility ?? "",
          created_at: data.card?.created_at ?? "",
          updated_at: data.card?.updated_at ?? "",
        });
      } catch (error) {
        setCard(null);
        setContext({ items: [] });
        setDetailForm(null);
      }
    };

    const loadLinks = async () => {
      if (!cardId) return;
      try {
        const res = await fetch(`${apiBase}/cards/${cardId}/links`);
        const data = await res.json();
        setLinks(data.items || []);
      } catch (error) {
        setLinks([]);
      }
    };

    loadCard();
    loadLinks();
  }, [cardId]);

  if (!card) {
    return <p className="empty">カード詳細を読み込み中...</p>;
  }

  const contextItems = context.items || [];

  const handleDetailChange = (field, value) => {
    setDetailForm((prev) => ({ ...prev, [field]: value }));
  };

  const toNullableNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleSave = async () => {
    if (!detailForm) return;
    setSaveState({ status: "saving", message: "" });
    const payload = {
      thread_id: detailForm.thread_id || null,
      message_id: toNullableNumber(detailForm.message_id),
      text_id: toNullableNumber(detailForm.text_id),
      split_key: detailForm.split_key || null,
      split_version: toNullableNumber(detailForm.split_version),
      speaker_id: toNullableNumber(detailForm.speaker_id),
      conversation_at: detailForm.conversation_at || null,
      contents: detailForm.contents ?? "",
      is_edited: toNullableNumber(detailForm.is_edited),
      card_role_id: toNullableNumber(detailForm.card_role_id),
      card_role_confidence: toNullableNumber(detailForm.card_role_confidence),
      visibility: detailForm.visibility || null,
      created_at: detailForm.created_at || null,
      updated_at: detailForm.updated_at || null,
    };

    try {
      const res = await fetch(`${apiBase}/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("Failed to save");
      }
      const refresh = await fetch(`${apiBase}/cards/${cardId}`);
      const data = await refresh.json();
      setCard(data.card);
      setContext(data.context_messages || { items: [] });
      setDetailForm({
        thread_id: data.card?.thread_id ?? "",
        message_id: data.card?.message_id ?? "",
        text_id: data.card?.text_id ?? "",
        split_key: data.card?.split_key ?? "",
        split_version: data.card?.split_version ?? "",
        speaker_id: data.card?.speaker_id ?? "",
        conversation_at: data.card?.conversation_at ?? "",
        contents: data.card?.contents ?? "",
        is_edited: data.card?.is_edited ?? "",
        card_role_id: data.card?.card_role_id ?? "",
        card_role_confidence: data.card?.card_role_confidence ?? "",
        visibility: data.card?.visibility ?? "",
        created_at: data.card?.created_at ?? "",
        updated_at: data.card?.updated_at ?? "",
      });
      setSaveState({ status: "success", message: "保存しました。" });
    } catch (error) {
      setSaveState({ status: "error", message: "保存に失敗しました。" });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>カード詳細</h2>
          <p className="empty">Card ID: {card.card_id}</p>
        </div>
        <Link to="/">一覧へ戻る</Link>
      </div>
      <div className="card">
        <div className="card-row">
          <span className="card-summary-text">
            {card.speaker_name || "-"}：{card.contents || ""}
          </span>
          <span className="card-role">{card.card_role_name || "未設定"}</span>
        </div>
      </div>

      <div className="section">
        <details className="accordion" close>
          <summary>前後メッセージ</summary>
          <div className="accordion-body">
            {contextItems.length === 0 ? (
              <p className="empty">前後メッセージがありません。</p>
            ) : (
              <div className="card-grid">
                {contextItems.map((item, index) => {
                  const showDivider =
                    index > 0 &&
                    contextItems[index - 1].message_id !== item.message_id;
                  return (
                    <div key={item.card_id} className="context-card-wrapper">
                      {showDivider && <div className="preview-divider" />}
                      <Link
                        to={`/cards/${item.card_id}`}
                        className={`card card-link${
                          item.card_id === card.card_id ? " card-highlight" : ""
                        }`}
                      >
                        <div className="card-row">
                          <span className="card-summary-text">
                            {item.speaker_name || "-"}：{item.contents || ""}
                          </span>
                          <span className="card-role">
                            {item.card_role_name || "未設定"}
                          </span>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      </div>

      <div className="section">
        <details className="accordion" close>
          <summary>詳細</summary>
          <div className="accordion-body">
            <div className="settings-form">
              <div className="form-row">
                <label className="form-field">
                  thread_id
                  <input
                    className="form-input"
                    value={detailForm?.thread_id ?? ""}
                    onChange={(event) =>
                      handleDetailChange("thread_id", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  message_id
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.message_id ?? ""}
                    onChange={(event) =>
                      handleDetailChange("message_id", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  text_id
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.text_id ?? ""}
                    onChange={(event) =>
                      handleDetailChange("text_id", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  split_key
                  <input
                    className="form-input"
                    value={detailForm?.split_key ?? ""}
                    onChange={(event) =>
                      handleDetailChange("split_key", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  split_version
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.split_version ?? ""}
                    onChange={(event) =>
                      handleDetailChange("split_version", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  speaker_id
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.speaker_id ?? ""}
                    onChange={(event) =>
                      handleDetailChange("speaker_id", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  conversation_at
                  <input
                    className="form-input"
                    value={detailForm?.conversation_at ?? ""}
                    onChange={(event) =>
                      handleDetailChange("conversation_at", event.target.value)
                    }
                  />
                </label>
                <label className="form-field form-field-wide">
                  contents
                  <textarea
                    className="form-textarea"
                    value={detailForm?.contents ?? ""}
                    onChange={(event) =>
                      handleDetailChange("contents", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  is_edit
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.is_edited ?? ""}
                    onChange={(event) =>
                      handleDetailChange("is_edited", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  card_role_id
                  <input
                    className="form-input"
                    type="number"
                    value={detailForm?.card_role_id ?? ""}
                    onChange={(event) =>
                      handleDetailChange("card_role_id", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  card_role_confidence
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={detailForm?.card_role_confidence ?? ""}
                    onChange={(event) =>
                      handleDetailChange("card_role_confidence", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  visibility
                  <input
                    className="form-input"
                    value={detailForm?.visibility ?? ""}
                    onChange={(event) =>
                      handleDetailChange("visibility", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  created_at
                  <input
                    className="form-input"
                    value={detailForm?.created_at ?? ""}
                    onChange={(event) =>
                      handleDetailChange("created_at", event.target.value)
                    }
                  />
                </label>
                <label className="form-field">
                  updated_at
                  <input
                    className="form-input"
                    value={detailForm?.updated_at ?? ""}
                    onChange={(event) =>
                      handleDetailChange("updated_at", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="inline-actions">
                <button
                  className="primary"
                  type="button"
                  onClick={handleSave}
                  disabled={saveState.status === "saving"}
                >
                  保存
                </button>
                {saveState.message && (
                  <span className="empty">{saveState.message}</span>
                )}
              </div>
            </div>
          </div>
        </details>
      </div>

      <div className="section">
        <h3>関連カード</h3>
        {links.length === 0 ? (
          <p className="empty">関連カードがありません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>種別</th>
                <th>内容</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.link_id}>
                  <td>{link.link_kind_name}</td>
                  <td>{link.to_card?.contents}</td>
                  <td>{link.confidence ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}