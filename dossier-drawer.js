(function () {
  const ENTITY = "/api/entity";
  const CACHE = new Map();
  const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character]);

  function fmtDate(value) {
    if (!value) return "날짜 확인 필요";
    if (/^\d{4}-\d{2}$/.test(value)) return value.replace("-", "년 ") + "월";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function profileRowsHTML(rows, { showEmpty = false } = {}) {
    const items = showEmpty ? (rows || []) : (rows || []).filter(([, value]) => value && (!Array.isArray(value) || value.length));
    if (!items.length) return "";
    return `<div class="profile-table">${items.map(([label, value]) => {
      const filled = value && (!Array.isArray(value) || value.length);
      const display = filled ? (Array.isArray(value) ? value.join(" · ") : value) : "확인 필요";
      return `<div class="profile-row"><span>${esc(label)}</span><strong class="${filled ? "" : "profile-empty"}">${esc(display)}</strong></div>`;
    }).join("")}</div>`;
  }

  function initials(name) {
    const value = String(name || "").replace(/파트너스|인베스트먼트|캐피탈|프라이빗에쿼티|주식회사/g, "").trim();
    return [...value].slice(0, 2).join("") || "IB";
  }

  function historyHTML(rows) {
    return (rows || []).map((item) => {
      const review = !String(item.verification_status || "").includes("공식");
      return `<div class="dossier-item history-card ${review ? "review" : ""}"><div class="history-top"><b>${esc(fmtDate(item.selected_at))} · ${esc(item.account || "계정 확인 필요")}</b><span class="status-chip ${review ? "review" : ""}">${esc(item.verification_status || item.status || "확인 필요")}</span></div><div>${esc(item.program || "사업명 확인 필요")} · ${esc(item.field || "분야 확인 필요")}</div><div class="data-pairs"><div><span>공동 GP</span><b>${esc((item.co_gps || []).join("·") || "단독")}</b></div><div><span>선정 상태</span><b>${esc(item.status || "—")}</b></div><div><span>모태출자액</span><b>${esc(item.mother_commitment || "확인 필요")}</b></div><div><span>목표·의무결성액</span><b>${esc(item.target_formation || "확인 필요")}</b></div></div>${item.source_url ? `<div class="line"><a class="title-link" href="${esc(item.source_url)}" target="_blank" rel="noopener">공식 원문 ↗</a></div>` : ""}</div>`;
    }).join("");
  }

  function dossierHTML(data) {
    const profile = data.profile_overview || {};
    const history = data.selection_history || [];
    const current = history[0] || {};
    const nugu = data.nugu_money && data.nugu_money.ready && data.nugu_money.found ? data.nugu_money : null;
    const basicRows = profileRowsHTML([
      ["분류", profile.category || data.type_label],
      ["영문명·약칭", profile.aliases],
      ["설립", profile.founded_year],
      ["대표", profile.representatives],
      ["운용규모", profile.assets_under_management],
      ["투자기업", profile.portfolio_count],
      ["기준일", profile.basis_date ? fmtDate(profile.basis_date) : null],
    ], { showEmpty: true });
    const investmentRows = profileRowsHTML([
      ["주요 전략", profile.specialization],
      ["투자 단계", profile.investment_stage],
      ["주요 분야", profile.focus_sectors],
    ]);
    const metrics = [
      ["출자 선정", history.length ? `${history.length}건` : null],
      ["등록 펀드", (data.funds || []).length ? `${data.funds.length}개` : null],
      ["공동 GP", (data.co_gps || []).length ? `${data.co_gps.length}곳` : null],
      ["최근 선정", current.selected_at ? fmtDate(current.selected_at) : null],
      ["최근 모태출자액", current.mother_commitment],
      ["목표·의무결성액", current.target_formation],
    ].filter(([, value]) => value);
    const relations = (data.relations || []).map((item) => `<article class="dossier-item relation-dossier"><div class="relation-top"><span class="relation-kind">${esc(item.category || "관계")}</span><span class="relation-date">${esc(fmtDate(item.occurred_at || item.valid_from || ""))}</span></div><div class="relation-path"><span class="relation-label">${esc(item.relation_label || "관계")}</span><button class="entity-button" type="button" data-dossier-entity="${esc(item.counterpart_key)}">${esc(item.counterpart_name || "")}</button></div>${item.basis ? `<p class="relation-basis">${esc(item.basis)}</p>` : ""}${item.source_url ? `<div class="relation-source"><a class="source-link" href="${esc(item.source_url)}" target="_blank" rel="noopener">원문 ↗</a></div>` : ""}</article>`).join("");
    const funds = (data.funds || []).map((item) => `<div class="dossier-item"><b>${esc(item.program || item.name || "펀드")}</b><div>${esc(item.manager || "")}</div><div class="data-pairs"><div><span>공식 조합명</span><b>${esc(item.name || "—")}</b></div><div><span>단계</span><b>${esc(item.status || "—")}</b></div><div><span>모태출자액</span><b>${esc(item.mother_commitment || "—")}</b></div><div><span>목표·의무결성액</span><b>${esc(item.target_formation || "—")}</b></div></div></div>`).join("");
    const coGps = (data.co_gps || []).map((item) => `<div class="dossier-item"><b>${esc(item.name)}</b> · ${esc(item.year)}년 ${esc(item.account || "")}<span class="source-status">${esc(item.status || "")}</span></div>`).join("");
    const latestNews = (data.related_news || []).slice(0, 5);
    const news = latestNews.map((item) => `<div class="dossier-item news-item"><a class="title-link" href="${esc(item.source_url)}" target="_blank" rel="noopener">${esc(item.title)}</a><div class="news-meta">${esc(item.source_name || "출처 확인 필요")} · ${esc(fmtDate(item.published_at || ""))}${item.related_count > 1 ? ` · 관련 보도 ${esc(item.related_count)}건` : ""}</div>${item.excerpt ? `<p>${esc(item.excerpt)}</p>` : ""}</div>`).join("");
    const nuguScore = nugu && nugu.rating_average !== null && Number.isFinite(Number(nugu.rating_average)) ? Number(nugu.rating_average).toFixed(1) : "—";
    const nuguReviews = nugu ? (nugu.review_excerpts || []).map((item) => `<article class="reputation-review"><div class="reputation-review-head"><span>${item.rating === null ? "평점 없음" : `${esc(item.rating)} / 10`}</span><span>${item.funding ? "투자 경험 있음" : "투자 경험 없음"}</span></div><p>${esc(item.review)}</p></article>`).join("") : "";
    const nuguHTML = nugu ? `<section class="dossier-section"><h3>업계 평판 · 누구머니</h3><div class="reputation-card"><div class="reputation-top"><div class="reputation-score"><span>평균 평점</span><strong>${esc(nuguScore)} / 10</strong></div><div class="reputation-count"><span>등록 후기</span><strong>${esc(nugu.review_count || 0)}건</strong></div></div>${nuguReviews ? `<div class="reputation-reviews">${nuguReviews}</div>` : ""}<div class="reputation-foot"><span class="reputation-note">익명 후기는 사실 확정이 아닌 취재 단서로만 활용하세요.</span><a class="source-link" href="${esc(nugu.source_url || "https://nugu.money/")}" target="_blank" rel="noopener">누구머니 원문 ↗</a></div></div></section>` : "";
    const evidence = (data.evidence || []).map((item) => `<div class="dossier-item">${item.source_url ? `<a class="title-link" href="${esc(item.source_url)}" target="_blank" rel="noopener">${esc(item.title)}</a>` : `<b>${esc(item.title)}</b>`}${item.verification_status ? `<span class="source-status">${esc(item.verification_status)}</span>` : ""}<div class="small muted">${esc(item.source_name || "")}${item.fact ? ` · ${esc(item.fact)}` : ""}</div></div>`).join("");
    return `<div class="dossier-head"><div class="profile-identity"><div class="profile-logo">${esc(initials(data.entity?.canonical_name))}</div><div><h2>${esc(data.entity?.canonical_name || "취재파일")}</h2><span class="badge vc">${esc(data.type_label || "취재대상")}</span></div></div>${data.updated_at ? `<div class="profile-updated">자료 갱신 ${esc(fmtDate(data.updated_at))}</div>` : ""}</div><section class="dossier-section"><h3>기본 정보</h3>${basicRows}</section><section class="dossier-section"><h3>투자·운용</h3><div class="profile-service-card"><div class="profile-service-top"><div class="profile-service-icon">◆</div><div><h4>${esc(profile.service_name || "기관 정보")}</h4></div></div>${profile.service_description ? `<p>${esc(profile.service_description)}</p>` : ""}${investmentRows ? `<div class="profile-service-fields">${investmentRows}</div>` : ""}</div></section>${nuguHTML}${metrics.length ? `<section class="dossier-section"><h3>운용 현황</h3><div class="profile-metrics">${metrics.map(([label, value]) => `<div class="profile-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</div></section>` : ""}${history.length ? `<section class="dossier-section"><h3>출자 선정</h3><div class="dossier-items">${historyHTML(history)}</div></section>` : ""}${funds ? `<section class="dossier-section"><h3>펀드</h3><div class="dossier-items">${funds}</div></section>` : ""}${coGps ? `<section class="dossier-section"><h3>공동 GP</h3><div class="dossier-items">${coGps}</div></section>` : ""}${relations ? `<section class="dossier-section"><h3>주요 관계</h3><div class="dossier-items">${relations}</div></section>` : ""}${news ? `<section class="dossier-section"><h3>관련 최신뉴스 · ${esc(latestNews.length)}건</h3><div class="dossier-items">${news}</div></section>` : ""}${evidence ? `<section class="dossier-section source-section"><h3>출처</h3><div class="dossier-items">${evidence}</div></section>` : ""}`;
  }

  function ensureDrawer() {
    let backdrop = document.getElementById("newsDossierBackdrop");
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.className = "drawer-backdrop";
    backdrop.id = "newsDossierBackdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = '<aside class="dossier-drawer" role="dialog" aria-modal="true" aria-label="취재파일"><button class="dossier-drawer-close" type="button" data-dossier-close aria-label="닫기">×</button><div id="newsDossier"><div class="empty">취재파일을 불러오는 중…</div></div></aside>';
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function close() {
    const backdrop = document.getElementById("newsDossierBackdrop");
    if (backdrop) backdrop.hidden = true;
    document.body.style.overflow = "";
  }

  async function open(entityKey) {
    if (!entityKey) return;
    const backdrop = ensureDrawer();
    const content = document.getElementById("newsDossier");
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    content.innerHTML = '<div class="empty">취재파일을 만드는 중…</div>';
    try {
      let data = CACHE.get(entityKey);
      if (!data) {
        const response = await fetch(`${ENTITY}?entity_key=${encodeURIComponent(entityKey)}`);
        data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "조회 실패");
        CACHE.set(entityKey, data);
      }
      content.innerHTML = dossierHTML(data);
      backdrop.querySelector(".dossier-drawer").scrollTop = 0;
    } catch (error) {
      content.innerHTML = `<div class="error">${esc(error.message)}</div>`;
    }
  }

  function chips(entities) {
    return (entities || []).map((entity) => `<button class="dossier-entity-chip" type="button" data-dossier-entity="${esc(entity.entity_key)}">${esc(entity.canonical_name)}</button>`).join("");
  }

  document.addEventListener("click", (event) => {
    const entity = event.target.closest("[data-dossier-entity]");
    if (entity) {
      event.preventDefault();
      open(entity.dataset.dossierEntity);
      return;
    }
    const backdrop = event.target.closest("#newsDossierBackdrop");
    if (event.target.closest("[data-dossier-close]") || event.target === backdrop) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  window.DossierDrawer = { chips, close, open };
})();
