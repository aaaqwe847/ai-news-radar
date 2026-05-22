const state = {itemsAi:[],itemsAll:[],itemsAllRaw:[],statsAi:[],totalAi:0,totalRaw:0,totalAllMode:0,allDedup:true,allDataLoaded:false,allDataUrl:"data/latest-24h-all.json",allDataPromise:null,siteFilter:"",query:"",mode:"ai",waytoagiMode:"today",waytoagiData:null,sourceStatus:null,generatedAt:null};
const statsEl=document.getElementById("stats"),sitePillsEl=document.getElementById("sitePills"),newsListEl=document.getElementById("newsList"),updatedAtEl=document.getElementById("updatedAt"),searchInputEl=document.getElementById("searchInput"),resultCountEl=document.getElementById("resultCount"),listTitleEl=document.getElementById("listTitle"),itemTpl=document.getElementById("itemTpl"),modeAiBtnEl=document.getElementById("modeAiBtn"),modeAllBtnEl=document.getElementById("modeAllBtn"),allDedupeWrapEl=document.getElementById("allDedupeWrap"),allDedupeToggleEl=document.getElementById("allDedupeToggle"),allDedupeLabelEl=document.getElementById("allDedupeLabel"),advancedSummaryEl=document.getElementById("advancedSummary"),sourceHealthEl=document.getElementById("sourceHealth"),waytoagiUpdatedAtEl=document.getElementById("waytoagiUpdatedAt"),waytoagiMetaEl=document.getElementById("waytoagiMeta"),waytoagiListEl=document.getElementById("waytoagiList"),waytoagiTodayBtnEl=document.getElementById("waytoagiTodayBtn"),waytoagi7dBtnEl=document.getElementById("waytoagi7dBtn"),waytoagiBadgeEl=document.getElementById("waytoagiBadge"),coverageStripEl=document.getElementById("coverageStrip");
const SOURCE_KINDS={official_ai:{label:"官方",tone:"official"},aibreakfast:{label:"日报",tone:"newsletter"},followbuilders:{label:"Builders",tone:"builders"},xapi:{label:"X",tone:"builders"},techurls:{label:"AGG",tone:"aggregate"},buzzing:{label:"AGG",tone:"aggregate"},iris:{label:"AGG",tone:"aggregate"},bestblogs:{label:"博客",tone:"blogs"},tophub:{label:"AGG",tone:"aggregate"},zeli:{label:"AGG",tone:"aggregate"},aihubtoday:{label:"AI",tone:"aihub"},aibase:{label:"AI",tone:"aihub"},newsnow:{label:"AGG",tone:"aggregate"}};
function fmtNumber(n){return new Intl.NumberFormat("zh-CN").format(n||0)}
function fmtTime(iso){if(!iso)return"--";const d=new Date(iso);if(Number.isNaN(d.getTime()))return"--";return new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(d)}
function fmtDate(iso){if(!iso)return"--";const d=new Date(iso+"T00:00:00");if(Number.isNaN(d.getTime()))return iso;return new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit"}).format(d)}
function sourceKind(siteId){return SOURCE_KINDS[siteId]||{label:"来源",tone:"default"}}
function siteRows(){return Array.isArray(state.sourceStatus?.sites)?state.sourceStatus.sites:[]}
function siteRow(siteId){return siteRows().find((site)=>site.site_id===siteId)||null}

function setStats(payload){
  const cards=[[fmtNumber(payload.total_items),"条信号"],[fmtNumber(payload.site_count),"个站点"],[fmtNumber(payload.source_count),"个来源"],[fmtNumber(payload.archive_total||0),"条归档"]];
  statsEl.innerHTML="";
  cards.forEach(([v,k])=>{const node=document.createElement("div");node.className="stat-item";node.innerHTML='<span class="stat-value">'+v+'</span><span class="stat-label">'+k+'</span>';statsEl.appendChild(node)});
}
function renderCoverageCard(label,value,tone){
  const node=document.createElement("div");node.className="coverage-card "+(tone||"");
  const val=document.createElement("span");val.className="coverage-value";val.textContent=value;
  const lbl=document.createElement("span");lbl.className="coverage-label";lbl.textContent=label;
  node.append(val,lbl);return node;
}
function renderCoverageStrip(errorMessage){
  if(!coverageStripEl)return;coverageStripEl.innerHTML="";
  const rows=siteRows();const failedSites=Array.isArray(state.sourceStatus?.failed_sites)?state.sourceStatus.failed_sites:[];
  const totalSites=rows.length;const okSites=Number(state.sourceStatus?.successful_sites||0);
  const coverageCount=Number(state.sourceStatus?.fetched_raw_items||state.totalRaw||0);
  const cards=[["源健康",totalSites?fmtNumber(okSites)+"/"+fmtNumber(totalSites):"--",failedSites.length?"warn":"ok"],["覆盖池",fmtNumber(coverageCount)+" 条","signal"],["AI精选",fmtNumber(state.totalAi)+" 条","signal"],["归档",fmtNumber(state.sourceStatus?.archive_total||0),""]];
  cards.forEach((c)=>coverageStripEl.appendChild(renderCoverageCard(c[0],c[1],c[2])));
}
function renderAdvancedSummary(){
  if(!advancedSummaryEl)return;const status=state.sourceStatus;
  if(!status){advancedSummaryEl.textContent="";return}
  const sites=Array.isArray(status.sites)?status.sites:[];const okSites=Number(status.successful_sites||0);
  advancedSummaryEl.textContent=fmtNumber(okSites)+"/"+fmtNumber(sites.length)+" 源可用";
}

function computeSiteStats(items){
  const m=new Map();items.forEach((item)=>{if(!m.has(item.site_id))m.set(item.site_id,{site_id:item.site_id,site_name:item.site_name,count:0,raw_count:0});const row=m.get(item.site_id);row.count+=1;row.raw_count+=1});
  return Array.from(m.values()).sort((a,b)=>b.count-a.count||a.site_name.localeCompare(b.site_name,"zh-CN"));
}
function currentSiteStats(){if(state.mode==="ai")return state.statsAi||[];return computeSiteStats(state.allDedup?(state.itemsAll||[]):(state.itemsAllRaw||[]))}
function renderSiteFilters(){
  const stats=currentSiteStats();sitePillsEl.innerHTML="";
  const allPill=document.createElement("button");allPill.className="pill"+(state.siteFilter===""?" active":"");allPill.textContent="全部";
  allPill.onclick=()=>{state.siteFilter="";renderSiteFilters();renderList()};sitePillsEl.appendChild(allPill);
  stats.forEach((s)=>{const btn=document.createElement("button");btn.className="pill"+(state.siteFilter===s.site_id?" active":"");
  btn.innerHTML=s.site_name+'<span class="pill-count">'+s.count+'</span>';
  btn.onclick=()=>{state.siteFilter=s.site_id;renderSiteFilters();renderList()};sitePillsEl.appendChild(btn)});
}
function renderModeSwitch(){
  modeAiBtnEl.classList.toggle("active",state.mode==="ai");modeAllBtnEl.classList.toggle("active",state.mode==="all");
  if(allDedupeWrapEl)allDedupeWrapEl.classList.toggle("show",state.mode==="all");
  if(allDedupeToggleEl)allDedupeToggleEl.checked=state.allDedup;
  if(allDedupeLabelEl)allDedupeLabelEl.textContent=state.allDedup?"去重开":"去重关";
  renderAdvancedSummary();
}
function effectiveAllItems(){return state.allDedup?state.itemsAll:state.itemsAllRaw}
function modeItems(){return state.mode==="all"?effectiveAllItems():state.itemsAi}
function getFilteredItems(){
  const q=state.query.trim().toLowerCase();
  return modeItems().filter((item)=>{if(state.siteFilter&&item.site_id!==state.siteFilter)return false;if(!q)return true;
  const hay=((item.title||"")+" "+(item.title_zh||"")+" "+(item.title_en||"")+" "+(item.site_name||"")+" "+(item.source||"")).toLowerCase();return hay.includes(q)});
}

function renderItemNode(item){
  const node=itemTpl.content.firstElementChild.cloneNode(true);
  node.classList.add("kind-"+sourceKind(item.site_id).tone);
  node.querySelector(".site-tag").textContent=item.site_name;
  const kind=sourceKind(item.site_id);const categoryEl=node.querySelector(".category-tag");
  categoryEl.textContent=kind.label;categoryEl.classList.add("kind-"+kind.tone);
  node.querySelector(".source-tag").textContent=item.source;
  node.querySelector(".time-tag").textContent=fmtTime(item.published_at||item.first_seen_at);
  const titleEl=node.querySelector(".title-link");const zh=(item.title_zh||"").trim();const en=(item.title_en||"").trim();
  titleEl.textContent="";
  if(zh&&en&&zh!==en){const primary=document.createElement("span");primary.className="title-zh";primary.textContent=zh;
  const sub=document.createElement("span");sub.className="title-en";sub.textContent=en;titleEl.appendChild(primary);titleEl.appendChild(sub)}
  else{titleEl.textContent=item.title||zh||en}
  titleEl.href=item.url;return node;
}
function buildSourceGroupNode(source,items){
  const section=document.createElement("section");section.className="source-group";
  const header=document.createElement("header");header.className="source-group-head";
  const title=document.createElement("h3");title.textContent=source;
  const count=document.createElement("span");count.textContent=fmtNumber(items.length);
  const listEl=document.createElement("div");listEl.className="source-group-list";
  header.append(title,count);section.append(header,listEl);
  items.forEach((item)=>listEl.appendChild(renderItemNode(item)));return section;
}
function groupBySource(items){
  const groupMap=new Map();items.forEach((item)=>{const key=item.source||"--";if(!groupMap.has(key))groupMap.set(key,[]);groupMap.get(key).push(item)});
  return Array.from(groupMap.entries()).sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0],"zh-CN"));
}
function renderGroupedBySource(items){const groups=groupBySource(items);const frag=document.createDocumentFragment();groups.forEach((g)=>frag.appendChild(buildSourceGroupNode(g[0],g[1])));newsListEl.appendChild(frag)}
function renderGroupedBySiteAndSource(items){
  const siteMap=new Map();items.forEach((item)=>{if(!siteMap.has(item.site_id))siteMap.set(item.site_id,{siteName:item.site_name||item.site_id,items:[]});siteMap.get(item.site_id).items.push(item)});
  const sites=Array.from(siteMap.entries()).sort((a,b)=>{const byCount=b[1].items.length-a[1].items.length;if(byCount!==0)return byCount;return a[1].siteName.localeCompare(b[1].siteName,"zh-CN")});
  const frag=document.createDocumentFragment();
  sites.forEach(([,site])=>{const siteSection=document.createElement("section");siteSection.className="site-group";
  const header=document.createElement("header");header.className="site-group-head";
  const title=document.createElement("h3");title.textContent=site.siteName;
  const count=document.createElement("span");count.className="group-count";count.textContent=fmtNumber(site.items.length);
  const siteListEl=document.createElement("div");siteListEl.className="site-group-list";
  header.append(title,count);siteSection.append(header,siteListEl);
  const sourceGroups=groupBySource(site.items);sourceGroups.forEach((g)=>siteListEl.appendChild(buildSourceGroupNode(g[0],g[1])));
  frag.appendChild(siteSection)});
  newsListEl.appendChild(frag);
}
function renderList(){
  const filtered=getFilteredItems();resultCountEl.textContent=fmtNumber(filtered.length);newsListEl.innerHTML="";
  if(!filtered.length){const empty=document.createElement("div");empty.className="empty";empty.textContent="当前筛选条件下没有结果。";newsListEl.appendChild(empty);return}
  if(state.siteFilter){renderGroupedBySource(filtered);return}
  renderGroupedBySiteAndSource(filtered);
}

function waytoagiViews(waytoagi){
  const updates7d=Array.isArray(waytoagi?.updates_7d)?waytoagi.updates_7d:[];
  const latestDate=waytoagi?.latest_date||(updates7d.length?updates7d[0].date:null);
  const updatesToday=Array.isArray(waytoagi?.updates_today)&&waytoagi.updates_today.length?waytoagi.updates_today:(latestDate?updates7d.filter((u)=>u.date===latestDate):[]);
  return{updates7d,updatesToday,latestDate};
}
function renderWaytoagi(waytoagi){
  const{updates7d,updatesToday,latestDate}=waytoagiViews(waytoagi);
  if(waytoagiTodayBtnEl)waytoagiTodayBtnEl.classList.toggle("active",state.waytoagiMode==="today");
  if(waytoagi7dBtnEl)waytoagi7dBtnEl.classList.toggle("active",state.waytoagiMode==="7d");
  if(waytoagiBadgeEl)waytoagiBadgeEl.textContent=fmtNumber(updatesToday.length)+" today / "+fmtNumber(updates7d.length)+" 7d";
  waytoagiUpdatedAtEl.textContent=fmtTime(waytoagi.generated_at);
  waytoagiMetaEl.innerHTML="";
  const rootLink=document.createElement("a");rootLink.href=waytoagi.root_url||"#";rootLink.target="_blank";rootLink.rel="noopener noreferrer";rootLink.textContent="主页面";
  const historyLink=document.createElement("a");historyLink.href=waytoagi.history_url||"#";historyLink.target="_blank";historyLink.rel="noopener noreferrer";historyLink.textContent="历史更新页";
  const todayCount=document.createElement("span");todayCount.textContent="最近更新日("+(latestDate||"--")+"\): "+fmtNumber(updatesToday.length);
  const weekCount=document.createElement("span");weekCount.textContent="7d: "+fmtNumber(updates7d.length);
  [rootLink,"·",historyLink,"·",todayCount,"·",weekCount].forEach((part)=>{if(typeof part==="string"){const sep=document.createElement("span");sep.textContent=part;waytoagiMetaEl.appendChild(sep)}else{waytoagiMetaEl.appendChild(part)}});
  waytoagiListEl.innerHTML="";
  if(waytoagi.has_error){const div=document.createElement("div");div.className="waytoagi-error";div.textContent=waytoagi.error||"Failed to load";waytoagiListEl.appendChild(div);return}
  const updates=state.waytoagiMode==="today"?updatesToday:updates7d;
  if(!updates.length){const div=document.createElement("div");div.className="waytoagi-empty";div.textContent=state.waytoagiMode==="today"?"最近更新日没有更新。":(waytoagi.warning||"近 7 日没有更新");waytoagiListEl.appendChild(div);return}
  updates.forEach((u)=>{const row=document.createElement("a");row.className="waytoagi-item";row.href=u.url||"#";row.target="_blank";row.rel="noopener noreferrer";
  const dateEl=document.createElement("span");dateEl.className="d";dateEl.textContent=fmtDate(u.date);
  const titleEl=document.createElement("span");titleEl.className="t";titleEl.textContent=u.title;
  row.append(dateEl,titleEl);waytoagiListEl.appendChild(row)});
}

function renderMetric(label,value,tone){const node=document.createElement("div");node.className="health-metric "+(tone||"");const labelEl=document.createElement("span");labelEl.className="health-label";labelEl.textContent=label;const valueEl=document.createElement("strong");valueEl.textContent=value;node.append(labelEl,valueEl);return node}
function renderIssueList(title,items){const wrap=document.createElement("div");wrap.className="health-issue";const titleEl=document.createElement("div");titleEl.className="health-issue-title";titleEl.textContent=title;const list=document.createElement("ul");items.slice(0,6).forEach((item)=>{const li=document.createElement("li");li.textContent=typeof item==="string"?item:JSON.stringify(item);list.appendChild(li)});if(items.length>6){const li=document.createElement("li");li.textContent="+"+fmtNumber(items.length-6)+" more";list.appendChild(li)}wrap.append(titleEl,list);return wrap}
function renderSourceHealth(errorMessage){
  if(!sourceHealthEl)return;sourceHealthEl.innerHTML="";const status=state.sourceStatus;
  if(!status){const empty=document.createElement("div");empty.className="health-empty";empty.textContent=errorMessage||"源状态未生成";sourceHealthEl.appendChild(empty);renderAdvancedSummary();return}
  const sites=Array.isArray(status.sites)?status.sites:[];const failedSites=Array.isArray(status.failed_sites)?status.failed_sites:[];const zeroSites=Array.isArray(status.zero_item_sites)?status.zero_item_sites:[];
  const rss=status.rss_opml||{};const agentmail=status.agentmail||{};const xApi=status.x_api||{};
  const failedFeeds=Array.isArray(rss.failed_feeds)?rss.failed_feeds:[];const skippedFeeds=Array.isArray(rss.skipped_feeds)?rss.skipped_feeds:[];const replacedFeeds=Array.isArray(rss.replaced_feeds)?rss.replaced_feeds:[];
  const metricGrid=document.createElement("div");metricGrid.className="health-grid";
  metricGrid.append(renderMetric("内置源",fmtNumber(status.successful_sites||0)+"/"+fmtNumber(sites.length),failedSites.length?"warn":"ok"),renderMetric("RSS",rss.enabled?fmtNumber(rss.ok_feeds||0)+"/"+fmtNumber(rss.effective_feed_total||0):"未启用"),renderMetric("X API",xApi.enabled?(xApi.skipped?"待窗口":fmtNumber(xApi.item_count||0)):"未启用",xApi.error?"bad":""),renderMetric("AgentMail",agentmail.enabled?fmtNumber(agentmail.item_count||0):"未启用",agentmail.error?"bad":""),renderMetric("加载失败",fmtNumber(failedSites.length+failedFeeds.length),(failedSites.length||failedFeeds.length)?"bad":"ok"),renderMetric("替换/跳过",fmtNumber(replacedFeeds.length)+"/"+fmtNumber(skippedFeeds.length)));
  sourceHealthEl.appendChild(metricGrid);const issues=document.createElement("div");issues.className="health-issues";
  if(failedSites.length)issues.appendChild(renderIssueList("失败站点",failedSites));
  if(zeroSites.length)issues.appendChild(renderIssueList("零结果站点",zeroSites));
  if(failedFeeds.length)issues.appendChild(renderIssueList("失败 RSS",failedFeeds));
  if(skippedFeeds.length)issues.appendChild(renderIssueList("跳过 RSS",skippedFeeds.map((item)=>item.feed_url+" . "+(item.reason||"skipped"))));
  if(issues.childElementCount){sourceHealthEl.appendChild(issues)}else{const ok=document.createElement("div");ok.className="health-ok";ok.textContent="源状态正常";sourceHealthEl.appendChild(ok)}
  renderAdvancedSummary();
}

async function loadNewsData(){const res=await fetch("./data/latest-24h.json?t="+Date.now());if(!res.ok)throw new Error("load latest-24h.json failed: "+res.status);return res.json()}
async function loadAllModeData(){if(state.allDataLoaded)return;if(!state.allDataPromise){state.allDataPromise=fetch("./"+state.allDataUrl+"?t="+Date.now()).then((res)=>{if(!res.ok)throw new Error("load all-mode failed: "+res.status);return res.json()}).then((payload)=>{state.itemsAllRaw=payload.items_all_raw||payload.items_all||state.itemsAi;state.itemsAll=payload.items_all||state.itemsAi;state.totalRaw=payload.total_items_raw||state.itemsAllRaw.length;state.totalAllMode=payload.total_items_all_mode||state.itemsAll.length;state.allDataLoaded=true}).catch((err)=>{state.allDataPromise=null;throw err})}return state.allDataPromise}
async function loadWaytoagiData(){const res=await fetch("./data/waytoagi-7d.json?t="+Date.now());if(!res.ok)throw new Error("load waytoagi-7d.json failed: "+res.status);return res.json()}
async function loadSourceStatusData(){const res=await fetch("./data/source-status.json?t="+Date.now());if(!res.ok)throw new Error("load source-status.json failed: "+res.status);return res.json()}
async function init(){
  const[newsResult,waytoagiResult,statusResult]=await Promise.allSettled([loadNewsData(),loadWaytoagiData(),loadSourceStatusData()]);
  if(newsResult.status==="fulfilled"){const payload=newsResult.value;state.itemsAi=payload.items_ai||payload.items||[];state.itemsAllRaw=payload.items_all_raw||payload.items_all||[];state.itemsAll=payload.items_all||[];state.statsAi=payload.site_stats||[];state.totalAi=payload.total_items||state.itemsAi.length;state.totalRaw=payload.total_items_raw||state.itemsAllRaw.length;state.totalAllMode=payload.total_items_all_mode||state.itemsAll.length;state.allDataUrl=payload.all_mode_data_url||state.allDataUrl;state.allDataLoaded=Boolean(payload.items_all||payload.items_all_raw);state.generatedAt=payload.generated_at;setStats(payload);renderModeSwitch();renderCoverageStrip();renderSiteFilters();renderList();updatedAtEl.textContent=fmtTime(state.generatedAt)}
  else{updatedAtEl.textContent="加载失败";newsListEl.innerHTML='<div class="empty">'+newsResult.reason.message+'</div>';renderCoverageStrip(newsResult.reason.message)}
  if(statusResult.status==="fulfilled"){state.sourceStatus=statusResult.value;renderSourceHealth();renderCoverageStrip()}else{renderSourceHealth(statusResult.reason.message);renderCoverageStrip(statusResult.reason.message)}
  if(waytoagiResult.status==="fulfilled"){state.waytoagiData=waytoagiResult.value;renderWaytoagi(state.waytoagiData)}else{waytoagiUpdatedAtEl.textContent="加载失败";waytoagiListEl.innerHTML='<div class="waytoagi-error">'+waytoagiResult.reason.message+'</div>'}
}
searchInputEl.addEventListener("input",(e)=>{state.query=e.target.value;renderList()});
modeAiBtnEl.addEventListener("click",()=>{state.mode="ai";renderModeSwitch();renderSiteFilters();renderList()});
modeAllBtnEl.addEventListener("click",async()=>{state.mode="all";renderModeSwitch();newsListEl.innerHTML="";const loading=document.createElement("div");loading.className="empty";loading.textContent="正在加载全量更新...";newsListEl.appendChild(loading);try{await loadAllModeData();renderSiteFilters();renderList()}catch(err){newsListEl.innerHTML="";const failed=document.createElement("div");failed.className="empty";failed.textContent=err.message;newsListEl.appendChild(failed)}});
if(allDedupeToggleEl){allDedupeToggleEl.addEventListener("change",(e)=>{state.allDedup=Boolean(e.target.checked);renderModeSwitch();renderSiteFilters();renderList()})}
if(waytoagiTodayBtnEl){waytoagiTodayBtnEl.addEventListener("click",()=>{state.waytoagiMode="today";if(state.waytoagiData)renderWaytoagi(state.waytoagiData)})}
if(waytoagi7dBtnEl){waytoagi7dBtnEl.addEventListener("click",()=>{state.waytoagiMode="7d";if(state.waytoagiData)renderWaytoagi(state.waytoagiData)})}
init();
