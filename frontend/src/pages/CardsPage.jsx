import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const apiBase = import.meta.env.VITE_API_BASE || "/api";

export default function CardsPage() {
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    q: "",
    visibility: "normal",
    sort_by: "conversation_at",
    sort_dir: "desc",
  });

  useEffect(() => {
    const params = new URLSearchParams({
      q: filters.q || "",
      visibility: filters.visibility,
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
      limit: 50,
      offset: 0,
    });
    fetch(`${apiBase}/cards?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setCards(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        setCards([]);
        setTotal(0);
      });
  }, [filters]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Cards</h2>
          <p className="empty">合計 {total} 件</p>
        </div>
      </div>
      <div className="filters">
        <input
          type="text"
          placeholder="キーワード検索"
          value={filters.q}
          onChange={(event) => setFilters({ ...filters, q: event.target.value })}
        />
        <select
          value={filters.visibility}
          onChange={(event) => setFilters({ ...filters, visibility: event.target.value })}
        >
          <option value="normal">表示</option>
          <option value="hidden">非表示</option>
          <option value="archived">アーカイブ</option>
        </select>
        <select
          value={filters.sort_by}
          onChange={(event) => setFilters({ ...filters, sort_by: event.target.value })}
        >
          <option value="conversation_at">投稿日時</option>
          <option value="card_role_confidence">カード役割設定信頼度</option>
          <option value="created_at">作成日時</option>
          <option value="updated_at">更新日時</option>
        </select>
        <select
          value={filters.sort_dir}
          onChange={(event) => setFilters({ ...filters, sort_dir: event.target.value })}
        >
          <option value="asc">asc</option>
          <option value="desc">desc</option>
        </select>
      </div>
      <div className="card-grid">
        {cards.length === 0 ? (
          <p className="empty">カードがありません。</p>
        ) : (
          cards.map((card) => (
            <Link
              key={card.card_id}
              to={`/cards/${card.card_id}`}
              className="card card-link"
            >
              <div className="card-row">
                <div className="card-summary">
                  <span className="card-summary-label">
                    {card.speaker_name || "-"}：
                  </span>
                  <span className="card-summary-text">{card.contents || ""}</span>
                </div>
                <span className="card-role">{card.card_role_name || "未設定"}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}