// ─────────────────────────────────────────────
//  DATA  (loaded from data.json)
// ─────────────────────────────────────────────
// NOTE: Requires a web server (e.g. Herd, php -S, python -m http.server).
//       fetch() is blocked by browsers on file:// protocol.
let COURSES, PATHS, ALSO_EXPLORE;

fetch('data.json')
  .then(r => r.json())
  .then(data => {
    COURSES      = data.courses;
    PATHS        = data.paths;
    ALSO_EXPLORE = data.alsoExplore;
  })
  .catch(() => {
    document.querySelector('.page').innerHTML =
      '<p style="color:var(--orange);padding:48px 0;text-align:center">Failed to load course data.<br>Please serve this page from a web server.</p>';
  });

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
const state = { level: null, focus: null, goal: null, version: null };
let currentPath = null;

// ─────────────────────────────────────────────
//  UI LOGIC
// ─────────────────────────────────────────────
const STEPS = ['s0','s1','s2','s3','s4'];
let currentStep = 0;

function goTo(n) {
  // Validate before advancing
  if (n === 2 && !state.level) return;
  if (n === 3 && !state.focus) return;

  document.getElementById(STEPS[currentStep]).classList.remove('active');
  currentStep = n;
  document.getElementById(STEPS[n]).classList.add('active');

  // Progress bar
  const pct = [0, 15, 45, 72, 100][n];
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressWrap').classList.toggle('visible', n > 0);
  document.getElementById('restartBtn').classList.toggle('visible', n > 0);

  // Progress labels
  ['pl1','pl2','pl3','pl4'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.classList.remove('active','done');
    if (i + 1 === n) el.classList.add('active');
    if (i + 1 < n)   el.classList.add('done');
  });

  // Configure step 3 based on level
  if (n === 3) configureStep3();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function configureStep3() {
  const isUpgrader = state.level === 'upgrade';
  document.getElementById('s3-goals').style.display   = isUpgrader ? 'none' : 'block';
  document.getElementById('s3-version').style.display = isUpgrader ? 'block' : 'none';

  if (isUpgrader) {
    document.getElementById('s3q').textContent    = 'Which version are you coming from?';
    document.getElementById('s3hint').textContent = 'This helps us choose the right bridging course for you.';
  } else {
    document.getElementById('s3q').textContent    = 'How do you learn best?';
    document.getElementById('s3hint').textContent = 'Your path will be ordered and weighted accordingly.';
  }
}

function pick(card) {
  const group = card.dataset.group;
  document.querySelectorAll(`[data-group="${group}"]`).forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  state[group] = card.dataset.val;

  // Enable next buttons
  if (group === 'level') enableNext('next1');
  if (group === 'focus') enableNext('next2');
  if (group === 'goal')  enableNext('next3');
}

function pickVersion(pill) {
  document.querySelectorAll('.vpill').forEach(p => p.classList.remove('selected'));
  pill.classList.add('selected');
  state.version = pill.dataset.val;
  enableNext('next3');
}

function enableNext(id) {
  document.getElementById(id).classList.add('enabled');
}

function skipStep3() {
  state.goal = state.level === 'upgrade' ? null : 'fundamentals';
  buildPath();
}

function restart() {
  state.level = state.focus = state.goal = state.version = null;
  document.querySelectorAll('.opt-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.vpill').forEach(p => p.classList.remove('selected'));
  ['next1','next2','next3'].forEach(id => document.getElementById(id).classList.remove('enabled'));
  goTo(0);
}

document.getElementById('restartBtn').addEventListener('click', restart);

// ─────────────────────────────────────────────
//  PATH BUILDER
// ─────────────────────────────────────────────
function buildPath() {
  const { level, focus, goal, version } = state;
  let pathKey;

  if (level === 'upgrade') {
    if (version === '2.7')      pathKey = 'upgrade_from_27';
    else if (version === '2.8') pathKey = 'upgrade_from_28';
    else if (version === '3x')  pathKey = 'upgrade_from_3x';
    else                        pathKey = 'upgrade_from_28'; // default
  } else {
    // Build key from parts
    const lvl  = level === 'beginner' ? 'beginner' : 'some';
    const g    = goal || 'fundamentals';
    const key1 = `${focus}_${lvl}_${g}`;
    const key2 = `${focus}_${lvl}`;
    const key3 = `${focus}_some`;
    pathKey = PATHS[key1] ? key1 : PATHS[key2] ? key2 : PATHS[key3] ? key3 : null;
  }

  const path = PATHS[pathKey];
  if (!path) { alert('Could not generate path — please try different selections.'); return; }
  currentPath = path;

  // Build UI
  const titleParts = path.title.split('\n');
  document.getElementById('pathTitle').innerHTML = `${titleParts[0]}<br><span class="accent">${titleParts[1] || ''}</span>`;
  document.getElementById('pathSummary').textContent = path.summary;

  const alert = document.getElementById('versionAlert');
  if (path.versionNote) {
    alert.innerHTML = path.versionNote;
    alert.classList.add('show');
  } else {
    alert.classList.remove('show');
  }

  // Steps
  const stepsEl = document.getElementById('pathCourses');
  stepsEl.innerHTML = path.steps.map((step, i) => {
    const course = COURSES[step.id];
    if (!course) return '';
    const catHtml = course.cats.map(c => `<span class="cat-tag ${c === 'CORE' ? 'highlight' : ''}">${c}</span>`).join('');
    const verHtml = course.version ? `<span class="version-tag">${course.version}</span>` : '';
    return `
      <div class="path-step" style="animation-delay:${i * 80}ms">
        <div class="step-spine">
          <div class="step-dot">${i + 1}</div>
          <div class="step-line"></div>
        </div>
        <div>
          <a class="course-card" href="${course.url}" target="_blank" rel="noopener">
            <div class="course-meta">${catHtml}${verHtml}</div>
            <div class="course-title">${course.title}</div>
            <div class="course-desc">${course.desc}</div>
            <div class="course-why">→ ${step.why}</div>
            <span class="course-link-hint">↗</span>
          </a>
        </div>
      </div>`;
  }).join('');

  // Also explore
  const alsoArr = ALSO_EXPLORE[focus] || [];
  if (alsoArr.length) {
    const alsoEl = document.getElementById('alsoGrid');
    alsoEl.innerHTML = alsoArr.map(item => {
      const c = COURSES[item.id];
      if (!c) return '';
      return `
        <a class="also-card" href="${c.url}" target="_blank" rel="noopener">
          <span class="also-icon">${item.icon}</span>
          <div class="also-text">
            <div class="also-name">${c.title}</div>
            <div class="also-cats">${c.cats.join(' · ')}</div>
          </div>
        </a>`;
    }).join('');
    document.getElementById('secondarySection').style.display = 'block';
  } else {
    document.getElementById('secondarySection').style.display = 'none';
  }

  goTo(4);
}

function downloadPlan() {
  if (!currentPath) return;

  const title = currentPath.title.replace('\n', ' — ');
  let md = `# ${title}\n\n`;
  md += `${currentPath.summary}\n\n`;
  md += `## Your Learning Path\n\n`;

  currentPath.steps.forEach((step, i) => {
    const course = COURSES[step.id];
    if (!course) return;
    md += `### Step ${i + 1}: [${course.title}](${course.url})\n`;
    md += `${course.desc}\n\n`;
    md += `**Why this step:** ${step.why}\n\n`;
  });

  const alsoArr = ALSO_EXPLORE[state.focus] || [];
  if (alsoArr.length) {
    md += `## Also Worth Exploring\n\n`;
    alsoArr.forEach(item => {
      const c = COURSES[item.id];
      if (!c) return;
      md += `- [${c.title}](${c.url})\n`;
    });
    md += '\n';
  }

  md += `---\n*Generated by [CG Cookie Learning Path Finder](https://cgcookie.com)*\n`;

  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'my-blender-learning-path.md';
  a.click();
  URL.revokeObjectURL(a.href);
}
