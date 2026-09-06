/**
 * AgroIndiaMap - High Impact Interactive India Agricultural Map
 * Features:
 * - White technical graph/grid background
 * - Deep emerald land shapes at rest
 * - Razor-thin, crisp hairline borders using vector-effect="non-scaling-stroke"
 * - Radiant ORANGE hover highlight for both States and Zoomed Districts
 * - Smooth cinematic zoom and state isolation
 * - District breakdown with exact West Bengal portal styling
 * - Detailed procurement metrics (Centralized, mCPC, FPO, SHG, Society)
 */

class AgroIndiaMap {
  constructor(containerSelector, options = {}) {
    this.container = typeof containerSelector === 'string'
      ? document.querySelector(containerSelector)
      : containerSelector;
    if (!this.container) {
      console.error(`AgroIndiaMap: Container not found.`);
      return;
    }

    this.options = Object.assign({
      width: 960,
      height: 720,
      initialState: null,
      onStateSelect: null,
      onDistrictSelect: null,
      onBackToIndia: null,
      cdnBaseUrl: "https://raw.githubusercontent.com/guneetnarula/indian-district-boundaries/master/topojson/state-wise/"
    }, options);

    this.currentState = null;
    this.currentDistrict = null;
    this.isZoomed = false;
    this.isCardPinned = false;
    this.pinnedDistrict = null;

    this.init();
  }

  async init() {
    this.buildDOM();
    this.initD3();
    await this.loadIndiaData();
    this.renderIndia();
    this.updateStats();

    if (this.options.initialState) {
      this.selectStateByName(this.options.initialState, false);
    }
  }

  buildDOM() {
    this.container.classList.add("agro-map-wrapper");
    this.container.innerHTML = `
      <div class="agro-header">
        <div class="agro-title-badge">
          <span class="pulse-dot"></span>
          <span>Agricultural Procurement Network</span>
        </div>
        <h2 class="agro-main-title" id="agro-map-title">Select State to explore Agricultural Procurement</h2>
        <p class="agro-subtitle" id="agro-map-subtitle">Click on any state to view district-level procurement centres and procurement reports</p>
      </div>

      <div class="agro-toolbar">
        <div class="agro-breadcrumbs">
          <span class="agro-breadcrumb-item active" id="crumb-india">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            India
          </span>
          <span class="agro-breadcrumb-sep" id="crumb-sep" style="display:none;">/</span>
          <span class="agro-breadcrumb-item" id="crumb-state" style="display:none;"></span>
          <span class="agro-breadcrumb-sep" id="crumb-dist-sep" style="display:none;">/</span>
          <span class="agro-breadcrumb-item" id="crumb-district" style="display:none;"></span>
        </div>

        <div class="agro-actions">
          <select class="agro-select" id="agro-state-selector">
            <option value="">Jump to State...</option>
          </select>
          <button class="agro-btn agro-btn-primary agro-btn-back" id="agro-btn-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back to India
          </button>
        </div>
      </div>

      <div class="agro-map-stage" id="agro-stage">
        <svg class="agro-svg" id="agro-svg" viewBox="0 0 ${this.options.width} ${this.options.height}"></svg>
        
        <!-- Hover Tooltip for State Overview -->
        <div class="agro-state-tooltip" id="agro-tooltip"></div>

        <!-- Floating Procurement Card -->
        <div class="agro-procurement-card" id="agro-card">
          <div class="agro-card-header">
            <h4 class="agro-card-title" id="card-district-name">DISTRICT NAME</h4>
            <button class="agro-card-close" id="card-close-btn" title="Close">&times;</button>
          </div>
          <ul class="agro-card-list">
            <li class="agro-card-row">
              <span class="agro-card-label">Centralized procurement centre :</span>
              <span class="agro-card-value" id="card-centralized">0</span>
            </li>
            <li class="agro-card-row">
              <span class="agro-card-label">Mobile purchase center mCPC :</span>
              <span class="agro-card-value" id="card-mcpc">0</span>
            </li>
            <li class="agro-card-row">
              <span class="agro-card-label">Purchase centres run by FPO's/ FPC :</span>
              <span class="agro-card-value" id="card-fpo">0</span>
            </li>
            <li class="agro-card-row">
              <span class="agro-card-label">Purchase centres run by SHG :</span>
              <span class="agro-card-value" id="card-shg">0</span>
            </li>
            <li class="agro-card-row">
              <span class="agro-card-label">Purchase centre run by Society :</span>
              <span class="agro-card-value" id="card-society">0</span>
            </li>
          </ul>
          <div class="agro-card-footer">
            <span>Total Centres: <strong class="stat-pill" id="card-total-centres">0</strong></span>
            <span>Procured: <strong class="stat-pill" id="card-procured">0 MT</strong></span>
          </div>
        </div>

        <!-- Loading Overlay -->
        <div class="agro-loading" id="agro-loader" style="display:none;">
          <div class="agro-spinner"></div>
          <span id="agro-loader-text">Loading district data...</span>
        </div>
      </div>

      <!-- Bottom Statistics Dashboard -->
      <div class="agro-stats-bar">
        <div class="agro-stat-item">
          <span class="agro-stat-title">Centralized Centres</span>
          <span class="agro-stat-num" id="stat-centralized">--</span>
          <span class="agro-stat-desc">Permanent mandis</span>
        </div>
        <div class="agro-stat-item">
          <span class="agro-stat-title">Mobile Centres (mCPC)</span>
          <span class="agro-stat-num" id="stat-mcpc">--</span>
          <span class="agro-stat-desc">Farm-gate outreach</span>
        </div>
        <div class="agro-stat-item accent-gold">
          <span class="agro-stat-title">SHG / FPO Centres</span>
          <span class="agro-stat-num" id="stat-shg-fpo">--</span>
          <span class="agro-stat-desc">Community operated</span>
        </div>
        <div class="agro-stat-item">
          <span class="agro-stat-title">Agri Societies (PACS)</span>
          <span class="agro-stat-num" id="stat-society">--</span>
          <span class="agro-stat-desc">Primary credit societies</span>
        </div>
        <div class="agro-stat-item">
          <span class="agro-stat-title">Total Procured (KMS)</span>
          <span class="agro-stat-num" id="stat-procured">--</span>
          <span class="agro-stat-desc">Certified procurement</span>
        </div>
      </div>
    `;

    // DOM Elements
    this.stage = this.container.querySelector("#agro-stage");
    this.svg = d3.select(this.container.querySelector("#agro-svg"));
    this.tooltip = this.container.querySelector("#agro-tooltip");
    this.card = this.container.querySelector("#agro-card");
    this.loader = this.container.querySelector("#agro-loader");
    this.loaderText = this.container.querySelector("#agro-loader-text");
    this.btnBack = this.container.querySelector("#agro-btn-back");
    this.stateSelector = this.container.querySelector("#agro-state-selector");
    this.title = this.container.querySelector("#agro-map-title");
    this.subtitle = this.container.querySelector("#agro-map-subtitle");

    // Breadcrumb elements
    this.crumbIndia = this.container.querySelector("#crumb-india");
    this.crumbSep = this.container.querySelector("#crumb-sep");
    this.crumbState = this.container.querySelector("#crumb-state");
    this.crumbDistSep = this.container.querySelector("#crumb-dist-sep");
    this.crumbDistrict = this.container.querySelector("#crumb-district");

    // Event listeners
    this.btnBack.addEventListener("click", () => {
      this.zoomOutToIndia();
      if (this.options.onBackToIndia) this.options.onBackToIndia();
    });
    this.crumbIndia.addEventListener("click", () => {
      this.zoomOutToIndia();
      if (this.options.onBackToIndia) this.options.onBackToIndia();
    });
    this.crumbState.addEventListener("click", () => {
      if (this.isCardPinned) this.unpinCard();
    });

    this.container.querySelector("#card-close-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.unpinCard();
    });

    this.stateSelector.addEventListener("change", (e) => {
      if (e.target.value) {
        this.selectStateByName(e.target.value);
      } else {
        this.zoomOutToIndia();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.isCardPinned) {
          this.unpinCard();
        } else if (this.isZoomed) {
          this.zoomOutToIndia();
        }
      }
    });
  }

  initD3() {
    this.width = this.options.width;
    this.height = this.options.height;

    this.svgGroup = this.svg.append("g").attr("class", "agro-main-group");
    this.indiaGroup = this.svgGroup.append("g").attr("class", "agro-india-group");
    this.districtsGroup = this.svgGroup.append("g").attr("class", "agro-districts-group");
    this.effectsGroup = this.svgGroup.append("g").attr("class", "agro-effects-group");

    this.projection = d3.geoMercator();
    this.pathGenerator = d3.geoPath().projection(this.projection);
  }

  async loadIndiaData() {
    this.showLoader("Loading map boundaries...");
    try {
      if (window.AGRO_MAP_EMBEDDED && window.AGRO_MAP_EMBEDDED.indiaStates) {
        this.indiaGeojson = window.AGRO_MAP_EMBEDDED.indiaStates;
      } else {
        const res = await fetch("/data/india-states.optimized.json");
        this.indiaGeojson = await res.json();
      }

      const states = this.indiaGeojson.features
        .map(f => f.properties.ST_NM || f.properties.st_nm || f.properties.NAME_1)
        .filter(Boolean)
        .sort();

      this.stateSelector.innerHTML = `<option value="">Jump to State...</option>` +
        states.map(s => `<option value="${s}">${s}</option>`).join("");

    } catch (err) {
      console.error("Failed to load India states GeoJSON:", err);
    } finally {
      this.hideLoader();
    }
  }

  renderIndia() {
    if (!this.indiaGeojson) return;

    this.projection.fitExtent(
      [[35, 30], [this.width - 35, this.height - 30]],
      this.indiaGeojson
    );

    const self = this;

    // Render States with non-scaling crisp hairline strokes
    this.statePaths = this.indiaGroup
      .selectAll(".state-path")
      .data(this.indiaGeojson.features)
      .enter()
      .append("path")
      .attr("class", "state-path")
      .attr("d", this.pathGenerator)
      .attr("vector-effect", "non-scaling-stroke")
      .attr("data-name", d => d.properties.ST_NM || d.properties.st_nm)
      .on("mouseover", function(event, d) {
        if (self.isZoomed) return;
        const stateName = d.properties.ST_NM || d.properties.st_nm;
        
        // Turn vibrant ORANGE on hover with clean thin boundary
        d3.select(this)
          .classed("hovered", true)
          .style("fill", "var(--agro-accent-gold)")
          .style("stroke", "var(--agro-accent-stroke)");

        const stateStats = window.AGRO_PROCUREMENT_DATA 
          ? window.AGRO_PROCUREMENT_DATA.getStateData(stateName)
          : null;

        let tooltipHTML = `<strong>${stateName}</strong>`;
        if (stateStats) {
          tooltipHTML += `
            <div>Districts: ${stateStats.districtsCount}</div>
            <div>Active Mandis: ${stateStats.totalCentralized + stateStats.totalMcpc}</div>
            <div style="color:var(--agro-accent-gold);font-size:11px;margin-top:2px;">Click to view district report &rarr;</div>
          `;
        }
        self.tooltip.innerHTML = tooltipHTML;
        self.tooltip.classList.add("visible");
      })
      .on("mousemove", function(event) {
        if (self.isZoomed) return;
        const [x, y] = d3.pointer(event, self.stage);
        if (self.tooltipRaf) cancelAnimationFrame(self.tooltipRaf);
        self.tooltipRaf = requestAnimationFrame(() => {
          self.tooltip.style.left = `${x + 15}px`;
          self.tooltip.style.top = `${y - 20}px`;
        });
      })
      .on("mouseout", function() {
        if (self.isZoomed) return;
        d3.select(this)
          .classed("hovered", false)
          .style("fill", null)
          .style("stroke", null);
        self.tooltip.classList.remove("visible");
      })
      .on("click", function(event, d) {
        const stateName = d.properties.ST_NM || d.properties.st_nm;
        const [clickX, clickY] = d3.pointer(event, self.svgGroup.node());
        self.zoomToState(d, stateName, clickX, clickY);
      });
  }

  /**
   * Cinematic Zoom into a State
   */
  async zoomToState(stateFeature, stateName, clickX = null, clickY = null, triggerCallback = true) {
    if (this.isZoomed && this.currentState === stateName) return;

    this.isZoomed = true;
    this.currentState = stateName;
    this.tooltip.classList.remove("visible");
    this.unpinCard();

    // Trigger radar pulse ripple at click coordinate
    if (clickX !== null && clickY !== null) {
      this.effectsGroup.selectAll(".ripple-circle").remove();
      this.effectsGroup.append("circle")
        .attr("class", "ripple-circle")
        .attr("cx", clickX)
        .attr("cy", clickY)
        .attr("r", 12);
    }

    // 1. Highlight and isolate selected state: Dim all other states
    this.statePaths
      .classed("is-selected", d => (d.properties.ST_NM || d.properties.st_nm) === stateName)
      .classed("is-dimmed", d => (d.properties.ST_NM || d.properties.st_nm) !== stateName);

    // 2. Compute Bounding Box of selected state in current projection
    const bounds = this.pathGenerator.bounds(stateFeature);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    const scale = Math.max(1, Math.min(10, 0.78 / Math.max(dx / this.width, dy / this.height)));
    const translateX = this.width / 2 - scale * x;
    const translateY = this.height / 2 - scale * y;

    // 3. Smooth dramatic camera zoom transition (250-500ms per target UX)
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const zoomDuration = prefersReducedMotion ? 0 : 400;
    this.svgGroup.transition()
      .duration(zoomDuration)
      .ease(d3.easeCubicInOut)
      .attr("transform", `translate(${translateX}, ${translateY}) scale(${scale})`);

    // 4. Update Header and Navigation
    this.title.textContent = "Select District to see the report";
    this.subtitle.textContent = `Showing all administrative districts and procurement points for ${stateName}`;
    this.btnBack.classList.add("visible");
    this.stateSelector.value = stateName;

    // Breadcrumbs
    this.crumbIndia.classList.remove("active");
    this.crumbSep.style.display = "inline";
    this.crumbState.style.display = "inline";
    this.crumbState.textContent = stateName;
    this.crumbState.classList.add("active");
    this.crumbDistSep.style.display = "none";
    this.crumbDistrict.style.display = "none";

    // 5. Load & render district boundaries for this state
    await this.renderDistrictsForState(stateName, stateFeature, scale);

    // 6. Update macro statistics to this state
    this.updateStats(stateName);

    if (triggerCallback && this.options.onStateSelect) {
      this.options.onStateSelect(stateName);
    }
  }

  /**
   * Fetch/retrieve district TopoJSON and render with razor-thin borders
   */
  async renderDistrictsForState(stateName, stateFeature, parentScale) {
    this.districtsGroup.selectAll("*").remove();
    this.districtsGroup.style("opacity", 0);

    const norm = (s) => (s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
    const target = norm(stateName);

    const topoData = await this.getStateTopoData(stateName);
    // Guard against race conditions during rapid state switching
    if (this.currentState !== stateName) return;

    if (!topoData) {
      console.warn(`District boundary data not available for ${stateName}`);
      // Ensure the selected state path remains clearly visible and styled
      this.statePaths
        .filter(d => {
          const n = norm(d.properties.ST_NM || d.properties.st_nm || d.properties.NAME_1);
          return n === target || n.includes(target) || target.includes(n);
        })
        .transition()
        .duration(300)
        .style("opacity", 1)
        .style("fill", "var(--agro-land-fill)")
        .style("stroke", "var(--agro-accent-gold)")
        .style("stroke-width", "1.5px");
      return;
    }

    try {
      const objKey = Object.keys(topoData.objects)[0];
      const districtsGeo = topojson.feature(topoData, topoData.objects[objKey]);

      if (!districtsGeo || !districtsGeo.features || districtsGeo.features.length === 0) {
        this.statePaths
          .filter(d => {
            const n = norm(d.properties.ST_NM || d.properties.st_nm || d.properties.NAME_1);
            return n === target || n.includes(target) || target.includes(n);
          })
          .style("opacity", 1);
        return;
      }

      const self = this;

      // Render District Polygons with non-scaling hairline strokes
      this.districtsGroup
        .selectAll(".district-path")
        .data(districtsGeo.features)
        .enter()
        .append("path")
        .attr("class", "district-path")
        .attr("d", this.pathGenerator)
        .attr("vector-effect", "non-scaling-stroke")
        .on("mouseover", function(event, d) {
          if (self.isCardPinned) return;
          self.highlightDistrict(d3.select(this), d, stateName, event);
        })
        .on("mousemove", function(event) {
          if (self.isCardPinned) return;
          self.positionCard(event);
        })
        .on("mouseout", function() {
          if (self.isCardPinned) return;
          self.unhighlightDistrict(d3.select(this));
        })
        .on("click", function(event, d) {
          event.stopPropagation();
          self.pinDistrict(d3.select(this), d, stateName, event);
        });

      // Cross-fade: State boundary hides, districts fade in smoothly
      const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fadeOutDuration = prefersReducedMotion ? 0 : 250;
      const fadeInDuration = prefersReducedMotion ? 0 : 350;

      this.statePaths
        .filter(d => {
          const n = norm(d.properties.ST_NM || d.properties.st_nm || d.properties.NAME_1);
          return n === target || n.includes(target) || target.includes(n);
        })
        .transition()
        .duration(fadeOutDuration)
        .style("opacity", 0);

      this.districtsGroup
        .transition()
        .duration(fadeInDuration)
        .style("opacity", 1);

    } catch (err) {
      console.error(`Error rendering districts for ${stateName}:`, err);
      this.statePaths
        .filter(d => {
          const n = norm(d.properties.ST_NM || d.properties.st_nm || d.properties.NAME_1);
          return n === target || n.includes(target) || target.includes(n);
        })
        .style("opacity", 1);
    }
  }

  highlightDistrict(selection, d, stateName, event) {
    const dName = d.properties.district || d.properties.NAME_2 || d.properties.dt_name || "District";
    
    // Clean, razor-sharp orange highlight matching reference
    selection
      .classed("highlighted", true)
      .style("fill", "var(--agro-accent-gold)")
      .style("stroke", "var(--agro-accent-stroke)");

    const data = window.AGRO_PROCUREMENT_DATA 
      ? window.AGRO_PROCUREMENT_DATA.getDistrictData(stateName, dName)
      : null;

    this.populateCard(data, dName);
    this.positionCard(event);
    this.card.classList.add("visible");
  }

  unhighlightDistrict(selection) {
    selection
      .classed("highlighted", false)
      .style("fill", null)
      .style("stroke", null);
    this.card.classList.remove("visible");
  }

  pinDistrict(selection, d, stateName, event) {
    const dName = d.properties.district || d.properties.NAME_2 || d.properties.dt_name || "District";
    
    this.districtsGroup.selectAll(".district-path")
      .classed("highlighted", false)
      .style("fill", null)
      .style("stroke", null);

    selection
      .classed("highlighted", true)
      .style("fill", "var(--agro-accent-gold)")
      .style("stroke", "var(--agro-accent-stroke)");

    const data = window.AGRO_PROCUREMENT_DATA 
      ? window.AGRO_PROCUREMENT_DATA.getDistrictData(stateName, dName)
      : null;

    this.isCardPinned = true;
    this.pinnedDistrict = dName;
    this.card.classList.add("pinned");
    this.populateCard(data, dName);
    this.positionCard(event);
    this.card.classList.add("visible");

    // Update breadcrumbs
    this.crumbDistSep.style.display = "inline";
    this.crumbDistrict.style.display = "inline";
    this.crumbDistrict.textContent = dName;
    this.crumbDistrict.classList.add("active");

    if (this.options.onDistrictSelect) {
      this.options.onDistrictSelect(data || { name: dName });
    }
  }

  unpinCard() {
    this.isCardPinned = false;
    this.pinnedDistrict = null;
    this.card.classList.remove("pinned");
    this.card.classList.remove("visible");
    this.crumbDistSep.style.display = "none";
    this.crumbDistrict.style.display = "none";

    this.districtsGroup.selectAll(".district-path")
      .classed("highlighted", false)
      .style("fill", null)
      .style("stroke", null);
  }

  populateCard(data, districtName) {
    const dTitle = districtName.toUpperCase() + (districtName.toUpperCase().includes("DISTRICT") ? "" : " DISTRICT");
    this.container.querySelector("#card-district-name").textContent = dTitle;

    if (data) {
      this.container.querySelector("#card-centralized").textContent = data.centralized;
      this.container.querySelector("#card-mcpc").textContent = data.mcpc;
      this.container.querySelector("#card-fpo").textContent = data.fpo;
      this.container.querySelector("#card-shg").textContent = data.shg;
      this.container.querySelector("#card-society").textContent = data.society;

      const total = data.centralized + data.mcpc + data.fpo + data.shg + data.society;
      this.container.querySelector("#card-total-centres").textContent = total;
      this.container.querySelector("#card-procured").textContent = data.paddyProcuredMT || "--";
    }
  }

  positionCard(event) {
    const [x, y] = d3.pointer(event, this.stage);
    if (this.cardRaf) cancelAnimationFrame(this.cardRaf);
    this.cardRaf = requestAnimationFrame(() => {
      const cardWidth = 320;
      const cardHeight = 260;
      const stageWidth = this.stageWidth || (this.stageWidth = this.stage.clientWidth);
      const stageHeight = this.stageHeight || (this.stageHeight = this.stage.clientHeight);

      let posX = x + 20;
      let posY = y - 30;

      if (posX + cardWidth > stageWidth - 20) {
        posX = x - cardWidth - 20;
      }
      if (posY + cardHeight > stageHeight - 20) {
        posY = stageHeight - cardHeight - 20;
      }
      if (posY < 20) posY = 20;

      this.card.style.left = `${posX}px`;
      this.card.style.top = `${posY}px`;
    });
  }

  /**
   * Reverse Zoom smoothly back to India Overview
   */
  zoomOutToIndia(triggerCallback = true) {
    if (!this.isZoomed) return;

    this.isZoomed = false;
    this.currentState = null;
    this.unpinCard();
    this.tooltip.classList.remove("visible");

    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fadeDuration = prefersReducedMotion ? 0 : 200;
    const zoomDuration = prefersReducedMotion ? 0 : 350;

    // 1. Fade out districts
    this.districtsGroup
      .transition()
      .duration(fadeDuration)
      .style("opacity", 0)
      .remove();

    this.districtsGroup = this.svgGroup.append("g").attr("class", "agro-districts-group");

    // 2. Restore State paths
    this.statePaths
      .classed("is-selected", false)
      .classed("is-dimmed", false)
      .classed("hovered", false)
      .transition()
      .duration(fadeDuration)
      .style("opacity", 1)
      .style("fill", null)
      .style("stroke", null);

    // 3. Smooth Camera Zoom-out to identity (350ms)
    this.svgGroup.transition()
      .duration(zoomDuration)
      .ease(d3.easeCubicInOut)
      .attr("transform", "translate(0, 0) scale(1)");

    // 4. Update Header and UI
    this.title.textContent = "Select State to explore Agricultural Procurement";
    this.subtitle.textContent = "Click on any state to view district-level procurement centres and procurement reports";
    this.btnBack.classList.remove("visible");
    this.stateSelector.value = "";

    // Breadcrumbs
    this.crumbIndia.classList.add("active");
    this.crumbSep.style.display = "none";
    this.crumbState.style.display = "none";
    this.crumbDistSep.style.display = "none";
    this.crumbDistrict.style.display = "none";

    // 5. Reset stats to national totals
    this.updateStats();

    if (triggerCallback && this.options.onBackToIndia) {
      this.options.onBackToIndia();
    }
  }

  /**
   * Get TopoJSON data for state, checking embedded cache or fetching
   */
  async getStateTopoData(stateName) {
    const slug = (stateName || "").toLowerCase().replace(/[^a-z]/g, "");
    const SLUG_ALIASES = {
      dadraandnagarhavelianddamananddiu: "dadranagarhaveli"
    };
    const fileSlug = SLUG_ALIASES[slug] || slug;

    // 0. Check in-memory session cache for instant (0ms) return trips
    if (!this.topoCache) this.topoCache = new Map();
    if (this.topoCache.has(slug)) {
      return this.topoCache.get(slug);
    }
    if (this.topoCache.has(fileSlug)) {
      return this.topoCache.get(fileSlug);
    }

    // 1. Check embedded cache
    if (window.AGRO_MAP_EMBEDDED && window.AGRO_MAP_EMBEDDED.stateTopo) {
      if (window.AGRO_MAP_EMBEDDED.stateTopo[stateName]) {
        const data = window.AGRO_MAP_EMBEDDED.stateTopo[stateName];
        this.topoCache.set(slug, data);
        this.topoCache.set(fileSlug, data);
        return data;
      }
      const foundKey = Object.keys(window.AGRO_MAP_EMBEDDED.stateTopo).find(
        k => k.toLowerCase().replace(/[^a-z]/g, "") === slug || k.toLowerCase().replace(/[^a-z]/g, "") === fileSlug
      );
      if (foundKey) {
        const data = window.AGRO_MAP_EMBEDDED.stateTopo[foundKey];
        this.topoCache.set(slug, data);
        this.topoCache.set(fileSlug, data);
        return data;
      }
    }

    // 2. Check local static file in /data/
    try {
      const localRes = await fetch(`/data/${fileSlug}.json`);
      if (localRes.ok) {
        const ct = localRes.headers.get("content-type");
        if (!ct || ct.includes("json")) {
          const data = await localRes.json();
          if (data && data.objects) {
            this.topoCache.set(slug, data);
            this.topoCache.set(fileSlug, data);
            return data;
          }
        }
      }
    } catch (e) {}

    // 3. Fallback to external CDN
    this.showLoader(`Loading ${stateName} districts...`);
    try {
      const cdnRes = await fetch(`${this.options.cdnBaseUrl}${fileSlug}.json`);
      if (cdnRes.ok) {
        const ct = cdnRes.headers.get("content-type");
        if (!ct || ct.includes("json")) {
          const data = await cdnRes.json();
          if (data && data.objects) {
            this.topoCache.set(slug, data);
            this.topoCache.set(fileSlug, data);
            return data;
          }
        }
      }
    } catch (err) {
      console.warn(`District TopoJSON not reachable for ${stateName}:`, err);
    } finally {
      this.hideLoader();
    }

    return null;
  }

  getCurrentState() {
    return this.currentState;
  }

  isStateZoomed() {
    return this.isZoomed;
  }

  selectStateByName(stateName, triggerCallback = true) {
    if (!this.indiaGeojson || !stateName) return;
    const norm = (s) => (s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
    const target = norm(stateName);
    const feature = this.indiaGeojson.features.find(f => {
      const name = norm(f.properties.ST_NM || f.properties.st_nm || f.properties.NAME_1);
      return name === target || name.includes(target) || target.includes(name);
    });

    if (feature) {
      this.zoomToState(
        feature,
        feature.properties.ST_NM || feature.properties.st_nm || stateName,
        null,
        null,
        triggerCallback
      );
    }
  }

  updateStats(stateName = null) {
    let centralized = 0;
    let mcpc = 0;
    let shgFpo = 0;
    let society = 0;
    let procured = "14,820,000 MT";

    if (stateName && window.AGRO_PROCUREMENT_DATA) {
      const s = window.AGRO_PROCUREMENT_DATA.getStateData(stateName);
      if (s) {
        centralized = s.totalCentralized || 0;
        mcpc = s.totalMcpc || 0;
        shgFpo = (s.totalShg || 0) + (s.totalFpo || 0);
        society = s.totalSociety || 0;
        procured = s.totalProcuredMT || "0 MT";
      }
    } else if (window.AGRO_PROCUREMENT_DATA) {
      centralized = 3450;
      mcpc = 980;
      shgFpo = 4200;
      society = 5820;
      procured = "54,200,000 MT";
    }

    this.animateCounter("#stat-centralized", centralized);
    this.animateCounter("#stat-mcpc", mcpc);
    this.animateCounter("#stat-shg-fpo", shgFpo);
    this.animateCounter("#stat-society", society);
    const procEl = this.container.querySelector("#stat-procured");
    if (procEl) procEl.textContent = procured;
  }

  animateCounter(selector, targetVal) {
    const el = this.container.querySelector(selector);
    if (!el) return;
    const startVal = parseInt(el.textContent.replace(/[^0-9]/g, "")) || 0;
    const duration = 600;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const current = Math.round(startVal + (targetVal - startVal) * progress);
      el.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  showLoader(text = "Loading...") {
    if (this.loader) {
      this.loaderText.textContent = text;
      this.loader.style.display = "flex";
    }
  }

  hideLoader() {
    if (this.loader) {
      this.loader.style.display = "none";
    }
  }

  destroy() {
    if (this.tooltipRaf) cancelAnimationFrame(this.tooltipRaf);
    if (this.cardRaf) cancelAnimationFrame(this.cardRaf);
    if (this.container) {
      this.container.innerHTML = "";
      this.container.classList.remove("agro-map-wrapper");
    }
  }
}

window.AgroIndiaMap = AgroIndiaMap;
