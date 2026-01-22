import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const apiBase = import.meta.env.VITE_API_BASE || "/api";

export default function CardDetailPage() {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  const [context, setContext] = useState({ prev: [], next: [] });
  const [links, setLinks] = useState([]);

  useEffect(() => {
    if (!cardId) return;
    fetch(`${apiBase}/cards/${cardId}`)
      .then((res) => res.json())
      .then((data) => {
        setCard(data.card);
        setContext(data.context_messages || { prev: [], next: [] });
      })
      .catch(() => {
        setCard(null);
        setContext({ prev: [], next: [] });
      });
    fetch(`${apiBase}/cards/${cardId}/links`)
      .then((res) => res.json())
      .then((data) => setLinks(data.items || []))
      .catch(() => setLinks([]));
  }, [cardId]);

  if (!card) {
    return <p className="empty">カード詳細を読み込み中...</p>;
  }

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
        <div className="card-title">
          {card.card_role_name || "未設定"} ・ {card.speaker_name || "-"}
        </div>
        <div className="card-body">{card.contents}</div>
        <div className="section">
          <span className="badge">{card.visibility}</span>
          <span className="empty"> {card.conversation_at}</span>
        </div>
      </div>

      <div className="section">
        <h3>前後メッセージ</h3>
        <div className="card-grid">
          {context.prev.map((item) => (
            <div key={item.card_id} className="card">
              <div className="card-title">{item.card_role_name || "未設定"}</div>
              <div className="card-body">{item.contents}</div>
            </div>
          ))}
          {context.next.map((item) => (
            <div key={item.card_id} className="card">
              <div className="card-title">{item.card_role_name || "未設定"}</div>
              <div className="card-body">{item.contents}</div>
            </div>
          ))}
        </div>
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