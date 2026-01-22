import { useEffect, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || "/api";

const canonicalRoles = ["human", "ai", "system", "unknown"];

const emptySpeaker = {
  speaker_name: "",
  speaker_role: "",
  canonical_role: "human",
};

const emptyMajorItem = {
  major_name: "",
};

const emptyCardRole = {
  card_role_major_item_id: "",
  minor_name: "",
};

const emptyLinkKind = {
  link_kind_name: "",
};

const emptyMeaninglessPhrase = {
  card_role_id: "",
  phrase: "",
};

export default function SettingsPage() {
  const [speakers, setSpeakers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [linkKinds, setLinkKinds] = useState([]);
  const [majorItems, setMajorItems] = useState([]);
  const [meaninglessPhrases, setMeaninglessPhrases] = useState([]);

  const [newSpeaker, setNewSpeaker] = useState(emptySpeaker);
  const [editingSpeakerId, setEditingSpeakerId] = useState(null);
  const [editingSpeaker, setEditingSpeaker] = useState(emptySpeaker);

  const [newMajorItem, setNewMajorItem] = useState(emptyMajorItem);
  const [editingMajorItemId, setEditingMajorItemId] = useState(null);
  const [editingMajorItem, setEditingMajorItem] = useState(emptyMajorItem);

  const [newCardRole, setNewCardRole] = useState(emptyCardRole);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editingRole, setEditingRole] = useState(emptyCardRole);

  const [newLinkKind, setNewLinkKind] = useState(emptyLinkKind);
  const [editingLinkKindId, setEditingLinkKindId] = useState(null);
  const [editingLinkKind, setEditingLinkKind] = useState(emptyLinkKind);

  const [newMeaninglessPhrase, setNewMeaninglessPhrase] = useState(emptyMeaninglessPhrase);
  const [editingMeaninglessId, setEditingMeaninglessId] = useState(null);
  const [editingMeaninglessPhrase, setEditingMeaninglessPhrase] = useState(emptyMeaninglessPhrase);

  const fetchSpeakers = async () => {
    try {
      const res = await fetch(`${apiBase}/speakers`);
      const data = await res.json();
      setSpeakers(data);
    } catch {
      setSpeakers([]);
    }
  };

  const fetchMajorItems = async () => {
    try {
      const res = await fetch(`${apiBase}/card-role-major-items`);
      const data = await res.json();
      setMajorItems(data);
    } catch {
      setMajorItems([]);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch(`${apiBase}/card-roles`);
      const data = await res.json();
      setRoles(data);
    } catch {
      setRoles([]);
    }
  };

  const fetchLinkKinds = async () => {
    try {
      const res = await fetch(`${apiBase}/link-kinds`);
      const data = await res.json();
      setLinkKinds(data);
    } catch {
      setLinkKinds([]);
    }
  };

  const fetchMeaninglessPhrases = async () => {
    try {
      const res = await fetch(`${apiBase}/meaningless_phrases`);
      const data = await res.json();
      setMeaninglessPhrases(data);
    } catch {
      setMeaninglessPhrases([]);
    }
  };

  useEffect(() => {
    fetchSpeakers();
    fetchMajorItems();
    fetchRoles();
    fetchLinkKinds();
    fetchMeaninglessPhrases();
  }, []);

  const handleCreateSpeaker = async (event) => {
    event.preventDefault();
    if (!newSpeaker.speaker_name || !newSpeaker.speaker_role) {
      return;
    }
    await fetch(`${apiBase}/speakers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSpeaker),
    });
    setNewSpeaker(emptySpeaker);
    fetchSpeakers();
  };

  const handleUpdateSpeaker = async (speakerId) => {
    await fetch(`${apiBase}/speakers/${speakerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingSpeaker),
    });
    setEditingSpeakerId(null);
    setEditingSpeaker(emptySpeaker);
    fetchSpeakers();
  };

  const handleDeleteSpeaker = async (speakerId) => {
    await fetch(`${apiBase}/speakers/${speakerId}`, { method: "DELETE" });
    fetchSpeakers();
  };

  const handleCreateMajorItem = async (event) => {
    event.preventDefault();
    if (!newMajorItem.major_name) {
      return;
    }
    await fetch(`${apiBase}/card-role-major-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMajorItem),
    });
    setNewMajorItem(emptyMajorItem);
    fetchMajorItems();
  };

  const handleUpdateMajorItem = async (majorId) => {
    await fetch(`${apiBase}/card-role-major-items/${majorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingMajorItem),
    });
    setEditingMajorItemId(null);
    setEditingMajorItem(emptyMajorItem);
    fetchMajorItems();
  };

  const handleDeleteMajorItem = async (majorId) => {
    await fetch(`${apiBase}/card-role-major-items/${majorId}`, { method: "DELETE" });
    fetchMajorItems();
  };

  const handleCreateRole = async (event) => {
    event.preventDefault();
    if (!newCardRole.card_role_major_item_id || !newCardRole.minor_name) {
      return;
    }
    await fetch(`${apiBase}/card-roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_role_major_item_id: Number(newCardRole.card_role_major_item_id),
        minor_name: newCardRole.minor_name,
      }),
    });
    setNewCardRole(emptyCardRole);
    fetchRoles();
  };

  const handleUpdateRole = async (roleId) => {
    await fetch(`${apiBase}/card-roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_role_major_item_id: Number(editingRole.card_role_major_item_id),
        minor_name: editingRole.minor_name,
      }),
    });
    setEditingRoleId(null);
    setEditingRole(emptyCardRole);
    fetchRoles();
  };

  const handleDeleteRole = async (roleId) => {
    await fetch(`${apiBase}/card-roles/${roleId}`, { method: "DELETE" });
    fetchRoles();
  };

  const handleCreateLinkKind = async (event) => {
    event.preventDefault();
    if (!newLinkKind.link_kind_name) {
      return;
    }
    await fetch(`${apiBase}/link-kinds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLinkKind),
    });
    setNewLinkKind(emptyLinkKind);
    fetchLinkKinds();
  };

  const handleUpdateLinkKind = async (linkKindId) => {
    await fetch(`${apiBase}/link-kinds/${linkKindId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingLinkKind),
    });
    setEditingLinkKindId(null);
    setEditingLinkKind(emptyLinkKind);
    fetchLinkKinds();
  };

  const handleDeleteLinkKind = async (linkKindId) => {
    await fetch(`${apiBase}/link-kinds/${linkKindId}`, { method: "DELETE" });
    fetchLinkKinds();
  };

  const handleCreateMeaninglessPhrase = async (event) => {
    event.preventDefault();
    if (!newMeaninglessPhrase.card_role_id || !newMeaninglessPhrase.phrase) {
      return;
    }
    await fetch(`${apiBase}/meaningless_phrases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_role_id: Number(newMeaninglessPhrase.card_role_id),
        phrase: newMeaninglessPhrase.phrase,
      }),
    });
    setNewMeaninglessPhrase(emptyMeaninglessPhrase);
    fetchMeaninglessPhrases();
  };

  const handleUpdateMeaninglessPhrase = async (meaninglessId) => {
    await fetch(`${apiBase}/meaningless_phrases/${meaninglessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_role_id: Number(editingMeaninglessPhrase.card_role_id),
        phrase: editingMeaninglessPhrase.phrase,
      }),
    });
    setEditingMeaninglessId(null);
    setEditingMeaninglessPhrase(emptyMeaninglessPhrase);
    fetchMeaninglessPhrases();
  };

  const handleDeleteMeaninglessPhrase = async (meaninglessId) => {
    await fetch(`${apiBase}/meaningless_phrases/${meaninglessId}`, { method: "DELETE" });
    fetchMeaninglessPhrases();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p className="empty">基本設定データを確認・編集します。</p>
        </div>
      </div>
      <div className="section">
        <h3>Speakers</h3>
        <form className="settings-form" onSubmit={handleCreateSpeaker}>
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Name"
              value={newSpeaker.speaker_name}
              onChange={(event) =>
                setNewSpeaker((prev) => ({ ...prev, speaker_name: event.target.value }))
              }
            />
            <input
              className="form-input"
              placeholder="Role"
              value={newSpeaker.speaker_role}
              onChange={(event) =>
                setNewSpeaker((prev) => ({ ...prev, speaker_role: event.target.value }))
              }
            />
            <select
              className="form-input"
              value={newSpeaker.canonical_role}
              onChange={(event) =>
                setNewSpeaker((prev) => ({ ...prev, canonical_role: event.target.value }))
              }
            >
              {canonicalRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button className="primary" type="submit">
              追加
            </button>
          </div>
        </form>
        {speakers.length === 0 ? (
          <p className="empty">登録されていません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Canonical</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {speakers.map((speaker) => {
                const isEditing = editingSpeakerId === speaker.speaker_id;
                return (
                  <tr key={speaker.speaker_id}>
                    <td>{speaker.speaker_id}</td>
                    <td>
                      {isEditing ? (
                        <input
                          className="form-input"
                          value={editingSpeaker.speaker_name}
                          onChange={(event) =>
                            setEditingSpeaker((prev) => ({
                              ...prev,
                              speaker_name: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        speaker.speaker_name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="form-input"
                          value={editingSpeaker.speaker_role}
                          onChange={(event) =>
                            setEditingSpeaker((prev) => ({
                              ...prev,
                              speaker_role: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        speaker.speaker_role
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="form-input"
                          value={editingSpeaker.canonical_role}
                          onChange={(event) =>
                            setEditingSpeaker((prev) => ({
                              ...prev,
                              canonical_role: event.target.value,
                            }))
                          }
                        >
                          {canonicalRoles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      ) : (
                        speaker.canonical_role
                      )}
                    </td>
                    <td>
                      <div className="inline-actions">
                        {isEditing ? (
                          <>
                            <button
                              className="primary"
                              type="button"
                              onClick={() => handleUpdateSpeaker(speaker.speaker_id)}
                            >
                              保存
                            </button>
                            <button
                              className="secondary"
                              type="button"
                              onClick={() => {
                                setEditingSpeakerId(null);
                                setEditingSpeaker(emptySpeaker);
                              }}
                            >
                              キャンセル
                            </button>
                          </>
                        ) : (
                          <button
                            className="secondary"
                            type="button"
                            onClick={() => {
                              setEditingSpeakerId(speaker.speaker_id);
                              setEditingSpeaker({
                                speaker_name: speaker.speaker_name ?? "",
                                speaker_role: speaker.speaker_role ?? "",
                                canonical_role: speaker.canonical_role ?? "unknown",
                              });
                            }}
                          >
                            編集
                          </button>
                        )}
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => handleDeleteSpeaker(speaker.speaker_id)}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="section">
        <h3>Card Role Major Items</h3>
        <form className="settings-form" onSubmit={handleCreateMajorItem}>
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Major name"
              value={newMajorItem.major_name}
              onChange={(event) =>
                setNewMajorItem((prev) => ({ ...prev, major_name: event.target.value }))
              }
            />
          </div>
          <div className="form-actions">
            <button className="primary" type="submit">
              追加
            </button>
          </div>
        </form>
        {majorItems.length === 0 ? (
          <p className="empty">登録されていません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Major Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {majorItems.map((major) => {
                const isEditing = editingMajorItemId === major.card_role_major_item_id;
                return (
                  <tr key={major.card_role_major_item_id}>
                    <td>{major.card_role_major_item_id}</td>
                    <td>
                      {isEditing ? (
                        <input
                          className="form-input"
                          value={editingMajorItem.major_name}
                          onChange={(event) =>
                            setEditingMajorItem((prev) => ({
                              ...prev,
                              major_name: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        major.major_name
                      )}
                    </td>
                    <td>
                      <div className="inline-actions">
                        {isEditing ? (
                          <>
                            <button
                              className="primary"
                              type="button"
                              onClick={() => handleUpdateMajorItem(major.card_role_major_item_id)}
                            >
                              保存
                            </button>
                            <button
                              className="secondary"
                              type="button"
                              onClick={() => {
                                setEditingMajorItemId(null);
                                setEditingMajorItem(emptyMajorItem);
                              }}
                            >
                              キャンセル
                            </button>
                          </>
                        ) : (
                          <button
                            className="secondary"
                            type="button"
                            onClick={() => {
                              setEditingMajorItemId(major.card_role_major_item_id);
                              setEditingMajorItem({
                                major_name: major.major_name ?? "",
                              });
                            }}
                          >
                            編集
                          </button>
                        )}
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => handleDeleteMajorItem(major.card_role_major_item_id)}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="section">
        <h3>Card Roles</h3>
        <form className="settings-form" onSubmit={handleCreateRole}>
          <div className="form-row">
            <select
              className="form-input"
              value={newCardRole.card_role_major_item_id}
              onChange={(event) =>
                setNewCardRole((prev) => ({
                  ...prev,
                  card_role_major_item_id: event.target.value,
                }))
              }
            >
              <option value="">Major ID</option>
              {majorItems.map((major) => (
                <option key={major.card_role_major_item_id} value={major.card_role_major_item_id}>
                  {major.card_role_major_item_id} - {major.major_name}
                </option>
              ))}
            </select>
            <input
              className="form-input"
              placeholder="Minor name"
              value={newCardRole.minor_name}
              onChange={(event) =>
                setNewCardRole((prev) => ({ ...prev, minor_name: event.target.value }))
              }
            />
          </div>
          <div className="form-actions">
            <button className="primary" type="submit">
              追加
            </button>
          </div>
        </form>
        {roles.length === 0 ? (
          <p className="empty">登録されていません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Major ID</th>
                <th>Minor Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const isEditing = editingRoleId === role.card_role_id;
                return (
                  <tr key={role.card_role_id}>
                    <td>{role.card_role_id}</td>
                    <td>
                      {isEditing ? (
                        <select
                          className="form-input"
                          value={editingRole.card_role_major_item_id}
                          onChange={(event) =>
                            setEditingRole((prev) => ({
                              ...prev,
                              card_role_major_item_id: event.target.value,
                            }))
                          }
                        >
                          <option value="">Major ID</option>
                          {majorItems.map((major) => (
                            <option
                              key={major.card_role_major_item_id}
                              value={major.card_role_major_item_id}
                            >
                              {major.card_role_major_item_id} - {major.major_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        role.card_role_major_item_id
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="form-input"
                          value={editingRole.minor_name}
                          onChange={(event) =>
                            setEditingRole((prev) => ({
                              ...prev,
                              minor_name: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        role.minor_name
                      )}
                    </td>
                    <td>
                      <div className="inline-actions">
                        {isEditing ? (
                          <>
                            <button
                              className="primary"
                              type="button"
                              onClick={() => handleUpdateRole(role.card_role_id)}
                            >
                              保存
                            </button>
                            <button
                              className="secondary"
                              type="button"
                              onClick={() => {
                                setEditingRoleId(null);
                                setEditingRole(emptyCardRole);
                              }}
                            >
                              キャンセル
                            </button>
                          </>
                        ) : (
                          <button
                            className="secondary"
                            type="button"
                            onClick={() => {
                              setEditingRoleId(role.card_role_id);
                              setEditingRole({
                                card_role_major_item_id: role.card_role_major_item_id ?? "",
                                minor_name: role.minor_name ?? "",
                              });
                            }}
                          >
                            編集
                          </button>
                        )}
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => handleDeleteRole(role.card_role_id)}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="section">
        <h3>Link Kinds</h3>
        <form className="settings-form" onSubmit={handleCreateLinkKind}>
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Link kind name"
              value={newLinkKind.link_kind_name}
              onChange={(event) =>
                setNewLinkKind((prev) => ({ ...prev, link_kind_name: event.target.value }))
              }
            />
          </div>
          <div className="form-actions">
            <button className="primary" type="submit">
              追加
            </button>
          </div>
        </form>
        {linkKinds.length === 0 ? (
          <p className="empty">登録されていません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {linkKinds.map((kind) => {
                const isEditing = editingLinkKindId === kind.link_kind_id;
                return (
                  <tr key={kind.link_kind_id}>
                    <td>{kind.link_kind_id}</td>
                    <td>
                      {isEditing ? (
                        <input
                          className="form-input"
                          value={editingLinkKind.link_kind_name}
                          onChange={(event) =>
                            setEditingLinkKind((prev) => ({
                              ...prev,
                              link_kind_name: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        kind.link_kind_name
                      )}
                    </td>
                    <td>
                      <div className="inline-actions">
                        {isEditing ? (
                          <>
                            <button
                              className="primary"
                              type="button"
                              onClick={() => handleUpdateLinkKind(kind.link_kind_id)}
                            >
                              保存
                            </button>
                            <button
                              className="secondary"
                              type="button"
                              onClick={() => {
                                setEditingLinkKindId(null);
                                setEditingLinkKind(emptyLinkKind);
                              }}
                            >
                              キャンセル
                            </button>
                          </>
                        ) : (
                          <button
                            className="secondary"
                            type="button"
                            onClick={() => {
                              setEditingLinkKindId(kind.link_kind_id);
                              setEditingLinkKind({ link_kind_name: kind.link_kind_name ?? "" });
                            }}
                          >
                            編集
                          </button>
                        )}
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => handleDeleteLinkKind(kind.link_kind_id)}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="section">
        <h3>Meaningless Phrases</h3>
        <form className="settings-form" onSubmit={handleCreateMeaninglessPhrase}>
          <div className="form-row">
            <select
              className="form-input"
              value={newMeaninglessPhrase.card_role_id}
              onChange={(event) =>
                setNewMeaninglessPhrase((prev) => ({
                  ...prev,
                  card_role_id: event.target.value,
                }))
              }
            >
              <option value="">Card Role ID</option>
              {roles.map((role) => (
                <option key={role.card_role_id} value={role.card_role_id}>
                  {role.card_role_id} - {role.minor_name}
                </option>
              ))}
            </select>
            <input
              className="form-input"
              placeholder="Phrase"
              value={newMeaninglessPhrase.phrase}
              onChange={(event) =>
                setNewMeaninglessPhrase((prev) => ({ ...prev, phrase: event.target.value }))
              }
            />
          </div>
          <div className="form-actions">
            <button className="primary" type="submit">
              追加
            </button>
          </div>
        </form>
        {meaninglessPhrases.length === 0 ? (
          <p className="empty">登録されていません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Card Role ID</th>
                <th>Phrase</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {meaninglessPhrases.map((phrase) => {
                const isEditing = editingMeaninglessId === phrase.meaningless_id;
                return (
                  <tr key={phrase.meaningless_id}>
                    <td>{phrase.meaningless_id}</td>
                    <td>
                      {isEditing ? (
                        <select
                          className="form-input"
                          value={editingMeaninglessPhrase.card_role_id}
                          onChange={(event) =>
                            setEditingMeaninglessPhrase((prev) => ({
                              ...prev,
                              card_role_id: event.target.value,
                            }))
                          }
                        >
                          <option value="">Card Role ID</option>
                          {roles.map((role) => (
                            <option key={role.card_role_id} value={role.card_role_id}>
                              {role.card_role_id} - {role.minor_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        phrase.card_role_id
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="form-input"
                          value={editingMeaninglessPhrase.phrase}
                          onChange={(event) =>
                            setEditingMeaninglessPhrase((prev) => ({
                              ...prev,
                              phrase: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        phrase.phrase
                      )}
                    </td>
                    <td>
                      <div className="inline-actions">
                        {isEditing ? (
                          <>
                            <button
                              className="primary"
                              type="button"
                              onClick={() => handleUpdateMeaninglessPhrase(phrase.meaningless_id)}
                            >
                              保存
                            </button>
                            <button
                              className="secondary"
                              type="button"
                              onClick={() => {
                                setEditingMeaninglessId(null);
                                setEditingMeaninglessPhrase(emptyMeaninglessPhrase);
                              }}
                            >
                              キャンセル
                            </button>
                          </>
                        ) : (
                          <button
                            className="secondary"
                            type="button"
                            onClick={() => {
                              setEditingMeaninglessId(phrase.meaningless_id);
                              setEditingMeaninglessPhrase({
                                card_role_id: phrase.card_role_id ?? "",
                                phrase: phrase.phrase ?? "",
                              });
                            }}
                          >
                            編集
                          </button>
                        )}
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => handleDeleteMeaninglessPhrase(phrase.meaningless_id)}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}