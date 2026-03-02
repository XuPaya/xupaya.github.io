/* ================================================================
   Equal-Time Comparison — Interactive Viewer
   ================================================================

   Compares optimization progress of multiple methods at equal
   wall-clock time with a split-view canvas and PSNR chart.

   Dependencies: Expects DOM elements defined in index.html.
   Configuration is read from the EQTIME_METHODS array set on
   window before this script loads.
*/

(function () {
  "use strict";

  // ── Configuration ───────────────────────────────────────────────
  // window.EQTIME_METHODS is defined in index.html for easy editing.
  var METHODS    = window.EQTIME_METHODS;
  var NUM_FRAMES = 60;
  var MAX_TIME   = 3500;     // seconds — restrict playback to this
  var START_TIME = 200;      // seconds — initial / loop-reset time
  var DIAG       = 5;        // diagonal offset for clip-path (%)

  var STEPS = [];
  for (var k = 0; k < NUM_FRAMES; k++) STEPS.push((k + 1) * 500);

  var BLANK =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  // ── State ───────────────────────────────────────────────────────
  var curTime   = START_TIME;
  var playing   = false;
  var speed     = 1000;
  var lastTS    = null;
  var h0        = 50;

  // ── DOM refs ────────────────────────────────────────────────────
  var canvas     = document.getElementById("eqtCanvas");
  var imgs       = [document.getElementById("eqtImg0"),
                    document.getElementById("eqtImg1")];
  var nfs        = [document.getElementById("eqtNF0"),
                    document.getElementById("eqtNF1")];
  var badges     = [document.getElementById("eqtBadge0"),
                    document.getElementById("eqtBadge1")];
  var handles    = [document.getElementById("eqtH0")];
  var slider     = document.getElementById("eqtSlider");
  var timeDisp   = document.getElementById("eqtTime");
  var playBtn    = document.getElementById("eqtPlay");
  var methodsCont = document.getElementById("eqtMethods");

  // ── Image cache ─────────────────────────────────────────────────
  var imgCache   = {};
  var prevFrames = [-2, -2];

  function imgPath(mi, fi) {
    return (
      "stochGRT_results/eqtime_anim/" +
      METHODS[mi].key +
      "/bonsai_eval_" +
      STEPS[fi] +
      ".png"
    );
  }

  function preload(src) {
    if (!imgCache[src]) {
      var im = new Image();
      im.src = src;
      imgCache[src] = im;
    }
  }

  // ── Build per-method progress cards ─────────────────────────────
  METHODS.forEach(function (m, i) {
    var card = document.createElement("div");
    card.className = "eqt-method-card";
    card.innerHTML =
      '<div class="mc-head">' +
        '<div class="mc-dot" style="background:' + m.color + '"></div>' +
        '<div class="mc-name">' + m.label + "</div>" +
      "</div>" +
      '<div class="mc-bar">' +
        '<div class="mc-bar-fill" id="eqtBar' + i + '" style="background:' + m.color + '"></div>' +
      "</div>" +
      '<div class="mc-stats" id="eqtStats' + i + '">\u2014</div>';
    methodsCont.appendChild(card);
  });

  // ── Helpers ─────────────────────────────────────────────────────

  function getFrameIndex(mi, t) {
    var times = METHODS[mi].times;
    var idx = -1;
    for (var i = 1; i < times.length; i++) {
      if (times[i] <= t) idx = i - 1;
      else break;
    }
    return idx;
  }

  function updateClips() {
    imgs[0].style.clipPath = "inset(0 " + (100 - h0) + "% 0 0)";
    nfs[0].style.clipPath  = "inset(0 " + (100 - h0) + "% 0 0)";
    imgs[1].style.clipPath = "inset(0 0 0 " + h0 + "%)";
    nfs[1].style.clipPath  = "inset(0 0 0 " + h0 + "%)";

    handles[0].style.left  = h0 + "%";
    handles[0].style.width = "3px";

    badges[0].style.left      = h0 / 2 + "%";
    badges[0].style.transform = "translateX(-50%)";
    badges[1].style.left      = (h0 + 100) / 2 + "%";
    badges[1].style.transform = "translateX(-50%)";
  }

  // ── Render ──────────────────────────────────────────────────────

  function render() {
    METHODS.forEach(function (m, i) {
      var fi = getFrameIndex(i, curTime);

      if (fi >= 0) {
        if (prevFrames[i] !== fi) {
          imgs[i].src = imgPath(i, fi);
          prevFrames[i] = fi;
          if (fi + 1 < NUM_FRAMES) preload(imgPath(i, fi + 1));
          if (fi + 2 < NUM_FRAMES) preload(imgPath(i, fi + 2));
        }
        nfs[i].classList.add("hidden");
      } else {
        imgs[i].src = BLANK;
        nfs[i].classList.remove("hidden");
        prevFrames[i] = -1;
      }

      var step  = fi >= 0 ? STEPS[fi] : 0;
      var psnr  = fi >= 0 ? m.psnrs[fi].toFixed(2) : "\u2014";
      var mTime = fi >= 0 ? m.times[fi + 1] : 0;

      badges[i].innerHTML =
        '<div class="b-label" style="color:' + m.color + '">' + m.label + "</div>" +
        '<div>Iter ' + step.toLocaleString() +
        ' &middot; <span class="b-psnr">' +
        (fi >= 0 ? psnr + " dB" : "\u2014") +
        "</span></div>";

      var bar      = document.getElementById("eqtBar" + i);
      var stats    = document.getElementById("eqtStats" + i);
      var progress = fi >= 0 ? (fi + 1) / NUM_FRAMES * 100 : 0;
      bar.style.width = progress + "%";

      var maxT = m.times[m.times.length - 1];
      if (fi < 0) {
        stats.textContent =
          "Waiting\u2026 (first eval at " + m.times[1].toFixed(0) + "s)";
      } else if (curTime >= maxT && fi === NUM_FRAMES - 1) {
        stats.textContent =
          "\u2713 Complete \u00b7 Iter " + step.toLocaleString() +
          " \u00b7 " + psnr + " dB \u00b7 " + mTime.toFixed(0) + "s";
      } else {
        stats.textContent =
          "Iter " + step.toLocaleString() +
          " \u00b7 " + psnr + " dB \u00b7 " +
          mTime.toFixed(0) + "s / " + maxT.toFixed(0) + "s";
      }
    });

    slider.value = curTime;
    var pct = (curTime / MAX_TIME) * 100;
    slider.style.background =
      "linear-gradient(to right, var(--c-primary) " + pct + "%, #e2e8f0 " + pct + "%)";
    timeDisp.textContent = curTime.toFixed(1) + "s";
    updateClips();
    updateChart();
  }

  // ── PSNR Chart ──────────────────────────────────────────────────

  var chartSx, chartSy;
  var chartMl = 52, chartMr = 12, chartMt = 15, chartMb = 35;
  var chartPw = 400 - chartMl - chartMr;
  var chartPh = 280 - chartMt - chartMb;
  var chartMinP, chartMaxP;

  function buildChart() {
    var svg = document.getElementById("eqtChart");
    var allP = [];
    METHODS.forEach(function (m) { allP = allP.concat(m.psnrs); });
    chartMinP = Math.floor(Math.min.apply(null, allP) / 2) * 2;
    chartMaxP = Math.ceil(Math.max.apply(null, allP) / 2) * 2 + 2;

    chartSx = function (t) { return chartMl + (t / MAX_TIME) * chartPw; };
    chartSy = function (p) {
      return chartMt + (1 - (p - chartMinP) / (chartMaxP - chartMinP)) * chartPh;
    };

    var h = "";

    // Grid + Y-axis labels
    for (var p = chartMinP; p <= chartMaxP; p += 2) {
      var y = chartSy(p);
      h += '<line x1="' + chartMl + '" y1="' + y + '" x2="' + (chartMl + chartPw) + '" y2="' + y + '" class="grid-line"/>';
      h += '<text x="' + (chartMl - 6) + '" y="' + (y + 3.5) + '" class="axis-label" text-anchor="end">' + p + "</text>";
    }

    // X-axis ticks
    for (var t = 0; t <= MAX_TIME + 100; t += 1000) {
      var x = chartSx(t);
      h += '<line x1="' + x + '" y1="' + (chartMt + chartPh) + '" x2="' + x + '" y2="' + (chartMt + chartPh + 5) + '" stroke="#94a3b8" stroke-width="1"/>';
      h += '<text x="' + x + '" y="' + (chartMt + chartPh + 18) + '" class="axis-label" text-anchor="middle">' + (t >= 1000 ? t / 1000 + "k" : t) + "</text>";
    }

    // Border + axis titles
    h += '<rect x="' + chartMl + '" y="' + chartMt + '" width="' + chartPw + '" height="' + chartPh + '" class="plot-border"/>';
    h += '<text x="' + (chartMl + chartPw / 2) + '" y="' + (280 - 3) + '" class="axis-title" text-anchor="middle">Time (s)</text>';
    h += '<text x="14" y="' + (chartMt + chartPh / 2) + '" class="axis-title" text-anchor="middle" transform="rotate(-90,14,' + (chartMt + chartPh / 2) + ')">PSNR (dB)</text>';

    // Data curves
    METHODS.forEach(function (m) {
      var pts = "";
      for (var i = 0; i < NUM_FRAMES; i++) {
        pts += chartSx(m.times[i + 1]).toFixed(1) + "," + chartSy(m.psnrs[i]).toFixed(1) + " ";
      }
      h += '<polyline class="curve" points="' + pts.trim() + '" stroke="' + m.color + '"/>';
    });

    // Time cursor
    h += '<line id="eqtCurLine" class="cursor-line" x1="' + chartMl + '" y1="' + chartMt + '" x2="' + chartMl + '" y2="' + (chartMt + chartPh) + '"/>';
    METHODS.forEach(function (m, i) {
      h += '<circle id="eqtDot' + i + '" class="cursor-dot" r="5" fill="' + m.color + '" cx="' + chartMl + '" cy="' + (chartMt + chartPh) + '" style="display:none"/>';
    });

    // Legend
    var lx = chartMl + 6;
    var ly = chartMt + 6;
    METHODS.forEach(function (m, i) {
      var oy = ly + i * 16;
      h += '<rect x="' + lx + '" y="' + oy + '" width="12" height="10" rx="2" fill="' + m.color + '" opacity=".85"/>';
      h += '<text x="' + (lx + 16) + '" y="' + (oy + 9) + '" class="legend-label">' + m.label + "</text>";
    });

    svg.innerHTML = h;

    svg.addEventListener("click", function (ev) {
      var rect = svg.getBoundingClientRect();
      var svgX = ((ev.clientX - rect.left) / rect.width) * 400;
      var t = ((svgX - chartMl) / chartPw) * MAX_TIME;
      t = Math.max(0, Math.min(MAX_TIME, t));
      curTime = t;
      if (playing) togglePlay();
      render();
    });
  }

  function updateChart() {
    if (!chartSx) return;
    var x = chartSx(curTime);
    var cl = document.getElementById("eqtCurLine");
    if (cl) {
      cl.setAttribute("x1", x);
      cl.setAttribute("x2", x);
    }
    METHODS.forEach(function (m, i) {
      var dot = document.getElementById("eqtDot" + i);
      if (!dot) return;
      var fi = getFrameIndex(i, curTime);
      if (fi >= 0) {
        dot.setAttribute("cx", chartSx(m.times[fi + 1]));
        dot.setAttribute("cy", chartSy(m.psnrs[fi]));
        dot.style.display = "";
      } else {
        dot.style.display = "none";
      }
    });
  }

  // ── Playback ────────────────────────────────────────────────────

  function tick(ts) {
    if (!playing) return;
    if (lastTS !== null) {
      var dt = (ts - lastTS) / 1000;
      curTime += dt * speed;
      if (curTime >= MAX_TIME) {
        curTime = START_TIME;
        prevFrames = prevFrames.map(function () { return -2; });
      }
      render();
    }
    lastTS = ts;
    requestAnimationFrame(tick);
  }

  function togglePlay() {
    playing = !playing;
    playBtn.innerHTML = playing ? "&#9646;&#9646;" : "&#9654;";
    if (playing) {
      if (curTime >= MAX_TIME) curTime = START_TIME;
      lastTS = null;
      requestAnimationFrame(tick);
    }
  }

  // ── Events ──────────────────────────────────────────────────────

  playBtn.addEventListener("click", togglePlay);

  slider.addEventListener("input", function () {
    curTime = parseFloat(slider.value);
    if (playing) togglePlay();
    render();
  });

  document.querySelectorAll("[data-eqt-speed]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-eqt-speed]").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      speed = parseInt(btn.dataset.eqtSpeed, 10);
    });
  });

  // ── Drag handle ─────────────────────────────────────────────────

  function startDrag(e) {
    e.preventDefault();
    handles[0].classList.add("active");

    function onMove(ev) {
      var rect = canvas.getBoundingClientRect();
      var cx   = ev.touches ? ev.touches[0].clientX : ev.clientX;
      var pct  = ((cx - rect.left) / rect.width) * 100;
      h0 = Math.max(10, Math.min(90, pct));
      render();
    }

    function onUp() {
      handles[0].classList.remove("active");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
  }

  handles[0].addEventListener("mousedown", startDrag);
  handles[0].addEventListener("touchstart", startDrag, { passive: false });

  // ── Autoplay on scroll into view ────────────────────────────────

  var observer = new IntersectionObserver(
    function (entries) {
      if (entries[0].isIntersecting && !playing && curTime === START_TIME) {
        togglePlay();
        observer.disconnect();
      }
    },
    { threshold: 0.4 }
  );
  observer.observe(canvas);

  // ── Initialise ──────────────────────────────────────────────────

  slider.max = MAX_TIME.toFixed(1);

  preload(imgPath(0, 0));

  buildChart();
  render();
})();
