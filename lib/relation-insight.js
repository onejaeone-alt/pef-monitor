const RELATION_INSIGHTS = {
  acquiring: {
    category: "인수",
    reporting_value: "인수가격과 지분율, 자금조달 구조를 확인할 거래 단서입니다.",
    follow_up_question: "거래금액·인수 지분·인수금융 조건은 어떻게 정했나",
  },
  co_gp_with: {
    category: "공동 운용",
    reporting_value: "두 운용사의 심사권과 사후관리, 관리보수 배분을 확인할 펀드 단서입니다.",
    follow_up_question: "투자심사·사후관리·관리보수는 두 GP가 어떻게 나누나",
  },
  deal_party_of: {
    category: "거래",
    reporting_value: "거래 단계와 각 참여자의 역할, 이해관계를 확인할 단서입니다.",
    follow_up_question: "현재 거래 단계와 각 참여자의 역할은 무엇인가",
  },
  exiting_from: {
    category: "회수",
    reporting_value: "매각가격과 원매자, 투자원금 대비 회수 성과를 확인할 단서입니다.",
    follow_up_question: "예상 매각가격·원매자·투자원금 대비 회수액은 얼마인가",
  },
  invested_in: {
    category: "투자",
    reporting_value: "투자금액과 지분율, 밸류에이션, 회수 시점을 확인할 투자 단서입니다.",
    follow_up_question: "투자금액·지분율·밸류에이션과 예상 회수 시점은 언제인가",
  },
  joined: {
    category: "인사",
    reporting_value: "새로 합류한 인물이 맡을 펀드와 거래를 확인할 인사 단서입니다.",
    follow_up_question: "새 직책에서 어느 펀드와 거래를 맡나",
  },
  left: {
    category: "인사",
    reporting_value: "퇴사·사임한 인물이 맡았던 펀드와 거래의 인수인계를 확인할 단서입니다.",
    follow_up_question: "맡았던 펀드·거래는 누가 이어받고 함께 이동한 인력은 누구인가",
  },
  linked_to_distress: {
    category: "재무 위험",
    reporting_value: "법원·채권단 일정과 대주주의 추가 지원 여부를 확인할 위험 단서입니다.",
    follow_up_question: "법원·채권단의 다음 일정과 대주주 추가 지원 계획은 무엇인가",
  },
  manages_fund: {
    category: "펀드",
    reporting_value: "실제 약정액과 LP 구성, 1차·최종 클로징 일정을 확인할 펀드 단서입니다.",
    follow_up_question: "현재 약정액·주요 LP·1차와 최종 클로징 시점은 언제인가",
  },
  owns_stake_in: {
    category: "지분",
    reporting_value: "지분율과 보유 목적, 직전 공시 이후 변동을 확인할 주주 단서입니다.",
    follow_up_question: "직전 공시보다 지분율과 보유 목적이 어떻게 달라졌나",
  },
  preferred_bidder_for: {
    category: "M&A",
    reporting_value: "제시 가격과 배타적 협상기간, 인수금융 조건을 확인할 M&A 단서입니다.",
    follow_up_question: "제시 가격·배타적 협상기간·인수금융 조건은 무엇인가",
  },
  promoted_at: {
    category: "인사",
    reporting_value: "승진 뒤 의사결정 권한과 담당 펀드·거래가 어떻게 달라지는지 확인할 단서입니다.",
    follow_up_question: "승진 뒤 투자심사 권한과 담당 펀드·거래가 어떻게 달라지나",
  },
  selected_gp: {
    category: "출자사업",
    reporting_value: "선정 발표 뒤 실제 결성액과 민간 LP, 결성 시한 충족 여부를 확인할 단서입니다.",
    follow_up_question: "실제 결성액·민간 LP·결성 시한 충족 여부는 어떻게 확인됐나",
  },
  selling: {
    category: "매각",
    reporting_value: "희망 매각가격과 원매자, 회수 일정과 성과를 확인할 매각 단서입니다.",
    follow_up_question: "희망 매각가격·원매자·본입찰과 거래 종결 일정은 언제인가",
  },
  tender_offer_for: {
    category: "공개매수",
    reporting_value: "공개매수 가격과 목표 지분, 자금조달과 상장폐지 계획을 확인할 단서입니다.",
    follow_up_question: "공개매수 가격·목표 지분·자금조달과 상장폐지 계획은 무엇인가",
  },
};

const DEFAULT_INSIGHT = {
  category: "관계",
  reporting_value: "두 대상의 역할과 거래·펀드에 미치는 영향을 확인할 단서입니다.",
  follow_up_question: "두 대상은 어떤 계약과 역할로 연결됐고 무엇이 달라졌나",
};

function relationInsight(relationType) {
  return { ...(RELATION_INSIGHTS[relationType] || DEFAULT_INSIGHT) };
}

module.exports = { relationInsight };
