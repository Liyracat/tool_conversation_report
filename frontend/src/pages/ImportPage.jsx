import { useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || "/api";

export default function ImportPage() {
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");

  const handlePreview = async () => {
    setMessage("");
    const res = await fetch(`${apiBase}/import/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_text: rawText,
      }),
    });
    if (!res.ok) {
      setMessage("プレビューに失敗しました");
      return;
    }
    const data = await res.json();
    setPreview(data);
  };

  const handleCommit = async () => {
    if (!preview) return;
    const res = await fetch(`${apiBase}/import/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thread_id: preview.thread_id,
        parts: preview.parts,
      }),
    });
    if (!res.ok) {
      setMessage("保存に失敗しました");
      return;
    }
    const data = await res.json();
    setMessage(`保存完了: ${data.created_card_ids.length}件`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Import</h2>
          <p className="empty">テキストを貼り付けてカード化します。</p>
        </div>
      </div>
      <div className="card">
        <textarea
          rows={8}
          style={{ width: "100%", marginTop: "12px" }}
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
        />
        <div className="section inline-actions">
          <button className="primary" onClick={handlePreview}>
            プレビュー
          </button>
          <button className="secondary" onClick={handleCommit} disabled={!preview}>
            保存
          </button>
        </div>
        {message && <p className="empty">{message}</p>}
      </div>
      {preview && (
        <div className="section">
          <h3>プレビュー</h3>
          <div className="card-grid">
            {preview.parts.map((part) => {
              const {
                message_id: messageId,
                text_id: textId,
                speaker_name: speakerName,
                contents,
              } = part;
              return (
                <div key={`${messageId}-${textId}`} className="card">
                  <div className="card-title">
                    {speakerName}{"　　　"}message_id: {messageId} / text_id: {textId}
                  </div>
                  <div className="card-body">{contents}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}