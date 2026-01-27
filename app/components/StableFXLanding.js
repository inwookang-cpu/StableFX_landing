'use client';

import { useState } from 'react';

// Sub-tab navigation for landing page
const landingTabs = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'insights', label: 'Insights' },
  { id: 'cases', label: 'Cases' },
];

export default function StableFXLanding({ onNavigate }) {
  const [activeSubTab, setActiveSubTab] = useState('home');

  return (
    <div className="min-h-screen">
      {/* Sub-tab Navigation */}
      <div className="border-b border-kustody-border bg-kustody-surface/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {landingTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                  activeSubTab === tab.id 
                    ? 'border-kustody-accent text-kustody-text' 
                    : 'border-transparent text-kustody-muted hover:text-kustody-text/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeSubTab === 'home' && <HomeSection onNavigate={onNavigate} />}
      {activeSubTab === 'about' && <AboutSection />}
      {activeSubTab === 'insights' && <InsightsSection />}
      {activeSubTab === 'cases' && <CasesSection />}
    </div>
  );
}

// Home Section
function HomeSection({ onNavigate }) {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-kustody-accent/10 via-transparent to-transparent" />
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-2xl">
            <p className="text-kustody-accent font-medium mb-3 font-mono text-sm tracking-wider">
              FX DERIVATIVES PRICING
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-5">
              Fair Price<br/>
              <span className="bg-gradient-to-r from-kustody-accent via-emerald-400 to-white bg-clip-text text-transparent">
                for Your FX
              </span>
            </h1>
            <p className="text-lg text-kustody-muted mb-8 leading-relaxed">
              은행이 말해주지 않는 외환파생상품의 진짜 가격.<br/>
              당신의 funding cost로 직접 계산하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => onNavigate('calculator')}
                className="bg-kustody-accent text-kustody-dark px-7 py-3.5 rounded-xl text-base font-semibold hover:bg-kustody-accent/90 transition-all hover:shadow-lg hover:shadow-kustody-accent/20"
              >
                무료로 계산하기 →
              </button>
              <button 
                onClick={() => onNavigate('console')}
                className="border border-kustody-border text-kustody-text px-7 py-3.5 rounded-xl text-base font-medium hover:bg-kustody-surface transition-all"
              >
                전문가 콘솔 보기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-16 border-t border-kustody-border/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-kustody-accent font-medium mb-2 font-mono text-sm">OUR VALUES</p>
            <h2 className="text-2xl md:text-3xl font-bold">
              정보의 비대칭을 구조로 해결합니다
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                title: 'Know Your Price',
                subtitle: '이론가를 알면',
                desc: '협상이 시작됩니다. 은행이 제시하는 가격이 fair한지, 당신의 funding cost 기준으로 직접 확인하세요.'
              },
              {
                num: '02',
                title: 'Level the Field',
                subtitle: '정보 비대칭',
                desc: '이제 끝입니다. 외환딜러들만 알던 pricing 로직을 누구나 사용할 수 있게 만들었습니다.'
              },
              {
                num: '03',
                title: 'Deal with Power',
                subtitle: '협상력을 갖추고',
                desc: '은행과 대등하게 거래하세요. 이론가를 아는 것만으로도 더 나은 조건을 받을 수 있습니다.'
              }
            ].map((item, i) => (
              <div key={i} className="bg-kustody-surface/50 rounded-xl p-6 border border-kustody-border hover:border-kustody-accent/30 transition-all hover:-translate-y-1">
                <span className="text-kustody-accent text-sm font-bold mb-3 block font-mono">
                  {item.num}
                </span>
                <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                <p className="text-kustody-accent font-medium mb-3 text-sm">{item.subtitle}</p>
                <p className="text-kustody-muted text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target Segments */}
      <section className="py-16 bg-gradient-to-b from-transparent via-kustody-accent/5 to-transparent">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-kustody-accent font-medium mb-2 font-mono text-sm">FOR YOU</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              정보 비대칭과 싸우는 사람들
            </h2>
            <p className="text-kustody-muted">각자의 상황에서 외환 비용을 최적화하려는 모든 분들을 위해</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: '🚢',
                title: '무역회사',
                desc: '수출입 결제 일정에 맞춘 정확한 헷지 비용을 계산하세요. 환율 변동에 매번 긴장하지 않아도 됩니다.'
              },
              {
                icon: '🌏',
                title: '해외투자 법인',
                desc: '해외 자회사 송금, 배당금 환전에서 은행 마진이 얼마인지 알고 계신가요? 실제 접근 가능한 금리 기준으로 확인하세요.'
              },
              {
                icon: '🚀',
                title: '스타트업 CFO',
                desc: '투자금 환전, 글로벌 벤더 결제... 소규모라서 은행에서 좋은 조건 못 받으셨죠? 이론가를 알면 협상력이 생깁니다.'
              }
            ].map((item, i) => (
              <div key={i} className="bg-kustody-dark rounded-xl p-6 border border-kustody-border hover:border-kustody-accent/30 transition-all">
                <span className="text-3xl mb-4 block">{item.icon}</span>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-kustody-muted text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Conversion Flow */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-kustody-accent font-medium mb-2 font-mono text-sm">HOW IT WORKS</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Simple은 무료. Complex는 로그인.
            </h2>
            <p className="text-kustody-muted">Treasury는 StableFX.</p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-0">
            {[
              { step: '1', title: '무료 계산기', desc: '웹으로 바로 접근', active: false },
              { step: '2', title: '회원가입', desc: 'AML/KYC 인증', active: false },
              { step: '3', title: '고급 계산기', desc: '복잡한 구조화 상품', active: false },
              { step: '4', title: 'StableFX DAT', desc: 'Digital Asset Treasury', active: true }
            ].map((item, i) => (
              <div key={i} className="flex items-center">
                <div className={`bg-kustody-surface/50 rounded-xl p-5 border text-center w-full md:w-40 ${item.active ? 'border-kustody-accent' : 'border-kustody-border'}`}>
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-kustody-accent/10 text-kustody-accent font-bold text-sm mb-3">
                    {item.step}
                  </span>
                  <h4 className="font-semibold text-sm mb-1">{item.title}</h4>
                  <p className="text-xs text-kustody-muted">{item.desc}</p>
                </div>
                {i < 3 && (
                  <div className="hidden md:block text-kustody-muted px-3">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-gradient-to-br from-kustody-accent/20 to-kustody-accent/5 rounded-2xl p-10 md:p-14 text-center border border-kustody-accent/20">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              지금 바로 시작하세요
            </h2>
            <p className="text-kustody-muted mb-6">
              회원가입 없이 무료로 FX Swap 이론가를 계산해보세요.<br/>
              은행이 제시하는 가격이 fair한지 확인할 수 있습니다.
            </p>
            <button 
              onClick={() => onNavigate('calculator')}
              className="bg-kustody-accent text-kustody-dark px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-kustody-accent/90 transition-all hover:shadow-lg hover:shadow-kustody-accent/30"
            >
              무료 계산기 사용하기 →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// About Section
function AboutSection() {
  return (
    <div>
      {/* Hero */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl">
            <p className="text-kustody-accent font-medium mb-3 font-mono text-sm">ABOUT STABLEFX</p>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-5">
              We level the playing field<br/>
              <span className="bg-gradient-to-r from-kustody-accent to-emerald-400 bg-clip-text text-transparent">
                in FX markets
              </span>
            </h1>
            <p className="text-lg text-kustody-muted leading-relaxed">
              7년간 외환딜러로 일하며 보아온 정보 비대칭의 문제.<br/>
              이제 기술로 해결합니다.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 border-t border-kustody-border/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-kustody-accent font-medium mb-3 font-mono text-sm">OUR MISSION</p>
              <h2 className="text-2xl font-bold mb-5">
                외환시장의 정보 비대칭을 해소합니다
              </h2>
              <div className="space-y-4 text-kustody-muted leading-relaxed text-sm">
                <p>
                  기업들은 은행으로부터 외환파생상품을 거래할 때, 정확한 이론가를 알지 못한 채 
                  은행이 제시하는 가격을 수용해왔습니다. 이 과정에서 불필요하게 높은 마진을 
                  지불하고 있었습니다.
                </p>
                <p>
                  StableFX는 은행 딜러들만 사용하던 pricing 로직을 누구나 접근할 수 있게 
                  만들어, 기업들이 자신의 funding cost 기준으로 fair value를 계산하고, 
                  은행과 대등하게 협상할 수 있도록 돕습니다.
                </p>
                <p>
                  궁극적으로 스테이블코인 기반의 Digital Asset Treasury 서비스를 통해, 
                  cross-border payment의 효율성과 treasury management의 새로운 
                  패러다임을 제시하고자 합니다.
                </p>
              </div>
            </div>
            <div className="bg-kustody-surface/50 rounded-xl p-6 border border-kustody-border">
              <div className="space-y-6">
                <div>
                  <span className="text-3xl font-bold bg-gradient-to-r from-kustody-accent to-emerald-400 bg-clip-text text-transparent font-mono">7+</span>
                  <p className="text-kustody-muted mt-1 text-sm">Years of FX Dealing Experience</p>
                </div>
                <div className="border-t border-kustody-border pt-6">
                  <span className="text-3xl font-bold bg-gradient-to-r from-kustody-accent to-emerald-400 bg-clip-text text-transparent font-mono">162.5억</span>
                  <p className="text-kustody-muted mt-1 text-sm">투자유치 실적 (트래블월렛 CFO)</p>
                </div>
                <div className="border-t border-kustody-border pt-6">
                  <span className="text-2xl font-bold bg-gradient-to-r from-kustody-accent to-emerald-400 bg-clip-text text-transparent font-mono">KB · NH · Mizuho</span>
                  <p className="text-kustody-muted mt-1 text-sm">Major Korean Banks Background</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="py-16 bg-gradient-to-b from-transparent via-kustody-accent/5 to-transparent">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-kustody-accent font-medium mb-2 font-mono text-sm">FOUNDER</p>
            <h2 className="text-2xl md:text-3xl font-bold">
              딜러 출신이 만드는 Fair FX
            </h2>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <div className="bg-kustody-dark rounded-xl p-6 md:p-8 border border-kustody-border">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-kustody-accent/30 to-kustody-accent/10 flex items-center justify-center text-3xl font-bold flex-shrink-0">
                  IW
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Inwoo Kim</h3>
                  <p className="text-kustody-accent font-medium mb-3 text-sm">CEO & Co-founder</p>
                  
                  <div className="space-y-3 text-kustody-muted leading-relaxed text-sm mb-4">
                    <p>
                      7년간 KB증권, NH투자증권, 미즈호은행에서 외환딜러로 근무하며 
                      interbank FX 시장의 pricing 메커니즘을 깊이 이해했습니다.
                    </p>
                    <p>
                      이후 스마일게이트인베스트먼트에서 2.5년간 VC로 핀테크 투자를 담당했고, 
                      트래블월렛 CFO로서 162.5억원 투자유치와 예비유니콘 선정을 이끌었습니다.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {['FX Dealer', 'VC', 'CFO', 'Fintech'].map((tag) => (
                      <span key={tag} className="px-2.5 py-1 bg-kustody-surface rounded-full text-xs text-kustody-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-kustody-border">
                <p className="text-xs text-kustody-muted mb-3">Career Timeline</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { period: '2012-2019', title: 'FX Dealer', company: 'KB · NH · Mizuho' },
                    { period: '2019-2022', title: 'VC', company: '스마일게이트인베스트먼트' },
                    { period: '2024-2025', title: 'CFO', company: '트래블월렛' },
                    { period: '2025-', title: 'CEO', company: 'StableFX' }
                  ].map((item, i) => (
                    <div key={i} className="bg-kustody-surface/50 rounded-lg p-3">
                      <p className="text-xs text-kustody-accent mb-1 font-mono">{item.period}</p>
                      <p className="font-medium text-xs">{item.title}</p>
                      <p className="text-xs text-kustody-muted">{item.company}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Company Info */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-kustody-accent font-medium mb-2 font-mono text-sm">COMPANY</p>
            <h2 className="text-2xl md:text-3xl font-bold">KustodyFi Co., Ltd.</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { label: '설립일', value: '2025.10.21' },
              { label: '사업 영역', value: 'Digital Asset Treasury' },
              { label: '핵심 제품', value: 'FX Pricing Engine' }
            ].map((item, i) => (
              <div key={i} className="bg-kustody-surface/50 rounded-lg p-5 border border-kustody-border text-center">
                <p className="text-xs text-kustody-muted mb-1">{item.label}</p>
                <p className="font-semibold text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// Insights Section
function InsightsSection() {
  const wikiArticles = [
    { title: 'FX 스왑이란?', desc: '외환스왑의 기본 개념과 구조', tag: 'Basics', readTime: '5분' },
    { title: '선물환 vs NDF 차이', desc: '결제 방식과 활용 상황 비교', tag: 'Products', readTime: '7분' },
    { title: '스왑포인트 계산법', desc: '금리차를 이용한 이론가 산출', tag: 'Pricing', readTime: '10분' },
    { title: '환헷지 전략 가이드', desc: '기업 재무팀을 위한 실무 가이드', tag: 'Strategy', readTime: '15분' },
    { title: 'KIKO 사태의 교훈', desc: '구조화 상품 리스크 이해하기', tag: 'Risk', readTime: '12분' },
    { title: '스테이블코인과 FX', desc: '디지털 자산 시대의 외환 관리', tag: 'Future', readTime: '8분' }
  ];

  return (
    <div>
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl mb-12">
            <p className="text-kustody-accent font-medium mb-3 font-mono text-sm">FX WIKI & INSIGHTS</p>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              외환 지식의 민주화
            </h1>
            <p className="text-lg text-kustody-muted leading-relaxed">
              딜러들만 알던 외환 지식을 누구나 이해할 수 있도록.<br/>
              FX 파생상품의 A to Z를 정리합니다.
            </p>
          </div>

          {/* Featured Article */}
          <div className="mb-12">
            <div className="bg-gradient-to-br from-kustody-accent/10 to-transparent rounded-xl p-6 md:p-10 border border-kustody-accent/20">
              <span className="inline-block px-2.5 py-1 bg-kustody-accent/20 text-kustody-accent text-xs font-medium rounded-full mb-3">
                Featured
              </span>
              <h2 className="text-xl md:text-2xl font-bold mb-3">
                은행 FX 딜러가 알려주는 스왑포인트의 비밀
              </h2>
              <p className="text-kustody-muted mb-4 text-sm max-w-xl">
                왜 같은 날짜에 같은 통화쌍인데 은행마다 가격이 다를까요? 
                스왑포인트의 결정 요인과 은행 마진 구조를 낱낱이 파헤칩니다.
              </p>
              <a href="#" className="inline-flex items-center gap-2 text-kustody-accent font-medium text-sm hover:gap-3 transition-all">
                읽어보기 <span>→</span>
              </a>
            </div>
          </div>

          {/* Wiki Grid */}
          <div className="mb-12">
            <h3 className="text-lg font-bold mb-6">FX 위키</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wikiArticles.map((article, i) => (
                <article key={i} className="bg-kustody-surface/50 rounded-lg p-5 border border-kustody-border hover:border-kustody-accent/30 transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-kustody-accent/10 text-kustody-accent text-xs font-medium rounded">
                      {article.tag}
                    </span>
                    <span className="text-xs text-kustody-muted">{article.readTime} 소요</span>
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{article.title}</h4>
                  <p className="text-xs text-kustody-muted">{article.desc}</p>
                </article>
              ))}
            </div>
          </div>

          {/* Blog Posts */}
          <div>
            <h3 className="text-lg font-bold mb-6">최신 인사이트</h3>
            <div className="space-y-3">
              {[
                { date: '2025.01.15', title: '2025년 원/달러 환율 전망과 기업 헷지 전략', tag: 'Market' },
                { date: '2025.01.08', title: 'BlackRock BUIDL이 Treasury 시장에 미치는 영향', tag: 'RWA' },
                { date: '2024.12.20', title: 'NDF vs DF: 언제 어떤 상품을 써야 할까?', tag: 'Product' }
              ].map((post, i) => (
                <article key={i} className="flex items-center gap-4 p-4 bg-kustody-surface/50 rounded-lg border border-kustody-border hover:border-kustody-accent/30 transition-colors cursor-pointer">
                  <span className="text-xs text-kustody-muted w-20 flex-shrink-0 font-mono">
                    {post.date}
                  </span>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm hover:text-kustody-accent transition-colors">{post.title}</h4>
                  </div>
                  <span className="px-2.5 py-1 bg-kustody-surface text-kustody-muted text-xs rounded-full">
                    {post.tag}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Cases Section
function CasesSection() {
  const cases = [
    {
      company: 'A 무역회사',
      industry: '전자부품 수출',
      problem: '매달 500만 달러 규모의 수출 대금을 환전하면서 은행이 제시하는 스왑 가격을 그대로 수용',
      solution: 'StableFX 계산기로 이론가 확인 후 협상',
      result: '연간 환전 비용 약 1.2억원 절감',
      quote: '이론가를 알고 나니 협상 자체가 달라졌습니다.'
    },
    {
      company: 'B 테크 스타트업',
      industry: 'SaaS',
      problem: '시리즈 B 투자금 $10M을 환전하면서 최적의 타이밍과 가격을 판단하기 어려움',
      solution: '스왑 이론가 기반 환전 전략 수립',
      result: '환전 시점 최적화로 약 3천만원 추가 확보',
      quote: 'CFO로서 숫자에 근거한 의사결정을 할 수 있게 됐습니다.'
    },
    {
      company: 'C 제조업체',
      industry: '자동차 부품',
      problem: '6개월 선물환 헷지 시 은행 간 견적 편차가 커서 최적 선택이 어려움',
      solution: '각 은행 견적 vs 이론가 비교 분석',
      result: '마진 가장 낮은 은행 선별, 연간 8천만원 절감',
      quote: '같은 상품인데 은행마다 이렇게 다른 줄 몰랐습니다.'
    }
  ];

  return (
    <div>
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl mb-12">
            <p className="text-kustody-accent font-medium mb-3 font-mono text-sm">CASE STUDIES</p>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              이론가를 아는 것만으로<br/>
              <span className="bg-gradient-to-r from-kustody-accent to-emerald-400 bg-clip-text text-transparent">
                협상력이 달라집니다
              </span>
            </h1>
            <p className="text-lg text-kustody-muted leading-relaxed">
              StableFX 계산기를 활용해 실제로 비용을 절감한<br/>
              기업들의 사례를 소개합니다.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {[
              { value: '30%', label: '평균 마진 절감' },
              { value: '₩2.3억', label: '총 절감 비용' },
              { value: '47', label: '활용 기업 수' },
              { value: '4.8', label: '만족도 (5점)' }
            ].map((stat, i) => (
              <div key={i} className="text-center p-5 bg-kustody-surface/50 rounded-lg border border-kustody-border">
                <p className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-kustody-accent to-emerald-400 bg-clip-text text-transparent font-mono mb-1">
                  {stat.value}
                </p>
                <p className="text-xs text-kustody-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Case Cards */}
          <div className="space-y-6">
            {cases.map((caseStudy, i) => (
              <article key={i} className="bg-kustody-surface/50 rounded-xl p-6 md:p-8 border border-kustody-border hover:border-kustody-accent/30 transition-colors">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="lg:w-1/3">
                    <span className="inline-block px-2.5 py-1 bg-kustody-accent/10 text-kustody-accent text-xs font-medium rounded-full mb-3">
                      {caseStudy.industry}
                    </span>
                    <h3 className="text-xl font-bold mb-1">{caseStudy.company}</h3>
                    <p className="text-2xl font-bold text-kustody-accent font-mono">
                      {caseStudy.result.match(/[\d,.억천만원]+/)?.[0]}
                    </p>
                    <p className="text-xs text-kustody-muted">절감</p>
                  </div>
                  
                  <div className="lg:w-2/3 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-kustody-muted mb-1">문제</p>
                        <p className="text-xs text-kustody-text">{caseStudy.problem}</p>
                      </div>
                      <div>
                        <p className="text-xs text-kustody-muted mb-1">솔루션</p>
                        <p className="text-xs text-kustody-text">{caseStudy.solution}</p>
                      </div>
                      <div>
                        <p className="text-xs text-kustody-muted mb-1">결과</p>
                        <p className="text-xs text-kustody-text">{caseStudy.result}</p>
                      </div>
                    </div>
                    
                    <blockquote className="border-l-2 border-kustody-accent pl-3 italic text-kustody-muted text-sm">
                      "{caseStudy.quote}"
                    </blockquote>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
