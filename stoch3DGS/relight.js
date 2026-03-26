/* ================================================================
   Relighting Animation — Interactive Viewer
   ================================================================

   Animates relighting results under rotating environment lighting
   for multiple scenes and views.

   Dependencies: Expects DOM elements defined in index.html.
   Configuration is read from the RL_SCENES array set on
   window before this script loads.
*/

(function () {
  "use strict";

  // ── Configuration ───────────────────────────────────────────────
  // window.RL_SCENES is defined in index.html for easy editing.
  var SCENES    = window.RL_SCENES;
  var RL_FRAMES = 60;

  // ── State ───────────────────────────────────────────────────────
  var frame     = 0;
  var prevFrame = -1;
  var isPlaying = false;
  var fps       = 20;
  var timer     = null;
  var imgEls    = [];
  var cache     = {};

  // ── DOM refs ────────────────────────────────────────────────────
  var grid      = document.getElementById("rlGrid");
  var playBtn   = document.getElementById("rlPlay");
  var slider    = document.getElementById("rlSlider");
  var frameDisp = document.getElementById("rlFrame");

  // ── Build scene / view grid ─────────────────────────────────────

  SCENES.forEach(function (scene) {
    var row = document.createElement("div");
    row.className = "rl-scene";
    row.innerHTML = '<div class="rl-scene-label">' + scene.label + "</div>";

    scene.views.forEach(function (v, vi) {
      var base  = "stochGRT_results/" + scene.key + "/" + v.dir;
      var imgId = "rl-" + scene.key + "-" + v.dir;

      var pair = document.createElement("div");
      pair.className = "rl-pair";
      pair.innerHTML =
        '<div class="rl-pair-imgs">' +
          '<div class="rl-cell">' +
            '<span class="rl-tag">Reference</span>' +
            '<img src="' + base + "/gt/" + v.gt + '" alt="GT" draggable="false" />' +
          "</div>" +
          '<div class="rl-cell">' +
            '<span class="rl-tag">Relighted</span>' +
            '<img id="' + imgId + '" alt="Relight" draggable="false" />' +
          "</div>" +
        "</div>" +
        '<div class="rl-view-label">View ' + (vi + 1) + "</div>";

      row.appendChild(pair);
      imgEls.push({ el: null, id: imgId, base: base });
    });

    grid.appendChild(row);
  });

  imgEls.forEach(function (o) {
    o.el = document.getElementById(o.id);
  });

  // ── Helpers ─────────────────────────────────────────────────────

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function src(base, fi) {
    return base + "/renders/pred_rgb-" + pad(fi) + ".png";
  }

  function preloadFrame(fi) {
    imgEls.forEach(function (o) {
      var s = src(o.base, fi);
      if (!cache[s]) {
        var im = new Image();
        im.src = s;
        cache[s] = im;
      }
    });
  }

  // ── Render ──────────────────────────────────────────────────────

  function render() {
    if (prevFrame === frame) return;

    imgEls.forEach(function (o) {
      o.el.src = src(o.base, frame);
    });
    prevFrame = frame;

    preloadFrame((frame + 1) % RL_FRAMES);
    preloadFrame((frame + 2) % RL_FRAMES);

    slider.value = frame;
    var pct = (frame / (RL_FRAMES - 1)) * 100;
    slider.style.background =
      "linear-gradient(to right, var(--c-primary) " + pct + "%, #e2e8f0 " + pct + "%)";
    frameDisp.textContent = frame + " / " + (RL_FRAMES - 1);
  }

  // ── Playback ────────────────────────────────────────────────────

  function step() {
    frame = (frame + 1) % RL_FRAMES;
    render();
  }

  function toggle() {
    isPlaying = !isPlaying;
    playBtn.innerHTML = isPlaying ? "&#9646;&#9646;" : "&#9654;";
    if (isPlaying) {
      timer = setInterval(step, 1000 / fps);
    } else {
      clearInterval(timer);
      timer = null;
    }
  }

  // ── Events ──────────────────────────────────────────────────────

  playBtn.addEventListener("click", toggle);

  slider.addEventListener("input", function () {
    frame = parseInt(slider.value, 10);
    if (isPlaying) toggle();
    prevFrame = -1;
    render();
  });

  document.querySelectorAll("[data-rl-fps]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-rl-fps]").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      fps = parseInt(btn.dataset.rlFps, 10);
      if (isPlaying) {
        clearInterval(timer);
        timer = setInterval(step, 1000 / fps);
      }
    });
  });

  // ── Autoplay on scroll into view ────────────────────────────────

  var observer = new IntersectionObserver(
    function (entries) {
      if (entries[0].isIntersecting && !isPlaying) {
        toggle();
        observer.disconnect();
      }
    },
    { threshold: 0.3 }
  );
  observer.observe(grid);

  // ── Initialise ──────────────────────────────────────────────────

  preloadFrame(0);
  preloadFrame(1);
  render();
})();
